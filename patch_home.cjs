const fs = require('fs');

const path = 'frontend/src/pages/Home.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace sequential provider loop with Promise.all
const oldLoop = `            for (const provider of DOH_PROVIDERS) {
              setProgressText(\`Testing \${domain} on \${provider.name}...\`);

              try {
                const result = await measureDoH(provider, domain);
                results[domain][provider.name] = result;

                if (result.successRate > 0) {
                  allQueries.push({
                    user_id: "anonymous",
                    domain,
                    provider: provider.name,
                    latency_ms: result.avgLatency,
                    success: true,
                  });
                }
              } catch (error) {
                results[domain][provider.name] = "Error";
                allQueries.push({
                  user_id: "anonymous",
                  domain,
                  provider: provider.name,
                  latency_ms: 0,
                  success: false,
                });
              }
              completed++;
              setProgress(Math.round((completed / total) * 100));
            }`;

const newLoop = `            await Promise.all(
              DOH_PROVIDERS.map(async (provider) => {
                setProgressText(\`Testing \${domain} on \${provider.name}...\`);

                try {
                  const result = await measureDoH(provider, domain);
                  results[domain][provider.name] = result;

                  if (result.successRate > 0) {
                    allQueries.push({
                      user_id: "anonymous",
                      domain,
                      provider: provider.name,
                      latency_ms: result.avgLatency,
                      success: true,
                    });
                  }
                } catch (error) {
                  results[domain][provider.name] = "Error";
                  allQueries.push({
                    user_id: "anonymous",
                    domain,
                    provider: provider.name,
                    latency_ms: 0,
                    success: false,
                  });
                }
                completed++;
                setProgress(Math.round((completed / total) * 100));
              })
            );`;

if (code.includes(oldLoop)) {
  code = code.replace(oldLoop, newLoop);
} else {
  console.error("Could not find the old loop pattern in Home.tsx");
}

// Update the UI "Err" text to "❌ Failed"
const oldErr = `<span className="text-red-500 flex items-center justify-center gap-1 text-xs">
                                          <AlertCircle className="w-3 h-3" />{" "}
                                          Err
                                        </span>`;
const newErr = `<span className="text-red-500 flex items-center justify-center gap-1 text-xs">
                                          ❌ Failed
                                        </span>`;

if (code.includes(oldErr)) {
  code = code.replace(oldErr, newErr);
} else {
  // Try regex in case of formatting differences
  const errRegex = /<span className="text-red-500 flex items-center justify-center gap-1 text-xs">\s*<AlertCircle className="w-3 h-3" \/>\{" "\}\s*Err\s*<\/span>/m;
  code = code.replace(errRegex, newErr);
}

fs.writeFileSync(path, code);
console.log('patched');
