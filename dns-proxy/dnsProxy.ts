import dgram from "dgram";
import dnsPacket from "dns-packet";
import { DNS_PROVIDERS, testDomains } from "./dns";
import { logDnsQuery } from "../shared/services/queryLogger";
import { incrementProxyStat } from "../shared/services/proxyStats";
import { logBenchmarkResult } from "../shared/services/benchmarkLogger";

interface DnsCache {
  [key: string]: {
    result: Buffer;
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
  public config: ProxyConfig;
  private queryStats = {
    total: 0,
    cached: 0,
    failed: 0,
    totalTime: 0,
  };

  constructor(config: Partial<ProxyConfig> = {}) {
    this.config = {
      port: config.port || 5353,
      cacheTtl: config.cacheTtl || 3600,
      fastestProvider: config.fastestProvider || "Google DNS",
    };
  }

  /**
   * Start the DNS proxy server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = dgram.createSocket("udp4");

      this.server.on("message", (msg, rinfo) => {
        this.handleDnsQuery(msg, rinfo);
      });

      this.server.on("error", err => {
        console.error("DNS Proxy Server error:", err);
        reject(err);
      });

      // Bind to localhost only to prevent open resolver abuse
      this.server.bind(this.config.port, "127.0.0.1", () => {
        console.log(
          `DNS Proxy Server listening on 127.0.0.1:${this.config.port}`
        );
        resolve();
      });
    });
  }

  /**
   * Stop the DNS proxy server
   */
  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          console.log("DNS Proxy Server stopped");
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
  private async handleDnsQuery(
    msg: Buffer,
    rinfo: dgram.RemoteInfo
  ): Promise<void> {
    try {
      let packet;
      try {
        packet = dnsPacket.decode(msg);
      } catch (err) {
        console.error("Failed to decode DNS packet:", err);
        return;
      }

      const domain =
        packet.questions && packet.questions[0]
          ? packet.questions[0].name
          : null;
      const type =
        packet.questions && packet.questions[0]
          ? packet.questions[0].type
          : null;

      const cacheKey = domain && type ? `${domain}:${type}` : null;

      // Log total query attempt
      incrementProxyStat("default", "total", this.config.fastestProvider);

      if (cacheKey && domain) {
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.queryStats.cached++;
          incrementProxyStat("default", "cache_hit");

          // Log to Supabase
          logDnsQuery({
            userId: "default",
            domain,
            recordType: type || undefined,
            clientIp: rinfo.address,
            upstreamProvider: this.config.fastestProvider,
            latencyMs: 0,
            cached: true,
            status: "success",
          });

          // We need to update the transaction ID of the cached response to match the request
          // The first 2 bytes of a DNS packet are the transaction ID
          const responseBuffer = Buffer.from(cached);
          responseBuffer.writeUInt16BE(packet.id || 0, 0);

          this.server?.send(
            responseBuffer,
            0,
            responseBuffer.length,
            rinfo.port,
            rinfo.address
          );
          return;
        }
      }

      // Query the fastest provider
      incrementProxyStat("default", "cache_miss");
      await this.queryFastestProvider(msg, rinfo, cacheKey, domain, type);

      this.queryStats.total++;
    } catch (error) {
      console.error("Error handling DNS query:", error);
      this.queryStats.failed++;
    }
  }

  /**
   * Query the fastest DNS provider via raw UDP
   */
  private queryFastestProvider(
    msg: Buffer,
    clientRinfo: dgram.RemoteInfo,
    cacheKey: string | null,
    domain: string | null,
    type: string | null
  ): Promise<void> {
    return new Promise(resolve => {
      const providerIp =
        DNS_PROVIDERS[
          this.config.fastestProvider as keyof typeof DNS_PROVIDERS
        ];

      if (!providerIp) {
        console.error("Provider not found:", this.config.fastestProvider);
        resolve();
        return;
      }

      const startTime = performance.now();
      const client = dgram.createSocket("udp4");

      // Setup timeout
      const timeout = setTimeout(() => {
        this.sendServfail(msg, clientRinfo);
        if (domain) {
          logDnsQuery({
            userId: "default",
            domain,
            recordType: type || undefined,
            clientIp: clientRinfo.address,
            upstreamProvider: this.config.fastestProvider,
            cached: false,
            status: "error",
          });
        }
        client.close();
        resolve();
      }, 5000);

      client.on("message", response => {
        clearTimeout(timeout);

        // Send response back to original client
        this.server?.send(
          response,
          0,
          response.length,
          clientRinfo.port,
          clientRinfo.address
        );

        // Calculate resolution time
        const endTime = performance.now();
        const latencyMs = Math.round(endTime - startTime);
        this.queryStats.totalTime += latencyMs;

        if (domain) {
          logDnsQuery({
            userId: "default",
            domain,
            recordType: type || undefined,
            clientIp: clientRinfo.address,
            upstreamProvider: this.config.fastestProvider,
            latencyMs,
            cached: false,
            status: "success",
          });
        }

        // Cache the raw response if we have a valid key
        if (cacheKey) {
          this.setCache(cacheKey, response);
        }

        client.close();
        resolve();
      });

      client.on("error", err => {
        console.error("Upstream DNS query error:", err);
        clearTimeout(timeout);
        this.sendServfail(msg, clientRinfo);
        if (domain) {
          logDnsQuery({
            userId: "default",
            domain,
            recordType: type || undefined,
            clientIp: clientRinfo.address,
            upstreamProvider: this.config.fastestProvider,
            cached: false,
            status: "error",
          });
        }
        client.close();
        resolve();
      });

      // Send raw buffer to upstream provider
      client.send(msg, 0, msg.length, 53, providerIp, err => {
        if (err) {
          console.error("Failed to send to upstream DNS:", err);
          clearTimeout(timeout);
          this.sendServfail(msg, clientRinfo);
          if (domain) {
            logDnsQuery({
              userId: "default",
              domain,
              recordType: type || undefined,
              clientIp: clientRinfo.address,
              upstreamProvider: this.config.fastestProvider,
              cached: false,
              status: "error",
            });
          }
          client.close();
          resolve();
        }
      });
    });
  }

  /**
   * Get result from cache
   */
  private getFromCache(key: string): Buffer | null {
    const cached = this.cache[key];
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      delete this.cache[key];
      return null;
    }

    return cached.result;
  }

  /**
   * Send SERVFAIL response
   */
  private sendServfail(requestQuery: Buffer, clientRinfo: dgram.RemoteInfo) {
    try {
      const packet = dnsPacket.decode(requestQuery);
      const response = dnsPacket.encode({
        type: "response",
        id: packet.id,
        flags: 2, // SERVFAIL
        questions: packet.questions,
      });
      this.server?.send(
        response,
        0,
        response.length,
        clientRinfo.port,
        clientRinfo.address
      );
    } catch (err) {
      console.error("Failed to send SERVFAIL:", err);
    }
  }

  /**
   * Set result in cache
   */
  private setCache(key: string, result: Buffer): void {
    // Basic TTL from config, could be improved by parsing response TTL
    this.cache[key] = {
      result,
      expiresAt: Date.now() + this.config.cacheTtl * 1000,
    };
  }

  /**
   * Update fastest provider based on benchmark results
   */
  async updateFastestProvider(domains: string[]): Promise<string> {
    const results = await testDomains(domains);

    let fastestProvider = "Google DNS";
    let fastestTime = Infinity;

    Object.entries(results).forEach(([domain, domainResults]) => {
      Object.entries(domainResults).forEach(([provider, time]) => {
        if (typeof time === "number") {
          logBenchmarkResult("default", domain, provider, time);
          if (time < fastestTime) {
            fastestTime = time;
            fastestProvider = provider;
          }
        }
      });
    });

    this.config.fastestProvider = fastestProvider;

    // Also save fastest provider to proxy config in Supabase
    try {
      import("../shared/supabaseClient").then(({ supabase }) => {
        supabase
          .from("proxy_config")
          .update({
            fastest_provider: fastestProvider,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", "default")
          .then();
      });
    } catch (err) {
      console.error("Failed to update fastest provider in supabase");
    }

    return fastestProvider;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      ...this.queryStats,
      averageTime:
        this.queryStats.total > 0
          ? Math.round(this.queryStats.totalTime / this.queryStats.total)
          : 0,
      cacheHitRate:
        this.queryStats.total > 0
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

export async function startDnsProxy(
  config?: Partial<ProxyConfig>
): Promise<DnsProxyServer> {
  const proxy = new DnsProxyServer(config);
  await proxy.start();
  return proxy;
}

// Global reference for the background interval
let backgroundBenchmarkInterval: NodeJS.Timeout | null = null;

export function startBackgroundBenchmark(
  domains: string[] = ["google.com", "cloudflare.com", "apple.com"],
  intervalMs: number = 3600000
) {
  if (backgroundBenchmarkInterval) {
    clearInterval(backgroundBenchmarkInterval);
  }

  const runBenchmark = async () => {
    try {
      console.log("Running background DNS benchmark...");
      const proxy = getDnsProxy();
      const fastest = await proxy.updateFastestProvider(domains);
      console.log(
        `Background benchmark complete. Fastest provider updated to: ${fastest}`
      );

      // We would ideally want to update the database for each user as well,
      // but without tying the proxy to a specific user context here, we just update the in-memory proxy config.
    } catch (err) {
      console.error("Failed to run background benchmark:", err);
    }
  };

  backgroundBenchmarkInterval = setInterval(runBenchmark, intervalMs);

  // Run immediately on start
  runBenchmark();
}

export function stopBackgroundBenchmark() {
  if (backgroundBenchmarkInterval) {
    clearInterval(backgroundBenchmarkInterval);
    backgroundBenchmarkInterval = null;
  }
}
