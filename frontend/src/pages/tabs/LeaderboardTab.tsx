import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, AlertCircle } from "lucide-react";
import { isSupabaseConfigured } from "@/config/env";
import { Skeleton } from "@/components/ui/skeleton";

export function LeaderboardTab({ user, leaderboard, userProviders, isFetchingData }: any) {
  const sortedLeaderboard = [...(leaderboard || [])].sort((a: any, b: any) => (b.reliability_score || b.score) - (a.reliability_score || a.score));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user ? "Your DNS Performance" : "Global DNS Performance"}</CardTitle>
        <CardDescription>Ranked by speed, reliability, and stability</CardDescription>
      </CardHeader>
      <CardContent>
        {!isSupabaseConfigured ? (
          <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
            <p>
              Leaderboard requires Supabase. Configure <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable this feature.
            </p>
          </div>
        ) : isFetchingData ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : leaderboard.length > 0 && (
          <div className="space-y-6">
            {leaderboard.length > 0 && (
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <p className="font-semibold">
                  Recommended DNS:{" "}
                  <span className="text-primary">
                    {sortedLeaderboard[0]?.provider}
                  </span>{" "}
                  (Score:{" "}
                  {sortedLeaderboard[0]?.reliability_score?.toFixed(1) ||
                   sortedLeaderboard[0]?.score?.toFixed(1)})
                </p>
              </div>
            )}
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 uppercase whitespace-nowrap">
                    <tr>
                      <th className="px-4 py-3 font-medium">Rank</th>
                      <th className="px-4 py-3 font-medium">Provider</th>
                      <th className="px-4 py-3 font-medium">Latency</th>
                      <th className="px-4 py-3 font-medium">Success %</th>
                      <th className="px-4 py-3 font-medium">Reliability Score</th>
                      <th className="px-4 py-3 font-medium">Tests</th>
                      <th className="px-4 py-3 font-medium text-center">Stability</th>
                      <th className="px-4 py-3 font-medium">Method Stats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeaderboard.map((item: any, index: number) => {
                      const provider = userProviders.find((p: any) => p.name === item.provider);
                      let successColor = "text-red-500";
                      const rate = item.success_rate <= 1 ? item.success_rate * 100 : item.success_rate;
                      if (rate >= 95) successColor = "text-green-500";
                      else if (rate >= 80) successColor = "text-yellow-500";

                      let latencyColor = "text-red-500";
                      if (item.avg_latency < 100) latencyColor = "text-green-500";
                      else if (item.avg_latency <= 250) latencyColor = "text-yellow-500";

                      return (
                        <tr key={item.provider} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${index === 0 ? "bg-yellow-500" : index === 1 ? "bg-slate-400" : index === 2 ? "bg-amber-700" : "bg-slate-800"}`}>
                              #{index + 1}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold" style={{ color: provider?.color }}>{item.provider}</td>
                          <td className={`px-4 py-3 font-medium ${latencyColor}`}>
                            {item.avg_latency === null || isNaN(item.avg_latency) ? "N/A" : Math.round(item.avg_latency)} ms
                          </td>
                          <td className={`px-4 py-3 font-medium ${successColor}`}>
                            {item.success_rate === null || isNaN(item.success_rate) ? "N/A" : item.success_rate <= 1 ? (item.success_rate * 100).toFixed(1) : item.success_rate.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 font-black text-primary">
                            {item.reliability_score === null || item.reliability_score === undefined || isNaN(item.reliability_score)
                              ? item.score === null || isNaN(item.score) ? "0.0" : item.score.toFixed(1)
                              : item.reliability_score.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{item.sample_count || item.total_tests || 0}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item.stability_status === 'Stable' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                              item.stability_status === 'Unstable' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              item.stability_status === 'Unreliable' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              <span className={`mr-1.5 h-2 w-2 rounded-full ${
                                item.stability_status === 'Stable' ? 'bg-green-500' :
                                item.stability_status === 'Unstable' ? 'bg-yellow-500' :
                                item.stability_status === 'Unreliable' ? 'bg-red-500' : 'bg-slate-500'
                              }`}></span>
                              {item.stability_status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs space-y-1">
                            {item.udp_percentage !== undefined && (
                              <>
                                <div className="flex justify-between w-32"><span className="text-slate-500">UDP:</span><span className="font-medium text-blue-500">{item.udp_percentage.toFixed(1)}%</span></div>
                                <div className="flex justify-between w-32"><span className="text-slate-500">DoH:</span><span className="font-medium text-indigo-500">{item.doh_percentage.toFixed(1)}%</span></div>
                                <div className="flex justify-between w-32"><span className="text-slate-500">Fallback:</span><span className="font-medium text-orange-500">{item.fallback_percentage.toFixed(1)}%</span></div>
                                <div className="flex justify-between w-32"><span className="text-slate-500">Failed:</span><span className="font-medium text-red-500">{item.failure_percentage.toFixed(1)}%</span></div>
                              </>
                            )}
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
  );
}
