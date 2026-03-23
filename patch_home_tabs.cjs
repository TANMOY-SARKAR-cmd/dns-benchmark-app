const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

code = code.replace(
  /<TabsList className="flex flex-wrap sm:grid sm:grid-cols-5 md:w-auto h-auto min-h-10">/g,
  '<TabsList className="flex overflow-x-auto flex-nowrap w-full sm:grid sm:grid-cols-6 md:w-auto h-auto min-h-10">'
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
