const fs = require("fs");
let code = fs.readFileSync("frontend/src/pages/Home.tsx", "utf8");

code = code.replace(
  `{!isError && result && result.fallbackUsed ? " (fallback)" : ""}`,
  `{}`
);

fs.writeFileSync("frontend/src/pages/Home.tsx", code);
console.log("Patched fallback text in UI");
