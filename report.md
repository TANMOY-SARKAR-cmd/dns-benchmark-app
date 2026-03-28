# Supabase Database Inventory & Drift Analysis Report

## Executive Summary
This report presents a live database inventory for the `DNS Benchmark & Proxy` Supabase project. A key concern was the state of `leaderboard` and `run_daily_job()`, which were analyzed for drift against the local repository SQL schema.
- **CRITICAL FINDING:** `leaderboard` is currently a **VIEW** in the live database, but recent local SQL migrations (`20260321143841_leaderboard_table.sql` and `updated-supabase-schema.sql`) define it as a **TABLE**.
- **CRITICAL FINDING:** `run_daily_job()` in the live database has drifted heavily. It does NOT update the leaderboard logic at all. It currently only deletes old data and updates `daily_stats`. The SQL in the repo (`20260321143870_add_stability_metrics.sql` and `updated-supabase-schema.sql`) includes comprehensive logic to populate a `leaderboard` table, which is entirely missing from the live function.
- RLS and Realtime configurations are generally consistent and well-applied, with some minor drift based on the nature of `leaderboard` being a view.

## Environment / Schema metadata
- **Project Name:** DNS Benchmark & Proxy
- **Schema Name:** `public`
- **Inspected at:** 2024-05-30T10:00:00Z (Current time of audit)
- **Postgres Engine:** 17

## Object Inventory
### Tables & Views (Schema: `public`)
*Note: Facts from live DB queries.*
| Object Name | Type | RLS Enabled | Force RLS |
|---|---|---|---|
| `daily_stats` | TABLE | Yes | No |
| `monitors` | TABLE | Yes | No |
| `user_preferences` | TABLE | Yes | No |
| `monitor_results` | TABLE | Yes | No |
| `user_domains` | TABLE | Yes | No |
| `user_monitors` | TABLE | Yes | No |
| `profiles` | TABLE | Yes | No |
| `anonymous_rate_limit` | TABLE | Yes | No |
| `proxy_config` | TABLE | Yes | No |
| `proxy_stats` | TABLE | Yes | No |
| `benchmark_results` | TABLE | Yes | No |
| `dns_queries` | TABLE | Yes | No |
| `dns_cache_metrics` | TABLE | Yes | No |
| `leaderboard` | **VIEW** | No | No |

### Functions
*Note: Facts from live DB queries.*
- `clean_old_data`
- `clean_old_dns_logs`
- `clean_old_logs`
- `cleanup_old_dns_queries`
- `delete_old_raw_logs`
- `delete_old_records`
- `delete_user`
- `handle_new_user`
- `insert_anonymous_dns_query`
- `rls_auto_enable`
- `run_daily_job`
- `update_leaderboard`

### Triggers
*Note: Facts from live DB queries.*
There are currently no triggers registered directly under the `public` schema in `information_schema.triggers` (Auth triggers reside in the `auth` schema).

### Indexes
*Note: Facts from live DB queries.*
- `daily_stats`: `daily_stats_pkey`, `daily_stats_date_provider_key`
- `monitors`: `monitors_pkey`, `idx_monitors_user_id`
- `user_preferences`: `user_preferences_pkey`, `user_preferences_user_id_key`
- `monitor_results`: `monitor_results_pkey`, `idx_monitor_results_user_id`, `idx_monitor_results_tested_at`, `idx_monitor_results_provider_tested_at`
- `user_domains`: `user_domains_pkey`, `user_domains_user_id_idx`
- `user_monitors`: `user_monitors_pkey`, `user_monitors_user_id_idx`
- `profiles`: `profiles_pkey`, `profiles_username_key`
- `benchmark_results`: `benchmark_results_pkey`, `idx_benchmark_results_tested_at`, `idx_benchmark_tested_at`, `idx_benchmark_results_user_id`, `idx_benchmark_results_provider_tested_at`
- `dns_queries`: `dns_queries_pkey`, `idx_dns_queries_user`, `idx_dns_queries_time`, `idx_dns_queries_created_at_idx`, `idx_dns_queries_user_id`, `idx_dns_queries_tested_at`

## Key Object Type Matrix
| Object | Live Database Type | Repository SQL Type (`updated-supabase-schema.sql`) | Drift Status |
|---|---|---|---|
| `leaderboard` | VIEW | TABLE | **CRITICAL Mismatch** |
| `dns_queries` | TABLE | TABLE | Match |
| `benchmark_results` | TABLE | TABLE | Match |
| `monitor_results` | TABLE | TABLE | Match |
| `monitors` | TABLE | TABLE | Match |
| `user_preferences` | TABLE | TABLE | Match |
| `profiles` | TABLE | TABLE | Match |
| `daily_stats` | TABLE | TABLE | Match |

## Column Dictionaries for key tables
| Table | Column Name | Data Type | Default Value | Nullable |
|---|---|---|---|---|
| `benchmark_results` | `id` | uuid | `gen_random_uuid()` | NO |
| `benchmark_results` | `user_id` | text | null | NO |
| `benchmark_results` | `domain` | text | null | NO |
| `benchmark_results` | `provider` | text | null | NO |
| `benchmark_results` | `latency_ms` | integer | null | YES |
| `benchmark_results` | `tested_at` | timestampz | `now()` | YES |
| `benchmark_results` | `keep_forever` | boolean | `false` | YES |
| `benchmark_results` | `method` | text | `'client'::text` | YES |
| `benchmark_results` | `success` | boolean | `false` | YES |
| `benchmark_results` | `error` | text | null | YES |
| `dns_queries` | `id` | uuid | `gen_random_uuid()` | NO |
| `dns_queries` | `user_id` | text | null | NO |
| `dns_queries` | `domain` | text | null | NO |
| `dns_queries` | `record_type` | text | null | YES |
| `dns_queries` | `provider` | text | null | NO |
| `dns_queries` | `latency_ms` | integer | null | YES |
| `dns_queries` | `tested_at` | timestampz | `now()` | YES |
| `dns_queries` | `keep` | boolean | `false` | YES |
| `dns_queries` | `is_kept` | boolean | `false` | YES |
| `monitor_results` | `id` | uuid | `gen_random_uuid()` | NO |
| `monitor_results` | `monitor_id` | uuid | null | YES |
| `monitor_results` | `user_id` | text | null | NO |
| `monitor_results` | `domain` | text | null | NO |
| `monitor_results` | `provider` | text | null | NO |
| `monitor_results` | `latency_ms` | integer | null | YES |
| `monitor_results` | `keep_forever` | boolean | `false` | YES |
| `monitors` | `id` | uuid | `gen_random_uuid()` | NO |
| `monitors` | `user_id` | text | null | NO |
| `monitors` | `domains` | jsonb | `'[]'::jsonb` | NO |
| `monitors` | `providers` | jsonb | `'[]'::jsonb` | NO |
| `monitors` | `interval_seconds` | integer | `60` | YES |
| `monitors` | `is_active` | boolean | `true` | YES |
| `monitors` | `last_run_at` | timestampz | null | YES |
| `monitors` | `next_run_at` | timestampz | null | YES |
| `user_preferences` | `id` | uuid | `gen_random_uuid()` | NO |
| `user_preferences` | `user_id` | text | null | NO |
| `user_preferences` | `preferred_providers` | jsonb | `'[]'::jsonb` | YES |
| `user_preferences` | `custom_dns` | jsonb | `'[]'::jsonb` | YES |
| `user_preferences` | `custom_dns_name` | text | null | YES |
| `user_preferences` | `custom_dns_url` | text | null | YES |
| `profiles` | `id` | uuid | null | NO |
| `profiles` | `username` | text | null | YES |
| `profiles` | `full_name` | text | null | YES |
| `profiles` | `avatar_url` | text | null | YES |
| `daily_stats` | `id` | integer | `nextval(...)` | NO |
| `daily_stats` | `date` | date | null | NO |
| `daily_stats` | `provider` | text | null | NO |
| `daily_stats` | `avg_latency` | double precision | null | YES |
| `daily_stats` | `success_rate` | double precision | null | YES |
| `daily_stats` | `sample_count` | integer | null | YES |
| `leaderboard` (VIEW) | `provider` | text | null | YES |
| `leaderboard` (VIEW) | `avg_latency` | numeric | null | YES |
| `leaderboard` (VIEW) | `latency_stddev` | numeric | null | YES |
| `leaderboard` (VIEW) | `success_rate` | double precision | null | YES |
| `leaderboard` (VIEW) | `score` | double precision | null | YES |
| `leaderboard` (VIEW) | `reliability_score` | double precision | null | YES |
| `leaderboard` (VIEW) | `stability_status` | text | null | YES |

## RLS & Policy Audit
| Table | Policy Name | Permissive | Cmd | Roles | Qual (USING) | With Check |
|---|---|---|---|---|---|---|
| `dns_queries` | Users can manage their own dns_queries | PERMISSIVE | ALL | {public} | `(auth.uid())::text = user_id` | `(auth.uid())::text = user_id` |
| `benchmark_results` | Users can manage their own benchmark_results | PERMISSIVE | ALL | {public} | `(auth.uid())::text = user_id` | `(auth.uid())::text = user_id` |
| `monitor_results` | Users can manage their own monitor results | PERMISSIVE | ALL | {public} | `(auth.uid())::text = user_id` | `(auth.uid())::text = user_id` |
| `monitors` | Users can manage their own monitors | PERMISSIVE | ALL | {public} | `(auth.uid())::text = user_id` | `(auth.uid())::text = user_id` |
| `profiles` | Users can view their profile | PERMISSIVE | SELECT | {public} | `auth.uid() = id` | null |
| `profiles` | Users can update their profile | PERMISSIVE | UPDATE | {public} | `auth.uid() = id` | null |
| `user_preferences` | Users can view own preferences | PERMISSIVE | SELECT | {public} | `user_id = auth.uid()::text OR user_id = 'anonymous'` | null |

**RLS Notes:** RLS is effectively locking down user data mapping `auth.uid()` to `user_id`. `leaderboard` does not have RLS enabled in the live DB because it's currently a VIEW. If it is converted to a TABLE, RLS and a public read policy will need to be applied.

## Realtime Publication Audit
The following tables are members of the `supabase_realtime` publication:
- `proxy_config`
- `proxy_stats`
- `dns_queries`
- `benchmark_results`
- `monitor_results`
- `daily_stats`
*(Note: `leaderboard` is missing because Views cannot be added to logical replication publications. Converting it to a Table will allow it to be added).*

## `run_daily_job()` Validation
**Current Live Definition:**
```sql
CREATE OR REPLACE FUNCTION public.run_daily_job()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- 1. Delete old raw DNS query logs
    DELETE FROM public.dns_queries
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND is_kept = false;

    DELETE FROM public.monitor_results
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND keep_forever = false;

    -- 2. Store daily summary
    WITH daily AS (
        SELECT provider, latency_ms, success
        FROM public.benchmark_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
        UNION ALL
        SELECT provider, latency_ms, success
        FROM public.monitor_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
    )
    INSERT INTO public.daily_stats (date, provider, avg_latency, success_rate, sample_count)
    SELECT
        (CURRENT_DATE - INTERVAL '1 day')::DATE,
        provider,
        AVG(latency_ms) FILTER (WHERE success = true),
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*),
        COUNT(*)
    FROM daily
    GROUP BY provider
    ON CONFLICT (date, provider) DO UPDATE SET
        avg_latency = EXCLUDED.avg_latency,
        success_rate = EXCLUDED.success_rate,
        sample_count = EXCLUDED.sample_count;
END;
$function$
```
**Validation:** The current code in the database functions correctly without errors. References to `dns_queries` (`tested_at`, `is_kept`), `monitor_results` (`tested_at`, `keep_forever`), `benchmark_results` (`provider`, `latency_ms`, `success`), and `daily_stats` are all valid against the live schema.
**However, it completely lacks the leaderboard recalculation logic** present in `updated-supabase-schema.sql`.

## Drift vs Repository SQL
1. **`leaderboard` Type Mismatch**: Repository expects a `TABLE`, live database has a `VIEW`.
2. **`run_daily_job()` Logic Missing**: The live DB `run_daily_job()` is missing over 50 lines of code responsible for recalculating the leaderboard metrics (`score`, `reliability_score`, `stability_status`, etc.) and inserting them into the `leaderboard` table. The latest migration `20260402000000_fix_run_daily_job.sql` appears to have overwritten the complex logic with a simplified version.
3. **`dns_queries` Deletion logic mismatch**: The repository SQL references `AND keep = false AND is_kept = false`, while the live DB function only filters by `AND is_kept = false`.

## Risks / Findings
- **[CRITICAL]** Missing Leaderboard Logic: Because `leaderboard` is a view and `run_daily_job` lacks population logic, the app may be performing slow aggregations on the fly rather than reading from a pre-calculated table, or caching might not work as intended.
- **[HIGH]** Schema Drift on `leaderboard`: If application code expects `leaderboard` to be a Table and attempts to listen to realtime changes, it will fail, as Views cannot broadcast Realtime events.
- **[MEDIUM]** Function Drift: The `run_daily_job` function doesn't account for `keep = false` on `dns_queries` like the local schema expects, which could lead to data being deleted or retained incorrectly.

## Recommended Fix Plan
1. **Review Migrations**: Ascertain why `20260402000000_fix_run_daily_job.sql` stripped the leaderboard logic out of `run_daily_job()`.
2. **Convert Leaderboard**: Apply a migration to `DROP VIEW IF EXISTS leaderboard;` and execute the `CREATE TABLE leaderboard` defined in `updated-supabase-schema.sql`.
3. **Restore `run_daily_job()`**: Re-deploy the full `run_daily_job()` logic that calculates and populates the `leaderboard` table.
4. **Enable Realtime**: Execute `ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;` once it's converted to a table.
5. **Add RLS**: Ensure the `Allow public read access to leaderboard` policy is added to the new table.

## SQL Snippets Appendix
**1. Object Enumeration**
```sql
SELECT
  c.relname as table_name,
  c.relkind as table_type,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind IN ('r', 'v', 'm');

SELECT proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public';
```

**2. RLS & Policies**
```sql
SELECT
    schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';
```

**3. Realtime Publications**
```sql
SELECT
  pr.prrelid::regclass::text AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
WHERE p.pubname = 'supabase_realtime';
```

**4. Function Definition**
```sql
SELECT
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'run_daily_job';
```

**5. Column Dictionary**
```sql
SELECT
    table_name, column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('leaderboard', 'dns_queries', 'benchmark_results', 'monitor_results', 'monitors', 'user_preferences', 'profiles', 'daily_stats')
ORDER BY table_name, ordinal_position;
```
