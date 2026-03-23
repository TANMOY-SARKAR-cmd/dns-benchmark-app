const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// 1. Add Skeleton import
code = code.replace(
  /import { Progress } from "@\/components\/ui\/progress";/,
  'import { Progress } from "@/components/ui/progress";\nimport { Skeleton } from "@/components/ui/skeleton";'
);

// 2. Add fetching state
code = code.replace(
  /const \[session, setSession\] = useState<any>\(null\);/,
  'const [session, setSession] = useState<any>(null);\n  const [isFetchingData, setIsFetchingData] = useState(true);'
);

code = code.replace(
  /fetchPersonalBest\(\);/,
  'fetchPersonalBest();\n    setIsFetchingData(false);'
);

// 3. Leaderboard Skeleton
code = code.replace(
  /<div className="space-y-6">/,
  `{isFetchingData ? (
                      <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-[400px] w-full" />
                      </div>
                    ) : (
                    <div className="space-y-6">`
);

// Close the leaderboard ternary condition
code = code.replace(
  /<\/div>\n                  <\/div>\n                \)}\n              <\/CardContent>/,
  `</div>\n                  </div>\n                )}\n              </CardContent>`
);

// Wait, the previous block is `<div className="space-y-6"> ... </div>` so I need to close the `)` at the end of the div.
code = code.replace(
  /<\/div>\n                  <\/div>\n                \)}\n              <\/CardContent>/,
  `</div>\n                  </div>\n                  )}` // Replace `)}` with `)}`
); // Let's use a safer regex:

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
