const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/tabs/HistoryTab.tsx', 'utf8');

code = code.replace(
  /import Papa from "papaparse";/,
  `import Papa from "papaparse";\nimport html2canvas from "html2canvas";`
);

// We need to add an export PNG button next to Export JSON
code = code.replace(
  /<Download className="w-4 h-4 mr-2" \/>\n            Export JSON\n          <\/Button>\n        <\/div>/,
  `<Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (chartRef.current) {
                const canvas = await html2canvas(chartRef.current);
                const dataUrl = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                link.href = dataUrl;
                link.download = "dns_benchmark_chart.png";
                link.click();
              }
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export PNG
          </Button>
        </div>`
);

fs.writeFileSync('frontend/src/pages/tabs/HistoryTab.tsx', code);
