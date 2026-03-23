const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// 1. fetchLeaderboard select
code = code.replace(
  /\.select\("provider, latency_ms, success"\)/g,
  '.select("provider, latency_ms, success, method")'
);

// 2. update agg
code = code.replace(
  /const agg: Record<\s*string,\s*\{\s*latencies: number\[\];\s*successCount: number;\s*total: number\s*\}\s*> = \{\};/,
  'const agg: Record<string, { latencies: number[]; successCount: number; total: number; udp: number; doh: number; fallback: number; failed: number }> = {};'
);

code = code.replace(
  /agg\[row\.provider\] = \{ latencies: \[\], successCount: 0, total: 0 \};/,
  'agg[row.provider] = { latencies: [], successCount: 0, total: 0, udp: 0, doh: 0, fallback: 0, failed: 0 };'
);

code = code.replace(
  /agg\[row\.provider\]\.total \+= 1;/,
  `agg[row.provider].total += 1;
          if (row.method === "server-udp") {
            agg[row.provider].udp += 1;
          } else if (row.method === "server-doh") {
            agg[row.provider].doh += 1;
          } else if (row.method === "fallback") {
            agg[row.provider].fallback += 1;
          } else if (row.method === "failed" || !row.success) {
            agg[row.provider].failed += 1;
          }`
);

// 3. update dataToProcess
code = code.replace(
  /jitter = avg_latency;\s*\}/,
  `jitter = avg_latency;
          }

          const udp_percentage = (stats.udp / Math.max(stats.total, 1)) * 100;
          const doh_percentage = (stats.doh / Math.max(stats.total, 1)) * 100;
          const fallback_percentage = (stats.fallback / Math.max(stats.total, 1)) * 100;
          const failure_percentage = (stats.failed / Math.max(stats.total, 1)) * 100;

          let stability_status = "Stable";
          if (failure_percentage > 20 || fallback_percentage > 30 || (jitter !== null && jitter > 50)) {
            stability_status = "Unreliable";
          } else if (failure_percentage > 10 || fallback_percentage > 15 || (jitter !== null && jitter > 25)) {
            stability_status = "Unstable";
          }`
);

code = code.replace(
  /return \{\s*provider,\s*avg_latency,\s*success_rate,\s*jitter,\s*total_tests: stats\.total,\s*\};/,
  `return {
            provider,
            avg_latency,
            success_rate,
            jitter,
            total_tests: stats.total,
            udp_percentage,
            doh_percentage,
            fallback_percentage,
            failure_percentage,
            stability_status,
          };`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
