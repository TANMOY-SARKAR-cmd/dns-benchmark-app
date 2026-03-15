import { supabase } from "../../shared/supabaseClient";

export async function logDnsQuery(query: {
  userId: string;
  domain: string;
  recordType?: string;
  clientIp?: string;
  upstreamProvider: string;
  latencyMs?: number;
  cached: boolean;
  status: "success" | "error";
}) {
  try {
    const { error } = await supabase.from("dns_queries").insert({
      user_id: query.userId,
      domain: query.domain,
      record_type: query.recordType,
      client_ip: query.clientIp,
      upstream_provider: query.upstreamProvider,
      latency_ms: query.latencyMs,
      cached: query.cached,
      status: query.status,
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
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to get DNS query logs from Supabase:", error);
    return [];
  }

  // Transform to match old interface
  return data.map(log => ({
    id: log.id,
    userId: log.user_id,
    domain: log.domain,
    provider: log.upstream_provider,
    resolutionTime: log.latency_ms,
    ipAddress: log.client_ip,
    status: log.status,
    cachedResult: log.cached ? 1 : 0,
    createdAt: new Date(log.created_at),
  }));
}
