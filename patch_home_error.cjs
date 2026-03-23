const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// Ensure ErrorBoundary is imported
code = code.replace(
  /import \{ SettingsTab \} from "\.\/tabs\/SettingsTab";/,
  `import { SettingsTab } from "./tabs/SettingsTab";\nimport { ErrorBoundary } from "@/components/ui/ErrorBoundary";`
);

// Wrap TabsContent bodies with ErrorBoundary
code = code.replace(/<TabsContent (.*?)>\n\s*<BenchmarkTab/g, '<TabsContent $1>\n            <ErrorBoundary>\n            <BenchmarkTab');
code = code.replace(/chartData=\{chartData\}\n\s*\/>\n\s*<\/TabsContent>/g, 'chartData={chartData}\n            />\n            </ErrorBoundary>\n          </TabsContent>');

code = code.replace(/<TabsContent value="history">\n\s*<HistoryTab/g, '<TabsContent value="history">\n            <ErrorBoundary>\n            <HistoryTab');
code = code.replace(/userProviders=\{userProviders\}\n\s*\/>\n\s*<\/TabsContent>/g, 'userProviders={userProviders}\n            />\n            </ErrorBoundary>\n          </TabsContent>');

code = code.replace(/<TabsContent value="leaderboard">\n\s*<LeaderboardTab/g, '<TabsContent value="leaderboard">\n            <ErrorBoundary>\n            <LeaderboardTab');
code = code.replace(/isFetchingData=\{isFetchingData\}\n\s*\/>\n\s*<\/TabsContent>/g, 'isFetchingData={isFetchingData}\n            />\n            </ErrorBoundary>\n          </TabsContent>');

code = code.replace(/<TabsContent value="monitors">\n\s*<MonitorsTab/g, '<TabsContent value="monitors">\n            <ErrorBoundary>\n            <MonitorsTab');
code = code.replace(/isFetchingData=\{isFetchingData\}\n\s*\/>\n\s*<\/TabsContent>/g, 'isFetchingData={isFetchingData}\n            />\n            </ErrorBoundary>\n          </TabsContent>');

code = code.replace(/<TabsContent value="logs">\n\s*<LiveLogsTab/g, '<TabsContent value="logs">\n            <ErrorBoundary>\n            <LiveLogsTab');
code = code.replace(/liveLogs=\{liveLogs\} \/>\n\s*<\/TabsContent>/g, 'liveLogs={liveLogs} />\n            </ErrorBoundary>\n          </TabsContent>');

code = code.replace(/<TabsContent value="settings">\n\s*<SettingsTab/g, '<TabsContent value="settings">\n            <ErrorBoundary>\n            <SettingsTab');
code = code.replace(/setUserProviders=\{setUserProviders\}\n\s*\/>\n\s*<\/TabsContent>/g, 'setUserProviders={setUserProviders}\n            />\n            </ErrorBoundary>\n          </TabsContent>');

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
