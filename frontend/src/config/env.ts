const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  const missing: string[] = [];

  if (!supabaseUrl) {
    missing.push("VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseKey) {
    missing.push(
      "VITE_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  throw new Error(
    `Supabase environment variables missing. Expected one of: ${missing.join(", ")}`
  );
}

export const ENV = {
  supabaseUrl,
  supabaseKey,
};
