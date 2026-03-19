-- Create dns_queries table
CREATE TABLE IF NOT EXISTS public.dns_queries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT DEFAULT 'anonymous',
    domain TEXT NOT NULL,
    provider TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create benchmark_results table
CREATE TABLE IF NOT EXISTS public.benchmark_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT DEFAULT 'anonymous',
    provider TEXT NOT NULL,
    avg_latency INTEGER NOT NULL,
    min_latency INTEGER,
    max_latency INTEGER,
    success_rate NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_dns_queries_created_at ON public.dns_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_dns_queries_provider ON public.dns_queries(provider);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_created_at ON public.benchmark_results(created_at);

-- Create Leaderboard View
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT provider, AVG(latency_ms) AS avg_latency
FROM public.dns_queries
WHERE success = true
GROUP BY provider;

-- Enable RLS and create policies
ALTER TABLE public.dns_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_results ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on dns_queries"
    ON public.dns_queries
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow public read access on benchmark_results"
    ON public.benchmark_results
    FOR SELECT
    TO public
    USING (true);

-- Allow public insert access
CREATE POLICY "Allow public insert access on dns_queries"
    ON public.dns_queries
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Allow public insert access on benchmark_results"
    ON public.benchmark_results
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dns_queries;
