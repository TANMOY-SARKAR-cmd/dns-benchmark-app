const fs = require("fs");
let content = fs.readFileSync("frontend/src/App.tsx", "utf8");
content = content.replace(
  'import ErrorBoundary from "./components/ErrorBoundary";',
  'import { ErrorBoundary } from "./components/ErrorBoundary";'
);
fs.writeFileSync("frontend/src/App.tsx", content);

// Also we need to fix the buffer/dns-packet issue for the browser:
let viteConfig = fs.readFileSync("frontend/vite.config.ts", "utf8");
if (!viteConfig.includes("buffer")) {
  viteConfig = viteConfig.replace(
    "plugins: [",
    `define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  plugins: [`
  );
  fs.writeFileSync("frontend/vite.config.ts", viteConfig);
}

// And install buffer polyfill
