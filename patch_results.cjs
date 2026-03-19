const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

content = content.replace(
  /const benchmarkResults = Object\.entries\(providerAvgs\)\.map\(\n\s*\[provider, \{ total, count \}\] => \(\{\n\s*user_id: "anonymous",\n\s*provider,\n\s*avg_latency: Math\.round\(total \/ count\),\n\s*created_at: new Date\(\)\.toISOString\(\)\n\s*\}\)\n\s*\);/g,
  `const benchmarkResults = Object.entries(providerAvgs).map(
          ([provider, { total, count }]) => {
            const providerResults = Object.values(results).map(r => r[provider]).filter(r => r && r !== "Error");
            const min_latency = providerResults.length > 0 ? Math.min(...providerResults.map(r => r.minLatency)) : 0;
            const max_latency = providerResults.length > 0 ? Math.max(...providerResults.map(r => r.maxLatency)) : 0;
            const avg_success = providerResults.length > 0 ? providerResults.reduce((acc, r) => acc + r.successRate, 0) / providerResults.length : 0;

            return {
              user_id: "anonymous",
              provider,
              avg_latency: Math.round(total / count),
              min_latency,
              max_latency,
              success_rate: Math.round(avg_success),
              created_at: new Date().toISOString()
            };
          }
        );`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', content);
