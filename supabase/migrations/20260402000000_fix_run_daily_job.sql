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

    -- 2. Store daily summary
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
