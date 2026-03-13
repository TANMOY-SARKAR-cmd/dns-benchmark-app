import dns from 'dns';
import dgram from 'dgram';
import { DNS_PROVIDERS, testDomains } from './dns';

interface DnsCache {
  [key: string]: {
    result: string[];
    expiresAt: number;
  };
}

interface ProxyConfig {
  port: number;
  cacheTtl: number;
  fastestProvider: string;
}

/**
 * DNS Proxy Server that routes queries to the fastest DNS provider
 * Similar to Pi-hole functionality
 */
export class DnsProxyServer {
  private server: dgram.Socket | null = null;
  private cache: DnsCache = {};
  private config: ProxyConfig;

  /**
   * Update proxy configuration at runtime
   */
  updateConfig(updates: Partial<ProxyConfig>): void {
    Object.assign(this.config, updates);
  }
  private queryStats = {
    total: 0,
    cached: 0,
    failed: 0,
    totalTime: 0,
  };

  constructor(config: Partial<ProxyConfig> = {}) {
    this.config = {
      port: config.port || 53,
      cacheTtl: config.cacheTtl || 3600,
      fastestProvider: config.fastestProvider || 'Google DNS',
    };
  }

  /**
   * Start the DNS proxy server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = dgram.createSocket('udp4');

      this.server.on('message', (msg, rinfo) => {
        this.handleDnsQuery(msg, rinfo);
      });

      this.server.on('error', (err) => {
        console.error('DNS Proxy Server error:', err);
        reject(err);
      });

      this.server.bind(this.config.port, () => {
        console.log(`DNS Proxy Server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the DNS proxy server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('DNS Proxy Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming DNS query
   */
  private async handleDnsQuery(msg: Buffer, rinfo: dgram.RemoteInfo): Promise<void> {
    try {
      const domain = this.parseDnsQuery(msg);
      
      if (!domain) {
        return;
      }

      // Check cache first
      const cached = this.getFromCache(domain);
      if (cached) {
        this.queryStats.cached++;
        const response = this.buildDnsResponse(msg, cached);
        this.server?.send(response, 0, response.length, rinfo.port, rinfo.address);
        return;
      }

      // Query the fastest provider
      const result = await this.queryFastestProvider(domain);
      
      if (result) {
        this.setCache(domain, result);
        const response = this.buildDnsResponse(msg, result);
        this.server?.send(response, 0, response.length, rinfo.port, rinfo.address);
      }

      this.queryStats.total++;
    } catch (error) {
      console.error('Error handling DNS query:', error);
      this.queryStats.failed++;
    }
  }

  /**
   * Parse domain from DNS query packet
   */
  private parseDnsQuery(msg: Buffer): string | null {
    try {
      // Simple DNS packet parsing (question section)
      // DNS packet structure: header (12 bytes) + questions
      if (msg.length < 12) return null;

      let offset = 12;
      let domain = '';

      while (offset < msg.length && msg[offset] !== 0) {
        const length = msg[offset];
        offset++;

        if (offset + length > msg.length) break;

        if (domain) domain += '.';
        domain += msg.toString('utf8', offset, offset + length);
        offset += length;
      }

      return domain || null;
    } catch {
      return null;
    }
  }

  /**
   * Query the fastest DNS provider
   */
  private queryFastestProvider(domain: string): Promise<string[] | null> {
    return new Promise((resolve) => {
      const provider = DNS_PROVIDERS[this.config.fastestProvider as keyof typeof DNS_PROVIDERS];
      
      if (!provider) {
        resolve(null);
        return;
      }

      const resolver = new dns.Resolver();
      resolver.setServers([provider]);
      // Set timeout via options in resolve4 call

      resolver.resolve4(domain, (err, addresses) => {
        if (err) {
          resolve(null);
        } else {
          resolve(addresses || null);
        }
      });
    });
  }

  /**
   * Build DNS response packet
   */
  private buildDnsResponse(query: Buffer, addresses: string[]): Buffer {
    // Simplified DNS response - in production, use a proper DNS library
    // This is a placeholder that returns the query as-is for demonstration
    return query;
  }

  /**
   * Get result from cache
   */
  private getFromCache(domain: string): string[] | null {
    const cached = this.cache[domain];
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      delete this.cache[domain];
      return null;
    }

    return cached.result;
  }

  /**
   * Set result in cache
   */
  private setCache(domain: string, result: string[]): void {
    this.cache[domain] = {
      result,
      expiresAt: Date.now() + this.config.cacheTtl * 1000,
    };
  }

  /**
   * Update fastest provider based on benchmark results
   */
  async updateFastestProvider(domains: string[]): Promise<string> {
    const results = await testDomains(domains);
    
    let fastestProvider = 'Google DNS';
    let fastestTime = Infinity;

    Object.values(results).forEach((domainResults) => {
      Object.entries(domainResults).forEach(([provider, time]) => {
        if (typeof time === 'number' && time < fastestTime) {
          fastestTime = time;
          fastestProvider = provider;
        }
      });
    });

    this.config.fastestProvider = fastestProvider;
    return fastestProvider;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      ...this.queryStats,
      averageTime: this.queryStats.total > 0 
        ? Math.round(this.queryStats.totalTime / this.queryStats.total)
        : 0,
      cacheHitRate: this.queryStats.total > 0
        ? Math.round((this.queryStats.cached / this.queryStats.total) * 100)
        : 0,
      fastestProvider: this.config.fastestProvider,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return Object.keys(this.cache).length;
  }
}

// Singleton instance
let proxyInstance: DnsProxyServer | null = null;

export function getDnsProxy(): DnsProxyServer {
  if (!proxyInstance) {
    proxyInstance = new DnsProxyServer();
  }
  return proxyInstance;
}

export async function startDnsProxy(config?: Partial<ProxyConfig>): Promise<DnsProxyServer> {
  const proxy = new DnsProxyServer(config);
  await proxy.start();
  return proxy;
}

// Background benchmark management
const BENCHMARK_DOMAINS = ['google.com', 'github.com', 'cloudflare.com'];
const BENCHMARK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let benchmarkTimeout: ReturnType<typeof setTimeout> | null = null;
let benchmarkStopped = false;

export function startBackgroundBenchmark(
  proxy: DnsProxyServer,
  domains = BENCHMARK_DOMAINS,
  intervalMs = BENCHMARK_INTERVAL_MS
): void {
  if (benchmarkTimeout) return;
  benchmarkStopped = false;

  const schedule = async () => {
    if (benchmarkStopped) return;
    try {
      await proxy.updateFastestProvider(domains);
    } catch (err) {
      console.error('Background benchmark error:', err);
    }
    if (!benchmarkStopped) {
      benchmarkTimeout = setTimeout(schedule, intervalMs);
    }
  };

  benchmarkTimeout = setTimeout(schedule, intervalMs);
}

export function stopBackgroundBenchmark(): void {
  benchmarkStopped = true;
  if (benchmarkTimeout) {
    clearTimeout(benchmarkTimeout);
    benchmarkTimeout = null;
  }
}
