import dnsPacket from "dns-packet";

export const config = {
  runtime: "edge",
};

const ALLOWED_PROVIDERS: Record<string, string> = {
  "Quad9": "https://dns9.quad9.net:5053/dns-query",
  "AdGuard": "https://dns.adguard-dns.com/dns-query",
  "OpenDNS": "https://doh.opendns.com/dns-query",
};

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const domain = url.searchParams.get("domain");
    const provider = url.searchParams.get("provider");

    if (!domain || !provider) {
      return new Response(JSON.stringify({ error: "Missing domain or provider" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_PROVIDERS[provider]) {
      return new Response(JSON.stringify({ error: "Provider not allowed for proxy" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const providerUrl = ALLOWED_PROVIDERS[provider];

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

    const start = performance.now();

    const response = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
        "Accept": "application/dns-message",
      },
      body: new Uint8Array(packet),
    });

    const latency = performance.now() - start;

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Provider returned status ${response.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await response.arrayBuffer();

    try {
      dnsPacket.decode(new Uint8Array(buffer) as any);
      return new Response(JSON.stringify({
        latency,
        success: true,
        verified: true
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Don't cache in browser to ensure accurate latency measurement on each call
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Failed to decode response" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
