const fs = require('fs');
let code = fs.readFileSync('api/dns-query.ts', 'utf8');

const validateCustomUrlFunction = `
function validateCustomUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    // Block private IP ranges
    const hostname = parsed.hostname;
    const ipPattern = /^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/;
    const match = hostname.match(ipPattern);
    if (match) {
      const parts = match.slice(1, 5).map(Number);
      if (
        parts[0] === 127 ||
        parts[0] === 10 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      ) {
        return false;
      }
    }
    // Also block localhost just in case
    if (hostname === "localhost") return false;

    return true;
  } catch {
    return false; // Invalid URL
  }
}
`;

code = code.replace(
  /const REQUEST_TIMEOUT = 2500; \/\/ ms — per individual DoH fetch/,
  `const REQUEST_TIMEOUT = 2500; // ms — per individual DoH fetch\n${validateCustomUrlFunction}`
);

code = code.replace(
  `if (providerLower === "custom" && (!q.customUrl || typeof q.customUrl !== "string")) {`,
  `if (providerLower === "custom") {
      if (!q.customUrl || typeof q.customUrl !== "string") {
        return new Response(
          JSON.stringify({
            error: \`queries[\${i}].customUrl must be a string when provider is "custom"\`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (!validateCustomUrl(q.customUrl)) {
        return new Response(
          JSON.stringify({
            error: \`queries[\${i}].customUrl is invalid or points to a private/local IP\`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    } else if (providerLower === "custom" && (!q.customUrl || typeof q.customUrl !== "string")) {`
);

fs.writeFileSync('api/dns-query.ts', code);
