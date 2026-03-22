-- Drop the existing leaderboard view
DROP VIEW IF EXISTS public.leaderboard;

-- Create the new leaderboard table
CREATE TABLE public.leaderboard (
  provider TEXT PRIMARY KEY,
  avg_latency DOUBLE PRECISION,
  success_rate DOUBLE PRECISION,
  sample_count INTEGER,
  score DOUBLE PRECISION,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to leaderboard"
  ON public.leaderboard
  FOR SELECT
  USING (true);

-- Create function to update the leaderboard
CREATE OR REPLACE FUNCTION update_leaderboard()
RETURNS void AS $$
BEGIN
  -- Clear the existing data
  DELETE FROM public.leaderboard;

  -- Insert newly calculated data
  INSERT INTO public.leaderboard (provider, avg_latency, success_rate, sample_count, score, last_updated)
  SELECT
    provider,
    avg_latency,
    success_rate,
    sample_count,
    COALESCE(
      (success_rate * 0.5) +
      ( (1.0 / NULLIF(avg_latency, 0)) * 0.3 ) +
      (log(GREATEST(sample_count, 1)) * 0.2),
      0
    ) AS score,
    now() AS last_updated
  FROM (
    SELECT
      provider,
      -- Weighted average latency for successful queries
      sum(latency_ms * weight) FILTER (WHERE success = true) / NULLIF(sum(weight) FILTER (WHERE success = true), 0) AS avg_latency,
      -- Weighted success rate (0 to 1)
      sum(CASE WHEN success THEN weight ELSE 0 END) / NULLIF(sum(weight), 0) AS success_rate,
      -- Actual sample count
      count(*) AS sample_count
    FROM (
      SELECT
        provider,
        latency_ms,
        success,
        CASE WHEN tested_at > (now() - interval '7 days') THEN 2.0 ELSE 1.0 END AS weight
      FROM public.dns_queries
      WHERE tested_at > (now() - interval '30 days')
    ) AS weighted_queries
    GROUP BY provider
  ) AS aggregated;
END;
$$ LANGUAGE plpgsql;

-- Schedule the cron job to run every 10 minutes
-- We first unschedule if it exists to avoid errors, then schedule.
DO $$
BEGIN
  PERFORM cron.unschedule('update_leaderboard_job');
EXCEPTION WHEN OTHERS THEN
  -- Do nothing if it doesn't exist
END;
$$;
SELECT cron.schedule('update_leaderboard_job', '*/10 * * * *', 'SELECT public.update_leaderboard()');

-- Run it once to populate data immediately
SELECT public.update_leaderboard();
