const fs = require("fs");
const file = "frontend/src/lib/doh.ts";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
  /fetchWithTimeout\(\s*url\.toString\(\),\s*\{([^}]+)\}\s*\)/g,
  "fetchWithTimeout(url.toString(), {$1}, 4000)"
);

code = code.replace(
  /fetchWithTimeout\(\s*provider\.url,\s*\{([^}]+)\}\s*\)/g,
  "fetchWithTimeout(provider.url, {$1}, 4000)"
);

fs.writeFileSync(file, code);
