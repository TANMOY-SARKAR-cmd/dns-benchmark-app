-- Modify dns_queries
ALTER TABLE public.dns_queries
  ADD COLUMN IF NOT EXISTS method_used text,
  ADD COLUMN IF NOT EXISTS is_kept boolean DEFAULT false,
  ALTER COLUMN user_id DROP NOT NULL;

-- Add new table: user_preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  preferred_providers jsonb,
  custom_dns jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Recreate monitors table to match the new schema exactly
DROP TABLE IF EXISTS public.monitors;

CREATE TABLE public.monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  domains jsonb,
  providers jsonb,
  interval_sec integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dns_queries_created_at ON public.dns_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_dns_queries_user_id ON public.dns_queries(user_id);

-- Enable RLS
ALTER TABLE public.dns_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies to enforce isolation
DROP POLICY IF EXISTS "Public all dns_queries" ON public.dns_queries;
DROP POLICY IF EXISTS "Public all benchmark_results" ON public.benchmark_results;

-- Anonymous read allowed
DROP POLICY IF EXISTS "Public read dns_queries" ON public.dns_queries;
CREATE POLICY "Public read dns_queries" ON public.dns_queries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read benchmark_results" ON public.benchmark_results;
CREATE POLICY "Public read benchmark_results" ON public.benchmark_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read user_preferences" ON public.user_preferences;
CREATE POLICY "Public read user_preferences" ON public.user_preferences FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read monitors" ON public.monitors;
CREATE POLICY "Public read monitors" ON public.monitors FOR SELECT USING (true);

-- User data isolated by user_id
DROP POLICY IF EXISTS "User data isolated by user_id for dns_queries" ON public.dns_queries;
CREATE POLICY "User data isolated by user_id for dns_queries" ON public.dns_queries
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "User data isolated by user_id for benchmark_results" ON public.benchmark_results;
CREATE POLICY "User data isolated by user_id for benchmark_results" ON public.benchmark_results
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "User data isolated by user_id for user_preferences" ON public.user_preferences;
CREATE POLICY "User data isolated by user_id for user_preferences" ON public.user_preferences
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "User data isolated by user_id for monitors" ON public.monitors;
CREATE POLICY "User data isolated by user_id for monitors" ON public.monitors
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
