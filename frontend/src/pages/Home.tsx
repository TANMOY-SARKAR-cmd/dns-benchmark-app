import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Globe, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DNSResult = Record<string, number | string>;
type TestResults = Record<string, DNSResult>;

export default function Home() {
  const [domainsInput, setDomainsInput] = useState('');
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const testMutation = trpc.dns.test.useMutation();
  const providersQuery = trpc.dns.providers.useQuery();

  // Load historical benchmark results
  useEffect(() => {
    const fetchRecentBenchmarks = async () => {
      const { data, error } = await supabase
        .from('benchmark_results')
        .select('*')
        .order('tested_at', { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        const historicalResults: TestResults = {};

        // Group by domain and provider to rebuild the latest test view
        data.forEach((row) => {
          if (!historicalResults[row.domain]) {
            historicalResults[row.domain] = {};
          }
          if (historicalResults[row.domain][row.provider] === undefined) {
             historicalResults[row.domain][row.provider] = row.latency_ms;
          }
        });
        setTestResults(historicalResults);
      }
    };
    fetchRecentBenchmarks();
  }, []);

  // Listen for real-time benchmark updates
  useEffect(() => {
    const benchmarkSubscription = supabase
      .channel('benchmark_results_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'benchmark_results' }, payload => {
        setTestResults(prev => {
           const current = prev ? { ...prev } : {};
           if (!current[payload.new.domain]) {
             current[payload.new.domain] = {};
           }
           current[payload.new.domain][payload.new.provider] = payload.new.latency_ms;
           return current;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(benchmarkSubscription);
    };
  }, []);

  const handleTest = async () => {
    // Parse domains
    const domains = domainsInput
      .split(/[,\n]/)
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (domains.length === 0) {
      toast.error('Please enter at least one domain');
      return;
    }

    if (domains.length > 100) {
      toast.error('Maximum 100 domains allowed');
      return;
    }

    setIsLoading(true);
    setProgress(0);

    try {
      const results = await testMutation.mutateAsync({ domains });
      setTestResults(results);
      toast.success(`DNS tests completed for ${domains.length} domain(s)`);
    } catch (error) {
      toast.error('Failed to run DNS tests');
      console.error(error);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!testResults || !providersQuery.data) return [];

    const providers = providersQuery.data.map((p) => p.name);
    return Object.entries(testResults).map(([domain, results]) => {
      const dataPoint: Record<string, any> = { domain };
      providers.forEach((provider) => {
        const value = results[provider];
        dataPoint[provider] = typeof value === 'number' ? value : 0;
      });
      return dataPoint;
    });
  }, [testResults, providersQuery.data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!testResults) return null;

    const allTimes: number[] = [];
    Object.values(testResults).forEach((domainResults) => {
      Object.values(domainResults).forEach((time) => {
        if (typeof time === 'number') {
          allTimes.push(time);
        }
      });
    });

    if (allTimes.length === 0) return null;

    return {
      fastest: Math.min(...allTimes),
      slowest: Math.max(...allTimes),
      average: Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length),
    };
  }, [testResults]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!testResults || !providersQuery.data) return;

    const providers = providersQuery.data.map((p) => p.name);
    const headers = ['Domain', ...providers];
    const rows = Object.entries(testResults).map(([domain, results]) => [
      domain,
      ...providers.map((p) => results[p] || 'Error'),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns-benchmark-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-slate-900">DNS Benchmark</h1>
          </div>
          <p className="text-slate-600">Compare DNS resolution speeds across multiple providers</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  Enter Domains to Test
                </CardTitle>
                <CardDescription>
                  Enter one or more domains separated by commas or new lines. Supports up to 100 domains.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="google.com&#10;github.com&#10;youtube.com&#10;&#10;Or: google.com, github.com, youtube.com"
                  value={domainsInput}
                  onChange={(e) => setDomainsInput(e.target.value)}
                  className="min-h-32 resize-none font-mono text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleTest}
                  disabled={isLoading || domainsInput.trim().length === 0}
                  className="w-full h-11 text-base font-semibold"
                  size="lg"
                >
                  {isLoading ? 'Testing...' : 'Run DNS Test'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* DNS Providers Info */}
          <div>
            <Card className="border-slate-200 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-lg">DNS Providers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {providersQuery.data?.map((provider) => (
                  <div key={provider.name} className="text-sm">
                    <p className="font-semibold text-slate-900">{provider.name}</p>
                    <p className="text-slate-500 font-mono">{provider.ip}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Progress Bar */}
        {isLoading && (
          <Card className="border-slate-200 shadow-lg mb-8">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Testing domains...</span>
                  <span className="text-slate-900 font-semibold">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {testResults && !isLoading && (
          <div className="space-y-8">
            {/* Statistics */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-600 text-sm font-medium mb-1">Fastest</p>
                      <p className="text-3xl font-bold text-green-600">{stats.fastest}ms</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-600 text-sm font-medium mb-1">Average</p>
                      <p className="text-3xl font-bold text-blue-600">{stats.average}ms</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-slate-600 text-sm font-medium mb-1">Slowest</p>
                      <p className="text-3xl font-bold text-orange-600">{stats.slowest}ms</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Chart */}
            {chartData.length > 0 && (
              <Card className="border-slate-200 shadow-lg">
                <CardHeader>
                  <CardTitle>DNS Speed Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="domain" />
                      <YAxis label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      {providersQuery.data?.map((provider, index) => (
                        <Bar
                          key={provider.name}
                          dataKey={provider.name}
                          fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][index % 5]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Results Table */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Test Results</CardTitle>
                <Button onClick={handleExportCSV} variant="outline" size="sm">
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">Domain</th>
                        {providersQuery.data?.map((provider) => (
                          <th key={provider.name} className="text-center py-3 px-4 font-semibold text-slate-900">
                            {provider.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(testResults).map(([domain, results]) => (
                        <tr key={domain} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-slate-900">{domain}</td>
                          {providersQuery.data?.map((provider) => {
                            const value = results[provider.name];
                            const isError = typeof value !== 'number';
                            return (
                              <td key={provider.name} className="text-center py-3 px-4">
                                {isError ? (
                                  <span className="text-red-600 flex items-center justify-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    Error
                                  </span>
                                ) : (
                                  <span className="text-slate-900 font-semibold">{value}ms</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!testResults && !isLoading && (
          <div className="text-center py-12">
            <Globe className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No tests run yet</h3>
            <p className="text-slate-500 mb-6">Enter domains above and click "Run DNS Test" to get started</p>
            <a href="/proxy">
              <Button variant="outline">View DNS Proxy Configuration →</Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
