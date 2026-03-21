import re

with open('frontend/src/lib/doh.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'const res = await fetch("/api/dns-query", {',
    'const res = await fetch(new URL("/api/dns-query", window.location.origin).toString(), {'
)

with open('frontend/src/lib/doh.ts', 'w') as f:
    f.write(content)
