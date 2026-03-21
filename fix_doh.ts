import fs from "fs";
let content = fs.readFileSync("../frontend/src/lib/doh.ts", "utf-8");

content = content.replace(
  'export type DoHProvider = {\n  name: string;\n  url: string;\n  color: string;\n  format: "json" | "binary";\n};',
  'export type DoHProvider = {\n  name: string;\n  url: string;\n  customIp?: string;\n  color: string;\n  format: "json" | "binary";\n};'
);

content = content.replace(
  `    const url = new URL("/api/dns-query", window.location.origin);
    url.searchParams.set("domain", domain);
    url.searchParams.set("provider", provider.name);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });`,
  `    const url = new URL("/api/dns-query", window.location.origin);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain,
        provider: provider.name,
        customIp: provider.customIp,
      }),
      signal: controller.signal,
    });`
);

content = content.replace(
  `  // If timeout already reached during server try, fail early
  if (controller.signal.aborted) {
    return { latency: 0, success: false, verified: false, method: "client" };
  }

  // 2. Fallback to client multi-method racing`,
  `  // If timeout already reached during server try, fail early
  if (controller.signal.aborted) {
    return { latency: 0, success: false, verified: false, method: "client" };
  }

  // Custom provider without valid DoH url shouldn't race the client methods since they'll fail anyway
  if (provider.name === "Custom" && (!provider.url || !provider.url.startsWith("https://"))) {
     clearTimeout(timeoutId);
     return { latency: 0, success: false, verified: false, method: "client" };
  }

  // 2. Fallback to client multi-method racing`
);

const batchFunction = `export async function measureDoHBatch(
  domains: string[],
  provider: DoHProvider,
  retries = 3
): Promise<Record<string, BenchmarkResult>> {
  const results: Record<string, BenchmarkResult> = {};
  const allQueries: { domain: string; provider: string; customIp?: string }[] = [];

  for (let i = 0; i < retries; i++) {
    for (const domain of domains) {
      allQueries.push({ domain, provider: provider.name, customIp: provider.customIp });
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

        const domainResults: Record<string, { latencies: number[], successCount: number }> = {};
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
                avgLatency: Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length),
                minLatency: Math.round(Math.min(...stats.latencies)),
                maxLatency: Math.round(Math.max(...stats.latencies)),
                successRate: Math.round((stats.successCount / retries) * 100),
                queriesPerSec: Math.round(stats.successCount / totalTimeSec),
                verified: true,
                method: "server"
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
    } catch(err) {
      // ignore
    }
  }

  return results;
}

export async function measureDoH(`;

content = content.replace("export async function measureDoH(", batchFunction);

fs.writeFileSync("../frontend/src/lib/doh.ts", content);
