const fs = require('fs');

const filePath = 'frontend/src/pages/Home.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /\/\/ Process one domain at a time.*setProgress\(Math\.round\(\(completed \/ total\) \* 100\)\);\s*\}\s*\}/s;

const newHandleTest = `      // Process one domain at a time, sending all providers in a single batch
      for (const domain of domains) {
        results[domain] = {};

        // Prepare queries for all providers for this domain
        const queries = userProviders.map(p => ({
          domain,
          provider: p.name,
          customIp: p.customIp
        }));

        setProgressText(\`Testing \${domain}...\`);

        let batchData = null;
        try {
          const res = await fetch(new URL("/api/dns-query", window.location.origin).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queries })
          });
          if (res.ok) {
            batchData = await res.json();
          }
        } catch (e) {
          // Ignore, fallback to client DoH handled below
        }

        // Process each provider
        for (const provider of userProviders) {
          try {
            let serverResult = null;
            if (batchData && batchData.results && Array.isArray(batchData.results)) {
               serverResult = batchData.results.find((r: any) => r.provider === provider.name && r.domain === domain);
            }

            let finalResult: BenchmarkResult;

            if (serverResult && serverResult.success && typeof serverResult.latency === "number") {
              // Server succeeded
              finalResult = {
                avgLatency: serverResult.latency,
                minLatency: serverResult.latency,
                maxLatency: serverResult.latency,
                successRate: 100,
                queriesPerSec: 1, // Placeholder
                verified: true,
                method: "server",
                fallbackUsed: false
              };
            } else {
              // Fallback to client DoH
              toast.warning(\`Backend failed for \${provider.name}, using fallback\`);
              finalResult = await measureDoH(provider, domain);
            }

            results[domain][provider.name] = finalResult;

            if (finalResult.successRate === 0) {
              toast.error(\`All methods failed for \${provider.name} on \${domain}\`);
            } else if (finalResult.successRate > 0) {
              allQueries.push({
                user_id: userId,
                domain,
                upstream_provider: provider.name,
                latency_ms: finalResult.avgLatency,
                status: "success",
                created_at: new Date().toISOString(),
                method_used: finalResult.method,
                fallback_used: finalResult.fallbackUsed,
              });
            }
          } catch (error) {
             results[domain][provider.name] = "Error";
             allQueries.push({
                user_id: userId,
                domain,
                upstream_provider: provider.name,
                latency_ms: 0,
                status: "failed",
                created_at: new Date().toISOString(),
                method_used: "failed",
                fallback_used: true,
             });
          }
          completed++;
          setProgress(Math.round((completed / total) * 100));
        }
      }`;

content = content.replace(regex, newHandleTest);
fs.writeFileSync(filePath, content);
console.log('Successfully patched Home.tsx full batching');
