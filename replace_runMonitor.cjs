const fs = require('fs');
const file = 'frontend/src/pages/Home.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldRunMonitor = `        const runMonitor = async () => {
          if (!monitor.domains || !monitor.providers || monitor.domains.length === 0 || monitor.providers.length === 0) {
            return;
          }

          try {
            const testedAt = new Date().toISOString();
            const payload: any[] = [];

            for (const providerName of monitor.providers) {
              const provider = userProviders.find((p: any) => p.name === providerName) || DOH_PROVIDERS.find((p: any) => p.name === providerName);
              if (!provider) continue;

              const results = await measureDoHBatch(monitor.domains, provider, 3);

              for (const domain of monitor.domains) {
                const res = results[domain];
                if (!res) continue;

                payload.push({
                  user_id: user.id,
                  monitor_id: monitor.id,
                  domain: domain,
                  provider: provider.name,
                  latency_ms: res.successRate > 0 ? res.avgLatency : null,
                  success: res.successRate > 0,
                  method: res.method || "failed",
                  error: res.successRate > 0 ? null : "Failed to resolve",
                  tested_at: testedAt,
                  keep_forever: false
                });
              }
            }

            if (payload.length > 0) {
              await supabase.from("monitor_results").insert(payload);
            }
          } catch (e) {
            console.error("Monitor execution failed for", monitor.id, e);
          }
        };`;

const newRunMonitor = `        const runMonitor = async () => {
          if (!monitor.domains || !monitor.providers || monitor.domains.length === 0 || monitor.providers.length === 0) {
            return;
          }

          try {
            const testedAt = new Date().toISOString();
            const payload: any[] = [];
            const results: Record<string, Record<string, any>> = {};

            for (const domain of monitor.domains) {
              results[domain] = {};
            }

            // Prepare all queries for backend
            const queries: any[] = [];
            for (const domain of monitor.domains) {
              for (const providerName of monitor.providers) {
                const provider = userProviders.find((p: any) => p.name === providerName) || DOH_PROVIDERS.find((p: any) => p.name === providerName);
                if (!provider) continue;

                const isCustom = !DOH_PROVIDERS.some((dp: any) => dp.name === provider.name);
                queries.push({
                  domain,
                  provider: isCustom ? "custom" : provider.name,
                  customUrl: isCustom ? provider.url : undefined,
                });
              }
            }

            let batchData = null;
            try {
              const res = await fetch(
                new URL("/api/dns-query", window.location.origin).toString(),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ queries }),
                }
              );
              if (res.ok) {
                batchData = await res.json();
              }
            } catch (e) {
              // Ignore, fallback to client DoH handled below
            }

            // First pass: identify server successes and failed providers per domain
            for (const domain of monitor.domains) {
              const failedProviders: any[] = [];

              for (const providerName of monitor.providers) {
                const provider = userProviders.find((p: any) => p.name === providerName) || DOH_PROVIDERS.find((p: any) => p.name === providerName);
                if (!provider) continue;

                let serverResult = null;
                if (batchData && batchData.results && Array.isArray(batchData.results)) {
                  serverResult = batchData.results.find(
                    (r: any) => r.provider === provider.name && r.domain === domain
                  );
                }

                if (serverResult && serverResult.success === true) {
                  results[domain][provider.name] = {
                    avgLatency: serverResult.latency,
                    minLatency: serverResult.latency,
                    maxLatency: serverResult.latency,
                    successRate: 100,
                    queriesPerSec: 1,
                    verified: true,
                    method: serverResult.method,
                  };
                } else {
                  failedProviders.push(provider);
                }
              }

              // Second pass: run client fallback concurrently only for failed providers
              if (failedProviders.length > 0) {
                const fallbackResults = await Promise.all(
                  failedProviders.map(async provider => {
                    try {
                      const fallbackResult = await measureClientDoH(provider, domain);
                      return { provider, result: fallbackResult };
                    } catch (error) {
                      return { provider, result: "Error" as const };
                    }
                  })
                );

                for (const { provider, result } of fallbackResults) {
                  results[domain][provider.name] = result;
                }
              }

              // Finalize results for all providers for this domain
              for (const providerName of monitor.providers) {
                const provider = userProviders.find((p: any) => p.name === providerName) || DOH_PROVIDERS.find((p: any) => p.name === providerName);
                if (!provider) continue;

                let serverResult = null;
                if (batchData && batchData.results && Array.isArray(batchData.results)) {
                  serverResult = batchData.results.find(
                    (r: any) => r.provider === provider.name && r.domain === domain
                  );
                }

                let clientResult = results[domain][provider.name];

                let final_success = false;
                let final_method = "failed";
                let final_latency = null;

                const serverSuccess = serverResult && serverResult.success === true;
                const clientSuccess = clientResult && clientResult !== "Error" && clientResult.successRate > 0;

                if (serverSuccess) {
                  final_success = true;
                  final_method = serverResult.method;
                  final_latency = serverResult.latency;
                } else if (clientSuccess) {
                  final_success = true;
                  final_method = clientResult.method || "fallback";
                  final_latency = clientResult.avgLatency;
                }

                payload.push({
                  user_id: user.id,
                  domain: domain,
                  provider: provider.name,
                  latency_ms: final_success ? final_latency : null,
                  success: final_success,
                  method: final_method,
                  error: final_success ? null : "Failed to resolve",
                  tested_at: testedAt,
                  keep_forever: false,
                  monitor_id: monitor.id
                });
              }
            }

            if (payload.length > 0) {
              await supabase.from("monitor_results").insert(payload.map(({ monitor_id, ...rest }) => rest)); // Strictly omitting monitor_id to adhere to required schema
            }
          } catch (e) {
            console.error("Monitor execution failed for", monitor.id, e);
          }
        };`;

if (content.includes(oldRunMonitor)) {
    content = content.replace(oldRunMonitor, newRunMonitor);
    fs.writeFileSync(file, content);
    console.log("Replaced runMonitor successfully.");
} else {
    console.log("Could not find the old runMonitor string.");
}
