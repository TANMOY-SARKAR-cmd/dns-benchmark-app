import dns from "dns";

// DNS providers configuration
export const DNS_PROVIDERS = {
  "Google DNS": "8.8.8.8",
  "Cloudflare DNS": "1.1.1.1",
  OpenDNS: "208.67.222.222",
  "Quad9 DNS": "9.9.9.9",
  "AdGuard DNS": "94.140.14.14",
} as const;

export type DNSProvider = keyof typeof DNS_PROVIDERS;
export type DNSResult = Record<DNSProvider, number | string>;

// Promisified DNS lookup with timeout
async function resolveDomain(
  domain: string,
  nameserver: string,
  timeoutMs: number = 5000
): Promise<number | string> {
  return new Promise(resolve => {
    const resolver = new dns.Resolver();
    resolver.setServers([nameserver]);

    const timeoutHandle = setTimeout(() => {
      resolve("Timeout");
    }, timeoutMs);

    const startTime = performance.now();
    resolver.resolve4(domain, (err: Error | null) => {
      clearTimeout(timeoutHandle);
      if (err) {
        resolve("Error");
      } else {
        const endTime = performance.now();
        resolve(Math.round(endTime - startTime));
      }
    });
  });
}

// Test a single domain across all DNS providers
export async function testDomain(
  domain: string,
  onProgress?: (provider: DNSProvider, result: number | string) => void
): Promise<DNSResult> {
  const results: DNSResult = {} as DNSResult;

  // Run tests concurrently
  const promises = Object.entries(DNS_PROVIDERS).map(
    async ([provider, nameserver]) => {
      const result = await resolveDomain(domain, nameserver);
      results[provider as DNSProvider] = result;
      if (onProgress) {
        onProgress(provider as DNSProvider, result);
      }
    }
  );

  await Promise.all(promises);
  return results;
}

// Test multiple domains
export async function testDomains(
  domains: string[],
  onProgress?: (
    completed: number,
    total: number,
    domain: string,
    provider: DNSProvider
  ) => void
): Promise<Record<string, DNSResult>> {
  const results: Record<string, DNSResult> = {};
  let completed = 0;
  const total = domains.length * Object.keys(DNS_PROVIDERS).length;

  for (const domain of domains) {
    results[domain] = await testDomain(domain, (provider, result) => {
      completed++;
      if (onProgress) {
        onProgress(completed, total, domain, provider);
      }
    });
  }

  return results;
}
