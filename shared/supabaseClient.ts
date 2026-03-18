import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_JWT_SECRET;

const isSupabaseConfigured = !!supabaseUrl && !!supabaseServiceKey;

if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_JWT_SECRET environment variables."
  );
  throw new Error(
    "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
