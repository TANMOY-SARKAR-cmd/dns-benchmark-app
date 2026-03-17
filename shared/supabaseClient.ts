import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

const isSupabaseConfigured = !!supabaseUrl && !!supabaseServiceKey;

if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SECRET_KEY environment variables."
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
