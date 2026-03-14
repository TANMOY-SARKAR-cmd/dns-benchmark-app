CREATE TABLE dns_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  record_type text,
  client_ip text,
  upstream_provider text NOT NULL,
  latency_ms integer,
  cached boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE benchmark_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  latency_ms integer,
  tested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE proxy_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_queries integer DEFAULT 0,
  cache_hits integer DEFAULT 0,
  cache_misses integer DEFAULT 0,
  active_provider text,
  updated_at timestamp with time zone DEFAULT now()
);

INSERT INTO proxy_stats (total_queries) VALUES (0);

CREATE TABLE proxy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean DEFAULT false,
  fastest_provider text DEFAULT 'Google DNS',
  auto_routing_enabled boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now()
);

INSERT INTO proxy_config (is_enabled) VALUES (false);

-- Setup Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE proxy_config;
ALTER PUBLICATION supabase_realtime ADD TABLE proxy_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE dns_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE benchmark_results;

-- Enable RLS
ALTER TABLE proxy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public all proxy_config" ON proxy_config FOR ALL USING (true);
CREATE POLICY "Public all proxy_stats" ON proxy_stats FOR ALL USING (true);
CREATE POLICY "Public all dns_queries" ON dns_queries FOR ALL USING (true);
CREATE POLICY "Public all benchmark_results" ON benchmark_results FOR ALL USING (true);
