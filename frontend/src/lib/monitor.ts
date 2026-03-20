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

              if (result.successRate > 0) {
                allQueries.push({
                  user_id: userId,
                  domain,
                  upstream_provider: provider.name,
                  latency_ms: result.avgLatency,
                  status: "success",
                  created_at: new Date().toISOString(),
                });
              } else {
                allQueries.push({
                  user_id: userId,
                  domain,
                  upstream_provider: provider.name,
                  latency_ms: 0,
                  status: "failed",
                  created_at: new Date().toISOString(),
                });
              }
            } catch (error) {
              allQueries.push({
                user_id: userId,
                domain,
                upstream_provider: provider.name,
                latency_ms: 0,
                status: "failed",
                created_at: new Date().toISOString(),
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

    const benchmarkResults = allQueries
      .filter(q => q.status === "success")
      .map(q => ({
        user_id: q.user_id,
        domain: q.domain,
        provider: q.upstream_provider,
        latency_ms: q.latency_ms,
        tested_at: q.created_at,
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
