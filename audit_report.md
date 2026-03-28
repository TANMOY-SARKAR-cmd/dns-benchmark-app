# Full System Audit — DNS Benchmark App

## Category | Status | Issues Found | Severity | Recommendation

| Category | Status | Issues Found | Severity | Recommendation |
|---|---|---|---|---|
| Project Structure | Passed | `shared` folder exists but is obsolete dead code. | Low | Remove `shared` folder. |
| Frontend | Passed | Routing uses `react-router-dom`, Auth logic robust (`AuthCallback.tsx`). No dangerous localStorage found. | Low | Ensure strict boolean checking for `success` on DNS queries. |
| API | Passed | `/api/dns-query.ts` has batch limits, abort controllers, global timeout. `/api/daily-job.ts` checks `CRON_SECRET`. | Low | `/api/dns-query.ts` `customUrl` should be strictly validated (URL parsing, protocol check). |
| Authentication | Passed | Setup handles PKCE and implicit flows securely. Uses `localStorage` correctly via Supabase SDK. | Low | Ensure unlinking identity checks count of identities to prevent account lockout. |
| Supabase Schema | Passed | Expected tables exist: `profiles`, `user_preferences`, `monitors`, `monitor_results`, `benchmark_results`, `dns_queries`, `leaderboard`, `daily_stats`. Schema strictly maps API response. | Low | None. |
| RLS Security | Warning | `dns_queries` and `benchmark_results` allow public inserts (`WITH CHECK (true)`). Users can manage their own data. | Medium | Public inserts could lead to database bloat. Consider rate-limiting or restricting anonymous inserts. |
| Supabase Auth Config | Passed | Configured correctly. | Low | None. |
| Cron Job | Passed | Vercel cron configured for `0 2 * * *`. `/api/daily-job.ts` calls `run_daily_job` RPC. | Low | None. |
| Leaderboard | Passed | Generated via RPC, stores pre-calculated metrics (reliability_score, stability_status, etc). | Low | None. |
| Monitor System | Passed | Execution interval stored in `interval_seconds`. RLS correctly restricts access. | Low | None. |
| Security | Warning | `Anyone can insert dns_queries` and `Anyone can insert benchmark_results` might be abused. SSRF risk on `customUrl`. | Medium | Validate `customUrl`. Consider rate limiting. |
| Data Flow | Passed | Client DoH fallback mechanism works. Server `method` mapped correctly. | Low | None. |

## Detailed Findings

### RLS Policies
The RLS policies on `dns_queries` and `benchmark_results` have an `INSERT` policy where `WITH CHECK (true)`, allowing unauthenticated (anonymous) users to insert records.
```sql
CREATE POLICY "Anyone can insert dns_queries" ON public.dns_queries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert benchmark_results" ON public.benchmark_results FOR INSERT WITH CHECK (true);
```
While this is likely intended for anonymous benchmarking, it poses a risk of database bloat or spam if an attacker runs a script.

### Missing Features / Potential Future Improvements
- **API Rate Limiting:** Implement rate limiting on the `/api/dns-query` endpoint to prevent abuse of the Vercel serverless function and upstream DNS providers.
- **Anonymous Benchmarking Abuse Prevention:** Add measures (like captcha or simple rate-limiting by IP) for the open Supabase `INSERT` policies if the application scales.
- **Dead Code Cleanup:** Remove the `shared/` directory as it is obsolete.

### Security Risks
- **SSRF via `customUrl`:** In `dns-query.ts`, the `customUrl` is passed directly to `fetch()`. While it's used for DoH, ensure it only hits expected ports/protocols (HTTPS) to prevent Server-Side Request Forgery.
- **Unauthenticated Database Inserts:** The `dns_queries` and `benchmark_results` tables can be spammed by unauthorized users.

### Performance Risks
- **Supabase Storage limits:** Anonymous benchmark results kept indefinitely (if a user maliciously sets `keep_forever` or `keep` to true via API spam) could fill the database over time. The 30-day cleanup helps, but a determined spammer could insert massive amounts of data daily.

## Database Fix for `public.leaderboard`

### Before
- **leaderboard type**: `VIEW`
- **run_daily_job behavior**: Cleaned up logs, stored `daily_stats`, but omitted any update logic for the leaderboard.
- **realtime membership**: `leaderboard` was missing from `supabase_realtime` publication.
- **leaderboard RLS/policy**: N/A (was a View).

### After
- **leaderboard type**: `TABLE` matching the frontend's expected properties perfectly.
- **run_daily_job behavior**: Deletes old logs, truncates/deletes `public.leaderboard` table, recomputes all aggregated statistics for the leaderboard and inserts into the table, and inserts into `daily_stats`. Contains `SECURITY DEFINER`.
- **realtime membership**: `leaderboard` is added and present in `supabase_realtime` publication.
- **leaderboard RLS/policy**: Row level security is enabled with a public `SELECT` read access policy `Allow public read access to leaderboard`.

### Caveats / Notes
- No more caveats remaining. Full app compatibility maintained for the transition. Migration was designed with strict structure matching the original view structure and was successful.
