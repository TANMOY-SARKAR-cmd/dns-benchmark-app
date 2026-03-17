import { useEffect, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe,
  Server,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export default function DnsProxy() {
  const [proxyIp, setProxyIp] = useState("");
  const [copied, setCopied] = useState(false);

  const configQuery = trpc.proxy.getConfig.useQuery(undefined, {
    retry: false
  });
  const statsQuery = trpc.proxy.getStats.useQuery(undefined, {
    retry: false,
    enabled: !configQuery.isError
  });
  const logsQuery = trpc.proxy.getQueryLogs.useQuery({ limit: 50 }, {
    retry: false,
    enabled: !configQuery.isError
  });
  const updateConfigMutation = trpc.proxy.updateConfig.useMutation();

  const config = configQuery.data;
  const stats = statsQuery.data;
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (logsQuery.data) {
      setLogs(logsQuery.data);
    }
  }, [logsQuery.data]);

  useEffect(() => {
    if (config?.proxy_ip) {
      setProxyIp(config.proxy_ip);
    } else {
      setProxyIp("127.0.0.1"); // Default local proxy IP
    }
  }, [config]);

  // Setup Realtime subscriptions
  useEffect(() => {
    const logsSubscription = supabase
      .channel("dns_queries_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dns_queries" },
        payload => {
          setLogs(current => {
            const newLog = {
              id: payload.new.id,
              domain: payload.new.domain,
              provider: payload.new.upstream_provider,
              resolutionTime: payload.new.latency_ms,
              cachedResult: payload.new.cached ? 1 : 0,
            };
            return [newLog, ...current].slice(0, 50); // keep last 50
          });
        }
      )
      .subscribe();

    const statsSubscription = supabase
      .channel("proxy_stats_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "proxy_stats" },
        payload => {
          statsQuery.refetch();
        }
      )
      .subscribe();

    const configSubscription = supabase
      .channel("proxy_config_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "proxy_config" },
        payload => {
          configQuery.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsSubscription);
      supabase.removeChannel(statsSubscription);
      supabase.removeChannel(configSubscription);
    };
  }, []);

  const handleToggleProxy = async () => {
    if (!config) return;
    try {
      await updateConfigMutation.mutateAsync({
        isEnabled: config.is_enabled === 1 ? 0 : 1,
      });
      toast.success(
        `DNS Proxy ${config.is_enabled === 1 ? "disabled" : "enabled"}`
      );
    } catch (error) {
      toast.error("Failed to update proxy configuration");
    }
  };

  const handleUpdateProvider = async (provider: string) => {
    try {
      await updateConfigMutation.mutateAsync({
        fastestProvider: provider,
      });
      toast.success(`Fastest provider updated to ${provider}`);
    } catch (error) {
      toast.error("Failed to update provider");
    }
  };

  const handleCopyIp = () => {
    if (proxyIp) {
      navigator.clipboard.writeText(proxyIp);
      setCopied(true);
      toast.success("Proxy IP copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const providers = trpc.dns.providers.useQuery();

  if (configQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <Card className="max-w-md w-full border-slate-200 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Server className="w-5 h-5 text-purple-600" />
              Backend Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-6">
              <p className="text-amber-800 font-medium">
                DNS Proxy server is not available in this deployment. The proxy feature requires a dedicated backend server.
              </p>
            </div>
            <p className="text-slate-600 mb-6 text-sm">
              This feature requires running the backend DNS proxy server locally or on a VPS.
            </p>
            <a href="/">
              <Button className="w-full">Return to Dashboard</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-slate-900">
              DNS Proxy (Pi-hole Mode)
            </h1>
          </div>
          <p className="text-slate-600">
            Configure your device to use this DNS proxy for automatic routing to
            the fastest provider
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-8">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Notice:</strong> This feature requires running the backend DNS proxy server locally or on a VPS.
              </p>
            </div>

            {/* Proxy Status */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    Proxy Status
                  </span>
                  <Switch
                    checked={config?.is_enabled === 1}
                    onCheckedChange={handleToggleProxy}
                    disabled={updateConfigMutation.isPending || configQuery.isLoading}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  {config?.is_enabled === 1 ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-slate-900 font-semibold">
                        DNS Proxy is Active
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      <span className="text-slate-900 font-semibold">
                        DNS Proxy is Inactive
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  When enabled, this DNS proxy will automatically route all DNS
                  queries to the fastest provider based on recent benchmarks.
                </p>
              </CardContent>
            </Card>

            {/* Proxy IP Configuration */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-600" />
                  Proxy Server Address
                </CardTitle>
                <CardDescription>
                  Point your devices to this IP address to use the DNS proxy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={proxyIp}
                    readOnly
                    className="font-mono text-sm"
                    placeholder="Proxy IP will appear here"
                  />
                  <Button
                    onClick={handleCopyIp}
                    variant="outline"
                    size="sm"
                    disabled={!proxyIp}
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-slate-700">
                    <strong>Default Port:</strong> {config?.proxy_port || 5353}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Note: To use standard port 53 on Linux/macOS, run the backend with sudo or use setcap cap_net_bind_service=+ep on the binary.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Provider Selection */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle>Fastest Provider</CardTitle>
                <CardDescription>
                  Select which DNS provider to route queries to
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={config?.fastest_provider || "Google DNS"}
                  onValueChange={handleUpdateProvider}
                  disabled={updateConfigMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.data?.map(provider => (
                      <SelectItem key={provider.name} value={provider.name}>
                        {provider.name} ({provider.ip})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-600">
                  Current provider:{" "}
                  <strong>{config?.fastest_provider || "Not set"}</strong>
                </p>
              </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle>Setup Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      Windows
                    </h4>
                    <ol className="text-sm text-slate-700 space-y-1 ml-4 list-decimal">
                      <li>
                        Go to Settings → Network & Internet → Advanced network
                        settings
                      </li>
                      <li>Click "Change adapter options"</li>
                      <li>Right-click your network → Properties</li>
                      <li>Select IPv4 → Properties</li>
                      <li>Enter DNS: {proxyIp || "Your proxy IP"}</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">macOS</h4>
                    <ol className="text-sm text-slate-700 space-y-1 ml-4 list-decimal">
                      <li>System Preferences → Network</li>
                      <li>Select your connection → Advanced</li>
                      <li>DNS tab → Add {proxyIp || "Your proxy IP"}</li>
                      <li>Click OK and Apply</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Linux</h4>
                    <ol className="text-sm text-slate-700 space-y-1 ml-4 list-decimal">
                      <li>Edit /etc/resolv.conf</li>
                      <li>Add: nameserver {proxyIp || "Your proxy IP"}</li>
                      <li>Save and restart networking</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistics Sidebar */}
          <div className="space-y-8">
            {/* Stats Cards */}
            {stats && (
              <>
                <Card className="border-slate-200 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-600 text-sm font-medium mb-1">
                        Total Queries
                      </p>
                      <p className="text-3xl font-bold text-purple-600">
                        {stats.totalQueries}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-600 text-sm font-medium mb-1">
                        Cache Hit Rate
                      </p>
                      <p className="text-3xl font-bold text-green-600">
                        {stats.cacheHitRate}%
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-600 text-sm font-medium mb-1">
                        Avg Resolution
                      </p>
                      <p className="text-3xl font-bold text-blue-600">
                        {stats.averageResolutionTime}ms
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-600 text-sm font-medium mb-1">
                        Most Used
                      </p>
                      <p className="text-lg font-bold text-slate-900">
                        {stats.mostUsedProvider || "N/A"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Recent Queries */}
            {logs && logs.length > 0 && (
              <Card className="border-slate-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Queries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {logs.slice(0, 10).map(log => (
                      <div
                        key={log.id}
                        className="text-xs p-2 bg-slate-50 rounded flex justify-between"
                      >
                        <div>
                          <p
                            className="font-mono text-slate-900 truncate max-w-[120px]"
                            title={log.domain}
                          >
                            {log.domain}
                          </p>
                          <p className="text-slate-600">{log.provider}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-900 font-semibold">
                            {log.cachedResult
                              ? "Cached"
                              : `${log.resolutionTime || 0}ms`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
