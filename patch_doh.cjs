const fs = require('fs');

const path = 'frontend/src/lib/doh.ts';
let code = fs.readFileSync(path, 'utf8');

// Insert fetchWithTimeout helper after imports and type definitions
const helper = `

async function fetchWithTimeout(url: string | URL, options: RequestInit, timeoutMs = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const response = await fetch(url, { signal: controller.signal, ...options });
    const latency = performance.now() - start;
    clearTimeout(timeout);
    return { response, latency };
  } catch (err) {
    clearTimeout(timeout);
    return { response: null, latency: null };
  }
}
`;

code = code.replace('type MethodResult = {', helper + '\ntype MethodResult = {');

// Update jsonQuery
code = code.replace(
  /async function jsonQuery[\s\S]*?return \{ latency: 0, success: false, verified: false \};\n\}/,
`async function jsonQuery(
  provider: DoHProvider,
  domain: string
): Promise<MethodResult> {
  try {
    const url = new URL(provider.url);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", "A");

    const { response, latency } = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
      },
    });

    if (response && latency !== null && response.ok) {
      await response.json();
      return {
        latency,
        success: true,
        verified: true,
      };
    }
  } catch (e) {
    // Ignore error
  }
  return { latency: 0, success: false, verified: false };
}`
);

// Update binaryGetQuery
code = code.replace(
  /async function binaryGetQuery[\s\S]*?return \{ latency: 0, success: false, verified: false \};\n\}/,
`async function binaryGetQuery(
  provider: DoHProvider,
  domain: string
): Promise<MethodResult> {
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
      .replace(/\\+/g, "-")
      .replace(/\\//g, "_")
      .replace(/=+$/, "");

    const url = new URL(provider.url);
    url.searchParams.set("dns", base64url);

    const { response, latency } = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/dns-message",
      },
      mode: "no-cors",
    });

    if (response && latency !== null && (response.type === "opaque" || response.ok)) {
      return {
        latency,
        success: true,
        // If opaque, we can't verify the body, but network request succeeded
        verified: false,
      };
    }
  } catch (e) {
    // Ignore error
  }
  return { latency: 0, success: false, verified: false };
}`
);

// Update binaryPostQuery
code = code.replace(
  /async function binaryPostQuery[\s\S]*?return \{ latency: 0, success: false, verified: false \};\n\}/,
`async function binaryPostQuery(
  provider: DoHProvider,
  domain: string
): Promise<MethodResult> {
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

    const { response, latency } = await fetchWithTimeout(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
        Accept: "application/dns-message",
      },
      body: new Uint8Array(packet),
    });

    if (response && latency !== null && response.ok) {
      dnsPacket.decode(new Uint8Array(await response.arrayBuffer()) as any);
      return {
        latency,
        success: true,
        verified: true,
      };
    }
  } catch (e) {
    // Ignore error
  }
  return { latency: 0, success: false, verified: false };
}`
);

// Update retries = 4 to retries = 3
code = code.replace(/retries = 4/g, 'retries = 3');

fs.writeFileSync(path, code);
console.log('patched');
