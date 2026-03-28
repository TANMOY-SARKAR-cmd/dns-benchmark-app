ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS custom_dns_format text DEFAULT 'json';
