import dnsPacket from "dns-packet";
import { Buffer } from "buffer";

export type DoHProvider = {
  name: string;
  url: string;
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
      if (provider.format === "json") {
        const url = new URL(provider.url);
        url.searchParams.set("name", domain);
        url.searchParams.set("type", "A");

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/dns-json",
          },
        });

        if (response.ok) {
          await response.json();
          successCount++;
          latencies.push(performance.now() - qStartTime);
        }
      } else if (provider.format === "binary") {
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

        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/dns-message",
            Accept: "application/dns-message",
          },
          body: new Uint8Array(packet),
        });

        if (response.ok) {
          dnsPacket.decode(Buffer.from(await response.arrayBuffer()));
          successCount++;
          latencies.push(performance.now() - qStartTime);
        }
      }
    } catch (e) {
      // Ignore individual failures so they don't break the whole test
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
  };
}
