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

### 1. `benchmark_results.keep` → should be `keep_forever`

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

### 2. `monitor_results` inserts strip `monitor_id` — orphaning every row

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
queried.

**Fix:** Remove the `.map(({ monitor_id, ...rest }) => rest)` destructure so `monitor_id` is
included in each inserted row:
```diff
- .insert(payload.map(({ monitor_id, ...rest }) => rest));
+ .insert(payload);
```

---

### 3. `AuthDialog` imports Supabase client from wrong path

**File:** `frontend/src/components/AuthDialog.tsx` line 12

```js
import { supabase } from "@/utils/supabaseClient";
```

The path `@/utils/supabaseClient` resolves to `frontend/src/utils/supabaseClient.ts`, which is a
thin wrapper. All other components import directly from `@/lib/supabase`. More importantly, the
`@/utils/supabaseClient` module re-exports using a different object shape, which can cause
runtime errors if the Supabase client is undefined when the dialog opens.

**Fix:**
```diff
- import { supabase } from "@/utils/supabaseClient";
+ import { supabase } from "@/lib/supabase";
```

---

### 4. Quad9 URL mismatch between client and server

**Frontend:** `frontend/src/lib/doh.ts` line 29
```js
url: "https://dns9.quad9.net:5053/dns-query",
```
**Backend:** `api/dns-query.ts` line 56
```js
quad9: "https://dns.quad9.net/dns-query",
```

These are completely different endpoints. Client-side Quad9 benchmarks use the non-standard port
5053 endpoint (`dns9.quad9.net:5053`) while the server-side proxy uses the standard endpoint.
Results are inconsistent and non-comparable between client and server measurements.

**Fix:** Standardize both to the canonical HTTPS/443 endpoint:
```diff
# frontend/src/lib/doh.ts line 29
- url: "https://dns9.quad9.net:5053/dns-query",
+ url: "https://dns.quad9.net/dns-query",
```
(No change needed in `api/dns-query.ts`.)

---

### 5. `allQueries` never sets the `error` field — error info is always lost

**File:** `frontend/src/pages/Home.tsx` lines 1083–1091 and 1127

When building the `allQueries` array (which feeds both `dns_queries` and `benchmark_results` inserts),
the `error` field is never set:
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
But on line 1127 the code reads `q.error || null`, which is always `null`:
```js
error: q.error || null,   // q.error is always undefined
```

**Fix:** Add the `error` field to the `allQueries.push()` call:
```diff
  method: final_method,
+ error: final_success ? null : "Failed to resolve",
});
```

---

## HIGH SEVERITY

---

### 6. Leaderboard sorts the array three times in JSX

**File:** `frontend/src/pages/tabs/LeaderboardTab.tsx` lines 34, 37–38, and 58

The same sort expression is called three separate times on the `leaderboard` array (once to get the
best provider name, once to get its score, once to render the table rows). Sorting mutates the
original array (`Array.prototype.sort` is in-place), which can cause subtle rendering
inconsistencies in React.

**Fix:** Compute the sorted array once in the component body before the return statement:
```ts
const sortedLeaderboard = [...leaderboard].sort(
  (a: any, b: any) => (b.reliability_score || b.score) - (a.reliability_score || a.score)
);
```
Then replace all three inline `.sort(...)` calls with `sortedLeaderboard`.

---

### 7. Monitors always save all providers instead of the user's selection

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

### 8. `handleDeleteAccount` leaves the auth record intact on RPC failure

**File:** `frontend/src/pages/Account.tsx` lines 199–229

If the Supabase RPC `delete_user` fails (e.g., the function doesn't exist — see existing note in
the code), the fallback code manually deletes data from tables but **cannot delete the auth user**
from the client side:
```js
// We can't delete auth user from client without RPC
await supabase.auth.signOut();
```
The user is signed out but their `auth.users` record still exists. They can sign back in to a
broken account with no profile data.

**Fix (two options — pick one):**
- **Option A (preferred):** Ensure the `delete_user` Supabase RPC exists (add it to a migration)
  so the fallback path is never hit.
- **Option B:** Display a clear toast/dialog warning the user that full account deletion requires
  contacting support if the RPC call fails, instead of silently signing them out.

---

## MEDIUM SEVERITY

---

### 9. `measureDoH` and `measureDoHBatch` are imported but never called

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

### 10. `monitor_results` inserts don't record `record_type`

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

### 11. Custom DNS provider format is always hardcoded to `"json"`

**Files:**
- `frontend/src/pages/Home.tsx` line 227 (preferences load)
- `frontend/src/pages/tabs/SettingsTab.tsx` line 73 (settings save)

```js
format: "json",
```

If a user adds a custom DoH endpoint that only supports the binary DNS-wire format (e.g., a
self-hosted DoH server using `application/dns-message`), the `jsonQuery` path will be used and
all queries will fail. There is no way to configure the format.

**Fix:** Add a "Format" dropdown (JSON / Binary) to the custom provider settings form in
`SettingsTab.tsx`, persist the chosen value in `user_preferences`, and load it back when
preferences are fetched.

---

### 12. `BenchmarkTab` chart filters providers twice inconsistently

**File:** `frontend/src/pages/tabs/BenchmarkTab.tsx`

`chartData` is computed for all providers, but the `<Bar>` components for inactive providers are
still rendered (just filtered again in the render expression). Any provider not in `activeProviders`
may still produce a bar entry in `chartData` that shows up incorrectly.

**Fix:** Apply the `activeProviders` filter when computing `chartData` so that inactive providers
are excluded at the data layer, not just the rendering layer.

---

### 13. `monitor.providers` format is inconsistent — may be stored as CSV string

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

### 14. `frontend/src/lib/monitor.ts` is an empty file

**File:** `frontend/src/lib/monitor.ts`

The file exists but contains no code. All monitor logic lives in `Home.tsx`. Either populate this
file with the monitor helper functions (to keep `Home.tsx` maintainable) or delete it.

---

### 15. No frontend validation for custom DNS URL before saving

**File:** `frontend/src/pages/tabs/SettingsTab.tsx`

Users can enter any string as a custom DoH URL. The backend validates it (using
`validateCustomUrl()` in `api/dns-query.ts`), but the frontend doesn't show an error until the
user runs a benchmark.

**Fix:** Import and call the same `validateCustomUrl()` logic (or an equivalent regex/URL check)
client-side when the user clicks "Save" in SettingsTab, and show an inline validation error if
the URL is invalid.

---

### 16. `allQueries` doesn't include `record_type` — the column exists in `dns_queries`

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
- Do not change the Supabase schema unless explicitly required by a fix above (fixes 1–5 are
  purely frontend/JS changes; only fix 8 Option A requires a new migration).
- Do not remove existing tests; add new ones only if a test for the fixed behaviour is missing.
