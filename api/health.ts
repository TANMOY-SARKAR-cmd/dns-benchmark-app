// api/health.ts
// Simple liveness probe — GET only, no caching, CORS open.

const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export default function handler(req: Request): Response {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: HEADERS,
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: HEADERS,
  });
}
