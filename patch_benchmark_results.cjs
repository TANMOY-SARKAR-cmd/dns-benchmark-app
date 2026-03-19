const fs = require("fs");

let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf-8");

const startStr = "// Calculate and insert provider averages for this run";
const endStr = "if (benchmarkResults.length > 0) {";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `const benchmarkResults = allQueries
          .filter(q => q.status === "success")
          .map(q => ({
            user_id: q.user_id,
            domain: q.domain,
            provider: q.upstream_provider,
            latency_ms: q.latency_ms,
            tested_at: q.created_at
          }));

        `;
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync("frontend/src/pages/Home.tsx", content);
  console.log("Replaced benchmark results generation logic.");
} else {
  console.log("Could not find start/end markers.");
}
