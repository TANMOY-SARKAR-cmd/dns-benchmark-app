
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='dns_queries' and column_name='created_at') THEN
    ALTER TABLE public.dns_queries RENAME COLUMN created_at TO tested_at;
  END IF;

  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='benchmark_results' and column_name='created_at') THEN
    ALTER TABLE public.benchmark_results RENAME COLUMN created_at TO tested_at;
  END IF;
END $$;
-- Rename created_at to tested_at in dns_queries


-- Rename created_at to tested_at in benchmark_results


-- Recreate index for dns_queries
DROP INDEX IF EXISTS public.idx_dns_queries_created_at;
CREATE INDEX IF NOT EXISTS idx_dns_queries_tested_at ON public.dns_queries(tested_at);

-- Recreate index for benchmark_results
DROP INDEX IF EXISTS public.idx_benchmark_results_created_at;
CREATE INDEX IF NOT EXISTS idx_benchmark_results_tested_at ON public.benchmark_results(tested_at);

-- Update the clean_old_data function
CREATE OR REPLACE FUNCTION public.clean_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete dns_queries older than 30 days where is_kept = false
  DELETE FROM public.dns_queries
  WHERE tested_at < NOW() - INTERVAL '30 days'
  AND is_kept = false;
END;
$$;

-- Drop and Recreate Leaderboard View
DROP VIEW IF EXISTS public.leaderboard;

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
    upstream_provider AS provider,
    round((sum(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / count(*)), 2) AS success_rate,
    round(avg(CASE WHEN success THEN latency_ms ELSE NULL END), 2) AS avg_latency,
    count(*) AS total_tests
FROM public.dns_queries
GROUP BY upstream_provider
ORDER BY round(avg(CASE WHEN success THEN latency_ms ELSE NULL END), 2);

GRANT SELECT ON public.leaderboard TO public;
GRANT SELECT ON public.leaderboard TO anon;
GRANT SELECT ON public.leaderboard TO authenticated;
