import { supabase } from "../../shared/supabaseClient";

export async function logBenchmarkResult(
  userId: string,
  domain: string,
  provider: string,
  latencyMs: number
) {
  try {
    const { error } = await supabase.from("benchmark_results").insert({
      user_id: userId,
      domain,
      provider,
      latency_ms: latencyMs,
    });

    if (error) {
      console.error("Failed to log benchmark to Supabase:", error);
    }
  } catch (err) {
    console.error("Exception logging benchmark:", err);
  }
}
