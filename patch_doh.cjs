const fs = require("fs");
let content = fs.readFileSync("frontend/src/lib/doh.ts", "utf8");

content = content.replace(
  `export type ResolveDNSResult = {
  latency: number;
  success: boolean;
  verified: boolean;
  method: "server" | "client";
};`,
  `export type ResolveDNSResult = {
  latency: number;
  success: boolean;
  verified: boolean;
  method: "server" | "client";
  fallbackUsed: boolean;
};`
);

content = content.replace(
  `        return {
          latency: performance.now() - start, // Calculate true latency from client perspective
          success: true,
          verified: data.verified,
          method: "server",
        };`,
  `        return {
          latency: performance.now() - start, // Calculate true latency from client perspective
          success: true,
          verified: data.verified,
          method: "server",
          fallbackUsed: false,
        };`
);

content = content.replace(
  `  // If timeout already reached during server try, fail early
  if (controller.signal.aborted) {
    return { latency: 0, success: false, verified: false, method: "client" };
  }`,
  `  // If timeout already reached during server try, fail early
  if (controller.signal.aborted) {
    return { latency: 0, success: false, verified: false, method: "client", fallbackUsed: true };
  }`
);

content = content.replace(
  `    return { latency: 0, success: false, verified: false, method: "client" };
  }

  // 2. Fallback to client multi-method racing`,
  `    return { latency: 0, success: false, verified: false, method: "client", fallbackUsed: true };
  }

  // 2. Fallback to client multi-method racing`
);

content = content.replace(
  `      return {
        ...raceResult,
        method: "client",
      };`,
  `      return {
        ...raceResult,
        method: "client",
        fallbackUsed: true,
      };`
);

content = content.replace(
  `  return { latency: 0, success: false, verified: false, method: "client" };
}`,
  `  return { latency: 0, success: false, verified: false, method: "client", fallbackUsed: true };
}`
);

fs.writeFileSync("frontend/src/lib/doh.ts", content);
