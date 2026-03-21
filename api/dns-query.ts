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
  const DOH_ENDPOINTS: Record<string, string> = {
    google: "https://dns.google/resolve",
    cloudflare: "https://cloudflare-dns.com/dns-query",
    quad9: "https://dns.quad9.net/dns-query",
    adguard: "https://dns.adguard-dns.com/dns-query",
    opendns: "https://doh.opendns.com/dns-query"
  };

  try {
    let url = "";
    if (provider) {
        url = DOH_ENDPOINTS[provider.toLowerCase()];
    }

    // If custom DNS/IP is provided and no matching DoH endpoint exists, fail for now since the user only wanted DOH.
    // Or we can try to form a URL if customIp looks like a URL.
    if (!url && customIp && customIp.startsWith('http')) {
        url = customIp;
    }

    if (!url) {
      return {
        success: false,
        latency: null,
        provider,
        domain,
        method: "server",
        error: "Invalid provider or unsupported custom IP/DNS via DoH",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const start = Date.now();

    const response = await fetch(
      `${url}?name=${domain}&type=A`,
      {
        method: "GET",
        headers: { accept: "application/dns-json" },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: false,
        latency: null,
        provider,
        domain,
        method: "server"
      };
    }

    await response.json();

    const latency = Date.now() - start;

    return {
      success: true,
      latency,
      provider,
      domain,
      method: "server"
    };

  } catch (err: any) {
    return {
      success: false,
      latency: null,
      provider,
      domain,
      method: "server",
      error: err.name === 'AbortError' ? 'Timeout' : (err.message || 'Unknown error')
    };
  }
}
