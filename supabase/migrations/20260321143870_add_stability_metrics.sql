-- Add new columns to leaderboard table for stability metrics
ALTER TABLE public.leaderboard
ADD COLUMN IF NOT EXISTS latency_stddev double precision,
ADD COLUMN IF NOT EXISTS stability_status text;

-- Update the daily job function to compute the new metrics
CREATE OR REPLACE FUNCTION public.run_daily_job()
RETURNS void AS $$
BEGIN
    -- 1. Delete old raw logs
    DELETE FROM dns_queries
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND keep = false
    AND is_kept = false;

    DELETE FROM monitor_results
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND keep_forever = false;

    -- Note: benchmark_results are kept as per requirements

    -- 2. & 3. Recompute leaderboard table using last 30 days data
    -- Avoid TRUNCATE to avoid ACCESS EXCLUSIVE lock on leaderboard.
    DELETE FROM leaderboard;

    WITH combined_results AS (
        SELECT provider, latency_ms, success, method, tested_at
        FROM benchmark_results
        WHERE tested_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT provider, latency_ms, success, method, tested_at
        FROM monitor_results
        WHERE tested_at >= NOW() - INTERVAL '30 days'
    ),
    aggregated_results AS (
        SELECT
            provider,
            AVG(latency_ms) FILTER (WHERE success = true) as avg_latency,
            STDDEV(latency_ms) FILTER (WHERE success = true) as latency_stddev,
            SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
            COUNT(*) as sample_count,
            (
                (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 0.5) +
                ((1.0 / NULLIF(AVG(latency_ms) FILTER (WHERE success = true), 0)) * 0.3) +
                (LOG(COUNT(*) + 1) * 0.2)
            ) as score,
            (
                (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 0.6) +
                ((1.0 / NULLIF(AVG(latency_ms) FILTER (WHERE success = true), 0)) * 0.25) +
                (LOG(COUNT(*) + 1) * 0.15)
            ) as reliability_score,

            SUM(CASE WHEN method = 'server-udp' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as udp_percentage,
            SUM(CASE WHEN method = 'server-doh' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as doh_percentage,
            SUM(CASE WHEN method = 'fallback' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as fallback_percentage,
            SUM(CASE WHEN method = 'failed' OR success = false THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as failure_percentage,
            NOW() as last_updated
        FROM combined_results
        GROUP BY provider
    )
    INSERT INTO leaderboard (
        provider, avg_latency, latency_stddev, success_rate, sample_count, score, reliability_score,
        udp_percentage, doh_percentage, fallback_percentage, failure_percentage, stability_status, last_updated
    )
    SELECT
        provider,
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
            WHEN failure_percentage > 20 OR fallback_percentage > 30 OR latency_stddev > 50 THEN 'Unreliable'
            WHEN failure_percentage > 10 OR fallback_percentage > 15 OR latency_stddev > 25 THEN 'Unstable'
            ELSE 'Stable'
        END as stability_status,
        last_updated
    FROM aggregated_results;

    -- 5. Store daily summary table
    WITH daily_combined_results AS (
        SELECT provider, latency_ms, success
        FROM benchmark_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
        UNION ALL
        SELECT provider, latency_ms, success
        FROM monitor_results
        WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
    )
    INSERT INTO daily_stats (date, provider, avg_latency, success_rate, sample_count)
    SELECT
        (CURRENT_DATE - INTERVAL '1 day')::DATE as date,
        provider,
        AVG(latency_ms) FILTER (WHERE success = true) as avg_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
        COUNT(*) as sample_count
    FROM daily_combined_results
    GROUP BY provider
    ON CONFLICT (date, provider) DO UPDATE SET
        avg_latency = EXCLUDED.avg_latency,
        success_rate = EXCLUDED.success_rate,
        sample_count = EXCLUDED.sample_count;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
