const fs = require("fs");
let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf8");

content = content.replace(
  `  const activeIntervals = useRef<
    Record<string, { id: NodeJS.Timeout; interval: number; domainsStr: string }>
  >({});`,
  `  const activeIntervals = useRef<Map<string, { id: NodeJS.Timeout; interval: number; domainsStr: string; providersStr: string }>>(new Map());`
);

content = content.replace(
  `      activeIntervals.current = {};`,
  `      activeIntervals.current.clear();`
);

content = content.replace(
  `        const currentSetup = activeIntervals.current[monitor.id];`,
  `        const currentSetup = activeIntervals.current.get(monitor.id);`
);

content = content.replace(
  `        const monitorDomainsStr = monitor.domains.join(",");
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
          };`,
  `        const monitorDomainsStr = monitor.domains.join(",");
        const monitorProvidersStr = monitor.providers.join(",");
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
          };`
);

content = content.replace(
  `          activeIntervals.current[monitor.id] = {
            id: intervalId,
            interval: monitor.interval_seconds,
            domainsStr: monitorDomainsStr,
          };`,
  `          activeIntervals.current.set(monitor.id, {
            id: intervalId,
            interval: monitor.interval_seconds,
            domainsStr: monitorDomainsStr,
            providersStr: monitorProvidersStr,
          });`
);

content = content.replace(
  `    Object.keys(activeIntervals.current).forEach(id => {
      if (!activeMonitorIds.has(id)) {
        clearInterval(activeIntervals.current[id].id);
        delete activeIntervals.current[id];
      }
    });`,
  `    Array.from(activeIntervals.current.keys()).forEach(id => {
      if (!activeMonitorIds.has(id)) {
        clearInterval(activeIntervals.current.get(id)!.id);
        activeIntervals.current.delete(id);
      }
    });`
);

content = content.replace(
  `    return () => {
      Object.values(activeIntervals.current).forEach(item =>
        clearInterval(item.id)
      );
    };`,
  `    return () => {
      Array.from(activeIntervals.current.values()).forEach(item =>
        clearInterval(item.id)
      );
    };`
);

content = content.replace(
  `    Object.values(activeIntervals.current).forEach(item =>
        clearInterval(item.id)
      );`,
  `    Array.from(activeIntervals.current.values()).forEach(item =>
        clearInterval(item.id)
      );`
);

// Fix the array join in monitor creation
content = content.replace(
  `        const { error: updateError } = await supabase
          .from("monitors")
          .update({
            domains,
            interval_seconds: monitorInterval,
          })
          .eq("id", editingMonitorId);`,
  `        const { error: updateError } = await supabase
          .from("monitors")
          .update({
            domains,
            providers: userProviders.map(p => p.name),
            interval_seconds: monitorInterval,
          })
          .eq("id", editingMonitorId);`
);

content = content.replace(
  `        const { error: insertError } = await supabase.from("monitors").insert({
          user_id: user.id,
          domains,
          interval_seconds: monitorInterval,
        });`,
  `        const { error: insertError } = await supabase.from("monitors").insert({
          user_id: user.id,
          domains,
          providers: userProviders.map(p => p.name),
          interval_seconds: monitorInterval,
        });`
);

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
