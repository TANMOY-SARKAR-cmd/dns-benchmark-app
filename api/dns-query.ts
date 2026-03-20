import { promises as dns } from "node:dns";

const PROVIDER_IPS: Record<string, string> = {
  "Google": "8.8.8.8",
  "Cloudflare": "1.1.1.1",
  "Quad9": "9.9.9.9",
  "AdGuard": "94.140.14.14",
  "OpenDNS": "208.67.222.222",
};

export default async function handler(req: Request) {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let domain = "unknown";
  let provider = "unknown";

  try {
    const body = await req.json();
    domain = body.domain;
    provider = body.provider;

    if (!domain || !provider) {
      return new Response(JSON.stringify({ error: "Missing domain or provider" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ip = PROVIDER_IPS[provider];
    if (!ip) {
      return new Response(JSON.stringify({ error: "Invalid provider" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({
      success: true,
      latency,
      provider,
      domain
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      latency: null,
      provider,
      domain,
      error: error.message || "Internal server error"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
