-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp without time zone DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  preferred_providers jsonb DEFAULT '[]'::jsonb,
  custom_dns jsonb DEFAULT '[]'::jsonb,
  custom_dns_name text,
  custom_dns_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create monitors table
CREATE TABLE public.monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  domains jsonb DEFAULT '[]'::jsonb,
  providers jsonb DEFAULT '[]'::jsonb,
  interval_seconds integer DEFAULT 60,
  is_active boolean DEFAULT true,
  last_run_at timestamp with time zone,
  next_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Create monitor_results table
CREATE TABLE public.monitor_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid REFERENCES public.monitors(id),
  user_id text NOT NULL,
  domain text NOT NULL,
  provider text NOT NULL,
  latency_ms integer,
  success boolean DEFAULT false,
  method text,
  error text,
  tested_at timestamp with time zone DEFAULT now(),
  keep_forever boolean DEFAULT false
);

-- Create dns_queries table
CREATE TABLE public.dns_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  domain text NOT NULL,
  record_type text,
  client_ip text,
  provider text NOT NULL,
  latency_ms integer,
  cached boolean DEFAULT false,
  method text,
  success boolean DEFAULT false,
  fallback_used boolean DEFAULT false,
  error text,
  keep boolean DEFAULT false,
  is_kept boolean DEFAULT false,
  tested_at timestamp with time zone DEFAULT now()
);

-- Create benchmark_results table
CREATE TABLE public.benchmark_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  domain text NOT NULL,
  provider text NOT NULL,
  latency_ms integer,
  success boolean DEFAULT false,
  method text DEFAULT 'client'::text,
  error text,
  keep_forever boolean DEFAULT false,
  tested_at timestamp with time zone DEFAULT now()
);

-- Create leaderboard table
CREATE TABLE public.leaderboard (
  provider text PRIMARY KEY,
  avg_latency double precision,
  success_rate double precision,
  sample_count integer,
  score double precision,
  reliability_score double precision,
  udp_percentage double precision DEFAULT 0,
  doh_percentage double precision DEFAULT 0,
  fallback_percentage double precision DEFAULT 0,
  failure_percentage double precision DEFAULT 0,
  latency_stddev double precision,
  stability_status text,
  last_updated timestamp with time zone DEFAULT now()
);

-- Create daily_stats table
CREATE TABLE public.daily_stats (
  id serial PRIMARY KEY,
  date date NOT NULL,
  provider text NOT NULL,
  avg_latency double precision,
  success_rate double precision,
  sample_count integer,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(date, provider)
);

-- Setup Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE dns_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE benchmark_results;
ALTER PUBLICATION supabase_realtime ADD TABLE monitor_results;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_stats;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dns_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User Preferences Policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (user_id = auth.uid()::text OR user_id = 'anonymous'::text);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (user_id = auth.uid()::text OR user_id = 'anonymous'::text);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (user_id = auth.uid()::text OR user_id = 'anonymous'::text);

-- Monitors Policies
CREATE POLICY "Public read monitors" ON public.monitors FOR SELECT USING (true);
CREATE POLICY "Users can manage their own monitors" ON public.monitors FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Monitor Results Policies
CREATE POLICY "Users can manage their own monitor results" ON public.monitor_results FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- DNS Queries Policies
CREATE POLICY "Public read dns_queries" ON public.dns_queries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dns_queries" ON public.dns_queries FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can manage their own dns_queries" ON public.dns_queries FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Benchmark Results Policies
CREATE POLICY "Public read benchmark_results" ON public.benchmark_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert benchmark_results" ON public.benchmark_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can manage their own benchmark_results" ON public.benchmark_results FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Leaderboard Policies
CREATE POLICY "Allow public read access to leaderboard" ON public.leaderboard FOR SELECT USING (true);

-- Daily Stats Policies
CREATE POLICY "Allow public read access to daily_stats" ON public.daily_stats FOR SELECT USING (true);

-- Create indexes
CREATE INDEX idx_monitors_user_id ON public.monitors(user_id);
CREATE INDEX idx_monitor_results_user_id ON public.monitor_results(user_id);
CREATE INDEX idx_monitor_results_tested_at ON public.monitor_results(tested_at);
CREATE INDEX idx_dns_queries_user_id ON public.dns_queries(user_id);
CREATE INDEX idx_dns_queries_tested_at ON public.dns_queries(tested_at);
CREATE INDEX idx_benchmark_results_tested_at ON public.benchmark_results(tested_at);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name', 'user_' || substr(new.id::text, 1, 6)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

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
