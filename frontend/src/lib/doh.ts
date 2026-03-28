import dnsPacket from "dns-packet";

export type DoHProvider = {
  key: string;
  name: string;
  url: string;
  color: string;
  format: "json" | "binary";
};

export const DOH_PROVIDERS: DoHProvider[] = [
  {
    key: "cloudflare",
    name: "Cloudflare",
    url: "https://cloudflare-dns.com/dns-query",
    color: "#f58220",
    format: "binary",
  },
  {
    key: "google",
    name: "Google",
    url: "https://dns.google/resolve",
    color: "#4285f4",
    format: "json",
  },
  {
    key: "quad9",
    name: "Quad9",
    url: "https://dns.quad9.net/dns-query",
    color: "#9b2226",
    format: "binary",
  },
  {
    key: "adguard",
    name: "AdGuard",
    url: "https://dns.adguard-dns.com/dns-query",
    color: "#1bd185",
    format: "binary",
  },
  {
    key: "opendns",
    name: "OpenDNS",
    url: "https://doh.opendns.com/dns-query",
    color: "#0053a0",
    format: "binary",
  },
];

export type BenchmarkResult = {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  queriesPerSec: number;
  verified: boolean;
  method:
    | "server-udp"
    | "server-doh"
    | "fallback"
    | "failed";
};

async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit,
  timeoutMs = 2000
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...options,
    });
    const latency = performance.now() - start;
    clearTimeout(timeout);
    return { response, latency };
  } catch (err) {
    clearTimeout(timeout);
    return { response: null, latency: null };
  }
}

type MethodResult = {
  latency: number;
  success: boolean;
  verified: boolean;
};

async function jsonQuery(
  provider: DoHProvider,
  domain: string,
  recordType: "A" | "AAAA" = "A"
): Promise<MethodResult> {
  try {
    const url = new URL(provider.url);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", recordType);

    const { response, latency } = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
      },
    });

    if (response && latency !== null && response.ok) {
      await response.json();
      return {
        latency,
        success: true,
        verified: true,
      };
    }
  } catch (e) {
    // Ignore error
  }
  return { latency: 0, success: false, verified: false };
}

async function binaryGetQuery(
  provider: DoHProvider,
  domain: string,
  recordType: "A" | "AAAA" = "A"
): Promise<MethodResult> {
  try {
    const packet = dnsPacket.encode({
      type: "query",
      id: 0,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [
        {
          type: recordType,
          name: domain,
        },
      ],
    });

    // Convert packet to base64url
    const base64url = btoa(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(packet)))
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const url = new URL(provider.url);
    url.searchParams.set("dns", base64url);

    const { response, latency } = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/dns-message",
      },
      mode: "no-cors",
    });

    if (
      response &&
      latency !== null &&
      (response.type === "opaque" || response.ok)
    ) {
      return {
        latency,
        success: true,
        // If opaque, we can't verify the body, but network request succeeded
        verified: false,
      };
    }
  } catch (e) {
    // Ignore error
  }
  return { latency: 0, success: false, verified: false };
}

async function binaryPostQuery(
  provider: DoHProvider,
  domain: string,
  recordType: "A" | "AAAA" = "A"
): Promise<MethodResult> {
  try {
    const packet = dnsPacket.encode({
      type: "query",
      id: 0,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [
        {
          type: recordType,
          name: domain,
        },
      ],
    });

    const { response, latency } = await fetchWithTimeout(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
        Accept: "application/dns-message",
      },
      body: new Uint8Array(packet),
    });

    if (response && latency !== null && response.ok) {
      dnsPacket.decode(new Uint8Array(await response.arrayBuffer()) as any);
      return {
        latency,
        success: true,
        verified: true,
      };
    }
  } catch (e) {
    // Ignore error
  }
  return { latency: 0, success: false, verified: false };
}


export type DnsResult = {
  domain: string;
  provider: string;
  latency: number | null;
  success: boolean;
  method: "server-udp" | "server-doh" | "fallback" | "failed";
  error: string | null;
};

export type ResolveDNSResult = {
  latency: number | null;
  success: boolean;
  verified: boolean;
  method:
    | "server-udp"
    | "server-doh"
    | "fallback"
    | "failed";
  provider?: string;
};

async function resolveClientDNS(
  domain: string,
  provider: DoHProvider,
  recordType: "A" | "AAAA" = "A"
): Promise<ResolveDNSResult> {
  const isCustom = !DOH_PROVIDERS.some(p => p.name === provider.name);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    let failedCount = 0;
    const wrapMethod = async (fn: Promise<MethodResult>) => {
      const res = await fn;
      if (res.success) {
        return res;
      }
      failedCount++;
      if (failedCount === 2) {
        return { latency: null, success: false, verified: false };
      }
      return new Promise<MethodResult>(() => {});
    };

    const raceResult = await Promise.race([
      wrapMethod(jsonQuery(provider, domain, recordType)),
      wrapMethod(binaryGetQuery(provider, domain, recordType)),
      new Promise<MethodResult>((_, reject) => {
        const abortHandler = () => reject(new Error("Timeout"));
        if (controller.signal.aborted) {
          abortHandler();
        } else {
          controller.signal.addEventListener("abort", abortHandler);
        }
      }),
    ]);

    clearTimeout(timeoutId);

    if (raceResult.success) {
      return {
        ...raceResult,
        method: "fallback",
        provider: isCustom ? "custom" : provider.key,
      };
    }
  } catch (e) {
    // Ignore error
  }

  clearTimeout(timeoutId);
  return {
    latency: null,
    success: false,
    verified: false,
    method: "failed",
    provider: isCustom ? "custom" : provider.key,
  };
}

export async function measureClientDoH(
  provider: DoHProvider,
  domain: string,
  retries = 3,
  recordType: "A" | "AAAA" = "A"
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let verified = true;

  const startTime = performance.now();

  const promises = Array.from({ length: retries }).map(async () => {
    const res = await resolveClientDNS(domain, provider, recordType);

    if (res.success) {
      successCount++;
      if (res.latency !== null) {
        latencies.push(res.latency);
      }
      if (!res.verified) {
        verified = false;
      }
    }
  });

  await Promise.all(promises);

  const endTime = performance.now();
  const totalTimeSec = (endTime - startTime) / 1000;

  if (successCount === 0) {
    return {
      avgLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      successRate: 0,
      queriesPerSec: 0,
      verified: false,
      method: "failed",
    };
  }

  return {
    avgLatency: Math.round(
      latencies.reduce((a, b) => a + b, 0) / latencies.length
    ),
    minLatency: Math.round(Math.min(...latencies)),
    maxLatency: Math.round(Math.max(...latencies)),
    successRate: Math.round((successCount / retries) * 100),
    queriesPerSec: Math.round(successCount / totalTimeSec),
    verified: verified,
    method: "fallback",
  };
}

async function resolveDNS(
  domain: string,
  provider: DoHProvider,
  recordType: "A" | "AAAA" = "A"
): Promise<ResolveDNSResult> {
  let serverResult: any = null;
  const isCustom = !DOH_PROVIDERS.some(p => p.name === provider.name);

  try {
    const res = await fetch(
      new URL("/api/dns-query", window.location.origin).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          provider: isCustom ? "custom" : provider.key,
          customUrl: isCustom ? provider.url : undefined,
          recordType,
        }),
      }
    );

    const data = await res.json();
    if (data.results && data.results.length > 0) {
      serverResult = data.results[0];
    }
  } catch (e) {
    // Ignore server error
  }

  if (serverResult && serverResult.success === true) {
    // Use server result
    return {
      latency: serverResult.latency,
      success: true,
      verified: true,
      method: serverResult.method === "server-udp" ? "server-udp" : "server-doh",
      provider: isCustom ? "custom" : provider.key,
    };
  } else {
    // Only then run client fallback
    const clientResult = await resolveClientDNS(domain, provider, recordType);

    if (clientResult.success) {
      return {
        ...clientResult,
        method: "fallback",
        provider: isCustom ? "custom" : provider.key,
      };
    } else {
      return {
        success: false,
        latency: null,
        verified: false,
        method: "failed",
        provider: isCustom ? "custom" : provider.key,
      };
    }
  }
}
export async function measureDoHBatch(
  domains: string[],
  provider: DoHProvider,
  retries = 3,
  recordType: "A" | "AAAA" = "A"
): Promise<Record<string, BenchmarkResult>> {
  const results: Record<string, BenchmarkResult> = {};
  const allQueries: { domain: string; provider: string }[] = [];

  const isCustom = !DOH_PROVIDERS.some(p => p.name === provider.name);

  for (let i = 0; i < retries; i++) {
    for (const domain of domains) {
      allQueries.push({
        domain,
        provider: isCustom ? "custom" : provider.key,
        ...(isCustom ? { customUrl: provider.url } : {}),
        recordType,
      } as any);
    }
  }

  try {
    const url = new URL("/api/dns-query", typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const start = performance.now();

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ queries: allQueries }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.results && Array.isArray(data.results)) {
        const endTime = performance.now();
        const totalTimeSec = (endTime - start) / 1000;

        const domainResults: Record<
          string,
          { latencies: number[]; successCount: number; method?: string }
        > = {};
        for (const domain of domains) {
          domainResults[domain] = {
            latencies: [],
            successCount: 0,
            method: undefined,
          };
        }

        for (const res of (data.results as DnsResult[])) {
          if (res.success === true && res.domain) {
            if (typeof res.latency === "number") {
              domainResults[res.domain].latencies.push(res.latency);
            }
            domainResults[res.domain].successCount++;
            if (!domainResults[res.domain].method)
              domainResults[res.domain].method = res.method;
          }
        }

        for (const domain of domains) {
          const stats = domainResults[domain];
          if (stats.successCount > 0) {
            results[domain] = {
              avgLatency: Math.round(
                stats.latencies.reduce((a, b) => a + b, 0) /
                  stats.latencies.length
              ),
              minLatency: Math.round(Math.min(...stats.latencies)),
              maxLatency: Math.round(Math.max(...stats.latencies)),
              successRate: Math.round((stats.successCount / retries) * 100),
              queriesPerSec: Math.round(stats.successCount / totalTimeSec),
              verified: true,
              method: stats.method as any,
            };
          }
        }
      }
    }
  } catch (e) {
    // Ignore server error
  }

  // Only run fallback for domains that were NOT successful on the server
  const missingDomains = domains.filter(d => !results[d] || results[d].successRate === 0);
  for (const domain of missingDomains) {
    try {
      const fallbackResult = await measureDoH(provider, domain, retries, recordType);
      if (fallbackResult && fallbackResult.method !== "failed") {
          results[domain] = {
              ...fallbackResult,
              method: "fallback",
          };
      } else {
          results[domain] = {
              avgLatency: 0,
              minLatency: 0,
              maxLatency: 0,
              successRate: 0,
              queriesPerSec: 0,
              verified: false,
              method: "failed",
          };
      }
    } catch (err) {
      results[domain] = {
          avgLatency: 0,
          minLatency: 0,
          maxLatency: 0,
          successRate: 0,
          queriesPerSec: 0,
          verified: false,
          method: "failed",
      };
    }
  }

  return results;
}

export async function measureDoH(
  provider: DoHProvider,
  domain: string,
  retries = 3,
  recordType: "A" | "AAAA" = "A"
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let verified = true;
  let finalMethod: any = "failed";

  const startTime = performance.now();

  const promises = Array.from({ length: retries }).map(async () => {
    const res = await resolveDNS(domain, provider, recordType);

    if (res.success) {
      successCount++;
      if (res.latency !== null) {
        latencies.push(res.latency);
      }
      if (!res.verified) {
        verified = false;
      }
      if (res.method && finalMethod === "failed") {
          finalMethod = res.method;
      } else if (res.method && res.method !== "fallback") {
          finalMethod = res.method;
      }
    }
  });

  await Promise.all(promises);

  const endTime = performance.now();
  const totalTimeSec = (endTime - startTime) / 1000;

  if (successCount === 0) {
    throw new Error(`All queries failed for ${provider.name}`);
  }

  return {
    avgLatency: Math.round(
      latencies.reduce((a, b) => a + b, 0) / latencies.length
    ),
    minLatency: Math.round(Math.min(...latencies)),
    maxLatency: Math.round(Math.max(...latencies)),
    successRate: Math.round((successCount / retries) * 100),
    queriesPerSec: Math.round(successCount / totalTimeSec),
    verified: verified,
    method: finalMethod as any,
  };
}
