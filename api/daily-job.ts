import { createClient } from "@supabase/supabase-js";

const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

export const maxDuration = 60;

export default async function handler(request: Request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.IS_DEV === "true";

  // Secure authorization check:
  // 1. Allow bypass only in development mode.
  // 2. Otherwise, require CRON_SECRET to be defined, non-empty, and NOT the string "undefined".
  // 3. Compare the Authorization header exactly against `Bearer ${cronSecret}`.
  const isAuthorized = isDev || (
    !!cronSecret &&
    cronSecret !== "undefined" &&
    authHeader === `Bearer ${cronSecret}`
  );

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: HEADERS
    });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env variables" }), { status: 500, headers: HEADERS });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { error } = await supabase.rpc('run_daily_job');

    if (error) {
      console.error("Supabase error running daily job:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
    }

    return new Response(JSON.stringify({ message: "Daily job executed successfully" }), { status: 200, headers: HEADERS });
  } catch (error: any) {
    console.error("Error executing daily job:", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500, headers: HEADERS });
  }
}
