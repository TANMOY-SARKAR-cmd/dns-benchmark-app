const fs = require('fs');

const file = 'frontend/src/pages/DnsProxy.tsx';
let content = fs.readFileSync(file, 'utf8');

const strToReplace = `<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-slate-700">
                    <strong>Default Port:</strong> {config?.proxy_port || 5353}
                  </p>
                </div>`;

const newStr = `<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-slate-700">
                    <strong>Default Port:</strong> {config?.proxy_port || 5353}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Note: To use standard port 53 on Linux/macOS, run the backend with sudo or use setcap cap_net_bind_service=+ep on the binary.
                  </p>
                </div>`;

content = content.replace(strToReplace, newStr);

fs.writeFileSync(file, content);
