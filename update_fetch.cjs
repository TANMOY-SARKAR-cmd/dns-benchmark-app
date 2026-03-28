const fs = require('fs');
const file = 'frontend/src/lib/doh.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /fetchWithTimeout\(url\.toString\(\), {\n      method: "GET",\n      headers: {\n        Accept: "application\/dns-message",\n      },\n      mode: "no-cors",\n    }\)/g,
  'fetchWithTimeout(url.toString(), {\n      method: "GET",\n      headers: {\n        Accept: "application/dns-message",\n      },\n      mode: "no-cors",\n    }, 4000)'
);

code = code.replace(
  /fetchWithTimeout\(provider\.url, {\n      method: "POST",\n      headers: {\n        "Content-Type": "application\/dns-message",\n        Accept: "application\/dns-message",\n      },\n      body: new Uint8Array\(packet\),\n    }\)/g,
  'fetchWithTimeout(provider.url, {\n      method: "POST",\n      headers: {\n        "Content-Type": "application/dns-message",\n        Accept: "application/dns-message",\n      },\n      body: new Uint8Array(packet),\n    }, 4000)'
);

fs.writeFileSync(file, code);
