const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

const updated = content.replace(
  /method:\s*finalResult\.method,\s*fallback_used:\s*finalResult\.fallbackUsed/g,
  `method: finalResult.method === "server" ? "server" : "fallback",
              fallback_used: finalResult.fallbackUsed`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', updated);
