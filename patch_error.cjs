const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

code = code.replace(
  `                return { provider, result: "Error" };`,
  `                return { provider, result: "Error" as const };`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
console.log("Patched Error type");
