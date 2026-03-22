const fs = require('fs');
const file = 'frontend/src/pages/Home.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/Trash2,/, 'Trash2,\n  Square,');
fs.writeFileSync(file, content);
