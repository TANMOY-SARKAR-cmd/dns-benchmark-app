const fs = require("fs");
let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf-8");

// Fetch Leaderboard
let newLeaderboardFetch = `    try {
      const { data, error } = await supabase.from("leaderboard").select("*");
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      setLeaderboard(data || []);
    } catch (e) {
      console.error("Leaderboard fetch error", e);
    }`;
content = content.replace(/    try \{\n      const \{ data, error \} = await supabase.from\("leaderboard"\).select\("\*"\);\n      if \(error\) throw error;\n      setLeaderboard\(data \|\| \[\]\);\n    \} catch \(e\) \{\n      console.error\("Leaderboard fetch error", e\);\n    \}/g, newLeaderboardFetch);

// Fetch History
let newHistoryFetch = `    try {
      const { data, error } = await supabase
        .from("benchmark_results")
        .select("*")
        .order("tested_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      setHistory(data || []);
    } catch (e) {
      console.error("History fetch error", e);
    }`;
content = content.replace(/    try \{\n      const \{ data, error \} = await supabase\n        .from\("benchmark_results"\)\n        .select\("\*"\)\n        .order\("tested_at", \{ ascending: false \}\)\n        .limit\(100\);\n      if \(error\) throw error;\n      setHistory\(data \|\| \[\]\);\n    \} catch \(e\) \{\n      console.error\("History fetch error", e\);\n    \}/g, newHistoryFetch);

// dns_queries insert: already has some logging but let's standardize
content = content.replace(/          if \(error\) \{\n            console.error\("Supabase insert failed for dns_queries:", error\);\n          \}/g, `          if (error) {\n            console.error("Supabase error:", error);\n          }`);

// benchmark_results insert
content = content.replace(/          if \(error\) \{\n            console.error\("Supabase insert failed for benchmark_results:", error\);\n          \}/g, `          if (error) {\n            console.error("Supabase error:", error);\n          }`);

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
console.log("Added debug logs.");
