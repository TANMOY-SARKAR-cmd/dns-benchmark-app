import { supabase } from '../supabaseClient';

export async function logDnsQuery(query: {
  domain: string;
  recordType?: string;
  clientIp?: string;
  upstreamProvider: string;
  latencyMs?: number;
  cached: boolean;
}) {
  try {
    const { error } = await supabase.from('dns_queries').insert({
      domain: query.domain,
      record_type: query.recordType,
      client_ip: query.clientIp,
      upstream_provider: query.upstreamProvider,
      latency_ms: query.latencyMs,
      cached: query.cached,
    });

    if (error) {
      console.error('Failed to log DNS query to Supabase:', error);
    }
  } catch (err) {
    console.error('Exception logging DNS query:', err);
  }
}
