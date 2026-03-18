const fs = require('fs');
console.log(fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8').substring(0, 100));
