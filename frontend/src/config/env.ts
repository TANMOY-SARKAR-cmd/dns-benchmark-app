const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://abcdefghijklmnopqrst.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3BxcnN0In0.X";

export const ENV = {
  supabaseUrl,
  supabaseAnonKey,
};
