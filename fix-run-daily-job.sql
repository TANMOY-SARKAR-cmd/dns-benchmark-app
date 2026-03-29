CREATE OR REPLACE FUNCTION public.run_daily_job()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         SELECT LOWER(TRIM(benchmark_results.provider)) AS provider,
            benchmark_results.latency_ms,
            benchmark_results.success,
            benchmark_results.method,
            benchmark_results.tested_at
           FROM benchmark_results
          WHERE benchmark_results.tested_at >= (now() - '30 days'::interval)
        UNION ALL
         SELECT LOWER(TRIM(monitor_results.provider)) AS provider,
            monitor_results.latency_ms,
            monitor_results.success,
            monitor_results.method,
            monitor_results.tested_at
           FROM monitor_results
          WHERE monitor_results.tested_at >= (now() - '30 days'::interval)
        ), aggregated_results AS (
         SELECT combined_results.provider,
            avg(combined_results.latency_ms) FILTER (WHERE combined_results.success = true) AS avg_latency,
            COALESCE(stddev(combined_results.latency_ms) FILTER (WHERE combined_results.success = true), 999) AS latency_stddev,
            sum(
                CASE
                    WHEN combined_results.success THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision AS success_rate,
            count(*) AS sample_count,
            COALESCE(sum(
                CASE
                    WHEN combined_results.success THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 0.5::double precision + (1.0 / NULLIF(avg(combined_results.latency_ms) FILTER (WHERE combined_results.success = true), 0::numeric) * 0.3)::double precision + log((count(*) + 1)::double precision) * 0.2::double precision, 0) AS score,
            COALESCE(sum(
                CASE
                    WHEN combined_results.success THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 0.6::double precision + (1.0 / NULLIF(avg(combined_results.latency_ms) FILTER (WHERE combined_results.success = true), 0::numeric) * 0.25)::double precision + log((count(*) + 1)::double precision) * 0.15::double precision, 0) AS reliability_score,
            COALESCE(sum(
                CASE
                    WHEN combined_results.method = 'server-udp'::text THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision, 0) AS udp_percentage,
            COALESCE(sum(
                CASE
                    WHEN combined_results.method = 'server-doh'::text THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision, 0) AS doh_percentage,
            COALESCE(sum(
                CASE
                    WHEN combined_results.method = 'fallback'::text THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision, 0) AS fallback_percentage,
            COALESCE(sum(
                CASE
                    WHEN combined_results.success = false THEN 1
                    ELSE 0
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision, 0) AS failure_percentage,
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
        SELECT LOWER(TRIM(provider)) AS provider, latency_ms, success
        FROM public.benchmark_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
        UNION ALL
        SELECT LOWER(TRIM(provider)) AS provider, latency_ms, success
        FROM public.monitor_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
    )
    INSERT INTO public.daily_stats (date, provider, avg_latency, success_rate, sample_count)
    SELECT
        (CURRENT_DATE - INTERVAL '1 day')::DATE,
        provider,
        AVG(latency_ms) FILTER (WHERE success = true),
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0),
        COUNT(*)
    FROM daily
    GROUP BY provider
    ON CONFLICT (date, provider) DO UPDATE SET
        avg_latency = EXCLUDED.avg_latency,
        success_rate = EXCLUDED.success_rate,
        sample_count = EXCLUDED.sample_count;
END;
$function$;
