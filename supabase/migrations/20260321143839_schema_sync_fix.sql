-- monitor_results already has keep_forever, domain, provider, latency_ms, success, method, error, tested_at.
-- Let's double check if monitor_results has fallback_used, and if so, drop it.
ALTER TABLE public.monitor_results DROP COLUMN IF EXISTS fallback_used;

-- Revert created_at -> tested_at in non-test tables
ALTER TABLE public.user_preferences RENAME COLUMN tested_at TO created_at;
ALTER TABLE public.monitors RENAME COLUMN tested_at TO created_at;
ALTER TABLE public.user_domains RENAME COLUMN tested_at TO created_at;
ALTER TABLE public.user_monitors RENAME COLUMN tested_at TO created_at;
ALTER TABLE public.profiles RENAME COLUMN tested_at TO created_at;

-- Revert the RLS policies to use auth.uid() matching the user_id type correctly
-- First, determine the type of user_id. From earlier queries:
-- user_preferences.user_id: text
-- monitors.user_id: text
-- monitor_results.user_id: text
-- Since user_id is text, auth.uid()::text = user_id is actually correct for these tables.
-- But let's refine the RLS policies.
DROP POLICY IF EXISTS "Users can manage their own monitors" ON public.monitors;
CREATE POLICY "Users can manage their own monitors"
ON public.monitors
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can manage their own monitor results" ON public.monitor_results;
CREATE POLICY "Users can manage their own monitor results"
ON public.monitor_results
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);
