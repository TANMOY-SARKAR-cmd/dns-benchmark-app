// api/dns-query.ts
// Vercel serverless function — Web Fetch API style (Request/Response).
// Supports single and batch DNS-over-HTTPS queries with concurrency limiting,
// per-request timeouts, a global timeout, and structured logging.

// ─── Constants ────────────────────────────────────────────────────────────────

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
const CHUNK_SIZE = 3;
const GLOBAL_TIMEOUT = 4500; // ms — safe under Vercel Hobby 10 s limit
const REQUEST_TIMEOUT = 2500; // ms — per individual DoH fetch

// ─── Types ────────────────────────────────────────────────────────────────────

interface DnsQuery {
  domain: string;
  provider: string;
}

interface DnsResult {
  domain: string;
  provider: string;
  latency: number | null;
  success: boolean;
  method: "server";
  error: string | null;
}

// ─── DNS resolver ─────────────────────────────────────────────────────────────

async function resolveDnsQuery(
  domain: string,
  provider: string
): Promise<DnsResult> {
  const base: Omit<DnsResult, "success" | "latency" | "error"> = {
    domain,
    provider,
    method: "server",
  };

  const url = DOH_ENDPOINTS[provider]; // already validated upstream

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const start = Date.now();

  try {
    const response = await fetch(
      `${url}?name=${encodeURIComponent(domain)}&type=A`,
      {
        method: "GET",
        headers: { accept: "application/dns-json" },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ...base,
        success: false,
        latency: null,
        error: `HTTP ${response.status}`,
      };
    }

    await response.json(); // consume body; we only need the RTT
    const latency = Date.now() - start;

    return { ...base, success: true, latency, error: null };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ...base,
      success: false,
      latency: null,
      error: isAbort ? "Timeout" : String(err),
    };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  // 1. OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 2. Method guard
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  // 3. Content-Type guard
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(
      JSON.stringify({ error: "Content-Type must be application/json" }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 4. Parse body
  let body: unknown;
  try {
    body = await req.json();
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
    if (
      typeof q.provider !== "string" ||
      !VALID_PROVIDERS.includes(q.provider.toLowerCase())
    ) {
      return new Response(
        JSON.stringify({
          error: `queries[${i}].provider must be one of: ${VALID_PROVIDERS.join(", ")}`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Normalise provider to lowercase so DOH_ENDPOINTS lookup always hits
    queries[i] = {
      domain: q.domain.trim(),
      provider: q.provider.toLowerCase(),
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
      chunk.map(q => resolveDnsQuery(q.domain, q.provider))
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
          method: "server",
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
