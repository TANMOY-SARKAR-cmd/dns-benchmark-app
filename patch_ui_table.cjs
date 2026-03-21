const fs = require("fs");
const filePath = "frontend/src/pages/Home.tsx";
let content = fs.readFileSync(filePath, "utf8");

const oldTable = `<table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b dark:border-slate-800">
                            <th className="py-3 px-4 font-semibold">Domain</th>
                            {userProviders.map(provider => (
                              <th
                                key={provider.name}
                                className="py-3 px-4 font-semibold text-center"
                              >
                                {provider.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(testResults).map(
                            ([domain, results]) => (
                              <tr
                                key={domain}
                                className="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              >
                                <td className="py-3 px-4 font-mono">
                                  {domain}
                                </td>
                                {userProviders.map(provider => {
                                  const result = results[provider.name];
                                  const isError = result === "Error" || !result;
                                  return (
                                    <td
                                      key={provider.name}
                                      className="py-3 px-4 text-center"
                                    >
                                      {isError ? (
                                        <span className="text-red-500 flex items-center justify-center gap-1 text-xs">
                                          ❌ Failed
                                        </span>
                                      ) : (
                                        <div>
                                          <div className="font-semibold">
                                            {result.avgLatency}ms
                                          </div>
                                          <div
                                            className={\`text-[10px] mt-1 inline-flex px-1.5 py-0.5 rounded font-mono font-medium \${result.method === "server" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : result.method === "client" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}\`}
                                          >
                                            {result.method}
                                            {result.fallbackUsed
                                              ? " (fallback)"
                                              : ""}
                                          </div>
                                          <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {result.minLatency}-
                                            {result.maxLatency}ms |{" "}
                                            {result.successRate}%
                                            {!result.verified && (
                                              <div className="text-yellow-600 dark:text-yellow-500 mt-1">
                                                ⚠️ Latency only (response not
                                                verified)
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>`;

const newTable = `<table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b dark:border-slate-800">
                            <th className="py-3 px-4 font-semibold">Domain</th>
                            <th className="py-3 px-4 font-semibold">Provider</th>
                            <th className="py-3 px-4 font-semibold text-center">Latency</th>
                            <th className="py-3 px-4 font-semibold text-center">Method</th>
                            <th className="py-3 px-4 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(testResults).flatMap(([domain, results]) =>
                            userProviders.map(provider => {
                              const result = results[provider.name];
                              const isError = result === "Error" || !result || result.successRate === 0;

                              let badgeColor = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400";
                              let badgeText = "-";

                              if (isError || (result && result.method === "failed")) {
                                badgeColor = "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400";
                                badgeText = "Failed";
                              } else if (result && result.method === "server") {
                                badgeColor = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400";
                                badgeText = "Server";
                              } else if (result && (result.method === "client" || result.method === "mixed")) {
                                badgeColor = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400";
                                badgeText = "Browser";
                              }

                              return (
                                <tr
                                  key={\`\${domain}-\${provider.name}\`}
                                  className="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                  <td className="py-3 px-4 font-mono">{domain}</td>
                                  <td className="py-3 px-4 font-semibold">{provider.name}</td>
                                  <td className="py-3 px-4 text-center">
                                    {isError ? "-" : <span className="font-semibold">{result.avgLatency}ms</span>}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div
                                      className={\`text-[10px] inline-flex px-2 py-1 rounded font-mono font-medium \${badgeColor}\`}
                                    >
                                      {badgeText}
                                      {!isError && result && result.fallbackUsed ? " (fallback)" : ""}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {isError ? (
                                      <span className="text-red-500 flex items-center justify-center gap-1 text-xs">
                                        ❌ Failed
                                      </span>
                                    ) : (
                                      <span className="text-green-500 flex items-center justify-center gap-1 text-xs">
                                        ✅ Success ({result.successRate}%)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>`;

if (content.includes(oldTable)) {
  content = content.replace(oldTable, newTable);
  fs.writeFileSync(filePath, content);
  console.log("Successfully replaced the Detailed Results table.");
} else {
  // If formatting changed, let's try a regex
  const regex =
    /<table className="w-full text-sm text-left">.*?(?=<\/div>\s*<\/CardContent>)/s;
  if (regex.test(content)) {
    content = content.replace(regex, newTable + "\n                      ");
    fs.writeFileSync(filePath, content);
    console.log("Successfully replaced using regex.");
  } else {
    console.log("Could not find the table content.");
  }
}
