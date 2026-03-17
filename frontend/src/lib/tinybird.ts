/**
 * Tinybird Definitions
 *
 * Define your datasources, endpoints, and client here.
 */

import {
  defineDatasource,
  defineEndpoint,
  defineToken,
  Tinybird,
  node,
  t,
  p,
  engine,
  type InferRow,
  type InferParams,
  type InferOutputRow,
} from "@tinybirdco/sdk";

// ============================================================================
// Tokens
// ============================================================================

export const appToken = defineToken("app_read");
export const ingestToken = defineToken("ingest_token");


// ============================================================================
// Datasources
// ============================================================================

/**
 * Page views datasource - tracks page view events
 */
export const pageViews = defineDatasource("page_views", {
  description: "Page view tracking data",
  schema: {
    timestamp: t.dateTime(),
    pathname: t.string(),
    session_id: t.string(),
    country: t.string().lowCardinality().nullable(),
  },
  engine: engine.mergeTree({
    sortingKey: ["pathname", "timestamp"],
  }),
  tokens: [
    { token: appToken, scope: "READ" },
    { token: ingestToken, scope: "APPEND" },
  ],
});

export type PageViewsRow = InferRow<typeof pageViews>;

// ============================================================================
// Endpoints
// ============================================================================

/**
 * Top pages endpoint - get the most visited pages
 */
export const topPages = defineEndpoint("top_pages", {
  description: "Get the most visited pages",
  params: {
    date_from: p.dateTime().optional('2026-03-17T17:48:01.723Z'),
    date_to: p.dateTime().optional('2026-03-16T17:48:01.723Z'),
    limit: p.int32().optional(10),
  },
  nodes: [
    node({
      name: "endpoint",
      sql: `
        SELECT pathname, count() AS views
        FROM page_views
        WHERE timestamp >= parseDateTimeBestEffort({{String(date_from, '2026-03-17T17:48:01.723Z', required=False)}})
          AND timestamp <= parseDateTimeBestEffort({{String(date_to, '2026-03-16T17:48:01.723Z', required=False)}})
        GROUP BY pathname
        ORDER BY views DESC
        LIMIT {{Int32(limit, 10)}}
      `,
    }),
  ],
  output: {
    pathname: t.string(),
    views: t.uint64(),
  },
  tokens: [{ token: appToken, scope: "READ" }],
});

export type TopPagesParams = InferParams<typeof topPages>;
export type TopPagesOutput = InferOutputRow<typeof topPages>;

// ============================================================================
// Client
// ============================================================================

export const tinybird = new Tinybird({
  datasources: { pageViews },
  pipes: { topPages },
});
