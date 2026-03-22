ALTER TABLE public.monitors ADD COLUMN IF NOT EXISTS last_run_at timestamp with time zone;
