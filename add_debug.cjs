const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// Insert import for ENV at the top if it's not there
if (!content.includes('import { ENV,')) {
    content = content.replace(/import { isSupabaseConfigured } from "@\/config\/env";/, 'import { isSupabaseConfigured, ENV } from "@/config/env";');
}

// Add the debug panel right inside the container
content = content.replace(
  /<div className="flex justify-between items-center mb-8">/,
  `<div className="mb-8 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-mono whitespace-pre overflow-x-auto">
          <strong>Debug Info:</strong>
          {JSON.stringify({ supabaseUrl: ENV.supabaseUrl, hasKey: !!ENV.supabaseAnonKey }, null, 2)}
        </div>

        <div className="flex justify-between items-center mb-8">`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', content);
