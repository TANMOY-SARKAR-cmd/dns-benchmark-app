const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// Also update the select query for the first query in fetchPersonalBest
code = code.replace(
  /\.select\("provider, latency_ms, success"\)/g,
  '.select("provider, latency_ms, success, method")'
);

code = code.replace(
  /jitter = avg_latency;\s*\}/g,
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
  /return \{\s*provider,\s*avg_latency,\s*success_rate,\s*jitter,\s*total_tests: stats\.total,\s*\};/g,
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
