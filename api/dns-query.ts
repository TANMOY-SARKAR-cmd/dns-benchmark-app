import dns from "node:dns/promises";

const PROVIDER_IPS: Record<string, string> = {
  Google: "8.8.8.8",
  Cloudflare: "1.1.1.1",
  Quad9: "9.9.9.9",
  AdGuard: "94.140.14.14",
  OpenDNS: "208.67.222.222",
};

export default async function handler(req: Request) {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Handle batched queries
    if (body.queries && Array.isArray(body.queries)) {
      const results = await Promise.all(
        body.queries.map(async (query: any) => {
          return await resolveDnsQuery(
            query.domain,
            query.provider,
            query.customIp
          );
        })
      );

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    // Handle single query
    const { domain, provider, customDns, customIp } = body;

    if (!domain || (!provider && !customDns && !customIp)) {
      return new Response(
        JSON.stringify({ error: "Missing domain or provider" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = await resolveDnsQuery(domain, provider, customDns || customIp);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        latency: null,
        method: "server",
        error: error.message || "Internal server error",
      }),
      {
        status: 200, // Returning 200 with success: false as requested
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function resolveDnsQuery(
  domain: string,
  provider: string,
  customIp?: string
) {
  try {
    const ip = customIp || PROVIDER_IPS[provider] || PROVIDER_IPS[provider?.toLowerCase()] || PROVIDER_IPS[provider?.charAt(0).toUpperCase() + provider?.slice(1).toLowerCase()];

    if (!ip) {
      return {
        success: false,
        latency: null,
        provider,
        domain,
        method: "server",
        error: "Invalid provider",
      };
    }

    const resolver = new dns.Resolver();
    resolver.setServers([ip]);

    const start = Date.now();

    await Promise.race([
      resolver.resolve4(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 2000)
      ),
    ]);

    const latency = Date.now() - start;

    return {
      success: true,
      latency,
      provider,
      domain,
      method: "server",
    };
  } catch (error: any) {
    return {
      success: false,
      latency: null,
      provider,
      domain,
      method: "server",
      error: error.message || "Resolution failed",
    };
  }
}
