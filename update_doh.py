import re

with open('frontend/src/lib/doh.ts', 'r') as f:
    content = f.read()

# Update ResolveDNSResult type
content = re.sub(
    r'export type ResolveDNSResult = \{[^}]+\};',
    '''export type ResolveDNSResult = {
  latency: number | null;
  success: boolean;
  verified: boolean;
  method: "server" | "client" | "failed" | "mixed";
  fallbackUsed: boolean;
  provider?: string;
};''',
    content
)

# Replace the resolveDNS function
old_resolveDNS = re.search(r'async function resolveDNS\(.*?\)\s*:\s*Promise<ResolveDNSResult>\s*\{.*?(?=\nexport async function measureDoHBatch)', content, re.DOTALL)

new_resolveDNS = '''async function resolveDNS(
  domain: string,
  provider: DoHProvider
): Promise<ResolveDNSResult> {
  // Try server first
  try {
    const res = await fetch("/api/dns-query", {
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
}'''

content = content[:old_resolveDNS.start()] + new_resolveDNS + content[old_resolveDNS.end():]

# Update measureDoH to handle null latencies properly
old_measureDoH = re.search(r'export async function measureDoH\(.*?\)\s*:\s*Promise<BenchmarkResult>\s*\{.*?(?=\Z)', content, re.DOTALL)

new_measureDoH = '''export async function measureDoH(
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
'''

if old_measureDoH:
    content = content[:old_measureDoH.start()] + new_measureDoH + content[old_measureDoH.end():]

with open('frontend/src/lib/doh.ts', 'w') as f:
    f.write(content)
