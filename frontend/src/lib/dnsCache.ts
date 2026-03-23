export interface CachedDnsResult {
  latency: number | null;
  success: boolean;
  method: "server-udp" | "server-doh" | "fallback" | "failed";
  error: string | null;
  timestamp: number;
}

const CACHE_KEY = "dns_cache";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedDnsResult(domain: string, provider: string): CachedDnsResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cache: Record<string, CachedDnsResult> = JSON.parse(raw);
    const key = `${domain}:${provider}`;
    const entry = cache[key];

    if (!entry) return null;

    if (Date.now() - entry.timestamp > TTL_MS) {
      delete cache[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

export function setCachedDnsResult(domain: string, provider: string, result: Omit<CachedDnsResult, "timestamp">): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache: Record<string, CachedDnsResult> = raw ? JSON.parse(raw) : {};

    // Cleanup old entries
    const now = Date.now();
    for (const k in cache) {
      if (now - cache[k].timestamp > TTL_MS) {
        delete cache[k];
      }
    }

    cache[`${domain}:${provider}`] = { ...result, timestamp: now };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("Failed to write to DNS cache", e);
  }
}

export function clearDnsCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
