import dns from "node:dns";
import dnsPacket from "dns-packet";

export const maxDuration = 15; // seconds


// api/dns-query.ts
// Vercel serverless function — Web Fetch API style (Request/Response).
// Supports single and batch DNS-over-HTTPS queries with concurrency limiting,
// per-request timeouts, a global timeout, and structured logging.

// ─── Constants

const DNS_IPS: Record<string, string> = {
  google: "8.8.8.8",
  cloudflare: "1.1.1.1",
  quad9: "9.9.9.9",
  adguard: "94.140.14.14",
  opendns: "208.67.222.222",
};

function resolveWithNativeDNS(
  domain: string,
  nameserver: string,
  timeoutMs = 500,
  recordType: "A" | "AAAA" = "A"
): Promise<number | null> {
  return new Promise(resolve => {
    const resolver = new dns.Resolver();
    resolver.setServers([nameserver]);

    const start = Date.now();

    const timeout = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    const resolveMethod = recordType === "AAAA" ? resolver.resolve6.bind(resolver) : resolver.resolve4.bind(resolver);
    resolveMethod(domain, err => {
      clearTimeout(timeout);
      if (err) {
        resolve(null);
      } else {
        resolve(Date.now() - start);
      }
    });
  });
}

const CORS_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DOH_ENDPOINTS: Record<string, string> = {
  google: "https://dns.google/resolve",
  cloudflare: "https://cloudflare-dns.com/dns-query",
  quad9: "https://dns.quad9.net/dns-query",
  adguard: "https://dns.adguard-dns.com/dns-query",
  opendns: "https://doh.opendns.com/dns-query",
};

const VALID_PROVIDERS = Object.keys(DOH_ENDPOINTS);

const MAX_BATCH_SIZE = 10;
const CHUNK_SIZE = 10;
const GLOBAL_TIMEOUT = 8000; // ms — safe under Vercel Hobby 10 s limit
const REQUEST_TIMEOUT = 4000; // ms — per individual DoH fetch

export function validateCustomUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    // Block private IP ranges
    const hostname = parsed.hostname;
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipPattern);
    if (match) {
      const parts = match.slice(1, 5).map(Number);
      if (
        parts[0] === 127 ||
        parts[0] === 10 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      ) {
        return false;
      }
    }
    // Also block localhost just in case
    if (hostname === "localhost") return false;

    return true;
  } catch {
    return false; // Invalid URL
  }
}


// ─── Types ────────────────────────────────────────────────────────────────────

interface DnsQuery {
  domain: string;
  provider: string;
  customUrl?: string;
  recordType?: "A" | "AAAA";
}

interface DnsResult {
  domain: string;
  provider: string;
  latency: number | null;
  success: boolean;
  method: "server-udp" | "server-doh" | "fallback" | "failed";
  error: string | null;
}

// ─── DNS resolver ─────────────────────────────────────────────────────────────

async function resolveDnsQuery(
  domain: string,
  provider: string,
  customUrl?: string,
  recordType: "A" | "AAAA" = "A"
): Promise<DnsResult> {
  const base: Omit<DnsResult, "success" | "latency" | "error" | "method"> = {
    domain,
    provider,
  };

  const udpIp = DNS_IPS[provider];
  let method: DnsResult["method"] = "failed";

  if (udpIp) {
    const nativeLatency = await resolveWithNativeDNS(domain, udpIp, 500, recordType);
    if (nativeLatency !== null) {
      method = "server-udp";
      const result: DnsResult = {
        ...base,
        method,
        success: true,
        latency: nativeLatency,
        error: null,
      };
      if (process.env.DEBUG === "true") {
        console.log({ provider, method, latency: nativeLatency, success: true });
      }
      return result;
    }
  }

  const url = provider === "custom" && customUrl ? customUrl : DOH_ENDPOINTS[provider]; // already validated upstream

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const start = Date.now();

  try {
    let response;

    // Cloudflare, AdGuard, OpenDNS, Quad9 need binary format (via GET base64url). Google and Custom can use JSON.
    const useBinary = provider === "cloudflare" || provider === "quad9" || provider === "adguard" || provider === "opendns";

    if (useBinary) {
      const packet = dnsPacket.encode({
        type: "query",
        id: 0,
        flags: dnsPacket.RECURSION_DESIRED | dnsPacket.AUTHENTIC_DATA,
        questions: [{
          type: recordType,
          name: domain,
          class: "IN"
        }]
      });
      const base64Url = Buffer.from(packet).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      response = await fetch(
        `${url}?dns=${base64Url}`,
        {
          method: "GET",
          headers: { accept: "application/dns-message" },
          signal: controller.signal,
        }
      );
    } else {
      response = await fetch(
        `${url}?name=${encodeURIComponent(domain)}&type=${recordType}`,
        {
          method: "GET",
          headers: { accept: "application/dns-json" },
          signal: controller.signal,
        }
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      method = "failed";
      const result: DnsResult = {
        ...base,
        method,
        success: false,
        latency: null,
        error: `HTTP ${response.status}`,
      };
      if (process.env.DEBUG === "true") {
        console.log({ provider, method, latency: null, success: false });
      }
      return result;
    }

    if (useBinary) {
      await response.arrayBuffer(); // consume binary body
    } else {
      await response.json(); // consume JSON body
    }
    const latency = Date.now() - start;

    method = "server-doh";
    const result: DnsResult = {
      ...base,
      method,
      success: true,
      latency,
      error: null,
    };
    if (process.env.DEBUG === "true") {
      console.log({ provider, method, latency, success: true });
    }
    return result;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    method = "failed";
    const result: DnsResult = {
      ...base,
      method,
      success: false,
      latency: null,
      error: isAbort ? "Timeout" : String(err),
    };
    if (process.env.DEBUG === "true") {
      console.log({ provider, method, latency: null, success: false });
    }
    return result;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: Request) {
  // 3. Content-Type guard
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(
      JSON.stringify({ error: "Content-Type must be application/json" }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 4. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new Response(
      JSON.stringify({ error: "Request body must be a JSON object" }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const b = body as Record<string, unknown>;

  // 5. Normalise to a queries array
  let queries: DnsQuery[];

  if ("queries" in b) {
    if (!Array.isArray(b.queries)) {
      return new Response(
        JSON.stringify({ error: '"queries" must be an array' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (b.queries.length === 0) {
      return new Response(
        JSON.stringify({ error: '"queries" array must not be empty' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (b.queries.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
    queries = b.queries as DnsQuery[];
  } else if ("domain" in b && "provider" in b) {
    queries = [b as unknown as DnsQuery];
  } else {
    return new Response(
      JSON.stringify({
        error: "Body must contain { domain, provider } or { queries: [...] }",
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 6. Per-query field validation
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];

    if (typeof q.domain !== "string" || q.domain.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: `queries[${i}].domain must be a non-empty string`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (q.domain.length > 253) {
      return new Response(
        JSON.stringify({
          error: `queries[${i}].domain exceeds maximum length of 253`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (typeof q.provider !== "string") {
      return new Response(
        JSON.stringify({
          error: `queries[${i}].provider must be a string`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const providerLower = q.provider.toLowerCase();

    if (providerLower !== "custom" && !VALID_PROVIDERS.includes(providerLower)) {
      return new Response(
        JSON.stringify({
          error: `queries[${i}].provider must be "custom" or one of: ${VALID_PROVIDERS.join(", ")}`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (providerLower === "custom") {
      if (!q.customUrl || typeof q.customUrl !== "string") {
        return new Response(
          JSON.stringify({
            error: `queries[${i}].customUrl must be a string when provider is "custom"`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (!validateCustomUrl(q.customUrl)) {
        return new Response(
          JSON.stringify({
            error: `queries[${i}].customUrl is invalid or points to a private/local IP`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    } else if (providerLower === "custom" && (!q.customUrl || typeof q.customUrl !== "string")) {
      return new Response(
        JSON.stringify({
          error: `queries[${i}].customUrl must be a string when provider is "custom"`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Normalise provider to lowercase so DOH_ENDPOINTS lookup always hits
    queries[i] = {
      domain: q.domain.trim(),
      provider: providerLower,
      customUrl: q.customUrl,
      recordType: q.recordType === "AAAA" ? "AAAA" : "A",
    };
  }

  // 7. Batch processing — chunked concurrency + global timeout
  const startTime = Date.now();
  let timedOut = false;
  const results: DnsResult[] = [];

  outer: for (let i = 0; i < queries.length; i += CHUNK_SIZE) {
    // Check elapsed time before starting a new chunk
    if (Date.now() - startTime >= GLOBAL_TIMEOUT) {
      timedOut = true;
      break outer;
    }

    const chunk = queries.slice(i, i + CHUNK_SIZE);

    const settled = await Promise.allSettled(
      chunk.map(q => resolveDnsQuery(q.domain, q.provider, q.customUrl, q.recordType))
    );

    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        // resolveDnsQuery never rejects (all errors are caught internally);
        // this branch is a last-resort safety net.
        results.push({
          domain: "unknown",
          provider: "unknown",
          latency: null,
          success: false,
          method: "failed",
          error:
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason),
        });
      }
    }
  }

  // 8. Structured batch log (one line per request, never per DNS call)
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  console.log(
    JSON.stringify({
      type: "dns-batch",
      batchSize: queries.length,
      duration: Date.now() - startTime,
      timedOut,
      successCount,
      failureCount,
    })
  );

  // 9. Response — always 200; frontend inspects each result's success field
  return new Response(JSON.stringify({ results, timedOut }), {
    status: 200,
    headers: CORS_HEADERS,
  });
}
