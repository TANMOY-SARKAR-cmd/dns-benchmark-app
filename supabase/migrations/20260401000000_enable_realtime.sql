ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.dns_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.benchmark_results;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.monitor_results;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.daily_stats;
-- leaderboard is a view, so it cannot be added to publication.
