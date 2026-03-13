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

  let cachedQueries = 0;
  let failedQueries = 0;
  let successQueries = 0;
  let totalResolutionTime = 0;
  let resolutionTimeCount = 0;
  const providerCounts: Record<string, number> = {};

  for (const log of logs) {
    if (log.cachedResult === 1) cachedQueries++;
    if (log.status === 'error') failedQueries++;
    if (log.status === 'success') successQueries++;

    if (log.resolutionTime !== null) {
      totalResolutionTime += log.resolutionTime;
      resolutionTimeCount++;
    }

    providerCounts[log.provider] = (providerCounts[log.provider] || 0) + 1;
  }

  const summary = {
    totalQueries: logs.length,
    cachedQueries,
    failedQueries,
    successQueries,
    averageResolutionTime: resolutionTimeCount > 0 ? Math.round(totalResolutionTime / resolutionTimeCount) : 0,
    mostUsedProvider: '',
    cacheHitRate: logs.length > 0 ? Math.round((cachedQueries / logs.length) * 100) : 0,
  };

  const mostUsed = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];
  if (mostUsed) {
    summary.mostUsedProvider = mostUsed[0];
  }

  return summary;
}
