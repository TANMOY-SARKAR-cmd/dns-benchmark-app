import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Expected one of: VITE_SUPABASE_* or NEXT_PUBLIC_SUPABASE_*"
  );
}

if (import.meta.env.DEV) {
  console.log("Supabase ENV:", {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
