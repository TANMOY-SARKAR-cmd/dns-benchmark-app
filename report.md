System Part| Status| Notes
Provider matching| OK | Frontend sends and API receives provider.key. Matching uses r.provider === provider.key.
Result priority| OK | Priority is server-udp -> server-doh -> fallback -> failed. Fallback executed only for failedProviders.
Database schema| OK | benchmark_results and monitor_results updated to use tested_at, no created_at found in use.
History page| OK | History page reads record.method (or method_used for older records).
Monitor security| OK | All monitor queries use .eq("user_id", user.id) for select, update, and delete.
Monitoring loop| OK | Monitor loop uses setInterval with intervalMs. Stops/restarts via activeIntervals clearing in useEffect.
Daily cron| OK | vercel.json runs /api/daily-job once per day, which calls run_daily_job RPC to delete old data and recompute leaderboard.
TypeScript| OK | No TypeScript errors (pnpm run check passes).
