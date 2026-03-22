-- Add custom_dns_name and custom_dns_url to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS custom_dns_name text,
ADD COLUMN IF NOT EXISTS custom_dns_url text;
