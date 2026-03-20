const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://iayeyzsrhnqcesazsbrg.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlheWV5enNyaG5xY2VzYXpzYnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjM0MTYsImV4cCI6MjA4ODk5OTQxNn0.Dej0wfHArA8-kUnRR22RkyY2L_53RvmltKfG7VzA9yM";

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const ENV = {
  supabaseUrl: supabaseUrl ?? "",
  supabaseAnonKey: supabaseAnonKey ?? "",
};
