const fs = require("fs");
let code = fs.readFileSync("frontend/src/pages/Home.tsx", "utf8");

code = code.replace(`{record.fallback_used ? " (fallback)" : ""}`, `{}`);

fs.writeFileSync("frontend/src/pages/Home.tsx", code);
console.log("Patched fallback text in History UI");
