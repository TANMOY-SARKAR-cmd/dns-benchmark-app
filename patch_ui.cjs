const fs = require("fs");

let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf-8");

// Leaderboard: Update reference from item.avg_latency to item.global_avg_ms
content = content.replace(/\.sort\(\(a, b\) => a\.avg_latency - b\.avg_latency\)/g, ".sort((a, b) => a.global_avg_ms - b.global_avg_ms)");
content = content.replace(/{Math\.round\(item\.avg_latency\)}/g, "{Math.round(item.global_avg_ms)}");

// History Fetch: Change order("created_at") to order("tested_at")
content = content.replace(/\.order\("created_at", \{ ascending: false \}\)/g, '.order("tested_at", { ascending: false })');

// History Chart: Update dataKey="created_at" to tested_at and dataKey="avg_latency" to latency_ms
content = content.replace(/dataKey="created_at"/g, 'dataKey="tested_at"');
content = content.replace(/dataKey="avg_latency"/g, 'dataKey="latency_ms"');

// Live Logs: Update log.success to log.status === "success"
content = content.replace(/\$\{log\.success \? "text-green-600" : "text-red-600"\}/g, '${log.status === "success" ? "text-green-600" : "text-red-600"}');
content = content.replace(/\{log\.success \? `\$\{log\.latency_ms\}ms` : "Failed"\}/g, '{log.status === "success" ? `${log.latency_ms}ms` : "Failed"}');
// Live Logs: Update log.provider to log.upstream_provider
content = content.replace(/<span className="font-semibold">\{log\.provider\}<\/span>/g, '<span className="font-semibold">{log.upstream_provider}</span>');

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
console.log("Replaced UI logic.");
