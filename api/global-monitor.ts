import { createClient } from "@supabase/supabase-js";
import dns from "node:dns";

const CORS_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const POPULAR_DOMAINS = [
  "google.com",
  "cloudflare.com",
  "amazon.com",
  "netflix.com",
  "facebook.com",
];

const MAIN_PROVIDERS = [
  "google",
  "cloudflare",
  "quad9",
  "adguard",
  "opendns",
];

const DOH_ENDPOINTS: Record<string, string> = {
  google: "https://dns.google/resolve",
  cloudflare: "https://cloudflare-dns.com/dns-query",
  quad9: "https://dns.quad9.net/dns-query",
  adguard: "https://dns.adguard-dns.com/dns-query",
  opendns: "https://doh.opendns.com/dns-query",
};

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
  timeoutMs = 2500
): Promise<number | null> {
  return new Promise(resolve => {
    const resolver = new dns.Resolver();
    resolver.setServers([nameserver]);

    const start = Date.now();
    const timeout = setTimeout(() => resolve(null), timeoutMs);

    resolver.resolve4(domain, err => {
      clearTimeout(timeout);
      if (err) resolve(null);
      else resolve(Date.now() - start);
    });
  });
}

interface DnsResult {
  domain: string;
  provider: string;
  latency: number | null;
  success: boolean;
  method: "server-udp" | "server-doh" | "fallback" | "failed";
  error: string | null;
}

async function resolveDnsQuery(
  domain: string,
  provider: string,
  customUrl?: string
): Promise<DnsResult> {
  const base: Omit<DnsResult, "success" | "latency" | "error" | "method"> = { domain, provider };
  const udpIp = DNS_IPS[provider];
  let method: DnsResult["method"] = "failed";

  if (udpIp) {
    const nativeLatency = await resolveWithNativeDNS(domain, udpIp);
    if (nativeLatency !== null) {
      method = "server-udp";
      return { ...base, method, success: true, latency: nativeLatency, error: null };
    }
  }

  const url = provider === "custom" && customUrl ? customUrl : DOH_ENDPOINTS[provider];
  if (!url) {
    return { ...base, method: "failed", success: false, latency: null, error: "Invalid provider" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  const start = Date.now();

  try {
    const response = await fetch(`${url}?name=${encodeURIComponent(domain)}&type=A`, {
      method: "GET",
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return { ...base, method: "failed", success: false, latency: null, error: `HTTP ${response.status}` };
    }
    await response.json();
    const latency = Date.now() - start;
    return { ...base, method: "server-doh", success: true, latency, error: null };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return { ...base, method: "failed", success: false, latency: null, error: isAbort ? "Timeout" : String(err) };
  }
}


export const maxDuration = 60;

export default async function handler(request: Request) {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !process.env.IS_DEV) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iayeyzsrhnqcesazsbrg.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env variables" }), { status: 500, headers: CORS_HEADERS });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const queries: { domain: string; provider: string }[] = [];
  for (const domain of POPULAR_DOMAINS) {
    for (const provider of MAIN_PROVIDERS) {
      queries.push({ domain, provider });
    }
  }

  const settled = await Promise.allSettled(
    queries.map(q => resolveDnsQuery(q.domain, q.provider))
  );

  const resultsPayload: any[] = [];
  const testedAt = new Date().toISOString();

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const q = queries[i];

    let resData: DnsResult;
    if (outcome.status === "fulfilled") {
      resData = outcome.value;
    } else {
      resData = {
        domain: q.domain,
        provider: q.provider,
        latency: null,
        success: false,
        method: "failed",
        error: String(outcome.reason)
      };
    }

    resultsPayload.push({
      user_id: "global-cron",
      domain: resData.domain,
      provider: resData.provider,
      latency_ms: resData.latency,
      success: resData.success,
      method: resData.method,
      error: resData.error,
      tested_at: testedAt,
      keep_forever: false
    });
  }

  let totalProcessed = 0;
  if (resultsPayload.length > 0) {
    const { error } = await supabase.from('benchmark_results').insert(resultsPayload);
    if (error) {
      console.error("Failed to insert global benchmark results:", error);
    } else {
      totalProcessed = resultsPayload.length;
    }
  }

  return new Response(JSON.stringify({ message: "Global cron executed successfully", processed: totalProcessed }), { status: 200, headers: CORS_HEADERS });
}
