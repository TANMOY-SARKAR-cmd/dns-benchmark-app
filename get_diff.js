const { execSync } = require('child_process');
const diff = execSync('git diff').toString();
require('fs').writeFileSync('patch.diff', diff);
