import { promises as dns } from "node:dns";

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
    const { domain, provider, customIp } = body;

    if (!domain || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing domain or provider" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = await resolveDnsQuery(domain, provider, customIp);

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
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
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
    const ip = customIp || PROVIDER_IPS[provider];

    if (!ip) {
      return {
        success: false,
        latency: null,
        provider,
        domain,
        method: "server",
        error: "Invalid provider and no custom IP supplied",
      };
    }

    const resolver = new dns.Resolver();
    resolver.setServers([ip]);

    const start = performance.now();

    const resolvePromise = resolver.resolve4(domain);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 2000);
    });

    await Promise.race([resolvePromise, timeoutPromise]);

    const latency = performance.now() - start;

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
