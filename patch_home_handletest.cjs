const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

code = code.replace(
  /provider: isCustom \? "custom" : p\.name/g,
  'provider: isCustom ? "custom" : p.key'
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
