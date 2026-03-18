const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase is not configured. Set VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and the corresponding ANON KEY."
  );
  throw new Error(
    "Supabase is not configured. Set VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and corresponding ANON KEY."
  );
}

export const ENV = {
  supabaseUrl,
  supabaseAnonKey,
};
