import dnsPacket from "dns-packet";

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
  verified: boolean;
};

type MethodResult = {
  latency: number;
  success: boolean;
  verified: boolean;
};

async function jsonQuery(
  provider: DoHProvider,
  domain: string
): Promise<MethodResult> {
  const startTime = performance.now();
  try {
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
      return {
        latency: performance.now() - startTime,
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
  const startTime = performance.now();
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

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/dns-message",
      },
      mode: "no-cors",
    });

    if (response.type === "opaque" || response.ok) {
      return {
        latency: performance.now() - startTime,
        success: true,
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
  const startTime = performance.now();
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

    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
        Accept: "application/dns-message",
      },
      body: new Uint8Array(packet),
    });

    if (response.ok) {
      dnsPacket.decode(new Uint8Array(await response.arrayBuffer()) as any);
      return {
        latency: performance.now() - startTime,
        success: true,
        verified: true,
      };
    }
  } catch (e) {
    // Ignore error
  }
  return { latency: 0, success: false, verified: false };
}

export async function measureDoH(
  provider: DoHProvider,
  domain: string,
  retries = 4
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let verified = true; // default to true, set to false if the successful method is unverified

  const startTime = performance.now();

  const promises = Array.from({ length: retries }).map(async () => {
    // Try methods in order: JSON -> Binary GET -> Binary POST
    let res = await jsonQuery(provider, domain);

    if (!res.success) {
      res = await binaryGetQuery(provider, domain);
    }

    if (!res.success) {
      res = await binaryPostQuery(provider, domain);
    }

    if (res.success) {
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
  };
}
