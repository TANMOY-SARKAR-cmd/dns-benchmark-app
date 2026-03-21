const fs = require("fs");
let content = fs.readFileSync("frontend/vite.config.ts", "utf8");

content = content.replace(
  `export default defineConfig({`,
  `export default defineConfig({
  define: {
    global: 'globalThis',
  },`
);

content = content.replace(
  `  resolve: {
    alias: {`,
  `  resolve: {
    alias: {
      buffer: 'buffer',`
);

fs.writeFileSync("frontend/vite.config.ts", content);
