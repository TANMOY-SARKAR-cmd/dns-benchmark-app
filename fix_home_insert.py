import re

with open('frontend/src/pages/Home.tsx', 'r') as f:
    content = f.read()

# Update push of successful individual queries (lines ~565)
old_success_push = '''                    allQueries.push({
                      user_id: userId,
                      domain,
                      upstream_provider: provider.name,
                      latency_ms: result.avgLatency,
                      status: "success",
                      created_at: new Date().toISOString(),
                    });'''

new_success_push = '''                    allQueries.push({
                      user_id: userId,
                      domain,
                      upstream_provider: provider.name,
                      latency_ms: result.avgLatency,
                      status: "success",
                      created_at: new Date().toISOString(),
                      method_used: result.method,
                      fallback_used: result.fallbackUsed,
                    });'''

content = content.replace(old_success_push, new_success_push)

# Update push of failed individual queries (lines ~576)
old_error_push = '''                  allQueries.push({
                    user_id: userId,
                    domain,
                    upstream_provider: provider.name,
                    latency_ms: 0,
                    status: "failed",
                    created_at: new Date().toISOString(),
                  });'''

new_error_push = '''                  allQueries.push({
                    user_id: userId,
                    domain,
                    upstream_provider: provider.name,
                    latency_ms: 0,
                    status: "failed",
                    created_at: new Date().toISOString(),
                    method_used: "failed",
                    fallback_used: true,
                  });'''

content = content.replace(old_error_push, new_error_push)

# Update insertion of benchmark results (lines ~610)
old_benchmark_map = '''          const benchmarkResults = Object.values(
            allQueries.reduce(
              (acc, q) => {
                const key = `${q.domain}-${q.upstream_provider}`;
                if (!acc[key]) {
                  acc[key] = { ...q, sum: 0, count: 0 };
                }
                acc[key].sum += q.latency_ms;
                acc[key].count += 1;
                return acc;
              },
              {} as Record<string, any>
            )
          ).map((q: any) => ({
            user_id: q.user_id,
            domain: q.domain,
            provider: q.upstream_provider,
            latency_ms: q.latency_ms,
            tested_at: q.created_at,
          }));'''

new_benchmark_map = '''          const benchmarkResults = Object.values(
            allQueries.reduce(
              (acc, q) => {
                const key = `${q.domain}-${q.upstream_provider}`;
                if (!acc[key]) {
                  acc[key] = { ...q, sum: 0, count: 0 };
                }
                acc[key].sum += q.latency_ms;
                acc[key].count += 1;
                return acc;
              },
              {} as Record<string, any>
            )
          ).map((q: any) => ({
            user_id: q.user_id,
            domain: q.domain,
            provider: q.upstream_provider,
            latency_ms: q.latency_ms,
            tested_at: q.created_at,
            method_used: q.method_used,
            fallback_used: q.fallback_used,
          }));'''

content = content.replace(old_benchmark_map, new_benchmark_map)

# Also ensure monitor logic passes method (lines ~265)
old_monitor_success = '''                    latency_ms: result.avgLatency,
                    success: result.successRate > 0,
                    status: result.successRate > 0 ? "success" : "failed",
                    method_used: result.method,
                  });'''

new_monitor_success = '''                    latency_ms: result.avgLatency,
                    success: result.successRate > 0,
                    status: result.successRate > 0 ? "success" : "failed",
                    method_used: result.method,
                    fallback_used: result.fallbackUsed,
                  });'''

content = content.replace(old_monitor_success, new_monitor_success)

old_monitor_fail = '''                    latency_ms: 0,
                    success: false,
                    status: "failed",
                    method_used: "client",
                  });'''

new_monitor_fail = '''                    latency_ms: 0,
                    success: false,
                    status: "failed",
                    method_used: "failed",
                    fallback_used: true,
                  });'''

content = content.replace(old_monitor_fail, new_monitor_fail)

with open('frontend/src/pages/Home.tsx', 'w') as f:
    f.write(content)
