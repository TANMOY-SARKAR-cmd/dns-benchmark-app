import { createClient } from "@supabase/supabase-js";
import { ENV, isSupabaseConfigured } from "@/config/env";

export const supabase = isSupabaseConfigured ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey) : null;
