CREATE TABLE IF NOT EXISTS daily_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    provider TEXT NOT NULL,
    avg_latency FLOAT,
    success_rate FLOAT,
    sample_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, provider)
);

CREATE OR REPLACE FUNCTION run_daily_job() RETURNS void AS $$
BEGIN
    -- 1. Delete old raw logs
    DELETE FROM dns_queries
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND keep_forever = false;

    DELETE FROM monitor_results
    WHERE tested_at < NOW() - INTERVAL '30 days'
    AND keep_forever = false;

    -- 2. & 3. Recompute leaderboard table using last 30 days data
    -- Using benchmark_results as the primary source of benchmarking stats.
    -- (Home.tsx writes directly to benchmark_results when tests are run).
    -- Avoid TRUNCATE to avoid ACCESS EXCLUSIVE lock on leaderboard.
    DELETE FROM leaderboard;

    INSERT INTO leaderboard (provider, avg_latency, success_rate, sample_count, score, updated_at)
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
        NOW() as updated_at
    FROM benchmark_results
    WHERE tested_at >= NOW() - INTERVAL '30 days'
    GROUP BY provider;

    -- 5. Store daily summary table
    -- Correct the date to yesterday's date, since this runs at 2:00 AM for the previous day's data.
    INSERT INTO daily_stats (date, provider, avg_latency, success_rate, sample_count)
    SELECT
        (CURRENT_DATE - INTERVAL '1 day')::DATE as date,
        provider,
        AVG(latency_ms) FILTER (WHERE success = true) as avg_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
        COUNT(*) as sample_count
    FROM benchmark_results
    WHERE tested_at >= CURRENT_DATE - INTERVAL '1 day' AND tested_at < CURRENT_DATE
    GROUP BY provider
    ON CONFLICT (date, provider) DO UPDATE SET
        avg_latency = EXCLUDED.avg_latency,
        success_rate = EXCLUDED.success_rate,
        sample_count = EXCLUDED.sample_count;

END;
$$ LANGUAGE plpgsql;
