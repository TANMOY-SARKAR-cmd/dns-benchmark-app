const fs = require('fs');
const filePath = 'frontend/src/pages/Home.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /\{Math\.round\(item\.global_avg_ms\)\}/;

const newCode = `{isNaN(item.global_avg_ms) || item.global_avg_ms === null ? "No data" : Math.round(item.global_avg_ms)}`;

if (regex.test(content)) {
  content = content.replace(regex, newCode);
  fs.writeFileSync(filePath, content);
  console.log("Successfully patched leaderboard NaN check.");
} else {
  console.log("Could not find global_avg_ms round call.");
}
