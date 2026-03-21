# DNS Benchmark & Proxy - System Architecture Audit Report

## 1. Architecture Overview
The application is a client-centric DNS benchmarking tool with a hybrid resolution architecture.
* **Frontend**: React application built with Vite, TypeScript, Tailwind CSS, and shadcn/ui. Handles user interactions, data visualization (Recharts), and client-side DoH fallback capabilities.
* **Backend (API)**: Vercel Node.js Serverless Functions (`/api/dns-query` and `/api/health`). Natively resolves domains via UDP (using `node:dns`) for performance, falling back to DoH via HTTPS if UDP fails. Designed to bypass browser CORS and network limitations.
* **Database**: Supabase PostgreSQL. Stores historical benchmarking data (`dns_queries`, `benchmark_results`), user configurations (`user_preferences`, `monitors`), and computes global metrics (via the `leaderboard` view).
* **Analytics**: Integrates Tinybird (`@tinybirdco/sdk`) for tracking page views and engagement.

## 2. Workflow Trace (Data Flow)
1. **User Initiation**: A user enters a list of domains in the React frontend and starts the benchmark.
2. **Client Orchestration**: `frontend/src/lib/doh.ts` prepares the queries. For batched operations, it utilizes `measureDoHBatch`.
3. **Backend Processing**: The frontend POSTs the payload to `/api/dns-query`.
    * The serverless function validates the input.
    * It chunks the queries (size of 3) to prevent overwhelming upstream servers.
    * It attempts native UDP resolution (`node:dns`). If that fails, it executes a fetch to the provider's DoH endpoint.
    * An overall global timeout of 4.5s is enforced to prevent Vercel hobby-tier execution limits.
4. **Client Fallback**: If the backend returns `success: false` for specific domains or times out, the frontend triggers a local client-side DoH resolution (`measureClientDoH`) racing JSON and binary (`dns-packet`) formats.
5. **Persistence**: Completed metrics (combining server and fallback results) are pushed directly to Supabase (`dns_queries` and `benchmark_results`).
6. **Aggregation**: The `leaderboard` view in Supabase dynamically recalculates global `avg_latency` and `success_rate`.

## 3. Broken Links / Bugs
* **Inconsistent Monitor Storage**: The background monitor logic in `frontend/src/lib/monitor.ts` attempts to insert background check results into `dns_queries` and `benchmark_results`. However, `frontend/src/pages/Home.tsx` contains logic (line 297) writing directly to `monitor_results`. The application splits its tracking across different tables unpredictably.
* **Outdated Schema usage in Shared Services**: The `shared/services/queryLogger.ts` uses an outdated schema property (`upstream_provider` instead of `provider`) and references Node.js exclusive APIs (`process.env`) via `shared/supabaseClient.ts`.
* **CORS Over-permissiveness**: Both `/api/dns-query.ts` and `/api/health.ts` specify `Access-Control-Allow-Origin: "*"`. Because the API executes potentially expensive operations without API keys, this leaves the backend completely open to third-party abuse as a public DNS proxy.

## 4. Performance Issues
* **Severe Network Spam in Monitor**: The `runMonitorBenchmark` function in `frontend/src/lib/monitor.ts` loops over domains and providers, awaiting `measureDoH(provider, domain)` sequentially or in massive unbatched parallel bursts. This causes an `N * M` explosion of HTTP POST requests to `/api/dns-query`. It **must** utilize `measureDoHBatch` to handle this efficiently in a single network roundtrip.
* **Synchronous Chunking**: `/api/dns-query.ts` chunks requests into groups of 3 (`CHUNK_SIZE = 3`). Because it awaits `Promise.allSettled` for each chunk *sequentially*, large batches will easily hit the 4.5s `GLOBAL_TIMEOUT` and artificially fail remaining queries.

## 5. Security Issues
* **Critical RLS Policy Flaws**:
    * `dns_queries` and `benchmark_results` have policies set to: `Allow public insert access... FOR INSERT TO public WITH CHECK (true)`. A malicious actor can easily write a script to insert millions of fake 1ms latency records, entirely poisoning the global leaderboard and consuming database quotas.
    * `user_preferences` allows `UPDATE` for rows where `user_id = 'anonymous'`. Any unauthenticated user's client can overwrite the global "anonymous" preferences, causing collisions across all guest users.
    * Tables like `proxy_config`, `proxy_stats`, and `dns_cache_metrics` have permissive `Public ALL` or `Public INSERT` policies, offering full read/write access to unauthenticated sessions.
* **Lack of Rate Limiting**: There is no rate limiting on `/api/dns-query.ts`. Combined with the open CORS policy, an attacker can run up Vercel serverless execution costs (DDoS via invocation).

## 6. Database & Supabase Issues
* **Referential Integrity Loss**: The `user_id` column in `dns_queries`, `benchmark_results`, and `user_preferences` is declared as type `TEXT` (defaulting to `'anonymous'`) rather than a strict `UUID` foreign key referencing `auth.users(id)`.
* **Scattered Migration Scripts**: The root directory is cluttered with conflicting SQL definitions (`supabase-schema.sql`, `supabase_phase3.sql`, `updated-supabase-schema.sql`), making the single source of truth for the schema ambiguous outside of the `supabase/migrations/` folder.

## 7. Unused Code / Dead UI
* **Dead Code**: The entire `shared/services/` directory (`benchmarkLogger.ts`, `proxyStats.ts`, `queryLogger.ts`) is obsolete, never imported by the frontend or backend, and reliant on broken Node dependencies.
* **Lingering Artifacts**: The repository root is polluted with patch files (`update_benchmark_results.patch`, `code_review.patch`), python scripts (`update_doh.py`), base64 error logs (`err.b64`), and screenshot/video validation assets (`verification.png`, `verification/`).

## 8. Recommendations
1. **Lock Down Database**: Rewrite RLS policies. Disallow direct inserts to `dns_queries` from unauthenticated users, or pipe them through a signed serverless function to validate payloads.
2. **Isolate Guest State**: Remove the ability for `user_id = 'anonymous'` to save to `user_preferences` or `monitors`. Persist guest preferences strictly in `localStorage`.
3. **Restrict API Access**: Hardcode `Access-Control-Allow-Origin` in the Vercel functions to the deployed Vercel URL and localhost during development.
4. **Optimize Chunking**: Increase `CHUNK_SIZE` in `/api/dns-query` (e.g., to 10) and run chunks concurrently up to a safe limit to avoid timing out valid queries.
5. **Clean the Repository**: Delete the `shared/services/` folder and all root-level `.patch` / `.sql` / `.py` / `.png` artifacts.

## 9. Priority Fix List (High → Low)
1. **HIGH**: Patch RLS policies in Supabase to prevent unauthorized or anonymous bulk `INSERT` and `UPDATE` spam.
2. **HIGH**: Refactor `runMonitorBenchmark` in `frontend/src/lib/monitor.ts` to use `measureDoHBatch` instead of singular `measureDoH` calls to prevent DDoS-ing your own API.
3. **MEDIUM**: Update CORS headers in `/api/dns-query.ts` to reject requests not originating from your frontend.
4. **MEDIUM**: Clean up dead code (`shared/services/` and root artifacts) to reduce bundle confusion and improve developer experience.
5. **LOW**: Restructure `user_id` across databases to use proper Foreign Keys and implement a strict separation for guest data (e.g. dropping `user_id = 'anonymous'` db storage).
