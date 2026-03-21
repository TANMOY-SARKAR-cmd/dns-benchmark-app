-- Fix the database schema to completely match the API -> DB mappings:
-- API       -> DB
-- latency   -> latency_ms
-- success   -> success
-- method    -> method
-- error     -> error
-- domain    -> domain
-- provider  -> provider
-- timestamp -> tested_at

DO $$
BEGIN
  -- Rename upstream_provider to provider in dns_queries
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='dns_queries' and column_name='upstream_provider') THEN
    ALTER TABLE public.dns_queries RENAME COLUMN upstream_provider TO provider;
  END IF;

  -- Rename status to success in dns_queries and change type
  -- Actually, we can't just rename if type is text ('success' | 'error') and we want boolean.
  -- Let's drop and recreate or alter type.
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='dns_queries' and column_name='status') THEN
    ALTER TABLE public.dns_queries
      ALTER COLUMN status TYPE boolean
      USING (status = 'success');
    ALTER TABLE public.dns_queries RENAME COLUMN status TO success;
  END IF;

  -- Rename method_used to method in dns_queries
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='dns_queries' and column_name='method_used') THEN
    ALTER TABLE public.dns_queries RENAME COLUMN method_used TO method;
  END IF;

  -- Ensure error column exists in dns_queries
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='dns_queries' and column_name='error') THEN
    ALTER TABLE public.dns_queries ADD COLUMN error text;
  END IF;

  -- Same for benchmark_results? It has provider, latency_ms already.
  -- Add method if method_used exists
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='benchmark_results' and column_name='method_used') THEN
    ALTER TABLE public.benchmark_results RENAME COLUMN method_used TO method;
  END IF;

END $$;

-- Drop and Recreate Leaderboard View with correct names
DROP VIEW IF EXISTS public.leaderboard;

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
    provider,
    round((sum(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / count(*)), 2) AS success_rate,
    round(avg(CASE WHEN success THEN latency_ms ELSE NULL END), 2) AS avg_latency,
    count(*) AS total_tests
FROM public.dns_queries
GROUP BY provider
ORDER BY round(avg(CASE WHEN success THEN latency_ms ELSE NULL END), 2);

GRANT SELECT ON public.leaderboard TO public;
GRANT SELECT ON public.leaderboard TO anon;
GRANT SELECT ON public.leaderboard TO authenticated;
