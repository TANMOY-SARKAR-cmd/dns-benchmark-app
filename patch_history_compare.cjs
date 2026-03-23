const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/tabs/HistoryTab.tsx', 'utf8');

// I'll add state for compare mode
code = code.replace(
  /export function HistoryTab\({ user, history, handleKeepRecord, userProviders }: any\) {/,
  `import { useState, useRef } from "react";\nexport function HistoryTab({ user, history, handleKeepRecord, userProviders }: any) {\n  const [isCompareMode, setIsCompareMode] = useState(false);\n  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);\n  const chartRef = useRef<HTMLDivElement>(null);`
);

code = code.replace(
  /<Button\n            variant="outline"\n            size="sm"\n            onClick=\{\(\) => \{/g,
  `<Button
            variant={isCompareMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsCompareMode(!isCompareMode)}
          >
            {isCompareMode ? "Cancel Compare" : "Compare Runs"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {`
);

// Filter data for chart based on selected runs if in compare mode
code = code.replace(
  /data=\{Object\.values\(\n                    history\.reduce/,
  `data={Object.values(
                    history.filter((h: any) => !isCompareMode || selectedRuns.includes(h.id)).reduce`
);

// Add chartRef to the chart container div
code = code.replace(
  /<div className="h-\[400px\] w-full">/,
  `<div className="h-[400px] w-full" id="results-chart" ref={chartRef}>`
);

// Add Checkbox column to table
code = code.replace(
  /<th className="py-3 px-4 font-semibold">Time<\/th>/,
  `{isCompareMode && <th className="py-3 px-4 font-semibold">Select</th>}
                      <th className="py-3 px-4 font-semibold">Time</th>`
);

code = code.replace(
  /<td className="py-3 px-4">\{new Date\(record\.tested_at \|\| record\.timestamp\)\.toLocaleString\(\)\}<\/td>/,
  `{isCompareMode && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedRuns.includes(record.id)}
                              onChange={() => {
                                setSelectedRuns(prev => prev.includes(record.id) ? prev.filter(id => id !== record.id) : [...prev, record.id])
                              }}
                            />
                          </td>
                        )}
                        <td className="py-3 px-4">{new Date(record.tested_at || record.timestamp).toLocaleString()}</td>`
);

fs.writeFileSync('frontend/src/pages/tabs/HistoryTab.tsx', code);
