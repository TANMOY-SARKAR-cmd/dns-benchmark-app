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
  Server,
  Clock,
  Trash2,
  Square,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthButton } from "@/components/AuthButton";
import { measureDoHBatch } from "@/lib/doh";
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
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [userProviders, setUserProviders] = useState<typeof DOH_PROVIDERS>([
    ...DOH_PROVIDERS,
  ]);

  const [history, setHistory] = useState<any[]>([]);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);

  // Monitors
  const [monitors, setMonitors] = useState<any[]>([]);
  const [monitorResults, setMonitorResults] = useState<Record<string, any>>({});
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);
  const [monitorDomains, setMonitorDomains] = useState("");
  const [monitorInterval, setMonitorInterval] = useState(60);
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false);
  const activeIntervals = useRef<Record<string, NodeJS.Timeout>>({});

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
          table: "monitor_results",
        },
        payload => {
          setMonitorResults(prev => ({
            ...prev,
            [payload.new.monitor_id]: payload.new,
          }));
        }
      )

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
      if (data && data.custom_dns_name && data.custom_dns_url) {
        setCustomName(data.custom_dns_name);
        setCustomUrl(data.custom_dns_url);
        setUserProviders([
          ...DOH_PROVIDERS,
          {
            key: "custom",
            name: data.custom_dns_name,
            url: data.custom_dns_url,
            color: "#8b5cf6",
            format: "json",
          },
        ]);
      }
    } catch (e) {
      console.error("Preferences fetch error:", e);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Clear all existing intervals
    Object.values(activeIntervals.current).forEach(clearInterval);
    activeIntervals.current = {};

    monitors.forEach(monitor => {
      if (monitor.is_active) {
        const intervalMs = (monitor.interval_seconds || 60) * 1000;

        // Execute immediately, then on interval
        const runMonitor = async () => {
          if (
            !monitor.domains ||
            !monitor.providers ||
            monitor.domains.length === 0 ||
            monitor.providers.length === 0
          ) {
            return;
          }

          try {
            const testedAt = new Date().toISOString();
            const payload: any[] = [];
            const results: Record<string, Record<string, any>> = {};

            for (const domain of monitor.domains) {
              results[domain] = {};
            }

            // Prepare all queries for backend
            const queries: any[] = [];
            for (const domain of monitor.domains) {
              for (const providerName of monitor.providers) {
                const provider =
                  userProviders.find((p: any) => p.name === providerName) ||
                  DOH_PROVIDERS.find((p: any) => p.name === providerName);
                if (!provider) continue;

                const isCustom = !DOH_PROVIDERS.some(
                  (dp: any) => dp.name === provider.name
                );
                queries.push({
                  domain,
                  provider: isCustom ? "custom" : provider.key,
                  customUrl: isCustom ? provider.url : undefined,
                });
              }
            }

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

            // First pass: identify server successes and failed providers per domain
            for (const domain of monitor.domains) {
              const failedProviders: any[] = [];

              for (const providerName of monitor.providers) {
                const provider =
                  userProviders.find((p: any) => p.name === providerName) ||
                  DOH_PROVIDERS.find((p: any) => p.name === providerName);
                if (!provider) continue;

                const isCustom = !DOH_PROVIDERS.some(
                  (dp: any) => dp.name === provider.name
                );
                let serverResult = null;
                if (
                  batchData &&
                  batchData.results &&
                  Array.isArray(batchData.results)
                ) {
                  serverResult = batchData.results.find(
                    (r: any) =>
                      r.provider === (isCustom ? "custom" : provider.key) &&
                      r.domain === domain
                  );
                }

                if (serverResult && serverResult.success === true) {
                  results[domain][provider.name] = {
                    avgLatency: serverResult.latency,
                    minLatency: serverResult.latency,
                    maxLatency: serverResult.latency,
                    successRate: 100,
                    queriesPerSec: 1,
                    verified: true,
                    method: serverResult.method,
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
                      const fallbackResult = await measureClientDoH(
                        provider,
                        domain
                      );
                      return { provider, result: fallbackResult };
                    } catch (error) {
                      return { provider, result: "Error" as const };
                    }
                  })
                );

                for (const { provider, result } of fallbackResults) {
                  results[domain][provider.name] = result;
                }
              }

              // Finalize results for all providers for this domain
              for (const providerName of monitor.providers) {
                const provider =
                  userProviders.find((p: any) => p.name === providerName) ||
                  DOH_PROVIDERS.find((p: any) => p.name === providerName);
                if (!provider) continue;

                const isCustom = !DOH_PROVIDERS.some(
                  (dp: any) => dp.name === provider.name
                );
                let serverResult = null;
                if (
                  batchData &&
                  batchData.results &&
                  Array.isArray(batchData.results)
                ) {
                  serverResult = batchData.results.find(
                    (r: any) =>
                      r.provider === (isCustom ? "custom" : provider.key) &&
                      r.domain === domain
                  );
                }

                let clientResult = results[domain][provider.name];

                let final_success = false;
                let final_method = "failed";
                let final_latency = null;

                const serverSuccess =
                  serverResult && serverResult.success === true;
                const clientSuccess =
                  clientResult &&
                  clientResult !== "Error" &&
                  clientResult.successRate > 0;

                if (serverSuccess) {
                  final_success = true;
                  final_method = serverResult.method;
                  final_latency = serverResult.latency;
                } else if (clientSuccess) {
                  final_success = true;
                  final_method = clientResult.method || "fallback";
                  final_latency = clientResult.avgLatency;
                }

                payload.push({
                  user_id: user.id,
                  domain: domain,
                  provider: provider.name,
                  latency_ms: final_success ? final_latency : null,
                  success: final_success,
                  method: final_method,
                  error: final_success ? null : "Failed to resolve",
                  tested_at: testedAt,
                  keep_forever: false,
                  monitor_id: monitor.id,
                });
              }
            }

            if (payload.length > 0) {
              await supabase
                .from("monitor_results")
                .insert(payload.map(({ monitor_id, ...rest }) => rest)); // Strictly omitting monitor_id to adhere to required schema
            }
          } catch (e) {
            console.error("Monitor execution failed for", monitor.id, e);
          }
        };

        // runMonitor(); // We don't necessarily want to run it immediately on load if it just ran
        const intervalId = setInterval(runMonitor, intervalMs);
        activeIntervals.current[monitor.id] = intervalId;
      }
    });

    return () => {
      Object.values(activeIntervals.current).forEach(clearInterval);
    };
  }, [monitors, user]);

  const fetchMonitors = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("monitors")
        .select("*")
        .eq("user_id", user.id)
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

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Login required", {
        description: "You must be logged in to use monitoring.",
      });
      return;
    }

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
          .eq("id", editingMonitorId)
          .eq("user_id", user.id);
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
    if (!user) {
      toast.error("Login required", {
        description: "You must be logged in to use monitoring.",
      });
      return;
    }
    try {
      const { error } = await supabase
        .from("monitors")
        .update({ is_active: !monitor.is_active })
        .eq("id", monitor.id)
        .eq("user_id", user.id);
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
    if (!user) {
      toast.error("Login required", {
        description: "You must be logged in to use monitoring.",
      });
      return;
    }
    try {
      const { error } = await supabase
        .from("monitors")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
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
      let dataToProcess = [];

      if (user) {
        // Fetch personal performance from dns_queries
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
          .from("dns_queries")
          .select("provider, latency_ms, success")
          .eq("user_id", user.id)
          .gte("tested_at", thirtyDaysAgo.toISOString());

        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }

        // Aggregate data manually
        const agg: Record<
          string,
          { latencies: number[]; successCount: number; total: number }
        > = {};
        for (const row of data || []) {
          if (!agg[row.provider]) {
            agg[row.provider] = { latencies: [], successCount: 0, total: 0 };
          }
          agg[row.provider].total += 1;
          if (row.success) {
            agg[row.provider].successCount += 1;
            if (row.latency_ms !== null) {
              agg[row.provider].latencies.push(row.latency_ms);
            }
          }
        }

        dataToProcess = Object.entries(agg).map(([provider, stats]) => {
          const success_rate = (stats.successCount / stats.total) * 100;
          const avg_latency =
            stats.latencies.length > 0
              ? stats.latencies.reduce((a, b) => a + b, 0) /
                stats.latencies.length
              : null;

          let jitter = null;
          if (stats.latencies.length > 1 && avg_latency !== null) {
            const variance =
              stats.latencies.reduce(
                (sum, lat) => sum + Math.pow(lat - avg_latency, 2),
                0
              ) /
              (stats.latencies.length - 1);
            jitter = Math.sqrt(variance);
          } else if (stats.latencies.length === 1) {
            jitter = avg_latency;
          }

          return {
            provider,
            avg_latency,
            success_rate,
            jitter,
            total_tests: stats.total,
          };
        });
      } else {
        // Fetch global leaderboard from view
        const { data, error } = await supabase.from("leaderboard").select("*");
        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }
        dataToProcess = data || [];
      }

      // Calculate personal score if needed, global comes with score
      const processedLeaderboard = dataToProcess.map((item: any) => {
        if (item.score !== undefined) {
          return item;
        }

        // Local calculation for personal stats fallback
        let score = 0;
        const successRateDecimal = item.success_rate / 100; // was 0-100 locally
        if (successRateDecimal !== 0 && item.avg_latency !== null) {
          score =
            successRateDecimal * 0.5 +
            (1.0 / item.avg_latency) * 0.3 +
            Math.log10(Math.max(item.total_tests || 1, 1)) * 0.2;
        }

        return {
          ...item,
          score,
          success_rate: successRateDecimal, // normalize to 0-1
          sample_count: item.total_tests,
        };
      });

      setLeaderboard(processedLeaderboard);
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
        const queries = userProviders.map(p => {
          const isCustom = !DOH_PROVIDERS.some(dp => dp.name === p.name);
          return {
            domain,
            provider: isCustom ? "custom" : p.name,
            customUrl: isCustom ? p.url : undefined,
          };
        });

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
          const isCustom = !DOH_PROVIDERS.some(dp => dp.name === provider.name);
          let serverResult = null;
          if (
            batchData &&
            batchData.results &&
            Array.isArray(batchData.results)
          ) {
            serverResult = batchData.results.find(
              (r: any) =>
                r.provider === (isCustom ? "custom" : provider.key) &&
                r.domain === domain
            );
          }

          if (serverResult && serverResult.success === true) {
            // Server succeeded
            results[domain][provider.name] = {
              avgLatency: serverResult.latency,
              minLatency: serverResult.latency,
              maxLatency: serverResult.latency,
              successRate: 100,
              queriesPerSec: 1, // Placeholder
              verified: true,
              method: serverResult.method, // Use the real method from the server
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
          const isCustom = !DOH_PROVIDERS.some(dp => dp.name === provider.name);
          let serverResult = null;
          if (
            batchData &&
            batchData.results &&
            Array.isArray(batchData.results)
          ) {
            serverResult = batchData.results.find(
              (r: any) =>
                r.provider === (isCustom ? "custom" : provider.key) &&
                r.domain === domain
            );
          }

          let clientResult = results[domain][provider.name];
          // If server succeeded, clientResult might be exactly the server result mapped.
          // If server failed, clientResult is the fallback result.

          let final_success = false;
          let final_method = "failed";
          let final_latency = null;

          const serverSuccess = serverResult && serverResult.success === true;

          const clientSuccess =
            clientResult &&
            clientResult !== "Error" &&
            clientResult.successRate > 0;

          if (serverSuccess) {
            final_success = true;
            final_method = serverResult.method;
            final_latency = serverResult.latency;
          } else if (clientSuccess) {
            final_success = true;
            final_method = clientResult.method || "fallback";
            final_latency = clientResult.avgLatency;
          }

          allQueries.push({
            user_id: userId,
            domain,
            provider: provider.name,
            latency_ms: final_success ? final_latency : null,
            success: final_success,
            tested_at: new Date().toISOString(),
            method: final_method,
          });

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

        const benchmarkResults = allQueries.map(q => ({
          user_id: q.user_id,
          domain: q.domain,
          provider: q.provider,
          latency_ms: q.latency_ms,
          tested_at: q.tested_at,
          success: q.success,
          error: q.error || null,
          method: q.method || "failed",
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
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" /> Settings
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
                                  (result.method === "server-udp" ||
                                    result.method === "server-doh")
                                ) {
                                  badgeColor =
                                    "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400";
                                  badgeText = "Server";
                                } else if (
                                  result &&
                                  result.method === "fallback"
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
                              <option value={10}>10 seconds</option>
                              <option value={30}>30 seconds</option>
                              <option value={60}>1 minute</option>
                              <option value={300}>5 minutes</option>
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
                          <Card key={monitor.id} className="bg-card">
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {monitor.domains.join(", ")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Server className="w-4 h-4" />
                                    <span>{monitor.providers.join(", ")}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                      Runs every {monitor.interval_seconds / 60}{" "}
                                      minutes
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <History className="w-4 h-4" />
                                    <span
                                      className={
                                        monitor.is_active
                                          ? "text-green-500 font-medium"
                                          : "text-slate-500"
                                      }
                                    >
                                      {monitor.is_active ? "Active" : "Stopped"}
                                    </span>
                                    {monitorResults[monitor.id] && (
                                      <span className="ml-2 text-xs flex items-center gap-1">
                                        |{" "}
                                        {monitorResults[monitor.id].success ? (
                                          <span className="text-green-500">
                                            Success
                                          </span>
                                        ) : (
                                          <span className="text-red-500">
                                            Failed
                                          </span>
                                        )}
                                        |{" "}
                                        <span className="uppercase text-slate-500">
                                          {monitorResults[monitor.id].method}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleMonitor(monitor)}
                                    className={
                                      monitor.is_active
                                        ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                        : "text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                    }
                                    title={
                                      monitor.is_active
                                        ? "Stop Monitor"
                                        : "Start Monitor"
                                    }
                                  >
                                    {monitor.is_active ? (
                                      <Square
                                        className="w-4 h-4"
                                        fill="currentColor"
                                      />
                                    ) : (
                                      <Play
                                        className="w-4 h-4"
                                        fill="currentColor"
                                      />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleDeleteMonitor(monitor.id)
                                    }
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
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
                      const rawTimestamp = log.timestamp || log.tested_at;
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
                            {(log.method || log.method_used) === "client" ||
                            (log.method || log.method_used) === "fallback" ||
                            (log.method || log.method_used) ===
                              "client-fallback" ? (
                              <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 px-1.5 py-0.5 rounded font-mono font-medium">
                                fallback
                              </span>
                            ) : (log.method || log.method_used) ===
                                "server-udp" ||
                              (log.method || log.method_used) === "server" ? (
                              <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 px-1.5 py-0.5 rounded font-mono font-medium">
                                server-udp
                              </span>
                            ) : (log.method || log.method_used) ===
                              "server-doh" ? (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono font-medium">
                                server-doh
                              </span>
                            ) : (log.method || log.method_used) === "failed" ? (
                              <span className="text-[10px] bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400 px-1.5 py-0.5 rounded font-mono font-medium">
                                failed
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-medium">
                                {log.method || log.method_used}
                              </span>
                            )}
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
                                const time = curr.tested_at || curr.timestamp;
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
                                  {new Date(
                                    record.tested_at || record.timestamp
                                  ).toLocaleString()}
                                </td>
                                <td className="py-3 px-4 font-mono">
                                  {record.domain}
                                </td>
                                <td className="py-3 px-4">{record.provider}</td>
                                <td className="py-3 px-4">
                                  {record.latency_ms}ms
                                </td>
                                <td className="py-3 px-4">
                                  {record.method || record.method_used ? (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${(record.method || record.method_used) === "server" || (record.method || record.method_used) === "server-udp" || (record.method || record.method_used) === "server-doh" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : (record.method || record.method_used) === "client" || (record.method || record.method_used) === "client-fallback" || (record.method || record.method_used) === "fallback" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}`}
                                    >
                                      {record.method || record.method_used}
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
                <CardTitle>
                  {user ? "Your DNS Performance" : "Global DNS Performance"}
                </CardTitle>
                <CardDescription>
                  Ranked by speed, reliability, and stability
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
                  <div className="space-y-6">
                    {leaderboard.length > 0 && (
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <p className="font-semibold">
                          Recommended DNS:{" "}
                          <span className="text-primary">
                            {
                              leaderboard.sort(
                                (a, b) =>
                                  (b.reliability_score || b.score) -
                                  (a.reliability_score || a.score)
                              )[0]?.provider
                            }
                          </span>{" "}
                          (Score:{" "}
                          {leaderboard
                            .sort(
                              (a, b) =>
                                (b.reliability_score || b.score) -
                                (a.reliability_score || a.score)
                            )[0]
                            ?.reliability_score?.toFixed(1) ||
                            leaderboard
                              .sort(
                                (a, b) =>
                                  (b.reliability_score || b.score) -
                                  (a.reliability_score || a.score)
                              )[0]
                              ?.score?.toFixed(1)}
                          )
                        </p>
                      </div>
                    )}
                    <div className="rounded-md border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 uppercase">
                            <tr>
                              <th className="px-4 py-3 font-medium">Rank</th>
                              <th className="px-4 py-3 font-medium">
                                Provider
                              </th>
                              <th className="px-4 py-3 font-medium">Latency</th>
                              <th className="px-4 py-3 font-medium">
                                Success %
                              </th>
                              <th className="px-4 py-3 font-medium">
                                Reliability Score
                              </th>
                              <th className="px-4 py-3 font-medium">Tests</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaderboard
                              .sort(
                                (a, b) =>
                                  (b.reliability_score || b.score) -
                                  (a.reliability_score || a.score)
                              )
                              .map((item, index) => {
                                const provider = userProviders.find(
                                  p => p.name === item.provider
                                );

                                // Color logic
                                let successColor = "text-red-500";
                                const rate =
                                  item.success_rate <= 1
                                    ? item.success_rate * 100
                                    : item.success_rate;
                                if (rate >= 95) successColor = "text-green-500";
                                else if (rate >= 80)
                                  successColor = "text-yellow-500";

                                let latencyColor = "text-red-500";
                                if (item.avg_latency < 100)
                                  latencyColor = "text-green-500";
                                else if (item.avg_latency <= 250)
                                  latencyColor = "text-yellow-500";

                                return (
                                  <tr
                                    key={item.provider}
                                    className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                  >
                                    <td className="px-4 py-3">
                                      <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${index === 0 ? "bg-yellow-500" : index === 1 ? "bg-slate-400" : index === 2 ? "bg-amber-700" : "bg-slate-800"}`}
                                      >
                                        #{index + 1}
                                      </div>
                                    </td>
                                    <td
                                      className="px-4 py-3 font-bold"
                                      style={{ color: provider?.color }}
                                    >
                                      {item.provider}
                                    </td>
                                    <td
                                      className={`px-4 py-3 font-medium ${latencyColor}`}
                                    >
                                      {item.avg_latency === null ||
                                      isNaN(item.avg_latency)
                                        ? "N/A"
                                        : Math.round(item.avg_latency)}{" "}
                                      ms
                                    </td>
                                    <td
                                      className={`px-4 py-3 font-medium ${successColor}`}
                                    >
                                      {item.success_rate === null ||
                                      isNaN(item.success_rate)
                                        ? "N/A"
                                        : item.success_rate <= 1
                                          ? (item.success_rate * 100).toFixed(1)
                                          : item.success_rate.toFixed(1)}
                                      %
                                    </td>
                                    <td className="px-4 py-3 font-black text-primary">
                                      {item.reliability_score === null ||
                                      item.reliability_score === undefined ||
                                      isNaN(item.reliability_score)
                                        ? item.score === null ||
                                          isNaN(item.score)
                                          ? "0.0"
                                          : item.score.toFixed(1)
                                        : item.reliability_score.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                      {item.sample_count ||
                                        item.total_tests ||
                                        0}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
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
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium mb-2">
                        Custom DNS Provider
                      </h3>
                      <div className="grid gap-2">
                        <Input
                          placeholder="Provider Name (e.g. My Custom DNS)"
                          value={customName}
                          onChange={e => setCustomName(e.target.value)}
                        />
                        <Input
                          placeholder="DoH URL (e.g. https://dns.quad9.net/dns-query)"
                          value={customUrl}
                          onChange={e => setCustomUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={async () => {
                            if (!user) {
                              toast.error("Login required", {
                                description:
                                  "You must be logged in to save settings.",
                              });
                              return;
                            }
                            const { error } = await supabase
                              .from("user_preferences")
                              .upsert(
                                {
                                  user_id: user.id,
                                  custom_dns_name: customName || null,
                                  custom_dns_url: customUrl || null,
                                },
                                { onConflict: "user_id" }
                              );
                            if (error) {
                              toast.error("Failed to save settings");
                            } else {
                              toast.success("Settings saved!");
                              if (customName && customUrl) {
                                setUserProviders([
                                  ...DOH_PROVIDERS,
                                  {
                                    key: "custom",
                                    name: customName,
                                    url: customUrl,
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
                      <p className="text-xs text-slate-500">
                        Provide a valid DoH endpoint URL for a custom DNS
                        resolver. This will add your provider to the benchmark
                        list.
                      </p>
                    </div>
                    <div className="pt-6 border-t dark:border-slate-800"></div>
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
