import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  Square, Star, ShieldCheck, Zap,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthButton } from "@/components/AuthButton";
import { measureDoHBatch } from "@/lib/doh";
import { toast } from "sonner";

import { BenchmarkTab } from "./tabs/BenchmarkTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { LeaderboardTab } from "./tabs/LeaderboardTab";
import { MonitorsTab } from "./tabs/MonitorsTab";
import { LiveLogsTab } from "./tabs/LiveLogsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";



function isBenchmarkResult(result: any): result is BenchmarkResult {
  return result && typeof result === 'object' && result !== "Error";
}

export default function Home({ tab = "benchmark" }: { tab?: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigateTab = (e: any) => {
      const targetTab = e.detail;
      if (targetTab === "benchmark") navigate("/");
      else navigate("/" + targetTab);
    };
    window.addEventListener("navigateTab", handleNavigateTab);
    return () => window.removeEventListener("navigateTab", handleNavigateTab);
  }, [navigate]);
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || "anonymous";
  const [domainsInput, setDomainsInput] = useState("");
  const [recordType, setRecordType] = useState<"A" | "AAAA">("A");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [testResults, setTestResults] = useState<Record<
    string,
    Record<string, BenchmarkResult | "Error">
  > | null>(null);

  // Tabs


  // Leaderboard & History
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [userProviders, setUserProviders] = useState<typeof DOH_PROVIDERS>([
    ...DOH_PROVIDERS,
  ]);

  const [personalBest, setPersonalBest] = useState<{
    recommended: any;
    fastest: any;
    mostReliable: any;
  } | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [isFetchingData, setIsFetchingData] = useState(true);

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
    fetchPersonalBest();
    setIsFetchingData(false);

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

            const fallbackTasks: Promise<void>[] = [];
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

              // Second pass: queue client fallback concurrently for failed providers
              if (failedProviders.length > 0) {
                const tasks = failedProviders.map(async provider => {
                  try {
                    const fallbackResult = await measureClientDoH(
                      provider,
                      domain
                    );
                    results[domain][provider.name] = fallbackResult;
                  } catch (error) {
                    results[domain][provider.name] = "Error" as const;
                  }
                });
                fallbackTasks.push(...tasks);
              }
            }

            // Wait for all queued fallback tasks to complete across all domains
            if (fallbackTasks.length > 0) {
              await Promise.all(fallbackTasks);
            }

            for (const domain of monitor.domains) {
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
            isBenchmarkResult(clientResult) &&
            clientResult.successRate > 0;

                if (serverSuccess) {
                  final_success = true;
                  final_method = serverResult.method;
                  final_latency = serverResult.latency;
                } else if (clientSuccess) {
                  final_success = true;
                  final_method = isBenchmarkResult(clientResult) ? clientResult.method || "fallback" : "fallback";
                  final_latency = isBenchmarkResult(clientResult) ? clientResult.avgLatency : null;
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
    const domains: string[] = [];
    const rawParts = monitorDomains.split(/[\n,]+/);
    for (const part of rawParts) {
      const d = part
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0];

      if (d.length > 0 && VALID_DOMAIN_PATTERN.test(d)) {
        domains.push(d);
      }
    }

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

  const fetchPersonalBest = async () => {
    if (!user) {
      setPersonalBest(null);
      return;
    }

    try {
      const [
        { data: monitorData, error: monitorError },
        { data: benchmarkData, error: benchmarkError }
      ] = await Promise.all([
        supabase
          .from("monitor_results")
          .select("provider, latency_ms, success, method")
          .eq("user_id", user.id),
        supabase
          .from("benchmark_results")
          .select("provider, latency_ms, success, method")
          .eq("user_id", user.id)
      ]);

      if (monitorError) throw monitorError;
      if (benchmarkError) throw benchmarkError;

      const allData = [...(monitorData || []), ...(benchmarkData || [])];

      if (allData.length === 0) {
        setPersonalBest(null);
        return;
      }

      const agg: Record<string, { latencies: number[]; successCount: number; total: number; udp: number; doh: number; fallback: number; failed: number }> = {};

      for (const row of allData) {
        if (!agg[row.provider]) {
          agg[row.provider] = { latencies: [], successCount: 0, total: 0, udp: 0, doh: 0, fallback: 0, failed: 0 };
        }
        agg[row.provider].total += 1;
          if (row.method === "server-udp") {
            agg[row.provider].udp += 1;
          } else if (row.method === "server-doh") {
            agg[row.provider].doh += 1;
          } else if (row.method === "fallback") {
            agg[row.provider].fallback += 1;
          } else if (row.method === "failed" || !row.success) {
            agg[row.provider].failed += 1;
          }
        if (row.success) {
          agg[row.provider].successCount += 1;
          if (row.latency_ms !== null) {
            agg[row.provider].latencies.push(row.latency_ms);
          }
        }
      }

      const stats = [];
      for (const provider in agg) {
        const stat = agg[provider];
        if (stat.latencies.length === 0) continue;

        const success_rate = stat.successCount / stat.total;
        let sum = 0;
        for (let i = 0; i < stat.latencies.length; i++) {
          sum += stat.latencies[i];
        }
        const avg_latency = sum / stat.latencies.length;

        let reliability_score = 0;
        if (success_rate !== 0) {
          reliability_score =
            (success_rate * 0.6) +
            ((1.0 / Math.max(avg_latency, 1)) * 0.25) +
            (Math.log10(Math.max(stat.total || 1, 1)) * 0.15);
        }

        stats.push({
          provider,
          avg_latency,
          success_rate,
          reliability_score,
          total: stat.total,
        });
      }

      if (stats.length === 0) {
        setPersonalBest(null);
        return;
      }

      const fastest = [...stats].sort((a, b) => (a.avg_latency || 9999) - (b.avg_latency || 9999))[0];
      const mostReliable = [...stats].sort((a, b) => b.success_rate - a.success_rate)[0];
      const recommended = [...stats].sort((a, b) => b.reliability_score - a.reliability_score)[0];

      setPersonalBest({
        fastest,
        mostReliable,
        recommended,
      });

    } catch (error) {
      console.error("Error fetching personal best:", error);
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
          .select("provider, latency_ms, success, method")
          .eq("user_id", user.id)
          .gte("tested_at", thirtyDaysAgo.toISOString());

        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }

        // Aggregate data manually
        const agg: Record<string, { latencies: number[]; successCount: number; total: number; udp: number; doh: number; fallback: number; failed: number }> = {};
        for (const row of data || []) {
          if (!agg[row.provider]) {
            agg[row.provider] = { latencies: [], successCount: 0, total: 0, udp: 0, doh: 0, fallback: 0, failed: 0 };
          }
          agg[row.provider].total += 1;
          if (row.method === "server-udp") {
            agg[row.provider].udp += 1;
          } else if (row.method === "server-doh") {
            agg[row.provider].doh += 1;
          } else if (row.method === "fallback") {
            agg[row.provider].fallback += 1;
          } else if (row.method === "failed" || !row.success) {
            agg[row.provider].failed += 1;
          }
          if (row.success) {
            agg[row.provider].successCount += 1;
            if (row.latency_ms !== null) {
              agg[row.provider].latencies.push(row.latency_ms);
            }
          }
        }

        for (const provider in agg) {
          const stats = agg[provider];

          const success_rate = (stats.successCount / stats.total) * 100;
          let avg_latency = null;
          let jitter = null;

          if (stats.latencies.length > 0) {
            let sum = 0;
            for (let i = 0; i < stats.latencies.length; i++) {
              sum += stats.latencies[i];
            }
            avg_latency = sum / stats.latencies.length;

            if (stats.latencies.length > 1) {
              let varSum = 0;
              for (let i = 0; i < stats.latencies.length; i++) {
                varSum += Math.pow(stats.latencies[i] - avg_latency, 2);
              }
              jitter = Math.sqrt(varSum / (stats.latencies.length - 1));
            } else {
              jitter = avg_latency;
            }
          }

          const total = Math.max(stats.total, 1);
          const udp_percentage = (stats.udp / total) * 100;
          const doh_percentage = (stats.doh / total) * 100;
          const fallback_percentage = (stats.fallback / total) * 100;
          const failure_percentage = (stats.failed / total) * 100;

          let stability_status = "Stable";
          if (failure_percentage > 20 || fallback_percentage > 30 || (jitter !== null && jitter > 50)) {
            stability_status = "Unreliable";
          } else if (failure_percentage > 10 || fallback_percentage > 15 || (jitter !== null && jitter > 25)) {
            stability_status = "Unstable";
          }

          dataToProcess.push({
            provider,
            avg_latency,
            success_rate,
            jitter,
            total_tests: stats.total,
            udp_percentage,
            doh_percentage,
            fallback_percentage,
            failure_percentage,
            stability_status,
          });
        }
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

  const handleTest = async (providersToTest = userProviders) => {
    // Basic domain validation: strip protocols/paths and reject obviously invalid entries
    const VALID_DOMAIN_PATTERN =
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    const validDomains: string[] = [];
    const invalid: string[] = [];
    const tooLong: string[] = [];

    const rawParts = domainsInput.split(/[\n,]+/);
    for (const part of rawParts) {
      const d = part
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0];

      if (d.length === 0) continue;

      if (VALID_DOMAIN_PATTERN.test(d)) {
        if (d.length <= 253) {
          validDomains.push(d);
        } else {
          tooLong.push(d);
        }
      } else {
        invalid.push(d);
      }
    }

    const domains = validDomains;

    if (tooLong.length > 0) {
      toast.warning(
        `Skipped ${tooLong.length} domain(s) exceeding max length (253 chars)`
      );
    }

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
    const total = domains.length * providersToTest.length;

    try {
      const allQueries: any[] = [];

      // Process one domain at a time, sending all providers in a single batch
      for (const domain of domains) {
        results[domain] = {};

        // Prepare queries for all providers for this domain
        const queries = providersToTest.map(p => {
          const isCustom = !DOH_PROVIDERS.some(dp => dp.name === p.name);
          return {
            domain,
            provider: isCustom ? "custom" : p.key,
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
        for (const provider of providersToTest) {
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
          toast.warning(
            `Backend failed for ${failedProviders.length} provider(s), using client fallback`
          );
          const fallbackTasks = failedProviders.map(async provider => {
            try {
              const fallbackResult = await measureClientDoH(provider, domain);
              results[domain][provider.name] = fallbackResult;
              if (!isBenchmarkResult(fallbackResult) || fallbackResult.successRate === 0) {
                return 1; // Failed
              }
              return 0; // Success
            } catch (error) {
              results[domain][provider.name] = "Error" as const;
              return 1; // Failed
            }
          });

          const fallbackFailures = await Promise.all(fallbackTasks);
          const totalFailed = fallbackFailures.reduce<number>((sum, current) => sum + current, 0);

          if (totalFailed > 0) {
            toast.error(
              `All methods failed for ${totalFailed} provider(s) on ${domain}`
            );
          }
        }

        // Finalize results for all providers for this domain
        for (const provider of providersToTest) {
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
            isBenchmarkResult(clientResult) &&
            clientResult.successRate > 0;

          if (serverSuccess) {
            final_success = true;
            final_method = serverResult.method;
            final_latency = serverResult.latency;
          } else if (clientSuccess) {
            final_success = true;
            final_method = isBenchmarkResult(clientResult) ? clientResult.method || "fallback" : "fallback";
            final_latency = isBenchmarkResult(clientResult) ? clientResult.avgLatency : null;
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
        // Insert queries in batches of 50 concurrently
        const insertPromises = [];
        for (let i = 0; i < allQueries.length; i += 50) {
          const batch = allQueries.slice(i, i + 50);
          insertPromises.push(
            supabase.from("dns_queries").insert(batch).then(({ error }) => {
              if (error) {
                console.error("Supabase error:", error);
              }
            })
          );
        }
        await Promise.all(insertPromises);

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

        <Tabs value={tab} onValueChange={(val) => { if (val === "benchmark") navigate("/"); else navigate("/" + val); }} className="space-y-8">
          <TabsList className="flex overflow-x-auto flex-nowrap w-full sm:grid sm:grid-cols-6 md:w-auto h-auto min-h-10">
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
            <ErrorBoundary>
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
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="monitors">
            <ErrorBoundary>
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
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="logs">
            <ErrorBoundary>
            <LiveLogsTab user={user} liveLogs={liveLogs} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="history">
            <ErrorBoundary>
            <HistoryTab
              user={user}
              history={history}
              handleKeepRecord={handleKeepRecord}
              userProviders={userProviders}
            />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="leaderboard">
            <ErrorBoundary>
            <LeaderboardTab
              user={user}
              leaderboard={leaderboard}
              userProviders={userProviders}
              isFetchingData={isFetchingData}
            />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="settings">
            <ErrorBoundary>
            <SettingsTab
              user={user}
              customName={customName}
              setCustomName={setCustomName}
              customUrl={customUrl}
              setCustomUrl={setCustomUrl}
              setUserProviders={setUserProviders}
            />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
