-- rename keep to keep_forever in benchmark_results
ALTER TABLE public.benchmark_results RENAME COLUMN keep TO keep_forever;

-- drop fallback_used in benchmark_results
ALTER TABLE public.benchmark_results DROP COLUMN fallback_used;

-- fix created_at -> tested_at in all tables
ALTER TABLE public.user_preferences RENAME COLUMN created_at TO tested_at;
ALTER TABLE public.monitors RENAME COLUMN created_at TO tested_at;
ALTER TABLE public.user_domains RENAME COLUMN created_at TO tested_at;
ALTER TABLE public.user_monitors RENAME COLUMN created_at TO tested_at;
ALTER TABLE public.profiles RENAME COLUMN created_at TO tested_at;

-- Create index on benchmark_results(tested_at)
CREATE INDEX IF NOT EXISTS idx_benchmark_tested_at ON public.benchmark_results(tested_at);

-- Ensure RLS on monitors and monitor_results restricts to user's own monitors and results
DROP POLICY IF EXISTS "Users can view own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can insert own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can update own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can delete own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can manage their own monitors" ON public.monitors;

CREATE POLICY "Users can manage their own monitors"
ON public.monitors
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can manage their own monitor results" ON public.monitor_results;

CREATE POLICY "Users can manage their own monitor results"
ON public.monitor_results
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Re-create leaderboard to be absolutely sure it has the required fields
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT provider,
    avg(latency_ms) FILTER (WHERE (success = true)) AS avg_latency,
    (((sum(
        CASE
            WHEN success THEN 1
            ELSE 0
        END))::double precision / (count(*))::double precision) * (100)::double precision) AS success_rate,
    stddev(latency_ms) FILTER (WHERE (success = true)) AS jitter,
    count(*) AS total_tests
FROM public.dns_queries
WHERE (tested_at > (now() - '30 days'::interval))
GROUP BY provider;
