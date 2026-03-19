const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

const target = `const benchmarkResults = Object.entries(providerAvgs).map(
          ([provider, { total, count }]) => ({
            user_id: "anonymous",
            provider,
            avg_latency: Math.round(total / count),
            created_at: new Date().toISOString()
          })
        );`;

const replacement = `const benchmarkResults = Object.entries(providerAvgs).map(
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
        );`;

content = content.replace(target, replacement);

fs.writeFileSync('frontend/src/pages/Home.tsx', content);
