-- Create proxy config table
CREATE TABLE proxy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  is_enabled integer DEFAULT 0,
  fastest_provider text DEFAULT 'Google DNS',
  auto_routing_enabled boolean DEFAULT true,
  cache_ttl integer DEFAULT 3600,
  proxy_port integer DEFAULT 53,
  updated_at timestamp with time zone DEFAULT now()
);

-- Ensure there is always a default config row for ease of use
INSERT INTO proxy_config (user_id, is_enabled) VALUES ('default', 0);

-- Create proxy stats table
CREATE TABLE proxy_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  total_queries integer DEFAULT 0,
  cache_hits integer DEFAULT 0,
  cache_misses integer DEFAULT 0,
  active_provider text,
  updated_at timestamp with time zone DEFAULT now()
);

INSERT INTO proxy_stats (user_id) VALUES ('default');

-- Create dns queries log table
CREATE TABLE dns_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  domain text NOT NULL,
  record_type text,
  client_ip text,
  upstream_provider text NOT NULL,
  latency_ms integer,
  cached boolean DEFAULT false,
  status text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create benchmark results table
CREATE TABLE benchmark_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  domain text NOT NULL,
  provider text NOT NULL,
  latency_ms integer,
  tested_at timestamp with time zone DEFAULT now()
);

-- Create dns cache metrics table
CREATE TABLE dns_cache_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  domain text NOT NULL,
  record_type text NOT NULL,
  ttl integer,
  cache_hit_count integer DEFAULT 0,
  last_hit timestamp with time zone DEFAULT now(),
  UNIQUE(domain, record_type)
);

-- Setup Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE proxy_config;
ALTER PUBLICATION supabase_realtime ADD TABLE proxy_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE dns_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE benchmark_results;

-- Enable RLS and create basic public access policies for this standalone setup
-- Note: In a production multi-tenant app, RLS would use auth.uid()
ALTER TABLE proxy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_cache_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read proxy_config" ON proxy_config FOR SELECT USING (true);
CREATE POLICY "Public read proxy_stats" ON proxy_stats FOR SELECT USING (true);
CREATE POLICY "Public read dns_queries" ON dns_queries FOR SELECT USING (true);
CREATE POLICY "Public read benchmark_results" ON benchmark_results FOR SELECT USING (true);
CREATE POLICY "Public read dns_cache_metrics" ON dns_cache_metrics FOR SELECT USING (true);

-- Allow public inserts for simplicity in this demo (Normally backend service role does inserts)
CREATE POLICY "Public insert proxy_config" ON proxy_config FOR ALL USING (true);
CREATE POLICY "Public insert proxy_stats" ON proxy_stats FOR ALL USING (true);
CREATE POLICY "Public insert dns_queries" ON dns_queries FOR ALL USING (true);
CREATE POLICY "Public insert benchmark_results" ON benchmark_results FOR ALL USING (true);
CREATE POLICY "Public insert dns_cache_metrics" ON dns_cache_metrics FOR ALL USING (true);
