import { eq } from 'drizzle-orm';
import { dnsProxyConfig, dnsQueryLog, dnsProxyStats, InsertDnsProxyConfig, InsertDnsQueryLog, InsertDnsProxyStats } from '../drizzle/schema';
import { getDb } from './db';

/**
 * Get or create DNS proxy configuration for a user
 */
export async function getDnsProxyConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const config = await db.select().from(dnsProxyConfig).where(eq(dnsProxyConfig.userId, userId)).limit(1);
  
  if (config.length > 0) {
    return config[0];
  }

  // Create default config
  const newConfig: InsertDnsProxyConfig = {
    userId,
    isEnabled: 0,
    fastestProvider: 'Google DNS',
    proxyPort: 53,
    cacheTtl: 3600,
  };

  await db.insert(dnsProxyConfig).values(newConfig);
  const created = await db.select().from(dnsProxyConfig).where(eq(dnsProxyConfig.userId, userId)).limit(1);
  return created[0];
}

/**
 * Update DNS proxy configuration
 */
export async function updateDnsProxyConfig(userId: number, updates: Partial<InsertDnsProxyConfig>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.update(dnsProxyConfig)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(dnsProxyConfig.userId, userId));

  return getDnsProxyConfig(userId);
}

/**
 * Log a DNS query
 */
export async function logDnsQuery(userId: number, log: InsertDnsQueryLog) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.insert(dnsQueryLog).values({
    ...log,
    userId,
  });
}

/**
 * Get DNS query logs for a user
 */
export async function getDnsQueryLogs(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  return db.select()
    .from(dnsQueryLog)
    .where(eq(dnsQueryLog.userId, userId))
    .orderBy(dnsQueryLog.createdAt)
    .limit(limit);
}

/**
 * Get DNS proxy statistics for a user
 */
export async function getDnsProxyStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const stats = await db.select()
    .from(dnsProxyStats)
    .where(eq(dnsProxyStats.userId, userId))
    .orderBy(dnsProxyStats.date)
    .limit(1);

  if (stats.length > 0) {
    return stats[0];
  }

  // Create default stats
  const newStats: InsertDnsProxyStats = {
    userId,
    totalQueries: 0,
    cachedQueries: 0,
    failedQueries: 0,
    averageResolutionTime: 0,
  };

  await db.insert(dnsProxyStats).values(newStats);
  return getDnsProxyStats(userId);
}

/**
 * Update DNS proxy statistics
 */
export async function updateDnsProxyStats(userId: number, updates: Partial<InsertDnsProxyStats>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const existing = await getDnsProxyStats(userId);
  
  await db.update(dnsProxyStats)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(dnsProxyStats.userId, userId));

  return getDnsProxyStats(userId);
}

/**
 * Get query statistics summary
 */
export async function getQueryStatsSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const logs = await db.select().from(dnsQueryLog).where(eq(dnsQueryLog.userId, userId));

  const summary = {
    totalQueries: logs.length,
    cachedQueries: logs.filter(l => l.cachedResult === 1).length,
    failedQueries: logs.filter(l => l.status === 'error').length,
    successQueries: logs.filter(l => l.status === 'success').length,
    averageResolutionTime: 0,
    mostUsedProvider: '',
    cacheHitRate: 0,
  };

  // Calculate average resolution time
  const timings = logs
    .filter(l => l.resolutionTime !== null)
    .map(l => l.resolutionTime as number);
  
  if (timings.length > 0) {
    summary.averageResolutionTime = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
  }

  // Find most used provider
  const providerCounts: Record<string, number> = {};
  logs.forEach(log => {
    providerCounts[log.provider] = (providerCounts[log.provider] || 0) + 1;
  });
  
  const mostUsed = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];
  if (mostUsed) {
    summary.mostUsedProvider = mostUsed[0];
  }

  // Calculate cache hit rate
  if (summary.totalQueries > 0) {
    summary.cacheHitRate = Math.round((summary.cachedQueries / summary.totalQueries) * 100);
  }

  return summary;
}
