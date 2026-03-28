ALTER TABLE public.monitors
ALTER COLUMN providers TYPE jsonb
USING (
  CASE
    WHEN providers IS NULL THEN '[]'::jsonb
    WHEN providers::text LIKE '[%' THEN providers::jsonb
    ELSE to_jsonb(string_to_array(providers::text, ','))
  END
);
