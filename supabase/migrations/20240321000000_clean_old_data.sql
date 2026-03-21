-- Create the automatic cleanup function
CREATE OR REPLACE FUNCTION public.clean_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Delete dns_queries older than 30 days where is_kept = false
  DELETE FROM public.dns_queries
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND is_kept = false;

  -- Note: We intentionally DO NOT delete from benchmark_results
  -- because we want to keep aggregated benchmark results for the leaderboard.
  -- We also DO NOT delete dns_queries where is_kept = true (user-marked records).
END;
$$;

-- Schedule the new cleanup function using pg_cron
DO $$
BEGIN
  PERFORM cron.unschedule('daily_data_cleanup');
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-dns-queries');
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- Schedule the new job to run daily at midnight
SELECT cron.schedule(
    'clean_old_data_job',
    '0 0 * * *',
    'SELECT public.clean_old_data();'
);

-- Ensure the leaderboard view uses only aggregated data (benchmark_results)
-- Standard views in Postgres run with the privileges of their owner (which is the user who creates it, typically postgres)
-- This allows users to read the leaderboard without needing direct access to the underlying table.
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
    provider,
    round(avg(latency_ms), 2) AS global_avg_ms,
    count(*) AS total_tests
FROM public.benchmark_results
GROUP BY provider
ORDER BY round(avg(latency_ms), 2);

-- Revoke and Grant necessary permissions for the view
-- To ensure public can query the leaderboard view:
GRANT SELECT ON public.leaderboard TO public;
GRANT SELECT ON public.leaderboard TO anon;
GRANT SELECT ON public.leaderboard TO authenticated;

-- Ensure no data leaks between users in benchmark_results and dns_queries
ALTER TABLE public.benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dns_queries ENABLE ROW LEVEL SECURITY;

-- Drop all existing permissive policies to recreate them cleanly and securely
DROP POLICY IF EXISTS "Public read dns_queries" ON public.dns_queries;
DROP POLICY IF EXISTS "User data isolated by user_id for dns_queries" ON public.dns_queries;
DROP POLICY IF EXISTS "Allow public read access on dns_queries" ON public.dns_queries;
DROP POLICY IF EXISTS "Allow public insert access on dns_queries" ON public.dns_queries;
DROP POLICY IF EXISTS "Public all dns_queries" ON public.dns_queries;
DROP POLICY IF EXISTS "Public insert dns_queries" ON public.dns_queries;

DROP POLICY IF EXISTS "Public read benchmark_results" ON public.benchmark_results;
DROP POLICY IF EXISTS "User data isolated by user_id for benchmark_results" ON public.benchmark_results;
DROP POLICY IF EXISTS "Allow public read access on benchmark_results" ON public.benchmark_results;
DROP POLICY IF EXISTS "Allow public insert access on benchmark_results" ON public.benchmark_results;
DROP POLICY IF EXISTS "Public all benchmark_results" ON public.benchmark_results;
DROP POLICY IF EXISTS "Public insert benchmark_results" ON public.benchmark_results;

-- 1. DNS QUERIES POLICIES
-- Allow users to manage ONLY their own data
CREATE POLICY "Users can manage their own dns_queries" ON public.dns_queries
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Allow anyone (including anonymous) to insert data.
-- For authenticated users, it will fall back to the policy above, but for anon users we need this:
CREATE POLICY "Anyone can insert dns_queries" ON public.dns_queries
  FOR INSERT WITH CHECK (true);

-- 2. BENCHMARK RESULTS POLICIES
-- Allow users to manage ONLY their own data
CREATE POLICY "Users can manage their own benchmark_results" ON public.benchmark_results
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Allow anyone to insert
CREATE POLICY "Anyone can insert benchmark_results" ON public.benchmark_results
  FOR INSERT WITH CHECK (true);
