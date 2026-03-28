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

## Additional bugs discovered after audit (fixed in codebase)

---

### ✅ 20. `HistoryTab` uses `record.keep` instead of `record.keep_forever` — FIXED

**File:** `frontend/src/pages/tabs/HistoryTab.tsx`

The "Keep / Discard" button condition read `record.keep` but the database column is `keep_forever`
(bug #2 fixed `Home.tsx` to write `keep_forever`, but the display logic in `HistoryTab.tsx` still
checked the old `record.keep` field which is never set, causing the button to always show "Keep"
even for records that had already been kept).

**Fix applied:** Changed `record.keep` → `record.keep_forever` in the button condition.

---

### ✅ 21. `fetchPersonalBest()` not called after benchmark saves — FIXED

**File:** `frontend/src/pages/Home.tsx`

After a benchmark run finishes and results are saved to Supabase, the code called
`fetchLeaderboard()` and `fetchHistory()` but NOT `fetchPersonalBest()`. This meant the
"Your Best DNS" cards at the top of the Benchmark tab never reflected results from the just-run
benchmark without a full page reload.

**Fix applied:** Added `fetchPersonalBest()` immediately after `fetchHistory()` in the
post-benchmark Supabase save block.

---

### ✅ 22. `Account.tsx` `handleSavePreferences` missing `custom_dns_format` and URL validation — FIXED

**File:** `frontend/src/pages/Account.tsx`

The preferences upsert in Account.tsx omitted the `custom_dns_format` field, so the DNS format
preference (json vs binary) was silently dropped whenever a user saved from the Account page.
Additionally there was no URL validation, allowing invalid DoH endpoints to be stored.

**Fix applied:**
- Added `customFormat` state variable (`useState<"json" | "binary">("json")`).
- `fetchPreferences` now reads and sets `custom_dns_format` from the DB row.
- `handleSavePreferences` now validates the custom URL via the shared `validateCustomUrl` helper
  (imported from `SettingsTab.tsx`) before saving, and includes `custom_dns_format` in the upsert.

---

### ✅ 23. `MonitorsTab` interval display shows raw decimal for sub-minute intervals — FIXED

**File:** `frontend/src/pages/tabs/MonitorsTab.tsx`

The monitor card displayed `{monitor.interval_seconds / 60} minutes` which showed confusing
decimals for short intervals (e.g. "0.16666... minutes" for a 10-second interval).

**Fix applied:** The display now shows `X seconds` for intervals less than 60 seconds, and
`X minute(s)` for intervals ≥ 60 seconds. For example: "10 seconds", "30 seconds", "1 minute",
"5 minutes".

---

## Jules Prompt — Phase-Wise Instructions for Remaining Work

All **code** bugs (1–23) are now ✅ FIXED in the repository. The remaining work is
**database and deployment verification** — Jules must use Supabase MCP and the Vercel dashboard
to confirm the live environment matches the codebase.

Use the prompts below one phase at a time. Complete each phase fully before starting the next.

---

### Phase 1 — Verify live Supabase schema matches migrations

**Prompt for Jules:**

You are verifying the DNS Benchmark App at https://dns-benchmark-app.vercel.app.
Repo: TANMOY-SARKAR-cmd/dns-benchmark-app
You have Supabase MCP access.
All code bugs are fixed. Your only job in this phase is to check that every migration has been
applied to the live database. Do NOT write any code. Only run SQL queries.

Run each query below using Supabase MCP and record the result:

1. Confirm `leaderboard` is a TABLE (not a VIEW):
   ```sql
   SELECT table_type
   FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'leaderboard';
   ```
   Expected: `BASE TABLE`. If it returns `VIEW` or nothing, apply the full SQL from
   `supabase/migrations/20260403000000_leaderboard_table_and_daily_job.sql`.

2. Confirm `run_daily_job()` does NOT reference the removed `keep` column:
   ```sql
   SELECT prosrc FROM pg_proc WHERE proname = 'run_daily_job';
   ```
   The function body must NOT contain the string `AND keep = false`. If it does, apply the
   migration `supabase/migrations/20260403000000_leaderboard_table_and_daily_job.sql`.

3. Confirm the `leaderboard` table has the expected columns:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'leaderboard'
   ORDER BY ordinal_position;
   ```
   Expected columns: `provider`, `avg_latency`, `latency_stddev`, `success_rate`, `sample_count`,
   `score`, `reliability_score`, `udp_percentage`, `doh_percentage`, `fallback_percentage`,
   `failure_percentage`, `stability_status`, `last_updated`.

4. Confirm RLS is enabled and a public SELECT policy exists:
   ```sql
   SELECT relrowsecurity FROM pg_class WHERE relname = 'leaderboard';
   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'leaderboard';
   ```
   `relrowsecurity` must be `true`. There must be a policy with `cmd = 'SELECT'`.

5. Confirm the `delete_user` RPC exists and is SECURITY DEFINER:
   ```sql
   SELECT proname, prosecdef FROM pg_proc WHERE proname = 'delete_user';
   ```
   `prosecdef` must be `true`.

6. Confirm `benchmark_results` has `keep_forever` (not `keep`):
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'benchmark_results' AND column_name IN ('keep', 'keep_forever');
   ```
   Must return `keep_forever` only.

7. Confirm `dns_queries` has `is_kept` column:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'dns_queries' AND column_name = 'is_kept';
   ```
   Must return one row.

After running all queries, report which checks passed and which failed. If any failed, apply the
required migration(s) and re-run the checks until all pass. Then update agent.md to record the
verification date and results.

---

### Phase 2 — Trigger `run_daily_job()` and verify leaderboard data

**Prompt for Jules:**

You are verifying the DNS Benchmark App leaderboard pipeline.
Repo: TANMOY-SARKAR-cmd/dns-benchmark-app
You have Supabase MCP access.
Phase 1 (schema verification) must be complete before starting this phase.

1. Check whether `benchmark_results` or `monitor_results` contain any rows from the last 30 days:
   ```sql
   SELECT
     (SELECT COUNT(*) FROM public.benchmark_results WHERE tested_at >= NOW() - INTERVAL '30 days') AS benchmark_count,
     (SELECT COUNT(*) FROM public.monitor_results   WHERE tested_at >= NOW() - INTERVAL '30 days') AS monitor_count;
   ```
   If both counts are 0, the leaderboard will be empty after running the daily job — that is
   expected. Note the counts and continue.

2. Manually trigger `run_daily_job()`:
   ```sql
   SELECT public.run_daily_job();
   ```
   If this returns an error, record the full error text, find the cause in the function body
   (`SELECT prosrc FROM pg_proc WHERE proname = 'run_daily_job';`), fix it, and re-run.

3. Check the leaderboard table:
   ```sql
   SELECT provider, avg_latency, success_rate, sample_count, stability_status
   FROM public.leaderboard
   ORDER BY reliability_score DESC NULLS LAST;
   ```
   If rows exist: ✅ leaderboard is working. Record the result in agent.md.
   If no rows exist and benchmark_count > 0: there is a bug in the leaderboard INSERT — inspect
   `run_daily_job()` source and fix the SQL.

4. Confirm `daily_stats` table is being populated:
   ```sql
   SELECT date, provider, avg_latency, success_rate, sample_count
   FROM public.daily_stats
   ORDER BY date DESC
   LIMIT 10;
   ```

5. Update agent.md: mark this phase as completed, note the date, and record the leaderboard row
   count and whether `run_daily_job()` ran without errors.

---

### Phase 3 — Verify Vercel deployment and cron configuration

**Prompt for Jules:**

You are verifying the production deployment of the DNS Benchmark App.
Repo: TANMOY-SARKAR-cmd/dns-benchmark-app
You do NOT need Supabase MCP for this phase — all checks are in the Vercel dashboard.

1. Open the Vercel dashboard for the `dns-benchmark-app` project.

2. Check **Settings → Environment Variables** and confirm the following are set for **Production**:
   - `VITE_SUPABASE_URL` — the Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — the Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — the Supabase service role key (used by `api/daily-job.ts`)
   - `CRON_SECRET` — a secret string; must match what Vercel sends as `x-vercel-cron` or Bearer
     token in the Authorization header when the cron fires
   If any are missing, add them now (obtain values from the Supabase project settings page).

3. Check **Settings → Cron Jobs** and confirm the cron is configured:
   - Path: `/api/daily-job`
   - Schedule: `0 2 * * *` (daily at 02:00 UTC)
   If the cron job is missing, add it (or verify `vercel.json` crons section is correct and
   re-deploy).

4. Check **Deployments** — confirm the latest deployment is from the `main` branch and its status
   is **Ready**. If it is stale or failed, trigger a redeploy.

5. Check **Logs → Functions** for `/api/dns-query` — look at the last 5 invocations and confirm
   the batch log line shows `"successCount": N` where N > 0. If every call has `successCount: 0`,
   the DNS resolution is still failing — investigate Vercel outbound network restrictions.

6. Update agent.md: note which env vars were present / added, whether the cron was configured,
   and whether `/api/dns-query` logs show successful queries.

---

### Phase 4 — End-to-end verification (run benchmark → check DB → check UI)

**Prompt for Jules:**

You are doing final end-to-end verification of the DNS Benchmark App.
Repo: TANMOY-SARKAR-cmd/dns-benchmark-app
Phases 1, 2, and 3 must be complete before starting this phase.

1. Open https://dns-benchmark-app.vercel.app in a browser (incognito is fine).

2. In the **Benchmark** tab, enter 3 domains (e.g. `google.com`, `github.com`, `cloudflare.com`)
   and click **Run DNS Test**. Wait for it to complete.

3. Check the results table — at least some rows must show **Server** or **Client Fallback** status
   (green or blue badge), not just "Failed" (red). If all rows show "Failed", the DNS resolution
   pipeline is broken — re-check Phase 3 step 5 and the Vercel function logs.

4. Log in with a test account. After logging in, run the same benchmark again. Then:
   a. Verify the "Your Best DNS" cards at the top of the Benchmark tab update to show the
      provider with the lowest average latency from your test.
   b. Check the **Leaderboard** tab — it should now show "Your DNS Performance" with your
      results aggregated.
   c. Check the **History** tab — the latest benchmark rows should appear, and the
      "Keep" / "Discard" button should reflect the actual `keep_forever` value (default: Discard).
   d. Check the **Live Logs** tab — it should show the DNS queries from your just-run benchmark.

5. Use Supabase MCP to confirm rows were inserted correctly:
   ```sql
   SELECT provider, latency_ms, success, method, tested_at
   FROM public.dns_queries
   ORDER BY tested_at DESC
   LIMIT 15;
   ```
   At least some rows must have `success = true`.

   ```sql
   SELECT provider, latency_ms, success, method, tested_at
   FROM public.benchmark_results
   ORDER BY tested_at DESC
   LIMIT 15;
   ```

6. Trigger `run_daily_job()` one more time to confirm the leaderboard picks up the fresh data:
   ```sql
   SELECT public.run_daily_job();
   SELECT provider, avg_latency, success_rate, stability_status
   FROM public.leaderboard
   ORDER BY reliability_score DESC NULLS LAST;
   ```

7. Update agent.md: mark Phase 4 as complete, note the date, record the overall pass/fail
   result for each verification step, and add a final "All bugs verified fixed" summary line.

---

### Leaderboard data flow (context — no code changes needed here)

- **Manual benchmark** (`runBenchmark` in `Home.tsx`) inserts results into BOTH `dns_queries`
  AND `benchmark_results`.
- **Cron monitor** (`api/daily-job.ts` → `run_daily_job()` RPC) inserts into `monitor_results`.
- **Personal leaderboard** (logged-in view): `fetchLeaderboard()` reads `dns_queries` filtered by
  `user_id` and aggregates in JavaScript — correct as-is.
- **Global leaderboard** (logged-out view): reads from the `leaderboard` TABLE which is populated
  by `run_daily_job()` aggregating `benchmark_results + monitor_results` from the last 30 days.
- This data flow is correct. All code bugs are fixed. The remaining risk is the live DB or
  environment configuration not matching the repo.

