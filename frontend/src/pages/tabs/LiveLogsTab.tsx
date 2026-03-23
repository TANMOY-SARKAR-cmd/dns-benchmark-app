import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle } from "lucide-react";
import { isSupabaseConfigured } from "@/config/env";
import { EmptyState } from "@/components/ui/EmptyState";

export function LiveLogsTab({ user, liveLogs }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Query Logs</CardTitle>
        <CardDescription>
          Real-time stream of DNS tests happening globally
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isSupabaseConfigured ? (
          <EmptyState
            icon={AlertCircle}
            title="Supabase Required"
            description="Live logs require Supabase configuration."
          />
        ) : !user ? (
          <EmptyState
            icon={AlertCircle}
            title="Authentication Required"
            description="Please log in to view live logs."
          />
        ) : liveLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Waiting for queries... Run a benchmark to see live results here.
          </div>
        ) : (
          <div className="space-y-2">
            {liveLogs.map((log: any, i: number) => {
              const rawTimestamp = log.timestamp || log.tested_at;
              const date = rawTimestamp ? new Date(rawTimestamp) : null;
              const timeLabel = date && !isNaN(date.getTime()) ? date.toLocaleTimeString() : "—";
              return (
                <div key={i} className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-900 rounded-md text-sm">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-slate-500">{timeLabel}</span>
                    <span className="font-semibold">{log.upstream_provider || log.provider}</span>
                    <span className="font-mono">{log.domain}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(log.method || log.method_used) === "client" || (log.method || log.method_used) === "fallback" || (log.method || log.method_used) === "client-fallback" ? (
                      <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 px-1.5 py-0.5 rounded font-mono font-medium">fallback</span>
                    ) : (log.method || log.method_used) === "server-udp" || (log.method || log.method_used) === "server" ? (
                      <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 px-1.5 py-0.5 rounded font-mono font-medium">server-udp</span>
                    ) : (log.method || log.method_used) === "server-doh" ? (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono font-medium">server-doh</span>
                    ) : (log.method || log.method_used) === "failed" ? (
                      <span className="text-[10px] bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400 px-1.5 py-0.5 rounded font-mono font-medium">failed</span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-medium">{log.method || log.method_used}</span>
                    )}
                    <div className={`font-semibold flex items-center gap-1 ${log.status === "success" || log.success ? "text-green-600" : "text-red-600"}`}>
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
  );
}
