const fs = require("fs");
let content = fs.readFileSync("frontend/src/main.tsx", "utf8");

if (!content.includes("ErrorBoundary")) {
  content = content.replace(
    'import App from "./App";',
    'import App from "./App";\nimport { ErrorBoundary } from "./components/ErrorBoundary";'
  );

  content = content.replace(
    "<QueryClientProvider client={queryClient}>",
    "<ErrorBoundary>\n    <QueryClientProvider client={queryClient}>"
  );

  content = content.replace(
    "</QueryClientProvider>",
    "</QueryClientProvider>\n  </ErrorBoundary>"
  );

  fs.writeFileSync("frontend/src/main.tsx", content);
}
