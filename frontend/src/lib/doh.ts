export type DoHProvider = {
  name: string;
  url: string;
  color: string;
};

export const DOH_PROVIDERS: DoHProvider[] = [
  {
    name: "Cloudflare",
    url: "https://cloudflare-dns.com/dns-query",
    color: "#f58220",
  },
  { name: "Google", url: "https://dns.google/resolve", color: "#4285f4" },
  { name: "Quad9", url: "https://dns.quad9.net/dns-query", color: "#9b2226" },
  {
    name: "AdGuard",
    url: "https://dns.adguard.com/dns-query",
    color: "#1bd185",
  },
  {
    name: "OpenDNS",
    url: "https://doh.opendns.com/dns-query",
    color: "#0053a0",
  },
];

export type BenchmarkResult = {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  queriesPerSec: number;
};

export async function measureDoH(
  provider: DoHProvider,
  domain: string,
  retries = 6
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let successCount = 0;

  const startTime = performance.now();

  const promises = Array.from({ length: retries }).map(async () => {
    const qStartTime = performance.now();
    try {
      const isGoogle = provider.name === "Google";
      const url = new URL(provider.url);
      url.searchParams.set("name", domain);
      if (isGoogle) {
        // Google uses /resolve directly
      } else {
        url.searchParams.set("type", "A");
      }

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/dns-json",
        },
      });

      if (response.ok) {
        successCount++;
        latencies.push(performance.now() - qStartTime);
      }
    } catch (e) {
      // Ignore
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
  };
}
