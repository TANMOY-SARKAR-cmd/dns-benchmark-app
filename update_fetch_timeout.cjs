const fs = require('fs');
const file = 'frontend/src/lib/doh.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const { response, latency } = await fetchWithTimeout\(url\.toString\(\), {([^}]+)} \+?as RequestInit\);/g,
  'const { response, latency } = await fetchWithTimeout(url.toString(), {$1} as RequestInit, 4000);'
);

code = code.replace(
  /const { response, latency } = await fetchWithTimeout\(provider\.url, {([^}]+)} \+?as RequestInit\);/g,
  'const { response, latency } = await fetchWithTimeout(provider.url, {$1} as RequestInit, 4000);'
);

// Fallback if not matching with `as RequestInit`
code = code.replace(
  /const { response, latency } = await fetchWithTimeout\(url\.toString\(\), {([^}]+)}\);/g,
  'const { response, latency } = await fetchWithTimeout(url.toString(), {$1}, 4000);'
);

code = code.replace(
  /const { response, latency } = await fetchWithTimeout\(provider\.url, {([^}]+)}\);/g,
  'const { response, latency } = await fetchWithTimeout(provider.url, {$1}, 4000);'
);


fs.writeFileSync(file, code);
