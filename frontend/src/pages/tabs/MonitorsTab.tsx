import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Server, Clock, History, Play, Square, Trash2, Activity, AlertCircle, Edit } from "lucide-react";
import { isSupabaseConfigured } from "@/config/env";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = seconds / 60;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function MonitorsTab({
  editingMonitorId,
  userProviders,
  selectedMonitorProviders,
  setSelectedMonitorProviders,
  user,
  monitors,
  monitorResults,
  isCreatingMonitor,
  handleCreateMonitor,
  monitorDomains,
  setMonitorDomains,
  monitorInterval,
  setMonitorInterval,
  toggleMonitor,
  handleDeleteMonitor,
  handleEditMonitor,
  isFetchingData
}: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Continuous Monitoring</CardTitle>
        <CardDescription>
          Set up background tests to monitor your favorite domains over time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isSupabaseConfigured ? (
          <EmptyState
            icon={AlertCircle}
            title="Supabase Required"
            description="Continuous monitoring requires Supabase configuration."
          />
        ) : !user ? (
          <EmptyState
            icon={AlertCircle}
            title="Authentication Required"
            description="Please log in to set up background monitors."
          />
        ) : isFetchingData ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <div className="space-y-8">
            <form onSubmit={handleCreateMonitor} className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-3">
                  <label className="text-sm font-medium mb-1.5 block">Domains to monitor (one per line)</label>
                  <Textarea
                    value={monitorDomains}
                    onChange={(e) => setMonitorDomains(e.target.value)}
                    placeholder="e.g. google.com&#10;cloudflare.com"
                    className="font-mono text-sm resize-none"
                    rows={3}
                    required
                  />
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Interval</label>
                    <select
                      value={monitorInterval}
                      onChange={(e) => setMonitorInterval(Number(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                    >
                      <option value={10}>10 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={isCreatingMonitor} className="w-full mt-2">
                    {isCreatingMonitor ? "Saving..." : (editingMonitorId ? "Update Monitor" : "Create Monitor")}
                  </Button>

                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium mb-2 block">Providers to test</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {userProviders.map((provider: any) => (
                    <label key={provider.name} className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMonitorProviders.includes(provider.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMonitorProviders([...selectedMonitorProviders, provider.name]);
                          } else {
                            setSelectedMonitorProviders(selectedMonitorProviders.filter((p: string) => p !== provider.name));
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-700"
                      />
                      <span>{provider.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </form>

            {monitors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {monitors.map((monitor: any) => (
                  <Card key={monitor.id} className="bg-card">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{monitor.domains.join(", ")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Server className="w-4 h-4" />
                            <span>{monitor.providers.join(", ")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Runs every {formatInterval(monitor.interval_seconds)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <History className="w-4 h-4" />
                            <span className={monitor.is_active ? "text-green-500 font-medium" : "text-slate-500"}>
                              {monitor.is_active ? "Active" : "Stopped"}
                            </span>
                            {monitorResults[monitor.id] && (
                              <span className="ml-2 text-xs flex items-center gap-1">
                                | {monitorResults[monitor.id].success ? <span className="text-green-500">Success</span> : <span className="text-red-500">Failed</span>}
                                | <span className="uppercase text-slate-500">{monitorResults[monitor.id].method}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditMonitor(monitor)}
                            title="Edit Monitor"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleMonitor(monitor)}
                            className={monitor.is_active ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" : "text-green-500 hover:text-green-600 hover:bg-green-500/10"}
                            title={monitor.is_active ? "Stop Monitor" : "Start Monitor"}
                          >
                            {monitor.is_active ? <Square className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMonitor(monitor.id)}
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
              <EmptyState
                icon={Activity}
                title="No active monitors"
                description="Set up continuous monitoring to automatically track domain resolution performance over time."
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
