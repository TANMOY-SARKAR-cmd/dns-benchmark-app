const fs = require("fs");
let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf8");

// It seems our previous regex replacement for monitorProvidersStr didn't completely match the runTest block
content = content.replace(
  `        const monitorDomainsStr = (Array.isArray(monitor.domains) ? monitor.domains : []).join(",");
        if (
          !currentSetup ||
          currentSetup.interval !== monitor.interval_seconds ||
          currentSetup.domainsStr !== monitorDomainsStr
        ) {
          if (currentSetup) clearInterval(currentSetup.id);

          const runTest = async () => {
            await runMonitorBenchmark(monitor.domains, user.id);
            setLastChecked(prev => ({
              ...prev,
              [monitor.id]: new Date().toLocaleTimeString(),
            }));
          };

          if (!currentSetup) {
            runTest();
          }`,
  `        const monitorDomainsStr = (Array.isArray(monitor.domains) ? monitor.domains : []).join(",");
        const monitorProvidersStr = (Array.isArray(monitor.providers) ? monitor.providers : []).join(",");
        if (
          !currentSetup ||
          currentSetup.interval !== monitor.interval_seconds ||
          currentSetup.domainsStr !== monitorDomainsStr ||
          currentSetup.providersStr !== monitorProvidersStr
        ) {
          if (currentSetup) clearInterval(currentSetup.id);

          const runTest = async () => {
            if (!monitor.domains || !monitor.providers || monitor.domains.length === 0 || monitor.providers.length === 0) return;
            const providers = userProviders.filter(p => monitor.providers.includes(p.name));
            if (providers.length === 0) return;

            const results: any[] = [];
            for (const domain of monitor.domains) {
              for (const provider of providers) {
                try {
                  const result = await measureDoH(provider, domain);
                  results.push({
                    user_id: user.id,
                    domain,
                    upstream_provider: provider.name,
                    latency_ms: result.avgLatency,
                    success: result.successRate > 0,
                    status: result.successRate > 0 ? "success" : "failed",
                    method_used: result.method,
                  });
                } catch (e) {
                  results.push({
                    user_id: user.id,
                    domain,
                    upstream_provider: provider.name,
                    latency_ms: 0,
                    success: false,
                    status: "failed",
                    method_used: "client"
                  });
                }
              }
            }
            if (results.length > 0) {
              await supabase.from("dns_queries").insert(results);
            }

            setLastChecked(prev => ({
              ...prev,
              [monitor.id]: new Date().toLocaleTimeString(),
            }));

            await supabase.from("monitors").update({
              last_run_at: new Date().toISOString(),
              next_run_at: new Date(Date.now() + monitor.interval_seconds * 1000).toISOString()
            }).eq("id", monitor.id);
          };

          if (!currentSetup) {
            runTest();
          }`
);

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
