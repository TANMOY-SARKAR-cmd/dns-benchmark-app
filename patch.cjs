const fs = require("fs");
let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf8");

// Normalize monitors when fetched
content = content.replace(
  "setMonitors(data || []);",
  `const normalizedMonitors = (data || []).map(m => ({
        ...m,
        domains: Array.isArray(m.domains)
          ? m.domains
          : typeof m.domains === "string"
            ? m.domains.split(",")
            : [],
        providers: Array.isArray(m.providers)
          ? m.providers
          : typeof m.providers === "string"
            ? m.providers.split(",")
            : []
      }));
      setMonitors(normalizedMonitors);`
);

// Fix `.join` calls
content = content.replace(
  /monitor\.domains\.join/g,
  "(Array.isArray(monitor.domains) ? monitor.domains : []).join"
);
content = content.replace(
  /monitor\.providers\.join/g,
  "(Array.isArray(monitor.providers) ? monitor.providers : []).join"
);

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
