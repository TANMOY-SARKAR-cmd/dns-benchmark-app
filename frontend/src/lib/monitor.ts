import { measureDoH, DOH_PROVIDERS } from "./doh";
import { supabase } from "./supabase";
import { isSupabaseConfigured } from "@/config/env";

export async function runMonitorBenchmark(domains: string[], userId: string) {
  if (!isSupabaseConfigured || !userId) return;

  const allQueries: any[] = [];

  // Try to use a small concurrency internally so we don't bombard network
  for (let i = 0; i < domains.length; i += 5) {
    const batchDomains = domains.slice(i, i + 5);

    await Promise.all(
      batchDomains.map(async domain => {
        await Promise.all(
          DOH_PROVIDERS.map(async provider => {
            try {
              const result = await measureDoH(provider, domain);

              let final_success = false;
              let final_method = "failed";
              let final_latency = null;
              let fallback_used = true;

              if (result.successRate > 0) {
                final_success = true;
                if (
                  result.method === "server" ||
                  (result.method === "mixed" && !result.fallbackUsed)
                ) {
                  final_method = "server";
                  final_latency = result.avgLatency;
                  fallback_used = false;
                } else {
                  final_method = "fallback";
                  final_latency = result.avgLatency;
                  fallback_used = true;
                }
              }

              allQueries.push({
                user_id: userId,
                domain,
                provider: provider.name,
                latency_ms: final_latency,
                success: final_success,
                tested_at: new Date().toISOString(),
                method: final_method,
                fallback_used,
              });
            } catch (error) {
              allQueries.push({
                user_id: userId,
                domain,
                provider: provider.name,
                latency_ms: null,
                success: false,
                tested_at: new Date().toISOString(),
                method: "failed",
                fallback_used: true,
              });
            }
          })
        );
      })
    );
  }

  // Save to Supabase
  if (allQueries.length > 0) {
    // Insert queries in batches of 50
    for (let i = 0; i < allQueries.length; i += 50) {
      const batch = allQueries.slice(i, i + 50);
      const { error } = await supabase.from("dns_queries").insert(batch);
      if (error) {
        console.error("Supabase monitor error (dns_queries):", error);
      }
    }

    const benchmarkResults = allQueries.map(q => ({
      user_id: q.user_id,
      domain: q.domain,
      provider: q.provider,
      latency_ms: q.latency_ms,
      tested_at: q.tested_at,

      success: q.success,
      method: q.method || "client",
    }));

    if (benchmarkResults.length > 0) {
      const { error } = await supabase
        .from("benchmark_results")
        .insert(benchmarkResults);
      if (error) {
        console.error("Supabase monitor error (benchmark_results):", error);
      }
    }
  }
}
