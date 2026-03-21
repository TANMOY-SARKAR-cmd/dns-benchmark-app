import re

with open('frontend/src/lib/doh.ts', 'r') as f:
    content = f.read()

# Update BenchmarkResult type
content = re.sub(
    r'export type BenchmarkResult = \{[^}]+\};',
    '''export type BenchmarkResult = {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  queriesPerSec: number;
  verified: boolean;
  method: "server" | "client" | "failed" | "mixed";
  fallbackUsed: boolean;
};''',
    content
)

# Update ResolveDNSResult type again to ensure "failed" is valid
content = re.sub(
    r'export type ResolveDNSResult = \{[^}]+\};',
    '''export type ResolveDNSResult = {
  latency: number | null;
  success: boolean;
  verified: boolean;
  method: "server" | "client" | "failed" | "mixed";
  fallbackUsed: boolean;
  provider?: string;
};''',
    content
)

with open('frontend/src/lib/doh.ts', 'w') as f:
    f.write(content)
