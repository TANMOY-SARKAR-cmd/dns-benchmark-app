const fs = require('fs');

const code = fs.readFileSync('frontend/src/lib/doh.ts', 'utf8');

const updatedType = code.replace(
  /method: "server" \| "client" \| "failed" \| "mixed";/,
  'method: "server" | "client" | "client-fallback" | "failed" | "mixed";'
);

// We need to extract the fallback logic to resolveClientDNS
const targetStart = `async function resolveDNS(
  domain: string,
  provider: DoHProvider
): Promise<ResolveDNSResult> {`;

const targetReplacement = `async function resolveClientDNS(
  domain: string,
  provider: DoHProvider
): Promise<ResolveDNSResult> {
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
        method: "client-fallback",
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

export async function measureClientDoH(
  provider: DoHProvider,
  domain: string,
  retries = 3
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let verified = true;

  const startTime = performance.now();

  const promises = Array.from({ length: retries }).map(async () => {
    const res = await resolveClientDNS(domain, provider);

    if (res.success && res.latency !== null) {
      successCount++;
      latencies.push(res.latency);
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
      fallbackUsed: true,
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
    method: "client-fallback",
    fallbackUsed: true,
  };
}

async function resolveDNS(
  domain: string,
  provider: DoHProvider
): Promise<ResolveDNSResult> {`;

const startIdx = updatedType.indexOf(targetStart);
if (startIdx === -1) {
  console.error("Could not find start");
  process.exit(1);
}

const withNewFunctions = updatedType.substring(0, startIdx) + targetReplacement + updatedType.substring(startIdx + targetStart.length);

const fullReplacement = withNewFunctions.replace(
`  // Fallback to client DoH
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
  };`, `  return resolveClientDNS(domain, provider);`);


fs.writeFileSync('frontend/src/lib/doh.ts', fullReplacement);
console.log("Patched doh.ts successfully");
