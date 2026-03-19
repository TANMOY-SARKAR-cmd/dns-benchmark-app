const fs = require("fs");
let code = fs.readFileSync("server/dnsProxy.ts", "utf8");

const oldStr = `          logDnsQuery({
            userId: 'default',
            domain,
            recordType: type,
            clientIp: rinfo.address,
            upstreamProvider: this.config.fastestProvider,
            latencyMs: 0,
            cached: true,
            status: 'success'
          });`;

const newStr = `          logDnsQuery({
            userId: 'default',
            domain,
            recordType: type || undefined,
            clientIp: rinfo.address,
            upstreamProvider: this.config.fastestProvider,
            latencyMs: 0,
            cached: true,
            status: 'success'
          });`;

if (code.includes(oldStr)) {
  code = code.replace(oldStr, newStr);
  fs.writeFileSync("server/dnsProxy.ts", code);
  console.log("Replaced successfully");
} else {
  console.log("String not found");
}
