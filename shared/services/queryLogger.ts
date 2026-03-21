import { supabase } from "../../shared/supabaseClient";

export async function logDnsQuery(query: {
  userId: string;
  domain: string;
  recordType?: string;
  clientIp?: string;
  upstreamProvider: string;
  latencyMs?: number | null;
  method?: string;
  error?: string | null;
  cached: boolean;
  status: "success" | "error";
}) {
  try {
    const { error } = await supabase.from("dns_queries").insert({
      user_id: query.userId,
      domain: query.domain,
      record_type: query.recordType,
      client_ip: query.clientIp,
      provider: query.upstreamProvider,
      latency_ms: query.latencyMs,
      method: query.method,
      error: query.error,
      cached: query.cached,

      success: query.status === "success"
    });

    if (error) {
      console.error("Failed to log DNS query to Supabase:", error);
    }
  } catch (err) {
    console.error("Exception logging DNS query:", err);
  }
}

export async function getDnsQueryLogs(userId: string, limit: number = 100) {
  const { data, error } = await supabase
    .from("dns_queries")
    .select("*")
    .eq("user_id", userId)
    .order("tested_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to get DNS query logs from Supabase:", error);
    return [];
  }

  // Transform to match old interface
  return data.map((log: any) => ({
    id: log.id,
    userId: log.user_id,
    domain: log.domain,
    provider: log.provider,
    resolutionTime: log.latency_ms,
    ipAddress: log.client_ip,
    status: log.success ? "success" : "error",
    cachedResult: log.cached ? 1 : 0,
    createdAt: new Date(log.tested_at),
  }));
}
