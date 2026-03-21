const fs = require("fs");
let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf8");

// The UI was mostly updated in previous steps or already contains the requested components:
// Progress bar: already in Home.tsx.
// Method used: already rendered in the detailed results table.
// Live Logs Icons: the UI already uses text colors ("text-green-600" / "text-red-600"). We will update it to add actual icons.
// Leaderboard success rate: already displayed.
// History graph: already displayed.

// Update Live Logs to show icons
content = content.replace(
  `                          <div
                            className={\`font-semibold \${log.status === "success" ? "text-green-600" : "text-red-600"}\`}
                          >
                            {log.status === "success"
                              ? \`\${log.latency_ms}ms\`
                              : "Failed"}
                          </div>`,
  `                          <div className="flex items-center gap-2">
                            {log.method_used === "client" ? (
                              <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 px-1.5 py-0.5 rounded font-mono font-medium">
                                client fallback
                              </span>
                            ) : log.method_used === "server" ? (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono font-medium">
                                server
                              </span>
                            ) : null}
                            <div
                              className={\`font-semibold flex items-center gap-1 \${log.status === "success" || log.success ? "text-green-600" : "text-red-600"}\`}
                            >
                              {log.status === "success" || log.success ? (
                                <>
                                  <Activity className="w-3 h-3" />
                                  <span>{log.latency_ms}ms</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Failed</span>
                                </>
                              )}
                            </div>
                          </div>`
);

// Method used display in Benchmark Results Table
content = content.replace(
  `                                          <div className="text-xs text-muted-foreground mt-1 text-blue-600 dark:text-blue-400">
                                            ({result.method})
                                          </div>`,
  `                                          <div className={\`text-[10px] mt-1 inline-flex px-1.5 py-0.5 rounded font-mono font-medium \${result.fallbackUsed ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400" : "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400"}\`}>
                                            {result.method}{result.fallbackUsed ? " (fallback)" : ""}
                                          </div>`
);

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
