import dnsPacket from "dns-packet";

export type DoHProvider = {
  name: string;
  url: string;
  customIp?: string;
  color: string;
  format: "json" | "binary";
};

export const DOH_PROVIDERS: DoHProvider[] = [
  {
    name: "Cloudflare",
    url: "https://cloudflare-dns.com/dns-query",
    color: "#f58220",
    format: "binary",
  },
  {
    name: "Google",
    url: "https://dns.google/resolve",
    color: "#4285f4",
    format: "json",
  },
  {
    name: "Quad9",
    url: "https://dns9.quad9.net:5053/dns-query",
    color: "#9b2226",
    format: "binary",
  },
  {
    name: "AdGuard",
    url: "https://dns.adguard-dns.com/dns-query",
    color: "#1bd185",
    format: "binary",
  },
  {
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
  method: "server" | "client" | "failed" | "mixed";
  fallbackUsed: boolean;
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
  domain: string
): Promise<MethodResult> {
  try {
    const url = new URL(provider.url);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", "A");

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
  domain: string
): Promise<MethodResult> {
  try {
    const packet = dnsPacket.encode({
      type: "query",
      id: 0,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [
        {
          type: "A",
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
  domain: string
): Promise<MethodResult> {
  try {
    const packet = dnsPacket.encode({
      type: "query",
      id: 0,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [
        {
          type: "A",
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

export type ResolveDNSResult = {
  latency: number | null;
  success: boolean;
  verified: boolean;
  method: "server" | "client" | "failed" | "mixed";
  fallbackUsed: boolean;
  provider?: string;
};

async function resolveDNS(
  domain: string,
  provider: DoHProvider
): Promise<ResolveDNSResult> {
  // Try server first
  try {
    const res = await fetch(new URL("/api/dns-query", window.location.origin).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, provider: provider.name, customIp: provider.customIp })
    });

    const data = await res.json();

    if (data.success) {
      return { ...data, provider: provider.name, fallbackUsed: false, verified: true };
    }
  } catch (e) {
    // Ignore server error, fallback to client
  }

  // Fallback to client DoH
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
      // Never resolve if it's not the last failure, wait for the other to finish or timeout
      return new Promise<MethodResult>(() => {});
    };

    const raceResult = await Promise.race([
      wrapMethod(jsonQuery(provider, domain)),
      wrapMethod(binaryGetQuery(provider, domain)),
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
        method: "client",
        fallbackUsed: true,
        provider: provider.name,
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
    fallbackUsed: true,
    provider: provider.name,
  };
}
export async function measureDoHBatch(
  domains: string[],
  provider: DoHProvider,
  retries = 3
): Promise<Record<string, BenchmarkResult>> {
  const results: Record<string, BenchmarkResult> = {};
  const allQueries: { domain: string; provider: string; customIp?: string }[] =
    [];

  for (let i = 0; i < retries; i++) {
    for (const domain of domains) {
      allQueries.push({
        domain,
        provider: provider.name,
        customIp: provider.customIp,
      });
    }
  }

  try {
    const url = new URL("/api/dns-query", window.location.origin);
    const start = performance.now();

    // We can't easily rely on abort controller for a batch since the server execution might be longer.
    // Instead we do normal fetch but no Promise.race. We just wait for server.
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
          { latencies: number[]; successCount: number }
        > = {};
        for (const domain of domains) {
          domainResults[domain] = { latencies: [], successCount: 0 };
        }

        for (const res of data.results) {
          if (res.success && res.domain && typeof res.latency === "number") {
            domainResults[res.domain].latencies.push(res.latency);
            domainResults[res.domain].successCount++;
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
              method: "server",
              fallbackUsed: false,
            };
          }
        }
      }
    }
  } catch (e) {
    // Fallback if batch server request fails
  }

  // For any domains that failed or weren't returned by batch, fallback to individual resolveDNS
  const missingDomains = domains.filter(d => !results[d]);
  for (const domain of missingDomains) {
    try {
      results[domain] = await measureDoH(provider, domain, retries);
    } catch (err) {
      // ignore
    }
  }

  return results;
}

export async function measureDoH(
  provider: DoHProvider,
  domain: string,
  retries = 3
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let verified = true;
  let usedServer = false;
  let usedClient = false;

  const startTime = performance.now();

  const promises = Array.from({ length: retries }).map(async () => {
    const res = await resolveDNS(domain, provider);

    if (res.success && res.latency !== null) {
      successCount++;
      latencies.push(res.latency);
      if (!res.verified) {
        verified = false;
      }
      if (res.method === "server") usedServer = true;
      if (res.method === "client") usedClient = true;
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
    method:
      usedServer && usedClient ? "mixed" : usedServer ? "server" : "client",
    fallbackUsed: usedClient || (usedClient && usedServer),
  };
}
