// api/health.ts
// Simple liveness probe — GET only, no caching, CORS open.

const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: HEADERS,
  });
}
