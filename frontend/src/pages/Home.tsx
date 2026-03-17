import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { measureDoH, DOH_PROVIDERS, BenchmarkResult } from "@/lib/doh";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/config/env";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import Papa from "papaparse";
import {
  Globe,
  AlertCircle,
  Moon,
  Sun,
  Download,
  Play,
  History,
  Trophy,
  Activity,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [domainsInput, setDomainsInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [testResults, setTestResults] = useState<Record<
    string,
    Record<string, BenchmarkResult | "Error">
  > | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState("benchmark");

  // Leaderboard & History
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);

  useEffect(() => {
    // Fetch initial leaderboard and history
    fetchLeaderboard();
    fetchHistory();

    // Subscribe to live logs
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dns_queries",
        },
        payload => {
          setLiveLogs(prev => [payload.new, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase.from("leaderboard").select("*");
      if (error) throw error;
      setLeaderboard(data || []);
    } catch (e) {
      console.error("Leaderboard fetch error", e);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("benchmark_results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error("History fetch error", e);
    }
  };

  const handleUsePopular = () => {
    setDomainsInput(
      "google.com\nfacebook.com\napple.com\nnetflix.com\namazon.com\nwikipedia.org"
    );
  };

  const handleTest = async () => {
    const domains = domainsInput
      .split(/[\n,]+/)
      .map(d => d.trim())
      .filter(d => d.length > 0);

    if (domains.length === 0) {
      toast.error("Please enter at least one domain");
      return;
    }

    if (domains.length > 100) {
      toast.error("Maximum 100 domains allowed");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setTestResults(null);
    const results: Record<
      string,
      Record<string, BenchmarkResult | "Error">
    > = {};
    let completed = 0;
    const total = domains.length * DOH_PROVIDERS.length;

    try {
      const allQueries: any[] = [];

      // Process domains in batches of 5
      for (let i = 0; i < domains.length; i += 5) {
        const batchDomains = domains.slice(i, i + 5);

        await Promise.all(
          batchDomains.map(async domain => {
            results[domain] = {};

            for (const provider of DOH_PROVIDERS) {
              setProgressText(`Testing ${domain} on ${provider.name}...`);

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
            }
          })
        );
      }

      setTestResults(results);
      toast.success("Benchmark completed successfully");

      // Save to Supabase
      if (!isSupabaseConfigured) {
        toast.info("Supabase not configured — results not saved");
      } else if (allQueries.length > 0) {
        // Insert queries in batches of 50
        for (let i = 0; i < allQueries.length; i += 50) {
          await supabase
            .from("dns_queries")
            .insert(allQueries.slice(i, i + 50));
        }

        // Calculate and insert provider averages for this run
        const providerAvgs: Record<string, { total: number; count: number }> =
          {};
        allQueries.forEach(q => {
          if (q.success) {
            if (!providerAvgs[q.provider])
              providerAvgs[q.provider] = { total: 0, count: 0 };
            providerAvgs[q.provider].total += q.latency_ms;
            providerAvgs[q.provider].count++;
          }
        });

        const benchmarkResults = Object.entries(providerAvgs).map(
          ([provider, { total, count }]) => ({
            user_id: "anonymous",
            provider,
            avg_latency: Math.round(total / count),
          })
        );

        if (benchmarkResults.length > 0) {
          await supabase.from("benchmark_results").insert(benchmarkResults);
        }

        fetchLeaderboard();
        fetchHistory();
      }
    } catch (error) {
      toast.error("An error occurred during benchmarking");
      console.error(error);
    } finally {
      setIsLoading(false);
      setProgressText("");
    }
  };

  const handleExportCSV = () => {
    if (!testResults) return;

    const data = [];
    for (const [domain, providers] of Object.entries(testResults)) {
      const row: any = { Domain: domain };
      for (const provider of DOH_PROVIDERS) {
        const result = providers[provider.name];
        if (result === "Error" || !result) {
          row[`${provider.name} (ms)`] = "Error";
          row[`${provider.name} Success %`] = "Error";
        } else {
          row[`${provider.name} (ms)`] = result.avgLatency;
          row[`${provider.name} Success %`] = result.successRate;
        }
      }
      data.push(row);
    }

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `dns_benchmark_${new Date().toISOString()}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart data
  const chartData = testResults
    ? Object.entries(testResults).map(([domain, results]) => {
        const item: any = { domain };
        DOH_PROVIDERS.forEach(provider => {
          const res = results[provider.name];
          item[provider.name] = res && res !== "Error" ? res.avgLatency : null;
        });
        return item;
      })
    : [];

  return (
    <div
      className={`min-h-screen bg-slate-50 transition-colors duration-200 ${theme === "dark" ? "dark:bg-slate-950 dark:text-slate-50" : ""}`}
    >
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Globe className="w-8 h-8 text-blue-600" />
              DNS Benchmark
            </h1>
            <p className="text-slate-500 mt-1">
              Client-side DoH performance testing
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme?.(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="benchmark" className="flex items-center gap-2">
              <Play className="w-4 h-4" /> Benchmark
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Live Logs
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" /> History
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" /> Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="benchmark" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Input Section */}
              <div className="md:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Enter Domains to Test</CardTitle>
                    <CardDescription>
                      Enter one or more domains separated by commas or new
                      lines. Supports up to 100 domains.
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleUsePopular}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        Use Popular Domains
                      </Button>
                      <Button
                        onClick={handleTest}
                        disabled={isLoading || domainsInput.trim().length === 0}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Testing...
                          </>
                        ) : (
                          "Run DNS Test"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Providers Section */}
              <div>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>DNS Providers</CardTitle>
                    <CardDescription>Using DNS-over-HTTPS</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {DOH_PROVIDERS.map(provider => (
                      <div
                        key={provider.name}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: provider.color }}
                        />
                        <span className="font-semibold">{provider.name}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="text-center py-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/50">
              <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center justify-center gap-2">
                ✅ Fully client-side DoH benchmarking – works instantly in any
                browser. No server required.
              </p>
            </div>

            {/* Progress UI */}
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

            {/* Results Section */}
            {testResults && !isLoading && (
              <div className="space-y-6">
                {/* Chart */}
                {chartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Latency Comparison (ms)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              opacity={0.2}
                            />
                            <XAxis dataKey="domain" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor:
                                  theme === "dark" ? "#1e293b" : "#fff",
                                borderColor:
                                  theme === "dark" ? "#334155" : "#e2e8f0",
                                color: theme === "dark" ? "#f8fafc" : "#0f172a",
                              }}
                            />
                            <Legend />
                            {DOH_PROVIDERS.map(provider => (
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

                {/* Table */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Detailed Results</CardTitle>
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b dark:border-slate-800">
                            <th className="py-3 px-4 font-semibold">Domain</th>
                            {DOH_PROVIDERS.map(provider => (
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
                                {DOH_PROVIDERS.map(provider => {
                                  const result = results[provider.name];
                                  const isError = result === "Error" || !result;
                                  return (
                                    <td
                                      key={provider.name}
                                      className="py-3 px-4 text-center"
                                    >
                                      {isError ? (
                                        <span className="text-red-500 flex items-center justify-center gap-1 text-xs">
                                          <AlertCircle className="w-3 h-3" />{" "}
                                          Err
                                        </span>
                                      ) : (
                                        <div>
                                          <div className="font-semibold">
                                            {result.avgLatency}ms
                                          </div>
                                          <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {result.minLatency}-
                                            {result.maxLatency}ms |{" "}
                                            {result.successRate}%
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
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Live Query Logs</CardTitle>
                <CardDescription>
                  Real-time stream of DNS tests happening globally
                </CardDescription>
              </CardHeader>
              <CardContent>
                {liveLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    {isSupabaseConfigured ? "Waiting for queries... Run a benchmark to see live results here." : "Supabase is not configured. Live logs are disabled."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveLogs.map((log, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-900 rounded-md text-sm"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-slate-500">
                            {new Date(
                              log.timestamp || log.created_at
                            ).toLocaleTimeString()}
                          </span>
                          <span className="font-semibold">{log.provider}</span>
                          <span className="font-mono">{log.domain}</span>
                        </div>
                        <div
                          className={`font-semibold ${log.success ? "text-green-600" : "text-red-600"}`}
                        >
                          {log.success ? `${log.latency_ms}ms` : "Failed"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Recent Benchmarks</CardTitle>
                <CardDescription>Last 100 benchmark runs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="created_at"
                        tickFormatter={val =>
                          new Date(val).toLocaleTimeString()
                        }
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={val => new Date(val).toLocaleString()}
                        contentStyle={{
                          backgroundColor:
                            theme === "dark" ? "#1e293b" : "#fff",
                          borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="avg_latency"
                        stroke="#8884d8"
                        name="Avg Latency (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Global Leaderboard</CardTitle>
                <CardDescription>
                  Average latency by provider across all users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {leaderboard
                    .sort((a, b) => a.avg_latency - b.avg_latency)
                    .map((item, index) => {
                      const provider = DOH_PROVIDERS.find(
                        p => p.name === item.provider
                      );
                      return (
                        <Card key={item.provider} className="overflow-hidden">
                          <div className="flex items-center p-4 gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${index === 0 ? "bg-yellow-500" : index === 1 ? "bg-slate-400" : index === 2 ? "bg-amber-700" : "bg-slate-800"}`}
                            >
                              #{index + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg">
                                {item.provider}
                              </h3>
                              <p
                                className="text-2xl font-black"
                                style={{ color: provider?.color }}
                              >
                                {Math.round(item.avg_latency)}
                                <span className="text-sm font-normal text-slate-500">
                                  ms
                                </span>
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
