const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');
try {
  require('@babel/parser').parse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  console.log('Syntax is valid');
} catch (e) {
  console.log('Syntax error:', e);
}
