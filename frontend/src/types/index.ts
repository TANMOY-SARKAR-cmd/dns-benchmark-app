export interface Monitor {
  id: string;
  user_id: string;
  domains: string[];
  providers: string[];
  interval_seconds: number;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export interface MonitorResult {
  id: string;
  monitor_id: string;
  user_id: string;
  domain: string;
  provider: string;
  latency_ms: number | null;
  success: boolean;
  method: string;
  error: string | null;
  tested_at: string;
  keep_forever: boolean;
}

export interface BenchmarkResult {
  id?: string;
  user_id?: string;
  domain: string;
  provider: string;
  latency_ms: number | null;
  success: boolean;
  method: string;
  error?: string | null;
  tested_at?: string;
  keep?: boolean;
}

export interface LeaderboardEntry {
  provider: string;
  avg_latency: number;
  success_rate: number;
  sample_count: number;
  score: number;
  reliability_score: number;
  udp_percentage: number;
  doh_percentage: number;
  fallback_percentage: number;
  failure_percentage: number;
  latency_stddev: number;
  stability_status: string;
  last_updated: string;
}

export interface DnsQueryLog {
  id?: string;
  timestamp?: string;
  tested_at?: string;
  domain: string;
  provider?: string;
  upstream_provider?: string;
  method?: string;
  method_used?: string;
  latency_ms: number | null;
  success?: boolean;
  status?: string;
}
