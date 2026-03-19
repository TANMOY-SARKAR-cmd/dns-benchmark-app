const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// Debugging output to see if the regexes find matches
console.log("Replacing queries logic:", content.includes('allQueries.push({'));

content = content.replace(
  /allQueries\.push\(\{[\s\S]*?success: true,\n\s*\}\);/g,
  `allQueries.push({
                      user_id: "anonymous",
                      domain,
                      provider: provider.name,
                      latency_ms: result.avgLatency,
                      success: true,
                      created_at: new Date().toISOString()
                    });`
);

content = content.replace(
  /allQueries\.push\(\{[\s\S]*?success: false,\n\s*\}\);/g,
  `allQueries.push({
                    user_id: "anonymous",
                    domain,
                    provider: provider.name,
                    latency_ms: 0,
                    success: false,
                    created_at: new Date().toISOString()
                  });`
);

content = content.replace(
  /avg_latency: Math\.round\(total \/ count\),\n\s*\}\)\n\s*\);/g,
  `avg_latency: Math.round(total / count),
            created_at: new Date().toISOString()
          })
        );`
);

content = content.replace(
  /for \(let i = 0; i < allQueries\.length; i \+= 50\) \{\n\s*await supabase\n\s*\.from\("dns_queries"\)\n\s*\.insert\(allQueries\.slice\(i, i \+ 50\)\);\n\s*\}/g,
  `for (let i = 0; i < allQueries.length; i += 50) {
          const batch = allQueries.slice(i, i + 50);
          console.log("Inserting DNS queries:", batch);
          const { error } = await supabase
            .from("dns_queries")
            .insert(batch);
          if (error) {
            console.error("Supabase insert failed for dns_queries:", error);
          }
        }`
);

content = content.replace(
  /if \(benchmarkResults\.length > 0\) \{\n\s*await supabase\.from\("benchmark_results"\)\.insert\(benchmarkResults\);\n\s*\}/g,
  `if (benchmarkResults.length > 0) {
          console.log("Inserting benchmark results:", benchmarkResults);
          const { error } = await supabase.from("benchmark_results").insert(benchmarkResults);
          if (error) {
            console.error("Supabase insert failed for benchmark_results:", error);
          }
        }`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', content);
