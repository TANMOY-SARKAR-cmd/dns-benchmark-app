import { createClient } from "@supabase/supabase-js";
import { ENV } from "@/config/env";

export const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);
