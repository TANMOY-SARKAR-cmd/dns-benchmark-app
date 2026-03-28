# DNS Benchmark App — Bug Fix Guide for Jules

This document tracks every confirmed logic error and broken feature found in the codebase.
Fix open items **in order of severity** without refactoring unrelated code.
The live app is at https://dns-benchmark-app.vercel.app

Jules has Supabase MCP access — use it to inspect the live database schema, run SQL, and apply/verify migrations.

---

## Overview of the tech stack

- **Frontend:** React + TypeScript + Vite, located in `frontend/`
- **Backend API:** Vercel serverless functions in `api/`
- **Database:** Supabase (PostgreSQL). Schema is in `updated-supabase-schema.sql` and `supabase/migrations/`
- **DNS measurement:** Client-side via `frontend/src/lib/doh.ts`; server-side via `api/dns-query.ts`
- **Auth:** Supabase Auth, managed in `frontend/src/contexts/AuthContext.tsx`

---

## Status legend

- ✅ FIXED — confirmed resolved in current codebase
- 🔴 OPEN — still broken; Jules must fix this
- 🟡 INVESTIGATE — root cause uncertain; Jules must diagnose then fix

---

## CRITICAL — Fix these first

---

### ✅ 1. Supabase Realtime not enabled — FIXED

Migration `supabase/migrations/20260401000000_enable_realtime.sql` now adds all tables to the
`supabase_realtime` publication using idempotent `IF NOT EXISTS` checks.
Verify via Supabase MCP that the tables appear in the publication.

---

### ✅ 2. `benchmark_results.keep` → `keep_forever` — FIXED

`Home.tsx` now calls `.update({ keep_forever: keepState })` and merges `{ keep_forever: keepState }` in state.

---

### ✅ 3. `monitor_results` inserts include `monitor_id` — FIXED

The destructure that stripped `monitor_id` has been removed. The insert now calls `.insert(payload)` directly.

---

### ✅ 4. `AuthDialog` imports Supabase client from correct path — FIXED

`AuthDialog.tsx` now imports from `@/lib/supabase` (not `@/utils/supabaseClient`).

---

### ✅ 5. `delete_user` RPC — FIXED

Migration `supabase/migrations/20260401000001_fix_delete_user_rpc.sql` replaces the broken RPC with a
corrected version that deletes `profiles` first (FK), deletes `monitor_results` before `monitors` (FK),
and sets `search_path = public`. The client-side fallback in `Account.tsx` also deletes `profiles`.

---

### ✅ 6. Quad9 URL mismatch — FIXED

`frontend/src/lib/doh.ts` now uses `https://dns.quad9.net/dns-query` (matching the server endpoint).

---

## HIGH SEVERITY

---

### ✅ 7. Vercel cron authorization — FIXED

`api/daily-job.ts` now accepts `x-vercel-cron: 1` header in addition to Bearer token auth.
**Action still needed:** Ensure `CRON_SECRET` is set in the Vercel dashboard → Settings →
Environment Variables so Vercel sends it automatically with each cron call.

---

### ✅ 8. Live Logs: same domain+provider entry deduplication — FIXED

`Home.tsx` now updates an existing entry (by `domain + provider`) in-place rather than prepending duplicates.

---

### ✅ 9. `allQueries` error field — FIXED

`allQueries.push()` now sets `error: final_success ? null : "Failed to resolve"`.

---

### ✅ 10. Monitors save only the user's selected providers — FIXED

`Home.tsx` now has `selectedMonitorProviders` state and saves `providers: selectedMonitorProviders`.

---

## MEDIUM SEVERITY

---

### ✅ 11. Unused `measureDoH`/`measureDoHBatch` imports removed — FIXED

`Home.tsx` now only imports `measureClientDoH`, `DOH_PROVIDERS`, and `BenchmarkResult` from `@/lib/doh`.

---

### ✅ 12. `monitor_results` now includes `record_type` — FIXED

Monitor payload now sets `record_type: "A"`.

---

### ✅ 13. `BenchmarkTab` chart uses `filteredChartData` — FIXED

`BenchmarkTab.tsx` computes `filteredChartData` by stripping inactive providers from each row and
passes that to the chart instead of raw `chartData`. `<Bar>` components are still rendered only for
`activeProviders`.

---

### ✅ 14. `monitor.providers` stored as JSONB — FIXED

Migration `supabase/migrations/20260321143882_convert_monitor_providers.sql` converts the
`monitors.providers` column to `jsonb` and coerces any legacy CSV rows.

---

## LOW SEVERITY / CLEANUP

---

### ✅ 15. `frontend/src/lib/monitor.ts` — NOT AN ISSUE

The file does not exist in the current codebase. No action needed.

---

### ✅ 16. Frontend URL validation for custom DNS — FIXED

`SettingsTab.tsx` now calls `validateCustomUrl()` when saving and shows an inline error toast if
the URL is invalid.

---

### ✅ 17. `allQueries` includes `record_type` — FIXED

`allQueries.push()` now sets `record_type: "A"`.

---

## NEW BUGS — OPEN (Jules must fix these)

---

### ✅ 18. `run_daily_job()` crashes — references non-existent `keep` column in `dns_queries` — FIXED

Migration `supabase/migrations/20260403000000_leaderboard_table_and_daily_job.sql` was verified to be applied. `leaderboard` is a BASE TABLE and `run_daily_job()` executes successfully without referencing `keep` column.

**Files:** `supabase/migrations/20260321143865_add_method_statistics.sql` (line 15) and
`supabase/migrations/20260321143870_add_stability_metrics.sql` (line 13)

Both migrations define `run_daily_job()` with the following cleanup statement:
```sql
DELETE FROM dns_queries
WHERE tested_at < NOW() - INTERVAL '30 days'
AND keep = false        -- ← this column does NOT exist
AND is_kept = false;
```

No migration ever adds a `keep` column to `dns_queries`. The `updated-supabase-schema.sql` shows both
`keep` and `is_kept` columns, but that file is only a reference snapshot; the live database was
populated through migrations. As a result, `run_daily_job()` fails with:
```
ERROR:  column "keep" does not exist
```
every time the Vercel cron fires or when a user triggers a leaderboard refresh.
The PostgreSQL exception aborts the entire function body, so the `DELETE FROM leaderboard` and the
following `INSERT INTO leaderboard` never execute.  **The global leaderboard table is never refreshed.**

**Fix (use Supabase MCP to apply):**

1. Verify with Supabase MCP whether `dns_queries` has a `keep` column:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'dns_queries' AND column_name = 'keep';
   ```

2. If the column is missing, create a new migration
   `supabase/migrations/20260402000000_fix_run_daily_job.sql` with a corrected
   `run_daily_job()` that removes `AND keep = false`:
   ```sql
   CREATE OR REPLACE FUNCTION public.run_daily_job()
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   BEGIN
       -- 1. Delete old raw DNS query logs
       DELETE FROM public.dns_queries
       WHERE tested_at < NOW() - INTERVAL '30 days'
       AND is_kept = false;

       DELETE FROM public.monitor_results
       WHERE tested_at < NOW() - INTERVAL '30 days'
       AND keep_forever = false;

       -- 2. Recompute leaderboard from last 30 days of benchmark + monitor data
       DELETE FROM public.leaderboard;

       WITH combined_results AS (
           SELECT provider, latency_ms, success, method, tested_at
           FROM public.benchmark_results
           WHERE tested_at >= NOW() - INTERVAL '30 days'
           UNION ALL
           SELECT provider, latency_ms, success, method, tested_at
           FROM public.monitor_results
           WHERE tested_at >= NOW() - INTERVAL '30 days'
       ),
       aggregated AS (
           SELECT
               provider,
               AVG(latency_ms) FILTER (WHERE success = true) AS avg_latency,
               STDDEV(latency_ms) FILTER (WHERE success = true) AS latency_stddev,
               SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS success_rate,
               COUNT(*) AS sample_count,
               (
                   (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 0.5) +
                   ((1.0 / NULLIF(AVG(latency_ms) FILTER (WHERE success = true), 0)) * 0.3) +
                   (LOG(COUNT(*) + 1) * 0.2)
               ) AS score,
               (
                   (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 0.6) +
                   ((1.0 / NULLIF(AVG(latency_ms) FILTER (WHERE success = true), 0)) * 0.25) +
                   (LOG(COUNT(*) + 1) * 0.15)
               ) AS reliability_score,
               SUM(CASE WHEN method = 'server-udp' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 AS udp_percentage,
               SUM(CASE WHEN method = 'server-doh' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 AS doh_percentage,
               SUM(CASE WHEN method = 'fallback' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 AS fallback_percentage,
               SUM(CASE WHEN method = 'failed' OR success = false THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 AS failure_percentage,
               NOW() AS last_updated
           FROM combined_results
           GROUP BY provider
       )
       INSERT INTO public.leaderboard (
           provider, avg_latency, latency_stddev, success_rate, sample_count,
           score, reliability_score,
           udp_percentage, doh_percentage, fallback_percentage, failure_percentage,
           stability_status, last_updated
       )
       SELECT
           provider, avg_latency, latency_stddev, success_rate, sample_count,
           score, reliability_score,
           udp_percentage, doh_percentage, fallback_percentage, failure_percentage,
           CASE
               WHEN failure_percentage > 20 OR fallback_percentage > 30 OR latency_stddev > 50 THEN 'Unreliable'
               WHEN failure_percentage > 10 OR fallback_percentage > 15 OR latency_stddev > 25 THEN 'Unstable'
               ELSE 'Stable'
           END AS stability_status,
           last_updated
       FROM aggregated;

       -- 3. Store daily summary
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
   $$;
   ```

3. After applying, trigger it manually via the Supabase MCP to verify it runs without error:
   ```sql
   SELECT public.run_daily_job();
   ```
   Then check the `leaderboard` table has rows with non-null `avg_latency` (assuming there is
   recent benchmark data).

---

## Resolved / historical bugs
### ✅ 19. All benchmarks record `success=false, method="failed"` — leaderboard shows 100% failure — FIXED

Server-side UDP timeout was updated to 500ms, `REQUEST_TIMEOUT` to 4000ms, `GLOBAL_TIMEOUT` to 8000ms, and `maxDuration` set to 15s in `api/dns-query.ts`.
Client-side timeouts updated to 5000ms for `resolveClientDNS` and 4000ms for `fetchWithTimeout` in `frontend/src/lib/doh.ts`.

**Symptoms visible in the live app:**
- The personal Leaderboard tab ("Your DNS Performance") shows every provider with `N/A ms` latency,
  `0.0%` success rate, and `Failed: 100.0%` in method stats despite having 197–204 total test records.
- This means every row in `dns_queries` for the current user has `success=false, method="failed"`.
- The global leaderboard (visible when not logged in) is also stale because `run_daily_job()` was
  broken (bug 18 above).

**Root cause investigation steps for Jules:**

1. **Check if `benchmark_results` / `dns_queries` have any successful rows** using Supabase MCP:
   ```sql
   SELECT provider, COUNT(*) AS total,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successes,
          COUNT(DISTINCT method) AS distinct_methods
   FROM public.benchmark_results
   GROUP BY provider
   ORDER BY provider;
   ```
   If `successes = 0` for every provider, the server-side DNS resolution is failing.

2. **Check Vercel function logs** for `/api/dns-query` to see if UDP or DoH requests are timing out
   or throwing errors. Look for `ERROR` or `timeout` in logs from the last benchmark run.

3. **Likely cause A — UDP port 53 blocked in Vercel serverless:**
   `api/dns-query.ts` first tries `dns.Resolver` (UDP) for each query. In many cloud environments
   outbound UDP on port 53 is blocked, causing `resolveWithNativeDNS` to always hit the 2500ms
   timeout. Then it falls through to DoH via HTTPS. If DoH ALSO times out (or fails), the function
   returns `success: false, method: "failed"`.

   **Fix A:** In `api/dns-query.ts`, reduce the UDP timeout from 2500 ms to 500 ms so that UDP
   failures are detected quickly and the DoH fallback gets more of the available budget:
   ```diff
   - const nativeLatency = await resolveWithNativeDNS(domain, udpIp, 2500, recordType);
   + const nativeLatency = await resolveWithNativeDNS(domain, udpIp, 500, recordType);
   ```
   Also increase `REQUEST_TIMEOUT` for DoH to give HTTPS more room:
   ```diff
   - const REQUEST_TIMEOUT = 2500; // ms
   + const REQUEST_TIMEOUT = 4000; // ms
   ```
   And raise `GLOBAL_TIMEOUT` slightly so the second chunk isn't cut off:
   ```diff
   - const GLOBAL_TIMEOUT = 4500; // ms
   + const GLOBAL_TIMEOUT = 8000; // ms
   ```
   And raise `maxDuration` in `dns-query.ts` to match:
   ```diff
   + export const maxDuration = 15; // seconds
   ```

4. **Likely cause B — client-side DoH fallback timeout too short:**
   `frontend/src/lib/doh.ts` `resolveClientDNS` aborts after 2000 ms. The `fetchWithTimeout`
   inside it also uses 2000 ms. On a slow connection or with a slow DoH server, both timeouts fire
   before a response arrives.

   **Fix B:** Increase the client-side timeout in `resolveClientDNS`:
   ```diff
   - const timeoutId = setTimeout(() => controller.abort(), 2000);
   + const timeoutId = setTimeout(() => controller.abort(), 5000);
   ```
   And in `fetchWithTimeout` calls inside `jsonQuery`, `binaryGetQuery`, `binaryPostQuery`:
   ```diff
   - await fetchWithTimeout(url.toString(), { ... });
   + await fetchWithTimeout(url.toString(), { ... }, 4000);
   ```
   (The third argument to `fetchWithTimeout` is `timeoutMs`, defaulting to 2000.)

5. **After applying fixes**, trigger a test benchmark from the live app and verify that at least
   some queries in `dns_queries` now have `success=true`. Then trigger `run_daily_job()` manually
   and confirm the `leaderboard` table reflects real scores.

---

## Reference: confirmed schema column names

Use these when writing Supabase queries — do not guess or use aliases:

| Table | Column | Notes |
|---|---|---|
| `benchmark_results` | `keep_forever` | **not** `keep` |
| `monitor_results` | `keep_forever` | **not** `keep` |
| `monitor_results` | `monitor_id` | FK to `monitors.id` — **include it** |
| `leaderboard` | `last_updated` | **not** `updated_at` |
| `dns_queries` | `is_kept` | primary retention flag (from migrations) |
| `dns_queries` | `keep` | also present in `updated-supabase-schema.sql` but may not exist via migrations — verify with MCP before using |
| `dns_queries` | `record_type` | type of DNS record tested |

---

## How to run the project locally

```bash
# Install dependencies
pnpm install

# Run frontend dev server
cd frontend && pnpm dev

# Run API locally (requires Vercel CLI)
vercel dev
```

Tests:
```bash
# Frontend unit tests
cd frontend && pnpm test

# API unit tests (from repo root)
pnpm test
```

---

## What NOT to change

- Do not refactor the component structure or file layout.
- Do not upgrade dependencies.
- Do not change the Supabase schema unless explicitly required by a fix above.
- Do not remove existing tests; add new ones only if a test for the fixed behaviour is missing.
- Do not guess — use the Supabase MCP to check the actual live schema before writing migrations.

---

## Jules Prompt — Remaining Open Bugs (18 & 19)

Use this prompt verbatim when assigning the remaining work to Jules.

---

You are fixing the DNS Benchmark App at https://dns-benchmark-app.vercel.app.
Repo: TANMOY-SARKAR-cmd/dns-benchmark-app
You have Supabase MCP access — use it to inspect the live schema and apply/verify migrations.
agent.md tracks all known bugs. Items 1–17 are ✅ FIXED. Two bugs remain open (18 and 19).

---

### 🔴 Bug 18: run_daily_job() crashes — leaderboard never refreshed

Migration `supabase/migrations/20260403000000_leaderboard_table_and_daily_job.sql` contains the
full fix: converts leaderboard VIEW → TABLE, recreates run_daily_job() with cleanup + leaderboard
recompute + daily_stats, enables RLS + public SELECT, and adds the table to the realtime publication.

**Action:**

1. Use Supabase MCP to verify whether the migration was already applied:
   ```sql
   SELECT table_type FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'leaderboard';
   -- Must return TABLE (not VIEW)
   ```

2. Verify run_daily_job() no longer references the nonexistent `keep` column:
   ```sql
   SELECT prosrc FROM pg_proc WHERE proname = 'run_daily_job';
   -- Must NOT contain "AND keep = false"
   ```

3. If the migration was NOT applied, apply the full SQL from
   `supabase/migrations/20260403000000_leaderboard_table_and_daily_job.sql` via the Supabase MCP
   SQL editor.

4. Manually trigger run_daily_job() to confirm it runs without error:
   ```sql
   SELECT public.run_daily_job();
   ```

5. Verify the leaderboard table has rows:
   ```sql
   SELECT provider, avg_latency, success_rate, sample_count FROM public.leaderboard;
   ```
   If no rows exist, check that benchmark_results and monitor_results contain data from the last
   30 days (see Bug 19 below).

---

### 🟡 Bug 19: All benchmarks record success=false — leaderboard shows 100% failure

**Root cause investigation:**

1. Check live data with Supabase MCP:
   ```sql
   SELECT provider, COUNT(*) AS total,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successes,
          COUNT(DISTINCT method) AS distinct_methods
   FROM public.benchmark_results
   GROUP BY provider ORDER BY provider;

   SELECT provider, COUNT(*) AS total,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successes,
          COUNT(DISTINCT method) AS distinct_methods
   FROM public.dns_queries
   GROUP BY provider ORDER BY provider;
   ```
   If all rows have success=false, server-side DNS resolution is failing for every query.

2. **Verify server-side timeouts** in `api/dns-query.ts` are already set to the correct values:
   - `resolveWithNativeDNS(domain, udpIp, 500, recordType)` — UDP timeout must be 500 ms
   - `REQUEST_TIMEOUT = 4000` — per-DoH-fetch timeout must be 4000 ms
   - `GLOBAL_TIMEOUT = 8000` — overall batch timeout must be 8000 ms
   If any of these differ from the values above, update them.

3. **Add maxDuration export** to `api/dns-query.ts` if not already present, so Vercel allocates
   more execution time to the function:
   ```typescript
   export const maxDuration = 15; // seconds
   ```
   Place it near the top of the file, after the imports.

4. **Apply client-side timeout fix** in `frontend/src/lib/doh.ts`:

   a. In the `resolveClientDNS` function, increase the abort controller timeout from 2000 ms to
      5000 ms:
      ```diff
      - const timeoutId = setTimeout(() => controller.abort(), 2000);
      + const timeoutId = setTimeout(() => controller.abort(), 5000);
      ```

   b. Find every `fetchWithTimeout` call inside `jsonQuery`, `binaryGetQuery`, and
      `binaryPostQuery`. The function signature is `fetchWithTimeout(url, options, timeoutMs)`
      where `timeoutMs` defaults to 2000. Change each call to pass 4000 as the third argument.

5. After applying all fixes, trigger a test benchmark from the live app, then verify:
   ```sql
   SELECT provider, success, method FROM public.benchmark_results
   ORDER BY tested_at DESC LIMIT 20;
   ```
   At least some rows must now have `success = true`.

6. Finally, manually trigger run_daily_job() and confirm the leaderboard reflects real scores:
   ```sql
   SELECT public.run_daily_job();
   SELECT provider, avg_latency, success_rate, stability_status FROM public.leaderboard;
   ```

---

### Leaderboard data flow (context — no code changes needed here)

- **Manual benchmark** (`runBenchmark` in `Home.tsx`) inserts results into BOTH `dns_queries`
  AND `benchmark_results`.
- **Cron monitor** (`api/daily-job.ts` → `run_daily_job()` RPC) inserts into `monitor_results`.
- **Personal leaderboard** (logged-in view): `fetchLeaderboard()` reads `dns_queries` filtered by
  `user_id` and aggregates in JavaScript — correct as-is.
- **Global leaderboard** (logged-out view): reads from the `leaderboard` TABLE which is populated
  by `run_daily_job()` aggregating `benchmark_results + monitor_results` from the last 30 days.
- This data flow is correct. Once bugs 18 and 19 are fixed the leaderboard will work end-to-end.

---

### After fixing both bugs, update agent.md:

- Mark Bug 18 as ✅ FIXED — state which migration was applied / verified.
- Mark Bug 19 as ✅ FIXED — list the specific file changes made (timeouts, maxDuration).

