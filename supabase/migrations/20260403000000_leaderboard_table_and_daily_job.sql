-- 1) Convert leaderboard to TABLE
DROP VIEW IF EXISTS public.leaderboard;

CREATE TABLE public.leaderboard (
    provider TEXT PRIMARY KEY,
    avg_latency numeric,
    latency_stddev numeric,
    success_rate double precision,
    sample_count bigint,
    score double precision,
    reliability_score double precision,
    udp_percentage double precision,
    doh_percentage double precision,
    fallback_percentage double precision,
    failure_percentage double precision,
    stability_status text,
    last_updated timestamp with time zone DEFAULT now()
);

-- Enable RLS + public read policy
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to leaderboard"
ON public.leaderboard
FOR SELECT
USING (true);

-- 2) Recreate public.run_daily_job() with full logic
CREATE OR REPLACE FUNCTION public.run_daily_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Delete old raw DNS query logs
    DELETE FROM public.dns_queries
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND is_kept = false;

    DELETE FROM public.monitor_results
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND keep_forever = false;

    -- 2. Recompute leaderboard
    DELETE FROM public.leaderboard;

    WITH combined_results AS (
         SELECT benchmark_results.provider,
            benchmark_results.latency_ms,
            benchmark_results.success,
            benchmark_results.method,
            benchmark_results.tested_at
           FROM benchmark_results
          WHERE benchmark_results.tested_at >= (now() - '30 days'::interval)
        UNION ALL
         SELECT monitor_results.provider,
            monitor_results.latency_ms,
            monitor_results.success,
            monitor_results.method,
            monitor_results.tested_at
           FROM monitor_results
          WHERE monitor_results.tested_at >= (now() - '30 days'::interval)
        ), aggregated_results AS (
         SELECT combined_results.provider,
            avg(combined_results.latency_ms) FILTER (WHERE combined_results.success = true) AS avg_latency,
            stddev(combined_results.latency_ms) FILTER (WHERE combined_results.success = true) AS latency_stddev,
            sum(
                CASE
                    WHEN combined_results.success THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision AS success_rate,
            count(*) AS sample_count,
            sum(
                CASE
                    WHEN combined_results.success THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 0.5::double precision + (1.0 / NULLIF(avg(combined_results.latency_ms) FILTER (WHERE combined_results.success = true), 0::numeric) * 0.3)::double precision + log((count(*) + 1)::double precision) * 0.2::double precision AS score,
            sum(
                CASE
                    WHEN combined_results.success THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 0.6::double precision + (1.0 / NULLIF(avg(combined_results.latency_ms) FILTER (WHERE combined_results.success = true), 0::numeric) * 0.25)::double precision + log((count(*) + 1)::double precision) * 0.15::double precision AS reliability_score,
            sum(
                CASE
                    WHEN combined_results.method = 'server-udp'::text THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision AS udp_percentage,
            sum(
                CASE
                    WHEN combined_results.method = 'server-doh'::text THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision AS doh_percentage,
            sum(
                CASE
                    WHEN combined_results.method = 'fallback'::text THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision AS fallback_percentage,
            sum(
                CASE
                    WHEN combined_results.method = 'failed'::text OR combined_results.success = false THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision AS failure_percentage,
            now() AS last_updated
           FROM combined_results
          GROUP BY combined_results.provider
        )
    INSERT INTO public.leaderboard (
        provider, avg_latency, latency_stddev, success_rate, sample_count, score, reliability_score,
        udp_percentage, doh_percentage, fallback_percentage, failure_percentage, stability_status, last_updated
    )
    SELECT provider,
        avg_latency,
        latency_stddev,
        success_rate,
        sample_count,
        score,
        reliability_score,
        udp_percentage,
        doh_percentage,
        fallback_percentage,
        failure_percentage,
        CASE
            WHEN failure_percentage > 20::double precision OR fallback_percentage > 30::double precision OR latency_stddev > 50::numeric THEN 'Unreliable'::text
            WHEN failure_percentage > 10::double precision OR fallback_percentage > 15::double precision OR latency_stddev > 25::numeric THEN 'Unstable'::text
            ELSE 'Stable'::text
        END AS stability_status,
        last_updated
    FROM aggregated_results;

    -- 3. Store daily summary
    WITH daily AS (
        SELECT provider, latency_ms, success
        FROM public.benchmark_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
        UNION ALL
        SELECT provider, latency_ms, success
        FROM public.monitor_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
    )
    INSERT INTO public.daily_stats (date, provider, avg_latency, success_rate, sample_count)
    SELECT
        (CURRENT_DATE - INTERVAL '1 day')::DATE,
        provider,
        AVG(latency_ms) FILTER (WHERE success = true),
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*),
        COUNT(*)
    FROM daily
    GROUP BY provider
    ON CONFLICT (date, provider) DO UPDATE SET
        avg_latency = EXCLUDED.avg_latency,
        success_rate = EXCLUDED.success_rate,
        sample_count = EXCLUDED.sample_count;
END;
$$;

-- 3) Add leaderboard table to realtime publication
-- Idempotent way to add table to publication:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'leaderboard'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
    END IF;
END $$;
