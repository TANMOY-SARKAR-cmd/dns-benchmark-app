import re

with open('frontend/src/lib/doh.ts', 'r') as f:
    content = f.read()

# Update the batched measureDoHBatch to return the fallbackUsed correctly
old_batch = '''              successRate: Math.round((stats.successCount / retries) * 100),
              queriesPerSec: Math.round(stats.successCount / totalTimeSec),
              verified: true,
              method: "server",
              fallbackUsed: false,
            };'''

new_batch = '''              successRate: Math.round((stats.successCount / retries) * 100),
              queriesPerSec: Math.round(stats.successCount / totalTimeSec),
              verified: true,
              method: "server",
              fallbackUsed: false,
            };'''

with open('frontend/src/lib/doh.ts', 'w') as f:
    f.write(content)
