import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const dnsTestResults = mysqlTable("dnsTestResults", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  googleDns: int("googleDns"), // milliseconds
  cloudflareDns: int("cloudflareDns"),
  openDns: int("openDns"),
  quad9Dns: int("quad9Dns"),
  adguardDns: int("adguardDns"),
  status: mysqlEnum("status", ["success", "error"]).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DnsTestResult = typeof dnsTestResults.$inferSelect;
export type InsertDnsTestResult = typeof dnsTestResults.$inferInsert;

export const dnsProxyConfig = mysqlTable("dnsProxyConfig", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  isEnabled: int("isEnabled").default(0).notNull(), // 0 = false, 1 = true
  fastestProvider: varchar("fastestProvider", { length: 255 }), // Name of fastest provider
  proxyIp: varchar("proxyIp", { length: 45 }), // IPv4 or IPv6
  proxyPort: int("proxyPort").default(53).notNull(),
  cacheTtl: int("cacheTtl").default(3600).notNull(), // Cache time-to-live in seconds
  lastBenchmark: timestamp("lastBenchmark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DnsProxyConfig = typeof dnsProxyConfig.$inferSelect;
export type InsertDnsProxyConfig = typeof dnsProxyConfig.$inferInsert;

export const dnsQueryLog = mysqlTable("dnsQueryLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(), // Which provider resolved it
  resolutionTime: int("resolutionTime"), // milliseconds
  ipAddress: varchar("ipAddress", { length: 45 }), // Client IP that made the query
  status: mysqlEnum("status", ["success", "error", "cached"]).notNull(),
  cachedResult: int("cachedResult").default(0).notNull(), // 0 = fresh, 1 = cached
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DnsQueryLog = typeof dnsQueryLog.$inferSelect;
export type InsertDnsQueryLog = typeof dnsQueryLog.$inferInsert;

export const dnsProxyStats = mysqlTable("dnsProxyStats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  totalQueries: int("totalQueries").default(0).notNull(),
  cachedQueries: int("cachedQueries").default(0).notNull(),
  failedQueries: int("failedQueries").default(0).notNull(),
  averageResolutionTime: int("averageResolutionTime").default(0).notNull(), // milliseconds
  mostUsedProvider: varchar("mostUsedProvider", { length: 255 }),
  date: timestamp("date").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DnsProxyStats = typeof dnsProxyStats.$inferSelect;
export type InsertDnsProxyStats = typeof dnsProxyStats.$inferInsert;

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "DNS_TEST_COMPLETE",
    "DNS_TEST_FAILED",
    "PROXY_STATUS_CHANGED",
    "PROXY_ERROR",
    "BENCHMARK_COMPLETE",
    "ALERT",
    "INFO",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  data: text("data"), // JSON string for additional data
  isRead: int("isRead").default(0).notNull(), // 0 = unread, 1 = read
  isDismissed: int("isDismissed").default(0).notNull(), // 0 = active, 1 = dismissed
  actionUrl: varchar("actionUrl", { length: 512 }), // Optional URL for action button
  actionLabel: varchar("actionLabel", { length: 100 }), // Optional label for action button
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  emailNotifications: int("emailNotifications").default(1).notNull(), // 0 = disabled, 1 = enabled
  pushNotifications: int("pushNotifications").default(1).notNull(),
  soundEnabled: int("soundEnabled").default(1).notNull(),
  dnsTestAlerts: int("dnsTestAlerts").default(1).notNull(),
  proxyStatusAlerts: int("proxyStatusAlerts").default(1).notNull(),
  benchmarkAlerts: int("benchmarkAlerts").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

// TODO: Add your tables here
