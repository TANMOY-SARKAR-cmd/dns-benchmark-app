const fs = require('fs');
let content = fs.readFileSync('frontend/src/lib/monitor.ts', 'utf8');

content = content.replace(
  /benchmarkResults = allQueries\s*\n\s*\.filter\(q => q\.success\)\s*\n\s*\.map\(q => \(\{([\s\S]*?)\}\)\);/,
  `benchmarkResults = allQueries
      .map(q => ({$1
        success: q.success,
        method: q.method || "client",
      }));`
);


fs.writeFileSync('frontend/src/lib/monitor.ts', content);
