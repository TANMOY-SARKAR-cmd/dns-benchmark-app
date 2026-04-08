-- Drop view if we are changing column names to be safe
DROP VIEW IF EXISTS public.leaderboard;

-- Fix leaderboard average calculation to handle NULL/NaN
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
    provider,
    COALESCE(round(avg(latency_ms), 2), 0) AS global_avg_ms,
    count(*) AS total_tests
FROM public.benchmark_results
GROUP BY provider
ORDER BY 2;

GRANT SELECT ON public.leaderboard TO public;
GRANT SELECT ON public.leaderboard TO anon;
GRANT SELECT ON public.leaderboard TO authenticated;

-- Alter table to add method tracking if missing
ALTER TABLE public.dns_queries
ADD COLUMN IF NOT EXISTS method_used text DEFAULT 'client',
ADD COLUMN IF NOT EXISTS fallback_used boolean DEFAULT false;

ALTER TABLE public.benchmark_results
ADD COLUMN IF NOT EXISTS method_used text DEFAULT 'client',
ADD COLUMN IF NOT EXISTS fallback_used boolean DEFAULT false;
