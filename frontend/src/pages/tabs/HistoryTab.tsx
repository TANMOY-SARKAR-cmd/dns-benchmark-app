import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from "recharts";
import { Download, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import html2canvas from "html2canvas";
import { isSupabaseConfigured } from "@/config/env";
import { useTheme } from "@/contexts/ThemeContext";

import { useState, useRef } from "react";
export function HistoryTab({ user, history, handleKeepRecord, userProviders }: any) {
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Benchmarks</CardTitle>
          <CardDescription>Last 100 benchmark runs</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isCompareMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsCompareMode(!isCompareMode)}
          >
            {isCompareMode ? "Cancel Compare" : "Compare Runs"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (history.length === 0) return;
              const csv = Papa.unparse(history);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", "dns_benchmark_history.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (history.length === 0) return;
              const json = JSON.stringify(history, null, 2);
              const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", "dns_benchmark_history.json");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (chartRef.current) {
                const canvas = await html2canvas(chartRef.current);
                const dataUrl = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                link.href = dataUrl;
                link.download = "dns_benchmark_chart.png";
                link.click();
              }
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export PNG
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!isSupabaseConfigured ? (
          <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
            <p>
              History requires Supabase. Configure <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable this feature.
            </p>
          </div>
        ) : !user ? (
          <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-blue-500" />
            <p>Please log in to view your benchmark history.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="h-[400px] w-full" id="results-chart" ref={chartRef}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={Object.values(
                    history.filter((h: any) => !isCompareMode || selectedRuns.includes(h.id)).reduce(
                      (acc: any, curr: any) => {
                        const time = curr.tested_at || curr.timestamp;
                        if (!acc[time]) acc[time] = { tested_at: time };
                        acc[time][curr.provider] = curr.latency_ms;
                        return acc;
                      },
                      {} as Record<string, any>
                    )
                  ).sort(
                    (a: any, b: any) =>
                      new Date(a.tested_at).getTime() - new Date(b.tested_at).getTime()
                  )}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="tested_at"
                    tickFormatter={val => new Date(val).toLocaleTimeString()}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={val => new Date(val).toLocaleString()}
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#1e293b" : "#fff",
                      borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
                    }}
                  />
                  <Legend />
                  {userProviders.map((provider: any) => (
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
              <h3 className="text-lg font-semibold mb-4">Raw Records</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b dark:border-slate-800">
                      {isCompareMode && <th className="py-3 px-4 font-semibold">Select</th>}
                      <th className="py-3 px-4 font-semibold">Time</th>
                      <th className="py-3 px-4 font-semibold">Domain</th>
                      <th className="py-3 px-4 font-semibold">Provider</th>
                      <th className="py-3 px-4 font-semibold">Latency</th>
                      <th className="py-3 px-4 font-semibold">Method</th>
                      <th className="py-3 px-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record: any) => (
                      <tr key={record.id} className="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {isCompareMode && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedRuns.includes(record.id)}
                              onChange={() => {
                                setSelectedRuns(prev => prev.includes(record.id) ? prev.filter(id => id !== record.id) : [...prev, record.id])
                              }}
                            />
                          </td>
                        )}
                        <td className="py-3 px-4">{new Date(record.tested_at || record.timestamp).toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono">{record.domain}</td>
                        <td className="py-3 px-4">{record.provider}</td>
                        <td className="py-3 px-4">{record.latency_ms}ms</td>
                        <td className="py-3 px-4">
                          {record.method || record.method_used ? (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${(record.method || record.method_used) === "server" || (record.method || record.method_used) === "server-udp" || (record.method || record.method_used) === "server-doh" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : (record.method || record.method_used) === "client" || (record.method || record.method_used) === "client-fallback" || (record.method || record.method_used) === "fallback" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}`}
                            >
                              {record.method || record.method_used}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {record.keep_forever ? (
                            <Button size="sm" variant="outline" onClick={() => handleKeepRecord(record.id, false)}>Discard</Button>
                          ) : (
                            <Button size="sm" onClick={() => handleKeepRecord(record.id, true)}>Keep</Button>
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
  );
}
