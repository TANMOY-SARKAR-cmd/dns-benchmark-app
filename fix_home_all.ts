import fs from "fs";

let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf-8");

// Add specific imports
content = content.replace(
  'import { Textarea } from "@/components/ui/textarea";',
  'import { Textarea } from "@/components/ui/textarea";\nimport { Input } from "@/components/ui/input";'
);

content = content.replace(
  '  Activity,\n} from "lucide-react";',
  '  Activity,\n  Settings,\n  Save,\n} from "lucide-react";'
);

// State vars
content = content.replace(
  "  const [leaderboard, setLeaderboard] = useState<any[]>([]);",
  '  const [leaderboard, setLeaderboard] = useState<any[]>([]);\n  const [customIp, setCustomIp] = useState("");\n  const [userProviders, setUserProviders] = useState<typeof DOH_PROVIDERS>([...DOH_PROVIDERS]);\n  const [isGlobalMonitoring, setIsGlobalMonitoring] = useState(false);\n  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);'
);

// Effect
const useIntervalEffect = `
  // Fetch User Preferences for Custom DNS
  useEffect(() => {
    const loadPrefs = async () => {
      if (!user) {
         setUserProviders([...DOH_PROVIDERS]);
         return;
      }
      const { data } = await supabase
        .from("user_preferences")
        .select("custom_dns")
        .eq("user_id", user.id)
        .single();

      if (data && data.custom_dns && Array.isArray(data.custom_dns) && data.custom_dns.length > 0) {
         const customProviders = data.custom_dns.map((ip: string) => ({
            name: "Custom",
            url: "",
            customIp: ip,
            color: "#8b5cf6",
            format: "json",
         })) as typeof DOH_PROVIDERS;
         setUserProviders([...DOH_PROVIDERS, customProviders[0]]);
         setCustomIp(customProviders[0].customIp!);
      } else {
         setUserProviders([...DOH_PROVIDERS]);
      }
    };
    loadPrefs();
  }, [user]);

  useEffect(() => {
    if (isGlobalMonitoring && user) {
      const topDomains = ["google.com", "cloudflare.com", "amazon.com", "apple.com", "microsoft.com"];
      const run = async () => {
         await runMonitorBenchmark(topDomains, user.id);
      };
      run(); // Run immediately
      monitorIntervalRef.current = setInterval(run, 30000); // Then every 30s
    } else if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }

    return () => {
      if (monitorIntervalRef.current) {
         clearInterval(monitorIntervalRef.current);
      }
    };
  }, [isGlobalMonitoring, user, userProviders]);
`;

content = content.replace(
  "  // Setup live logs subscription",
  useIntervalEffect + "\n  // Setup live logs subscription"
);

// Replace DOH_PROVIDERS logic with userProviders
content = content.replace(
  "const total = domains.length * DOH_PROVIDERS.length;",
  "const total = domains.length * userProviders.length;"
);

content = content.replace(
  /DOH_PROVIDERS\.map\(async provider => \{/g,
  "userProviders.map(async provider => {"
);

content = content.replace(
  /for \(const provider of DOH_PROVIDERS\) \{/g,
  "for (const provider of userProviders) {"
);

content = content.replace(
  /DOH_PROVIDERS\.forEach\(provider => \{/g,
  "userProviders.forEach(provider => {"
);

content = content.replace(
  /\{DOH_PROVIDERS\.map\(provider => \(/g,
  "{userProviders.map(provider => ("
);

content = content.replace(
  /\{DOH_PROVIDERS\.map\(provider => \{/g,
  "{userProviders.map(provider => {"
);

content = content.replace(
  /const provider = DOH_PROVIDERS\.find\(/g,
  "const provider = userProviders.find("
);

// Replace TabsTrigger to include Settings
const oldTabsTrigger = `<TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-5 h-auto">
            <TabsTrigger value="benchmark" className="py-2">
              <Play className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Benchmark</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="py-2">
              <History className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="py-2">
              <Trophy className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Leaderboard</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="py-2">
              <Activity className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Live Logs</span>
            </TabsTrigger>
          </TabsList>`;

const newTabsTrigger = `<TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:grid-cols-6 h-auto">
            <TabsTrigger value="benchmark" className="py-2">
              <Play className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Benchmark</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="py-2">
              <History className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="py-2">
              <Trophy className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Leaderboard</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="py-2">
              <Activity className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Live Logs</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="py-2">
              <Settings className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>`;

content = content.replace(oldTabsTrigger, newTabsTrigger);

// Replace Leaderboard success_rate
content = content.replace(
  '<span className="text-sm font-normal text-slate-500">\n                                    ms\n                                  </span>\n                                </p>',
  '<span className="text-sm font-normal text-slate-500">\n                                    ms\n                                  </span>\n                                </p>\n                                {item.success_rate !== undefined && (\n                                  <p className="text-sm text-slate-500 mt-1">\n                                      Reliability: <span className="font-medium text-slate-700 dark:text-slate-300">{Number(item.success_rate).toFixed(1)}%</span>\n                                  </p>\n                                )}'
);

// Append Settings Tab Content before </Tabs>
const settingsContent = `
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Settings & Preferences</CardTitle>
                <CardDescription>Configure custom DNS providers and behavior</CardDescription>
              </CardHeader>
              <CardContent>
                {!user ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-blue-500" />
                    <p>Please log in to manage settings.</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-md">
                    <div>
                        <h3 className="text-sm font-medium mb-2">Custom DNS Provider IP</h3>
                        <div className="flex gap-2">
                            <Input
                                placeholder="e.g. 1.1.1.1"
                                value={customIp}
                                onChange={(e) => setCustomIp(e.target.value)}
                            />
                            <Button onClick={async () => {
                                const ipList = customIp ? [customIp] : [];
                                const { error } = await supabase.from('user_preferences').upsert({
                                    user_id: user.id,
                                    custom_dns: ipList
                                }, { onConflict: 'user_id' });
                                if (error) {
                                    toast.error('Failed to save settings');
                                } else {
                                    toast.success('Settings saved!');
                                    if (customIp) {
                                        setUserProviders([
                                            ...DOH_PROVIDERS,
                                            { name: "Custom", url: "", customIp, color: "#8b5cf6", format: "json" }
                                        ]);
                                    } else {
                                        setUserProviders([...DOH_PROVIDERS]);
                                    }
                                }
                            }}>
                                <Save className="w-4 h-4 mr-2" />
                                Save
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Provide a valid IP address for a custom DNS resolver. This will add "Custom" to the benchmark providers.
                        </p>
                    </div>
                    <div className="pt-6 border-t dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium">Global Monitoring</h3>
                                <p className="text-xs text-slate-500">Automatically test top domains every 30 seconds</p>
                            </div>
                            <Button
                                variant={isGlobalMonitoring ? "destructive" : "default"}
                                onClick={() => {
                                    if (!isGlobalMonitoring) {
                                        toast.success("Global monitoring started");
                                        setIsGlobalMonitoring(true);
                                    } else {
                                        toast.info("Global monitoring stopped");
                                        setIsGlobalMonitoring(false);
                                    }
                                }}
                            >
                                {isGlobalMonitoring ? "Stop" : "Start"}
                            </Button>
                        </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
`;

// It might be `<TabsContent value="leaderboard">` section ends with `              </CardContent>\n            </Card>\n          </TabsContent>` then `        </Tabs>`
content = content.replace("        </Tabs>", settingsContent);

// Fix History Chart
const historyChartRegex =
  /<TabsContent value="history">([\s\S]*?)<LineChart data=\{history\}>([\s\S]*?)<Line\s*type="monotone"\s*dataKey="latency_ms"\s*stroke="#8884d8"\s*name="Avg Latency \(ms\)"\s*\/>\s*<\/LineChart>/s;

const newHistoryChart = `<TabsContent value="history">$1<LineChart data={
                          Object.values(history.reduce((acc, curr) => {
                            const time = curr.tested_at;
                            if (!acc[time]) acc[time] = { tested_at: time };
                            acc[time][curr.provider] = curr.latency_ms;
                            return acc;
                          }, {} as Record<string, any>)).sort((a: any, b: any) => new Date(a.tested_at).getTime() - new Date(b.tested_at).getTime())
                        }>$2{userProviders.map((provider) => (
                             <Line
                               key={provider.name}
                               type="monotone"
                               dataKey={provider.name}
                               stroke={provider.color}
                               name={provider.name}
                               connectNulls
                             />
                          ))}
                        </LineChart>`;

content = content.replace(historyChartRegex, newHistoryChart);

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
