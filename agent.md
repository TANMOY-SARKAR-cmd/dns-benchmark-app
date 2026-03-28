# DNS Benchmark App — Bug Fix Guide for Jules

This document lists every confirmed logic error and broken feature found in the codebase.
Fix them **in order of severity** without refactoring unrelated code.
The live app is at https://dns-benchmark-app.vercel.app

---

## Overview of the tech stack

- **Frontend:** React + TypeScript + Vite, located in `frontend/`
- **Backend API:** Vercel serverless functions in `api/`
- **Database:** Supabase (PostgreSQL). Schema is in `updated-supabase-schema.sql` and `supabase/migrations/`
- **DNS measurement:** Client-side via `frontend/src/lib/doh.ts`; server-side via `api/dns-query.ts`
- **Auth:** Supabase Auth, managed in `frontend/src/contexts/AuthContext.tsx`

---

## CRITICAL — Fix these first

---

### 1. Supabase Realtime not enabled — Live Logs will never receive events

**Root cause:** The commands that add tables to the Supabase Realtime publication exist only in
`updated-supabase-schema.sql` (lines 112–116):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE dns_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE benchmark_results;
ALTER PUBLICATION supabase_realtime ADD TABLE monitor_results;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_stats;
```
These commands are **not present in any migration file** under `supabase/migrations/`. If the project
was set up via migrations (the normal workflow), the tables were never added to the publication, so
Supabase Realtime never fires events for them.

**Fix:** Create a new migration file, e.g.
`supabase/migrations/20260401000000_enable_realtime.sql`, with:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.dns_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.benchmark_results;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.monitor_results;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.daily_stats;
```
Apply via `supabase db push` or by running the migration in the Supabase dashboard SQL editor.

---

### 2. `benchmark_results.keep` → should be `keep_forever`

**File:** `frontend/src/pages/Home.tsx` lines 843 and 848

The database column is named `keep_forever` (see `updated-supabase-schema.sql` line 78), but the
frontend calls `.update({ keep: keepState })`. This silently fails — Supabase ignores unknown columns.

**Fix:**
```diff
- .update({ keep: keepState })
+ .update({ keep_forever: keepState })
```
Also update the in-memory state merge on line 848:
```diff
- prev.map(item => (item.id === id ? { ...item, keep: keepState } : item))
+ prev.map(item => (item.id === id ? { ...item, keep_forever: keepState } : item))
```

---

### 3. `monitor_results` inserts strip `monitor_id` — orphaning every row

**File:** `frontend/src/pages/Home.tsx` line 432

The code deliberately strips `monitor_id` before inserting into `monitor_results`:
```js
.insert(payload.map(({ monitor_id, ...rest }) => rest)); // "Strictly omitting monitor_id"
```
But `monitor_results.monitor_id` **exists in the schema** (line 37 of `updated-supabase-schema.sql`):
```sql
monitor_id uuid REFERENCES public.monitors(id),
```
Without it, monitor results are orphaned — they cannot be associated with their parent monitor when
queried. Additionally the Realtime subscription on `monitor_results` maps events by `monitor_id`
(Home.tsx line 174–178), so without it monitor result cards will never update.

**Fix:** Remove the `.map(({ monitor_id, ...rest }) => rest)` destructure so `monitor_id` is
included in each inserted row:
```diff
- .insert(payload.map(({ monitor_id, ...rest }) => rest));
+ .insert(payload);
```

---

### 4. `AuthDialog` imports Supabase client from wrong path

**File:** `frontend/src/components/AuthDialog.tsx` line 12

```js
import { supabase } from "@/utils/supabaseClient";
```

The path `@/utils/supabaseClient` resolves to `frontend/src/utils/supabaseClient.ts`, which uses
different environment variable names than the canonical client. All other components import directly
from `@/lib/supabase`. This can cause the Supabase client to be `undefined` when the dialog opens.

**Fix:**
```diff
- import { supabase } from "@/utils/supabaseClient";
+ import { supabase } from "@/lib/supabase";
```

---

### 5. `delete_user` RPC fails due to foreign key violation + missing profile deletion + missing `search_path`

**Files:**
- `supabase/migrations/20260321143880_add_delete_user_rpc.sql`
- `frontend/src/pages/Account.tsx` lines 199–229

**Problem A — FK violation:** The current RPC is:
```sql
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END; $$;
```
`public.profiles` has `id uuid PRIMARY KEY REFERENCES auth.users(id)` **without** `ON DELETE CASCADE`.
Attempting to `DELETE FROM auth.users` while a `profiles` row references it raises a foreign key
constraint violation, causing the RPC to always fail.

**Problem B — Missing `search_path`:** `SECURITY DEFINER` functions must include
`SET search_path = public` to prevent search-path hijacking (project convention).

**Problem C — Fallback leaves `auth.users` intact:** When the RPC fails, `Account.tsx` falls
back to deleting table data but calls `supabase.auth.signOut()` without deleting `auth.users`.
The user is signed out but can immediately sign back in to a broken, data-less account.
The fallback also never deletes the `profiles` row.

**Fix:** Replace the migration content with a corrected RPC (create a new migration
`supabase/migrations/20260401000001_fix_delete_user_rpc.sql`):
```sql
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Must delete profile first due to FK reference to auth.users
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM public.monitors WHERE user_id = v_uid::text;
  DELETE FROM public.user_preferences WHERE user_id = v_uid::text;
  DELETE FROM public.dns_queries WHERE user_id = v_uid::text;
  DELETE FROM public.benchmark_results WHERE user_id = v_uid::text;
  DELETE FROM public.monitor_results WHERE user_id = v_uid::text;
  -- Now safe to delete auth user
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
```
Also add `profiles` to the client-side fallback in `Account.tsx`:
```diff
  await Promise.all([
+   supabase.from("profiles").delete().eq("id", user.id),
    supabase.from("dns_queries").delete().eq("user_id", user.id),
    supabase.from("benchmark_results").delete().eq("user_id", user.id),
    supabase.from("monitor_results").delete().eq("user_id", user.id),
    supabase.from("monitors").delete().eq("user_id", user.id),
    supabase.from("user_preferences").delete().eq("user_id", user.id),
  ]);
```

---

### 6. Quad9 URL mismatch between client and server

**Frontend:** `frontend/src/lib/doh.ts` line 29
```js
url: "https://dns9.quad9.net:5053/dns-query",
```
**Backend:** `api/dns-query.ts` line 56
```js
quad9: "https://dns.quad9.net/dns-query",
```

These are completely different endpoints. Client-side Quad9 benchmarks use the non-standard port
5053 endpoint while the server-side proxy uses the standard endpoint. Results are inconsistent and
non-comparable between client and server measurements.

**Fix:**
```diff
# frontend/src/lib/doh.ts line 29
- url: "https://dns9.quad9.net:5053/dns-query",
+ url: "https://dns.quad9.net/dns-query",
```

---

## HIGH SEVERITY

---

### 7. Leaderboard shows 100% failed — Vercel cron job is never authorized

**File:** `api/daily-job.ts` and `vercel.json`

The global leaderboard (shown to non-logged-in users) is populated by `run_daily_job()` called via
the Vercel cron at `0 2 * * *`. The handler requires:
```typescript
authHeader === `Bearer ${cronSecret}`
```
where `cronSecret = process.env.CRON_SECRET`.

If `CRON_SECRET` is not set in the Vercel project environment variables, the handler always
returns `401 Unauthorized`. The `leaderboard` table is never refreshed, so it either stays empty
(users see nothing) or shows stale data from when the migration was first applied (possibly all
zeros because no benchmark data existed yet).

**Fix (two-part):**

1. **Set `CRON_SECRET` in Vercel environment variables.** Vercel automatically sends
   `Authorization: Bearer {CRON_SECRET}` on cron requests when `CRON_SECRET` is defined. Add any
   non-empty secret string as `CRON_SECRET` in the Vercel dashboard under Settings → Environment
   Variables.

2. **Optional — allow unauthorized calls from Vercel's own cron IP range** by also accepting
   requests with the `x-vercel-cron` request header (which Vercel adds to cron calls):
   ```typescript
   const isVercelCron = request.headers.get("x-vercel-cron") === "1";
   const isAuthorized = isDev || isVercelCron || (
     !!cronSecret && cronSecret !== "undefined" &&
     authHeader === `Bearer ${cronSecret}`
   );
   ```
   Note: The `x-vercel-cron` header is only sent by Vercel's cron scheduler and cannot be spoofed
   from the public internet on Vercel's infrastructure.

---

### 8. Live Logs: same domain+provider entry should update, not duplicate

**File:** `frontend/src/pages/Home.tsx` line 191

The Realtime subscription callback always prepends new entries:
```typescript
setLiveLogs(prev => [payload.new, ...prev].slice(0, 50));
```
When a user re-runs a benchmark for the same domain and DNS provider, a second row is added instead
of replacing the first. For a logged-in user's personal view the list grows with stale duplicates.

**Fix:** Update the existing entry for the same `domain + provider` combination if one exists;
otherwise prepend as a new entry:
```typescript
payload => {
  const newLog = payload.new;
  setLiveLogs(prev => {
    const existingIndex = prev.findIndex(
      log => log.domain === newLog.domain && log.provider === newLog.provider
    );
    if (existingIndex !== -1) {
      // Replace the existing entry in-place
      const updated = [...prev];
      updated[existingIndex] = newLog;
      return updated;
    }
    // New entry: prepend and cap at 50
    return [newLog, ...prev].slice(0, 50);
  });
}
```

---

### 9. `allQueries` never sets the `error` field — error info is always lost

**File:** `frontend/src/pages/Home.tsx` lines 1083–1091 and 1127

When building the `allQueries` array (which feeds both `dns_queries` and `benchmark_results` inserts),
the `error` field is never set, so all failed queries are stored with `error: null`:
```js
allQueries.push({
  user_id: userId,
  domain,
  provider: provider.name,
  latency_ms: final_success ? final_latency : null,
  success: final_success,
  tested_at: new Date().toISOString(),
  method: final_method,
  // ← error field missing
});
```
But on line 1127 the code reads `q.error || null`, which is always `null`.

**Fix:** Add the `error` field to the `allQueries.push()` call:
```diff
  method: final_method,
+ error: final_success ? null : "Failed to resolve",
});
```

---

### 10. Monitors always save all providers instead of the user's selection

**File:** `frontend/src/pages/Home.tsx` lines 515 and 525

When creating or updating a monitor, the code saves `userProviders.map(p => p.name)` — i.e.
**all** active providers — rather than only the providers the user selected for that monitor.
This means every monitor always tests all providers regardless of the monitor configuration form.

**Fix:** Add a `selectedMonitorProviders` state to the monitor creation form (a multi-select or
checkbox list) and save only those values:
```diff
- providers: userProviders.map(p => p.name),
+ providers: selectedMonitorProviders,   // user's per-monitor selection
```

---

## MEDIUM SEVERITY

---

### 11. `measureDoH` and `measureDoHBatch` are imported but never called

**File:** `frontend/src/pages/Home.tsx` lines 24 and 63

```js
import {
  measureDoH,        // ← never used
  measureClientDoH,
  ...
} from "@/lib/doh";
import { measureDoHBatch } from "@/lib/doh";  // ← never used
```

Only `measureClientDoH` is actually called. The unused imports add confusion about which function
runs the benchmark.

**Fix:** Remove both unused imports:
```diff
  import {
-   measureDoH,
    measureClientDoH,
    DOH_PROVIDERS,
    BenchmarkResult,
  } from "@/lib/doh";
- import { measureDoHBatch } from "@/lib/doh";
```

---

### 12. `monitor_results` inserts don't record `record_type`

**File:** `frontend/src/pages/Home.tsx` lines 394–425 (the monitor payload building block)

The `monitor_results` schema includes a `record_type` column (inherited from the dns_queries
pattern), but the payload object never sets it. All monitor records end up with a null
`record_type`, making it impossible to distinguish A from AAAA tests in history.

**Fix:** Add `record_type: "A"` to the monitor result payload (or make the monitor form let users
choose the record type and store it on the `monitors` table):
```diff
  payload.push({
    user_id: user.id,
    domain,
    provider: isCustom ? (provider.url || "custom") : provider.name,
    latency_ms: success ? latency : null,
    success,
    method: method || "failed",
    error: success ? null : "Failed to resolve",
    tested_at: testedAt,
    keep_forever: false,
    monitor_id: monitor.id,
+   record_type: "A",
  });
```

---

### 13. `BenchmarkTab` chart filters providers twice inconsistently

**File:** `frontend/src/pages/tabs/BenchmarkTab.tsx`

`chartData` is computed for all providers, but the `<Bar>` components for inactive providers are
still rendered (just filtered again in the render expression). Any provider not in `activeProviders`
may still produce a bar entry in `chartData` that shows up incorrectly.

**Fix:** Apply the `activeProviders` filter when computing `chartData` so that inactive providers
are excluded at the data layer, not just the rendering layer.

---

### 14. `monitor.providers` format is inconsistent — may be stored as CSV string

**File:** `frontend/src/pages/Home.tsx` lines 461–470

When loading monitors from the database, the code defensively handles both an array and a
comma-separated string:
```js
const providers = Array.isArray(monitor.providers)
  ? monitor.providers
  : (monitor.providers as string).split(",").map(s => s.trim());
```
But when saving monitors (lines 515, 525) only the array form is written. If old data exists in
CSV form it will cause display issues.

**Fix:** Ensure the `monitors.providers` column in the schema is typed as `jsonb` (not `text`),
and run a one-time migration to convert any legacy CSV rows to a proper JSON array. Remove the CSV
fallback once the migration is confirmed.

---

## LOW SEVERITY / CLEANUP

---

### 15. `frontend/src/lib/monitor.ts` is an empty file

**File:** `frontend/src/lib/monitor.ts`

The file exists but contains no code. All monitor logic lives in `Home.tsx`. Either populate this
file with the monitor helper functions (to keep `Home.tsx` maintainable) or delete it.

---

### 16. No frontend validation for custom DNS URL before saving

**File:** `frontend/src/pages/tabs/SettingsTab.tsx`

Users can enter any string as a custom DoH URL. The backend validates it (using
`validateCustomUrl()` in `api/dns-query.ts`), but the frontend doesn't show an error until the
user runs a benchmark.

**Fix:** Import and call the same `validateCustomUrl()` logic (or an equivalent regex/URL check)
client-side when the user clicks "Save" in SettingsTab, and show an inline validation error if
the URL is invalid.

---

### 17. `allQueries` doesn't include `record_type` — the column exists in `dns_queries`

**File:** `frontend/src/pages/Home.tsx` lines 1083–1091

The `dns_queries` table has a `record_type` column (schema line 54), but `allQueries.push()` never
sets it.

**Fix:** Add `record_type: "A"` (or the actual record type selected by the user) to the
`allQueries.push()` call.

---

## Reference: confirmed schema column names

Use these when writing Supabase queries — do not guess or use aliases:

| Table | Column | Notes |
|---|---|---|
| `benchmark_results` | `keep_forever` | **not** `keep` |
| `monitor_results` | `keep_forever` | **not** `keep` |
| `monitor_results` | `monitor_id` | FK to `monitors.id` — **include it** |
| `leaderboard` | `last_updated` | **not** `updated_at` |
| `dns_queries` | `is_kept` | retention flag |
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
