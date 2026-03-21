const fs = require('fs');
let content = fs.readFileSync('frontend/src/lib/monitor.ts', 'utf8');

content = content.replace(
  /allQueries\.push\(\{([\s\S]*?)latency_ms: result\.avgLatency,\s*success: true,\s*tested_at: new Date\(\)\.toISOString\(\),/g,
  `allQueries.push({$1latency_ms: result.avgLatency,
                  success: true,
                  tested_at: new Date().toISOString(),
                  method: result.method === "server" ? "server" : "fallback",
                  fallback_used: result.fallbackUsed,`
);

content = content.replace(
  /allQueries\.push\(\{([\s\S]*?)latency_ms: null,\s*success: false,\s*tested_at: new Date\(\)\.toISOString\(\),/g,
  `allQueries.push({$1latency_ms: null,
                  success: false,
                  tested_at: new Date().toISOString(),
                  method: "failed",
                  fallback_used: true,`
);


fs.writeFileSync('frontend/src/lib/monitor.ts', content);
