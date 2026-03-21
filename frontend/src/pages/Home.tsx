import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  measureDoH,
  measureClientDoH,
  DOH_PROVIDERS,
  BenchmarkResult,
} from "@/lib/doh";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured, ENV } from "@/config/env";
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
  Settings,
  Save,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthButton } from "@/components/AuthButton";
import { runMonitorBenchmark } from "@/lib/monitor";
import { toast } from "sonner";

export default function Home() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || "anonymous";
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
  const [customIp, setCustomIp] = useState("");
  const [userProviders, setUserProviders] = useState<typeof DOH_PROVIDERS>([
    ...DOH_PROVIDERS,
  ]);
  const [isGlobalMonitoring, setIsGlobalMonitoring] = useState(false);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);

  // Monitors
  const [monitors, setMonitors] = useState<any[]>([]);
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);
  const [monitorDomains, setMonitorDomains] = useState("");
  const [monitorInterval, setMonitorInterval] = useState(60);
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false);
  const [lastChecked, setLastChecked] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Capture non-null reference for use inside the closure
    const sb = supabase;

    // Fetch initial leaderboard and history
    // Fetch session
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    if (user) {
      fetchMonitors();
      fetchPreferences();
    }

    fetchLeaderboard();
    fetchHistory();

    // Subscribe to live logs
    const channel = sb
      .channel("dns_queries")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dns_queries",
        },
        payload => {
          console.log("Realtime insert:", payload);
          setLiveLogs(prev => [payload.new, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMonitors([]);
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      if (
        data &&
        data.custom_dns &&
        Array.isArray(data.custom_dns) &&
        data.custom_dns.length > 0
      ) {
        const customIp = data.custom_dns[0];
        setCustomIp(customIp);
        setUserProviders([
          ...DOH_PROVIDERS,
          {
            name: "Custom",
            url: "",
            customIp,
            color: "#8b5cf6",
            format: "json",
          },
        ]);
      }
    } catch (e) {
      console.error("Preferences fetch error:", e);
    }
  };

  const fetchMonitors = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("monitors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const normalizedMonitors = (data || []).map(m => ({
        ...m,
        domains: Array.isArray(m.domains)
          ? m.domains
          : typeof m.domains === "string"
            ? m.domains.split(",")
            : [],
        providers: Array.isArray(m.providers)
          ? m.providers
          : typeof m.providers === "string"
            ? m.providers.split(",")
            : [],
      }));
      setMonitors(normalizedMonitors);
    } catch (e) {
      console.error("Monitors fetch error:", e);
    }
  };

  const activeIntervals = useRef<
    Map<
      string,
      {
        id: NodeJS.Timeout;
        interval: number;
        domainsStr: string;
        providersStr: string;
      }
    >
  >(new Map());

  useEffect(() => {
    if (!user) {
      Array.from(activeIntervals.current.values()).forEach(item =>
        clearInterval(item.id)
      );
      activeIntervals.current.clear();
      return;
    }

    const activeMonitorIds = new Set<string>();

    monitors.forEach(monitor => {
      if (monitor.is_active) {
        activeMonitorIds.add(monitor.id);
        const currentSetup = activeIntervals.current.get(monitor.id);

        const monitorDomainsStr = (
          Array.isArray(monitor.domains) ? monitor.domains : []
        ).join(",");
        const monitorProvidersStr = (
          Array.isArray(monitor.providers) ? monitor.providers : []
        ).join(",");
        if (
          !currentSetup ||
          currentSetup.interval !== monitor.interval_seconds ||
          currentSetup.domainsStr !== monitorDomainsStr ||
          currentSetup.providersStr !== monitorProvidersStr
        ) {
          if (currentSetup) clearInterval(currentSetup.id);

          const runTest = async () => {
            if (
              !monitor.domains ||
              !monitor.providers ||
              monitor.domains.length === 0 ||
              monitor.providers.length === 0
            )
              return;
            const providers = userProviders.filter(p =>
              monitor.providers.includes(p.name)
            );
            if (providers.length === 0) return;

            const results: any[] = [];
            for (const domain of monitor.domains) {
              for (const provider of providers) {
                try {
                  const result = await measureDoH(provider, domain);
                  results.push({
                    user_id: user.id,
                    domain,
                    upstream_provider: provider.name,
                    latency_ms: result.avgLatency,
                    success: result.successRate > 0,
                    status: result.successRate > 0 ? "success" : "failed",
                    method_used: result.method,
                    fallback_used: result.fallbackUsed,
                  });
                } catch (e) {
                  results.push({
                    user_id: user.id,
                    domain,
                    upstream_provider: provider.name,
                    latency_ms: 0,
                    success: false,
                    status: "failed",
                    method_used: "failed",
                    fallback_used: true,
                  });
                }
              }
            }
            if (results.length > 0) {
              await supabase.from("dns_queries").insert(results);
            }

            setLastChecked(prev => ({
              ...prev,
              [monitor.id]: new Date().toLocaleTimeString(),
            }));

            await supabase
              .from("monitors")
              .update({
                last_run_at: new Date().toISOString(),
                next_run_at: new Date(
                  Date.now() + monitor.interval_seconds * 1000
                ).toISOString(),
              })
              .eq("id", monitor.id);
          };

          if (!currentSetup) {
            runTest();
          }

          const intervalId = setInterval(
            runTest,
            monitor.interval_seconds * 1000
          );
          activeIntervals.current.set(monitor.id, {
            id: intervalId,
            interval: monitor.interval_seconds,
            domainsStr: monitorDomainsStr,
            providersStr: monitorProvidersStr,
          });
        }
      }
    });

    Array.from(activeIntervals.current.keys()).forEach(id => {
      if (!activeMonitorIds.has(id)) {
        clearInterval(activeIntervals.current.get(id)!.id);
        activeIntervals.current.delete(id);
      }
    });
  }, [monitors, user]);

  useEffect(() => {
    return () => {
      Array.from(activeIntervals.current.values()).forEach(item =>
        clearInterval(item.id)
      );
    };
  }, []);

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const VALID_DOMAIN_PATTERN =
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    const domains = monitorDomains
      .split(/[\n,]+/)
      .map(
        d =>
          d
            .trim()
            .replace(/^https?:\/\//i, "")
            .split("/")[0]
      )
      .filter(d => d.length > 0 && VALID_DOMAIN_PATTERN.test(d));

    if (domains.length === 0) {
      toast.error("Please enter at least one valid domain");
      return;
    }

    setIsCreatingMonitor(true);
    try {
      let error;
      if (editingMonitorId) {
        const { error: updateError } = await supabase
          .from("monitors")
          .update({
            domains,
            providers: userProviders.map(p => p.name),
            interval_seconds: monitorInterval,
          })
          .eq("id", editingMonitorId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("monitors").insert({
          user_id: user.id,
          domains,
          providers: userProviders.map(p => p.name),
          interval_seconds: monitorInterval,
        });
        error = insertError;
      }

      if (error) throw error;

      toast.success(
        editingMonitorId
          ? "Monitor updated successfully"
          : "Monitor created successfully"
      );
      setMonitorDomains("");
      setMonitorInterval(60);
      setEditingMonitorId(null);
      fetchMonitors();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to create monitor");
    } finally {
      setIsCreatingMonitor(false);
    }
  };

  const toggleMonitor = async (monitor: any) => {
    try {
      const { error } = await supabase
        .from("monitors")
        .update({ is_active: !monitor.is_active })
        .eq("id", monitor.id);
      if (error) throw error;

      fetchMonitors();
      if (!monitor.is_active) {
        toast.success("Monitor started");
      } else {
        toast.info("Monitor stopped");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to toggle monitor");
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("monitors").delete().eq("id", id);
      if (error) throw error;

      toast.success("Monitor deleted");
      fetchMonitors();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete monitor");
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase.from("leaderboard").select("*");
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      setLeaderboard(data || []);
    } catch (e) {
      console.error("Leaderboard fetch error", e);
    }
  };

  const handleKeepRecord = async (id: string, keepState: boolean) => {
    try {
      const { error } = await supabase
        .from("benchmark_results")
        .update({ keep: keepState })
        .eq("id", id);
      if (error) throw error;

      setHistory(prev =>
        prev.map(item => (item.id === id ? { ...item, keep: keepState } : item))
      );
      toast.success(keepState ? "Record kept" : "Record discarded");
    } catch (e) {
      console.error("Update keep error", e);
      toast.error("Failed to update record");
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("benchmark_results")
        .select("*")
        .order("tested_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
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
    // Basic domain validation: strip protocols/paths and reject obviously invalid entries
    const VALID_DOMAIN_PATTERN =
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    const rawDomains = domainsInput
      .split(/[\n,]+/)
      .map(
        d =>
          d
            .trim()
            .replace(/^https?:\/\//i, "")
            .split("/")[0]
      )
      .filter(d => d.length > 0);

    const domains = rawDomains.filter(d => VALID_DOMAIN_PATTERN.test(d));
    const invalid = rawDomains.filter(d => !VALID_DOMAIN_PATTERN.test(d));

    if (invalid.length > 0) {
      toast.warning(
        `Skipped ${invalid.length} invalid entr${invalid.length === 1 ? "y" : "ies"}: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`
      );
    }

    if (domains.length === 0) {
      toast.error("Please enter at least one valid domain");
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
    const total = domains.length * userProviders.length;

    try {
      const allQueries: any[] = [];

      // Process one domain at a time, sending all providers in a single batch
      for (const domain of domains) {
        results[domain] = {};

        // Prepare queries for all providers for this domain
        const queries = userProviders.map(p => ({
          domain,
          provider: p.name,
          customIp: p.customIp,
        }));

        setProgressText(`Testing ${domain}...`);

        let batchData = null;
        try {
          const res = await fetch(
            new URL("/api/dns-query", window.location.origin).toString(),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ queries }),
            }
          );
          if (res.ok) {
            batchData = await res.json();
          }
        } catch (e) {
          // Ignore, fallback to client DoH handled below
        }

        const failedProviders = [];

        // First pass: identify server successes and failed providers
        for (const provider of userProviders) {
          let serverResult = null;
          if (
            batchData &&
            batchData.results &&
            Array.isArray(batchData.results)
          ) {
            serverResult = batchData.results.find(
              (r: any) => r.provider === provider.name && r.domain === domain
            );
          }

          if (
            serverResult &&
            serverResult.success &&
            typeof serverResult.latency === "number"
          ) {
            // Server succeeded
            results[domain][provider.name] = {
              avgLatency: serverResult.latency,
              minLatency: serverResult.latency,
              maxLatency: serverResult.latency,
              successRate: 100,
              queriesPerSec: 1, // Placeholder
              verified: true,
              method: "server",
              fallbackUsed: false,
            };
          } else {
            failedProviders.push(provider);
          }
        }

        // Second pass: run client fallback concurrently only for failed providers
        if (failedProviders.length > 0) {
          const fallbackResults = await Promise.all(
            failedProviders.map(async provider => {
              try {
                toast.warning(
                  `Backend failed for ${provider.name}, using fallback`
                );
                const fallbackResult = await measureClientDoH(provider, domain);
                return { provider, result: fallbackResult };
              } catch (error) {
                return { provider, result: "Error" as const };
              }
            })
          );

          for (const { provider, result } of fallbackResults) {
            results[domain][provider.name] = result;
            if (result === "Error" || result.successRate === 0) {
              toast.error(
                `All methods failed for ${provider.name} on ${domain}`
              );
            }
          }
        }

        // Finalize results for all providers for this domain
        for (const provider of userProviders) {
          const finalResult = results[domain][provider.name];
          if (
            finalResult &&
            finalResult !== "Error" &&
            finalResult.successRate > 0
          ) {
            allQueries.push({
              user_id: userId,
              domain,
              upstream_provider: provider.name,
              latency_ms: finalResult.avgLatency,
              status: "success",
              created_at: new Date().toISOString(),
              method_used: finalResult.method,
              fallback_used: finalResult.fallbackUsed,
            });
          } else {
            allQueries.push({
              user_id: userId,
              domain,
              upstream_provider: provider.name,
              latency_ms: 0,
              status: "failed",
              created_at: new Date().toISOString(),
              method_used: "failed",
              fallback_used: true,
            });
          }
          completed++;
          setProgress(Math.round((completed / total) * 100));
        }

        // Small delay between domains
        await new Promise(r => setTimeout(r, 150));
      }

      setTestResults(results);
      toast.success("Benchmark completed successfully");

      // Save to Supabase (only when configured and user is logged in)
      if (isSupabaseConfigured && user && allQueries.length > 0) {
        // Insert queries in batches of 50
        for (let i = 0; i < allQueries.length; i += 50) {
          const batch = allQueries.slice(i, i + 50);
          console.log("Inserting DNS queries:", batch);
          const { error } = await supabase.from("dns_queries").insert(batch);
          if (error) {
            console.error("Supabase error:", error);
          }
        }

        const benchmarkResults = allQueries
          .filter(q => q.status === "success")
          .map(q => ({
            user_id: q.user_id,
            domain: q.domain,
            provider: q.upstream_provider,
            latency_ms: q.latency_ms,
            tested_at: q.created_at,
          }));

        if (benchmarkResults.length > 0) {
          console.log("Inserting benchmark results:", benchmarkResults);
          const { error } = await supabase
            .from("benchmark_results")
            .insert(benchmarkResults);
          if (error) {
            console.error("Supabase error:", error);
          }
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
      for (const provider of userProviders) {
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
    URL.revokeObjectURL(url);
  };

  // Prepare chart data
  const chartData = testResults
    ? Object.entries(testResults).map(([domain, results]) => {
        const item: any = { domain };
        userProviders.forEach(provider => {
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
          <div className="flex items-center gap-2">
            <AuthButton />
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              onClick={() => setTheme?.(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-8"
        >
          <TabsList className="flex flex-wrap sm:grid sm:grid-cols-5 md:w-auto h-auto min-h-10">
            <TabsTrigger value="benchmark" className="flex items-center gap-2">
              <Play className="w-4 h-4" /> Benchmark
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Live Logs
            </TabsTrigger>
            <TabsTrigger value="monitors" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Monitors
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

          <TabsContent value="benchmark" className="space-y-8">
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
                        onClick={handleTest}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>{" "}
                            Running...
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

              {/* Providers Section */}
              <div>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>DNS Providers</CardTitle>
                    <CardDescription>Using DNS-over-HTTPS</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {userProviders.map(provider => (
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
              <div className="space-y-8">
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
                            {userProviders.map(provider => (
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
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b dark:border-slate-800">
                            <th className="py-3 px-4 font-semibold">Domain</th>
                            <th className="py-3 px-4 font-semibold">
                              Provider
                            </th>
                            <th className="py-3 px-4 font-semibold text-center">
                              Latency
                            </th>
                            <th className="py-3 px-4 font-semibold text-center">
                              Method
                            </th>
                            <th className="py-3 px-4 font-semibold text-center">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(testResults).flatMap(
                            ([domain, results]) =>
                              userProviders.map(provider => {
                                const result = results[provider.name];
                                const isError =
                                  result === "Error" ||
                                  !result ||
                                  result.successRate === 0;

                                let badgeColor =
                                  "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400";
                                let badgeText = "-";

                                if (
                                  isError ||
                                  (result && result.method === "failed")
                                ) {
                                  badgeColor =
                                    "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400";
                                  badgeText = "Failed";
                                } else if (
                                  result &&
                                  result.method === "server"
                                ) {
                                  badgeColor =
                                    "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400";
                                  badgeText = "Server";
                                } else if (
                                  result &&
                                  (result.method === "client" ||
                                    result.method === "client-fallback" ||
                                    result.method === "mixed")
                                ) {
                                  badgeColor =
                                    "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400";
                                  badgeText = "Client Fallback";
                                }

                                return (
                                  <tr
                                    key={`${domain}-${provider.name}`}
                                    className="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                  >
                                    <td className="py-3 px-4 font-mono">
                                      {domain}
                                    </td>
                                    <td className="py-3 px-4 font-semibold">
                                      {provider.name}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {isError ? (
                                        "-"
                                      ) : (
                                        <span className="font-semibold">
                                          {result.avgLatency}ms
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div
                                        className={`text-[10px] inline-flex px-2 py-1 rounded font-mono font-medium ${badgeColor}`}
                                      >
                                        {badgeText}
                                        {}
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
          </TabsContent>

          <TabsContent value="monitors">
            <Card>
              <CardHeader>
                <CardTitle>Continuous Monitoring</CardTitle>
                <CardDescription>
                  Set up background tests to monitor your favorite domains over
                  time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isSupabaseConfigured ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                    <p>Continuous monitoring requires Supabase.</p>
                  </div>
                ) : !user ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-blue-500" />
                    <p>Please log in to set up background monitors.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <form
                      onSubmit={handleCreateMonitor}
                      className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800"
                    >
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="md:col-span-3">
                          <label className="text-sm font-medium mb-1.5 block">
                            Domains to monitor (one per line)
                          </label>
                          <Textarea
                            value={monitorDomains}
                            onChange={e => setMonitorDomains(e.target.value)}
                            placeholder="e.g. google.com
cloudflare.com"
                            className="font-mono text-sm resize-none"
                            rows={3}
                            required
                          />
                        </div>
                        <div className="flex flex-col justify-between">
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">
                              Interval
                            </label>
                            <select
                              value={monitorInterval}
                              onChange={e =>
                                setMonitorInterval(Number(e.target.value))
                              }
                              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                            >
                              <option value={30}>30 seconds</option>
                              <option value={60}>1 minute</option>
                              <option value={300}>5 minutes</option>
                              <option value={600}>10 minutes</option>
                              <option value={3600}>1 hour</option>
                            </select>
                          </div>
                          <Button
                            type="submit"
                            disabled={isCreatingMonitor}
                            className="w-full mt-2"
                          >
                            Create Monitor
                          </Button>
                        </div>
                      </div>
                    </form>

                    {monitors.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {monitors.map(monitor => (
                          <Card key={monitor.id} className="flex flex-col">
                            <CardHeader className="pb-3 border-b dark:border-slate-800">
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full ${monitor.is_active ? "bg-green-500 animate-pulse" : "bg-slate-300 dark:bg-slate-700"}`}
                                  ></span>
                                  <span className="font-semibold text-sm">
                                    {monitor.is_active ? "Running" : "Stopped"}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  #{monitor.id.split("-")[0]}
                                </span>
                              </div>
                              <CardDescription>
                                Every{" "}
                                {monitor.interval_seconds < 60
                                  ? `${monitor.interval_seconds}s`
                                  : `${monitor.interval_seconds / 60}m`}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col justify-between">
                              <div className="space-y-4 mb-4">
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Domains
                                  </div>
                                  <div
                                    className="text-sm font-mono break-all line-clamp-2"
                                    title={(Array.isArray(monitor.domains)
                                      ? monitor.domains
                                      : []
                                    ).join(", ")}
                                  >
                                    {(Array.isArray(monitor.domains)
                                      ? monitor.domains
                                      : []
                                    ).join(", ")}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Providers
                                  </div>
                                  <div
                                    className="text-sm"
                                    title={(Array.isArray(monitor.providers)
                                      ? monitor.providers
                                      : []
                                    ).join(", ")}
                                  >
                                    {(Array.isArray(monitor.providers)
                                      ? monitor.providers
                                      : []
                                    ).join(", ")}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Last Checked
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    {lastChecked[monitor.id] || "Never"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-3 border-t dark:border-slate-800 mt-auto">
                                <Button
                                  variant={
                                    monitor.is_active ? "outline" : "default"
                                  }
                                  size="sm"
                                  onClick={() => toggleMonitor(monitor)}
                                  className="flex-1"
                                >
                                  {monitor.is_active ? "Stop" : "Start"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setMonitorDomains(
                                      (Array.isArray(monitor.domains)
                                        ? monitor.domains
                                        : []
                                      ).join("\n")
                                    );
                                    setMonitorInterval(
                                      monitor.interval_seconds
                                    );
                                    setEditingMonitorId(monitor.id);
                                  }}
                                  className="flex-1"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteMonitor(monitor.id)
                                  }
                                >
                                  Delete
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                        <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-200">
                          No active monitors
                        </h4>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm">
                          Set up continuous monitoring to automatically track
                          domain resolution performance over time.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
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
                {!isSupabaseConfigured ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                    <p>
                      Live logs require Supabase. Configure{" "}
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
                        VITE_SUPABASE_URL
                      </code>{" "}
                      and{" "}
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
                        VITE_SUPABASE_ANON_KEY
                      </code>{" "}
                      to enable this feature.
                    </p>
                  </div>
                ) : !user ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-blue-500" />
                    <p>Please log in to view live logs.</p>
                  </div>
                ) : liveLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Waiting for queries... Run a benchmark to see live results
                    here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveLogs.map((log, i) => {
                      const rawTimestamp = log.timestamp || log.created_at;
                      const date = rawTimestamp ? new Date(rawTimestamp) : null;
                      const timeLabel =
                        date && !isNaN(date.getTime())
                          ? date.toLocaleTimeString()
                          : "—";
                      return (
                        <div
                          key={i}
                          className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-900 rounded-md text-sm"
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-slate-500">
                              {timeLabel}
                            </span>
                            <span className="font-semibold">
                              {log.upstream_provider}
                            </span>
                            <span className="font-mono">{log.domain}</span>
                          </div>
                          <div className="flex items-center gap-2">
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
                              className={`font-semibold flex items-center gap-1 ${log.status === "success" || log.success ? "text-green-600" : "text-red-600"}`}
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
                          </div>
                        </div>
                      );
                    })}
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
                {!isSupabaseConfigured ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                    <p>
                      History requires Supabase. Configure{" "}
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
                        VITE_SUPABASE_URL
                      </code>{" "}
                      and{" "}
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
                        VITE_SUPABASE_ANON_KEY
                      </code>{" "}
                      to enable this feature.
                    </p>
                  </div>
                ) : !user ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-blue-500" />
                    <p>Please log in to view your benchmark history.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={Object.values(
                            history.reduce(
                              (acc, curr) => {
                                const time = curr.tested_at;
                                if (!acc[time]) acc[time] = { tested_at: time };
                                acc[time][curr.provider] = curr.latency_ms;
                                return acc;
                              },
                              {} as Record<string, any>
                            )
                          ).sort(
                            (a: any, b: any) =>
                              new Date(a.tested_at).getTime() -
                              new Date(b.tested_at).getTime()
                          )}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="tested_at"
                            tickFormatter={val =>
                              new Date(val).toLocaleTimeString()
                            }
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            labelFormatter={val =>
                              new Date(val).toLocaleString()
                            }
                            contentStyle={{
                              backgroundColor:
                                theme === "dark" ? "#1e293b" : "#fff",
                              borderColor:
                                theme === "dark" ? "#334155" : "#e2e8f0",
                            }}
                          />
                          <Legend />
                          {userProviders.map(provider => (
                            <Line
                              key={provider.name}
                              type="monotone"
                              dataKey={provider.name}
                              stroke={provider.color}
                              name={provider.name}
                              connectNulls
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        Raw Records
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="border-b dark:border-slate-800">
                              <th className="py-3 px-4 font-semibold">Time</th>
                              <th className="py-3 px-4 font-semibold">
                                Domain
                              </th>
                              <th className="py-3 px-4 font-semibold">
                                Provider
                              </th>
                              <th className="py-3 px-4 font-semibold">
                                Latency
                              </th>
                              <th className="py-3 px-4 font-semibold">
                                Method
                              </th>
                              <th className="py-3 px-4 font-semibold">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map(record => (
                              <tr
                                key={record.id}
                                className="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              >
                                <td className="py-3 px-4">
                                  {new Date(record.tested_at).toLocaleString()}
                                </td>
                                <td className="py-3 px-4 font-mono">
                                  {record.domain}
                                </td>
                                <td className="py-3 px-4">{record.provider}</td>
                                <td className="py-3 px-4">
                                  {record.latency_ms}ms
                                </td>
                                <td className="py-3 px-4">
                                  {record.method_used ? (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${record.method_used === "server" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : record.method_used === "client" || record.method_used === "client-fallback" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}`}
                                    >
                                      {record.method_used}
                                      {}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {record.keep ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleKeepRecord(record.id, false)
                                      }
                                    >
                                      Discard
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleKeepRecord(record.id, true)
                                      }
                                    >
                                      Keep
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
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
                {!isSupabaseConfigured ? (
                  <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                    <p>
                      Leaderboard requires Supabase. Configure{" "}
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
                        VITE_SUPABASE_URL
                      </code>{" "}
                      and{" "}
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
                        VITE_SUPABASE_ANON_KEY
                      </code>{" "}
                      to enable this feature.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leaderboard
                      .sort((a, b) => a.global_avg_ms - b.global_avg_ms)
                      .map((item, index) => {
                        const provider = userProviders.find(
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
                                  {isNaN(item.global_avg_ms) ||
                                  item.global_avg_ms === null
                                    ? "No data"
                                    : Math.round(item.global_avg_ms)}
                                  <span className="text-sm font-normal text-slate-500">
                                    ms
                                  </span>
                                </p>
                                {item.success_rate !== undefined && (
                                  <p className="text-sm text-slate-500 mt-1">
                                    Reliability:{" "}
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                      {Number(item.success_rate).toFixed(1)}%
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Settings & Preferences</CardTitle>
                <CardDescription>
                  Configure custom DNS providers and behavior
                </CardDescription>
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
                      <h3 className="text-sm font-medium mb-2">
                        Custom DNS Provider IP
                      </h3>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. 1.1.1.1"
                          value={customIp}
                          onChange={e => setCustomIp(e.target.value)}
                        />
                        <Button
                          onClick={async () => {
                            const ipList = customIp ? [customIp] : [];
                            const { error } = await supabase
                              .from("user_preferences")
                              .upsert(
                                {
                                  user_id: user.id,
                                  custom_dns: ipList,
                                },
                                { onConflict: "user_id" }
                              );
                            if (error) {
                              toast.error("Failed to save settings");
                            } else {
                              toast.success("Settings saved!");
                              if (customIp) {
                                setUserProviders([
                                  ...DOH_PROVIDERS,
                                  {
                                    name: "Custom",
                                    url: "",
                                    customIp,
                                    color: "#8b5cf6",
                                    format: "json",
                                  },
                                ]);
                              } else {
                                setUserProviders([...DOH_PROVIDERS]);
                              }
                            }
                          }}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Provide a valid IP address for a custom DNS resolver.
                        This will add "Custom" to the benchmark providers.
                      </p>
                    </div>
                    <div className="pt-6 border-t dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium">
                            Global Monitoring
                          </h3>
                          <p className="text-xs text-slate-500">
                            Automatically test top domains every 30 seconds
                          </p>
                        </div>
                        <Button
                          variant={
                            isGlobalMonitoring ? "destructive" : "default"
                          }
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
      </div>
    </div>
  );
}
