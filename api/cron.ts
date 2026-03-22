import { createClient } from "@supabase/supabase-js";
import dns from "node:dns";

const CORS_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

async function processMonitors(supabase: any) {
  const { data: monitors, error: fetchError } = await supabase.from('monitors').select('*').eq('is_active', true);
  if (fetchError || !monitors || monitors.length === 0) return 0;

  const resultsPayload: any[] = [];
  const testedAt = new Date().toISOString();
  let processed = 0;
  const now = Date.now();

  for (const monitor of monitors) {
    const intervalSecs = monitor.interval_seconds || 60;
    const lastRunTime = monitor.last_run_at ? new Date(monitor.last_run_at).getTime() : 0;

    // Only run if the interval has elapsed
    if (now - lastRunTime < intervalSecs * 1000) {
      continue;
    }

    const domains = Array.isArray(monitor.domains) ? monitor.domains : [];
    const providers = Array.isArray(monitor.providers) ? monitor.providers : [];

    const queries = [];
    for (const d of domains) {
      for (const p of providers) {
        if (typeof d === 'string' && typeof p === 'string') {
           queries.push({ domain: d, provider: p });
        }
      }
    }

    if (queries.length === 0) continue;

    const settled = await Promise.allSettled(
      queries.map(q => resolveDnsQuery(q.domain, q.provider))
    );

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
        user_id: monitor.user_id,
        monitor_id: monitor.id,
        domain: resData.domain,
        provider: resData.provider,
        latency_ms: resData.latency,
        success: resData.success,
        method: resData.method,
        error: resData.error,
        tested_at: testedAt,
        keep_forever: false
      });
      processed++;
    }

    // Update last_run_at immediately to prevent duplicate runs
    await supabase.from('monitors').update({ last_run_at: testedAt }).eq('id', monitor.id).single();
  }

  if (resultsPayload.length > 0) {
    await supabase.from('monitor_results').insert(resultsPayload);
  }
  return processed;
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

  // Run first batch
  let totalProcessed = await processMonitors(supabase);


  return new Response(JSON.stringify({ message: "Cron executed successfully", processed: totalProcessed }), { status: 200, headers: CORS_HEADERS });
}
