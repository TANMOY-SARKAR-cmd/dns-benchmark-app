const fs = require("fs");
let content = fs.readFileSync("frontend/src/lib/doh.ts", "utf8");

content = content.replace(
  `export type BenchmarkResult = {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  queriesPerSec: number;
  verified: boolean;
  method: "server" | "client" | "mixed";
};`,
  `export type BenchmarkResult = {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  queriesPerSec: number;
  verified: boolean;
  method: "server" | "client" | "mixed";
  fallbackUsed?: boolean;
};`
);

content = content.replace(
  `    method:
      usedServer && usedClient ? "mixed" : usedServer ? "server" : "client",
  };`,
  `    method:
      usedServer && usedClient ? "mixed" : usedServer ? "server" : "client",
    fallbackUsed: usedClient && usedServer,
  };`
);

fs.writeFileSync("frontend/src/lib/doh.ts", content);
