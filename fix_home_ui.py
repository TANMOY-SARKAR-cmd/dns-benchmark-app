import re

with open('frontend/src/pages/Home.tsx', 'r') as f:
    content = f.read()

# Update Benchmark Results table headers (lines ~910)
old_headers = '''                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                              Domain
                            </th>
                            {userProviders.map(provider => (
                              <th
                                key={provider.name}
                                className="py-3 px-4 text-sm font-medium text-slate-500 text-center"
                              >
                                {provider.name}
                              </th>
                            ))}'''

new_headers = '''                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                              Domain
                            </th>
                            {userProviders.map(provider => (
                              <th
                                key={provider.name}
                                className="py-3 px-4 text-sm font-medium text-slate-500 text-center"
                              >
                                {provider.name}
                              </th>
                            ))}'''

# Wait, the instruction says "In results table add column: Provider | Latency | Method | Status". But the current UI displays domains as rows and providers as columns.
# Let me check the current table structure first.
