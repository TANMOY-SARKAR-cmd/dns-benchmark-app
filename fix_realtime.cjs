const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

content = content.replace(
  /payload => {\n\s*setLiveLogs\(prev => \[payload\.new, \.\.\.prev\]\.slice\(0, 50\)\);\n\s*}\n\s*\)/,
  `payload => {
          console.log("Realtime insert:", payload);
          setLiveLogs(prev => [payload.new, ...prev].slice(0, 50));
        }
      )`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', content);
