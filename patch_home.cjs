const fs = require('fs');

const code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// Add measureClientDoH to import
let newCode = code.replace(
  'import { measureDoH, DOH_PROVIDERS, BenchmarkResult } from "@/lib/doh";',
  'import { measureDoH, measureClientDoH, DOH_PROVIDERS, BenchmarkResult } from "@/lib/doh";'
);

// Replace the benchmark logic loop
const targetLoopStart = `      // Process one domain at a time, sending all providers in a single batch
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

const replacementLoop = `      // Process one domain at a time, sending all providers in a single batch
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

        const failedProviders = [];

        // First pass: identify server successes and failed providers
        for (const provider of userProviders) {
          let serverResult = null;
          if (batchData && batchData.results && Array.isArray(batchData.results)) {
             serverResult = batchData.results.find((r: any) => r.provider === provider.name && r.domain === domain);
          }

          if (serverResult && serverResult.success && typeof serverResult.latency === "number") {
            // Server succeeded
            results[domain][provider.name] = {
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
            failedProviders.push(provider);
          }
        }

        // Second pass: run client fallback concurrently only for failed providers
        if (failedProviders.length > 0) {
          const fallbackResults = await Promise.all(
            failedProviders.map(async (provider) => {
              try {
                toast.warning(\`Backend failed for \${provider.name}, using fallback\`);
                const fallbackResult = await measureClientDoH(provider, domain);
                return { provider, result: fallbackResult };
              } catch (error) {
                return { provider, result: "Error" };
              }
            })
          );

          for (const { provider, result } of fallbackResults) {
            results[domain][provider.name] = result;
            if (result === "Error" || result.successRate === 0) {
              toast.error(\`All methods failed for \${provider.name} on \${domain}\`);
            }
          }
        }

        // Finalize results for all providers for this domain
        for (const provider of userProviders) {
          const finalResult = results[domain][provider.name];
          if (finalResult && finalResult !== "Error" && finalResult.successRate > 0) {
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
          } else {
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

        // Small delay between domains
        await new Promise(r => setTimeout(r, 150));
      }`;

newCode = newCode.replace(targetLoopStart, replacementLoop);

// Replace UI badging
newCode = newCode.replace(
  `                              } else if (result && (result.method === "client" || result.method === "mixed")) {
                                badgeColor = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400";
                                badgeText = "Browser";
                              }`,
  `                              } else if (result && (result.method === "client" || result.method === "client-fallback" || result.method === "mixed")) {
                                badgeColor = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400";
                                badgeText = "Client Fallback";
                              }`
);

// Replace history tab badging
newCode = newCode.replace(
  `                                    <span className={\`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium \${record.method_used === "server" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : record.method_used === "client" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}\`}>`,
  `                                    <span className={\`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium \${record.method_used === "server" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : (record.method_used === "client" || record.method_used === "client-fallback") ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}\`}>`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', newCode);
console.log("Patched Home.tsx successfully");
