const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// Imports for new tabs
const newImports = `
import { BenchmarkTab } from "./tabs/BenchmarkTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { LeaderboardTab } from "./tabs/LeaderboardTab";
import { MonitorsTab } from "./tabs/MonitorsTab";
import { LiveLogsTab } from "./tabs/LiveLogsTab";
import { SettingsTab } from "./tabs/SettingsTab";
`;
code = code.replace(/import \{ toast \} from "sonner";/, `import { toast } from "sonner";\n${newImports}`);

// Now replace all the logic within the Tabs component with the new modular tab components
code = code.replace(
  /<TabsContent value="benchmark" className="space-y-8">[\s\S]*?<\/TabsContent>/g,
  `<TabsContent value="benchmark" className="space-y-8">
            <BenchmarkTab
              user={user}
              personalBest={personalBest}
              domainsInput={domainsInput}
              setDomainsInput={setDomainsInput}
              recordType={recordType}
              setRecordType={setRecordType}
              isLoading={isLoading}
              handleUsePopular={handleUsePopular}
              handleTest={handleTest}
              userProviders={userProviders}
              progressText={progressText}
              progress={progress}
              testResults={testResults}
              chartData={chartData}
            />
          </TabsContent>`
);

code = code.replace(
  /<TabsContent value="history">[\s\S]*?<\/TabsContent>/g,
  `<TabsContent value="history">
            <HistoryTab
              user={user}
              history={history}
              handleKeepRecord={handleKeepRecord}
              userProviders={userProviders}
            />
          </TabsContent>`
);

code = code.replace(
  /<TabsContent value="leaderboard">[\s\S]*?<\/TabsContent>/g,
  `<TabsContent value="leaderboard">
            <LeaderboardTab
              user={user}
              leaderboard={leaderboard}
              userProviders={userProviders}
              isFetchingData={isFetchingData}
            />
          </TabsContent>`
);

code = code.replace(
  /<TabsContent value="monitors">[\s\S]*?<\/TabsContent>/g,
  `<TabsContent value="monitors">
            <MonitorsTab
              user={user}
              monitors={monitors}
              monitorResults={monitorResults}
              isCreatingMonitor={isCreatingMonitor}
              handleCreateMonitor={handleCreateMonitor}
              monitorDomains={monitorDomains}
              setMonitorDomains={setMonitorDomains}
              monitorInterval={monitorInterval}
              setMonitorInterval={setMonitorInterval}
              toggleMonitor={toggleMonitor}
              handleDeleteMonitor={handleDeleteMonitor}
              isFetchingData={isFetchingData}
            />
          </TabsContent>`
);

code = code.replace(
  /<TabsContent value="logs">[\s\S]*?<\/TabsContent>/g,
  `<TabsContent value="logs">
            <LiveLogsTab user={user} liveLogs={liveLogs} />
          </TabsContent>`
);

code = code.replace(
  /<TabsContent value="settings">[\s\S]*?<\/TabsContent>/g,
  `<TabsContent value="settings">
            <SettingsTab
              user={user}
              customName={customName}
              setCustomName={setCustomName}
              customUrl={customUrl}
              setCustomUrl={setCustomUrl}
              setUserProviders={setUserProviders}
            />
          </TabsContent>`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
