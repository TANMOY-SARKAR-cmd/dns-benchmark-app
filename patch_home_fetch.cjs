const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// Undo the first incorrect replace
code = code.replace(
  'const agg: Record<string, { latencies: number[]; successCount: number; total: number; udp: number; doh: number; fallback: number; failed: number }> = {};',
  'const agg: Record<\n        string,\n        { latencies: number[]; successCount: number; total: number }\n      > = {};'
);

code = code.replace(
  'agg[row.provider] = { latencies: [], successCount: 0, total: 0, udp: 0, doh: 0, fallback: 0, failed: 0 };',
  'agg[row.provider] = { latencies: [], successCount: 0, total: 0 };'
);

code = code.replace(
  `agg[row.provider].total += 1;
          if (row.method === "server-udp") {
            agg[row.provider].udp += 1;
          } else if (row.method === "server-doh") {
            agg[row.provider].doh += 1;
          } else if (row.method === "fallback") {
            agg[row.provider].fallback += 1;
          } else if (row.method === "failed" || !row.success) {
            agg[row.provider].failed += 1;
          }`,
  'agg[row.provider].total += 1;'
);

// Now apply correctly to the second fetchLeaderboard `agg`
code = code.replace(
  /const agg: Record<\s*string,\s*\{\s*latencies: number\[\];\s*successCount: number;\s*total: number\s*\}\s*> = \{\};/g,
  `const agg: Record<string, { latencies: number[]; successCount: number; total: number; udp: number; doh: number; fallback: number; failed: number }> = {};`
);

code = code.replace(
  /agg\[row\.provider\] = \{ latencies: \[\], successCount: 0, total: 0 \};/g,
  `agg[row.provider] = { latencies: [], successCount: 0, total: 0, udp: 0, doh: 0, fallback: 0, failed: 0 };`
);

// Replace ALL occurrences of `agg[row.provider].total += 1;`
code = code.replace(
  /agg\[row\.provider\]\.total \+= 1;/g,
  `agg[row.provider].total += 1;
          if (row.method === "server-udp") {
            agg[row.provider].udp += 1;
          } else if (row.method === "server-doh") {
            agg[row.provider].doh += 1;
          } else if (row.method === "fallback") {
            agg[row.provider].fallback += 1;
          } else if (row.method === "failed" || !row.success) {
            agg[row.provider].failed += 1;
          }`
);


fs.writeFileSync('frontend/src/pages/Home.tsx', code);
