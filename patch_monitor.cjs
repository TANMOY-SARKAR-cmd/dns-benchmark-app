const fs = require('fs');
const content = fs.readFileSync('frontend/src/lib/monitor.ts', 'utf8');

const updated = content.replace(
  /method:\s*result\.method,\s*fallback_used:\s*result\.fallbackUsed/g,
  `method: result.method === "server" ? "server" : "fallback",
                  fallback_used: result.fallbackUsed`
).replace(
  /method:\s*"failed",\s*fallback_used:\s*true/g,
  `method: "failed",
                  fallback_used: true`
);

fs.writeFileSync('frontend/src/lib/monitor.ts', updated);
