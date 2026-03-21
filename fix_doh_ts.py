import re

with open('frontend/src/lib/doh.ts', 'r') as f:
    content = f.read()

# Update the batched measureDoHBatch returned results
old_batch = '''              successRate: Math.round((stats.successCount / retries) * 100),
              queriesPerSec: Math.round(stats.successCount / totalTimeSec),
              verified: true,
              method: "server",
            };'''

new_batch = '''              successRate: Math.round((stats.successCount / retries) * 100),
              queriesPerSec: Math.round(stats.successCount / totalTimeSec),
              verified: true,
              method: "server",
              fallbackUsed: false,
            };'''

content = content.replace(old_batch, new_batch)

with open('frontend/src/lib/doh.ts', 'w') as f:
    f.write(content)
