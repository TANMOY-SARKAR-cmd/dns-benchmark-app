import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Star, ShieldCheck, Zap, Play } from "lucide-react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";
import { useTheme } from "@/contexts/ThemeContext";

// Props from parent
export function BenchmarkTab({
  user,
  personalBest,
  domainsInput,
  setDomainsInput,
  recordType,
  setRecordType,
  isLoading,
  handleUsePopular,
  handleTest,
  userProviders,
  setUserProviders,
  progressText,
  progress,
  testResults,
  chartData,
}: any) {
  const { theme } = useTheme();
  const [activeProviders, setActiveProviders] = useState<string[]>([]);

  useEffect(() => {
    setActiveProviders(userProviders.map((p: any) => p.name));
  }, [userProviders]);

  const toggleProvider = (name: string) => {
    setActiveProviders((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const handleRunTest = () => {
    // Only pass active providers to test
    const filteredProviders = userProviders.filter((p: any) => activeProviders.includes(p.name));
    handleTest(filteredProviders);
  };

  const filteredChartData = chartData.map((item: any) => {
    const filtered: any = { domain: item.domain };
    Object.keys(item).forEach(key => {
      if (key === "domain" || activeProviders.includes(key)) filtered[key] = item[key];
    });
    return filtered;
  });

  return (
    <div className="space-y-8">
      {user && personalBest && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Your Best DNS</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-100 dark:border-blue-900 shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-blue-400">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Recommended DNS for you</p>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{personalBest.recommended.provider}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border-emerald-100 dark:border-emerald-900 shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-full text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Most reliable DNS</p>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{personalBest.mostReliable.provider}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border-amber-100 dark:border-amber-900 shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-full text-amber-600 dark:text-amber-400">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Fastest DNS</p>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{personalBest.fastest.provider}</h3>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Enter Domains to Test</CardTitle>
              <CardDescription>
                Enter one or more domains separated by commas or new lines. Supports up to 100 domains.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="google.com&#10;github.com&#10;youtube.com"
                value={domainsInput}
                onChange={e => setDomainsInput(e.target.value)}
                className="min-h-32 resize-none font-mono text-sm"
                disabled={isLoading}
              />
              <div className="flex gap-4 mt-4">
                <div className="w-1/3">
                  <Select value={recordType} onValueChange={(v: "A"|"AAAA") => setRecordType(v)} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Record Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">IPv4 (A)</SelectItem>
                      <SelectItem value="AAAA">IPv6 (AAAA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Button
                  variant="outline"
                  onClick={handleUsePopular}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Use Popular Domains
                </Button>
                <Button
                  onClick={handleRunTest}
                  disabled={isLoading || activeProviders.length === 0}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span> Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" /> Run DNS Test
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>DNS Providers</CardTitle>
              <CardDescription>Select providers to benchmark</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {userProviders.map((provider: any) => (
                <div key={provider.name} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={activeProviders.includes(provider.name)}
                    onChange={() => toggleProvider(provider.name)}
                    disabled={isLoading}
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: provider.color }} />
                  <span className="font-semibold">{provider.name}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="text-center py-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/50">
        <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center justify-center gap-2">
          ✅ Fully client-side DoH benchmarking – works instantly in any browser. No server required.
        </p>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                {progressText || "Initializing..."}
              </span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {testResults && !isLoading && (
        <div className="space-y-8">
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Latency Comparison (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredChartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="domain" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} interval={0} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme === "dark" ? "#1e293b" : "#fff",
                          borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
                          color: theme === "dark" ? "#f8fafc" : "#0f172a",
                        }}
                      />
                      <Legend />
                      {userProviders.filter((p: any) => activeProviders.includes(p.name)).map((provider: any) => (
                        <Bar
                          key={provider.name}
                          dataKey={provider.name}
                          fill={provider.color}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Detailed Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
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
                    {Object.entries(testResults).flatMap(([domain, results]: any) =>
                      userProviders.filter((p: any) => activeProviders.includes(p.name)).map((provider: any) => {
                        const result = results[provider.name];
                        const isError = result === "Error" || !result || result.successRate === 0;

                        let badgeColor = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400";
                        let badgeText = "-";

                        if (isError || (result && result.method === "failed")) {
                          badgeColor = "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400";
                          badgeText = "Failed";
                        } else if (result && (result.method === "server-udp" || result.method === "server-doh")) {
                          badgeColor = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400";
                          badgeText = "Server";
                        } else if (result && result.method === "fallback") {
                          badgeColor = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400";
                          badgeText = "Client Fallback";
                        }

                        return (
                          <tr key={`${domain}-${provider.name}`} className="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-mono">{domain}</td>
                            <td className="py-3 px-4 font-semibold">{provider.name}</td>
                            <td className="py-3 px-4 text-center">
                              {isError ? "-" : <span className="font-semibold">{result.avgLatency}ms</span>}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-[10px] inline-flex px-2 py-1 rounded font-mono font-medium ${badgeColor}`}>
                                {badgeText}
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
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
