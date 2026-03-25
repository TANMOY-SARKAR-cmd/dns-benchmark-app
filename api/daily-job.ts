import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const maxDuration = 60;

export default async function handler(request: Request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !process.env.IS_DEV) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env variables" }), { status: 500, headers: CORS_HEADERS });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { error } = await supabase.rpc('run_daily_job');

    if (error) {
      console.error("Supabase error running daily job:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ message: "Daily job executed successfully" }), { status: 200, headers: CORS_HEADERS });
  } catch (error: any) {
    console.error("Error executing daily job:", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500, headers: CORS_HEADERS });
  }
}
