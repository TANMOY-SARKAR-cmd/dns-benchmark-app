-- Ensure Row Level Security is explicitly enabled on both tables
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_results ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies for monitors to strictly check user_id
DROP POLICY IF EXISTS "Users can manage their own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can view own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can insert own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can update own monitors" ON public.monitors;
DROP POLICY IF EXISTS "Users can delete own monitors" ON public.monitors;

CREATE POLICY "Users can manage their own monitors"
ON public.monitors
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Recreate RLS policies for monitor_results to strictly check user_id
DROP POLICY IF EXISTS "Users can manage their own monitor results" ON public.monitor_results;
DROP POLICY IF EXISTS "Users can view own monitor results" ON public.monitor_results;
DROP POLICY IF EXISTS "Users can insert own monitor results" ON public.monitor_results;
DROP POLICY IF EXISTS "Users can update own monitor results" ON public.monitor_results;
DROP POLICY IF EXISTS "Users can delete own monitor results" ON public.monitor_results;

CREATE POLICY "Users can manage their own monitor results"
ON public.monitor_results
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);
