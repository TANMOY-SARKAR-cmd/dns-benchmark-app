export const config = { runtime: "nodejs" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.json();

    if (body.queries && Array.isArray(body.queries)) {
      const globalTimeout = new Promise(resolve =>
        setTimeout(() => resolve("timeout"), 4000)
      );

      const dnsPromises = body.queries.map((q: any) =>
        resolveDnsQuery(q.domain, q.provider, q.customIp)
      );

      const results = await Promise.race([
        Promise.allSettled(dnsPromises),
        globalTimeout
      ]);

      if (results === "timeout") {
        return new Response(JSON.stringify({ success: false, error: "Batch timeout" }), { status: 200 });
      }

      const formatted = (results as PromiseSettledResult<any>[]).map(r =>
        r.status === "fulfilled"
          ? r.value
          : { success: false, latency: null, method: "server" }
      );

      return new Response(JSON.stringify({ results: formatted }), { status: 200 });
    }

    const { domain, provider, customDns, customIp } = body;
    const result = await resolveDnsQuery(domain, provider, customDns || customIp);

    return new Response(JSON.stringify(result), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      latency: null,
      method: "server",
      error: err.message
    }), { status: 200 });
  }
}

async function resolveDnsQuery(domain: string, provider: string, customIp?: string) {
  const DOH: Record<string, string> = {
    google: "https://dns.google/resolve",
    cloudflare: "https://cloudflare-dns.com/dns-query",
    quad9: "https://dns.quad9.net/dns-query",
    adguard: "https://dns.adguard-dns.com/dns-query",
    opendns: "https://doh.opendns.com/dns-query"
  };

  try {
    let url = DOH[provider?.toLowerCase()];
    if (!url && customIp && customIp.startsWith("http")) url = customIp;
    if (!url) return { success: false, latency: null, provider, domain, method: "server" };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const start = Date.now();

    const res = await fetch(`${url}?name=${domain}&type=A`, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!res.ok) return { success: false, latency: null, provider, domain, method: "server" };

    await res.json();

    return {
      success: true,
      latency: Date.now() - start,
      provider,
      domain,
      method: "server"
    };

  } catch {
    return { success: false, latency: null, provider, domain, method: "server" };
  }
}
