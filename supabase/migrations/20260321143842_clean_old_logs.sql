-- Create the automatic cleanup function for 30-day retention
CREATE OR REPLACE FUNCTION public.clean_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Delete dns_queries older than 30 days where is_kept = false
  DELETE FROM public.dns_queries
  WHERE tested_at < NOW() - INTERVAL '30 days'
  AND is_kept = false;

  -- 2. Delete monitor_results older than 30 days where keep_forever = false
  DELETE FROM public.monitor_results
  WHERE tested_at < NOW() - INTERVAL '30 days'
  AND keep_forever = false;

  -- Note: We intentionally DO NOT delete from benchmark_results, leaderboard, monitors, profiles.
END;
$$;

-- Schedule the new cleanup function using pg_cron
DO $$
BEGIN
  PERFORM cron.unschedule('daily_logs_cleanup');
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- Schedule the new job to run daily at midnight
SELECT cron.schedule(
    'daily_logs_cleanup',
    '0 0 * * *',
    'SELECT public.clean_old_logs();'
);
