-- Add new columns to leaderboard table
ALTER TABLE public.leaderboard
ADD COLUMN IF NOT EXISTS udp_percentage double precision DEFAULT 0,
ADD COLUMN IF NOT EXISTS doh_percentage double precision DEFAULT 0,
ADD COLUMN IF NOT EXISTS fallback_percentage double precision DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_percentage double precision DEFAULT 0;

-- Function to run daily job
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
    DELETE FROM leaderboard;

    WITH combined_results AS (
        SELECT provider, latency_ms, success, method, tested_at
        FROM benchmark_results
        WHERE tested_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT provider, latency_ms, success, method, tested_at
        FROM monitor_results
        WHERE tested_at >= NOW() - INTERVAL '30 days'
    )
    INSERT INTO leaderboard (provider, avg_latency, success_rate, sample_count, score, udp_percentage, doh_percentage, fallback_percentage, failure_percentage, last_updated)
    SELECT
        provider,
        AVG(latency_ms) FILTER (WHERE success = true) as avg_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
        COUNT(*) as sample_count,
        (
            (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 0.5) +
            ((1.0 / NULLIF(AVG(latency_ms) FILTER (WHERE success = true), 0)) * 0.3) +
            (LOG(COUNT(*) + 1) * 0.2)
        ) as score,
        SUM(CASE WHEN method = 'server-udp' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as udp_percentage,
        SUM(CASE WHEN method = 'server-doh' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as doh_percentage,
        SUM(CASE WHEN method = 'fallback' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as fallback_percentage,
        SUM(CASE WHEN method = 'failed' OR success = false THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as failure_percentage,
        NOW() as last_updated
    FROM combined_results
    GROUP BY provider;

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
