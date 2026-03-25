const fs = require('fs');

const file = 'frontend/src/pages/Home.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchStr = `      // Save to Supabase (only when configured and user is logged in)
      if (isSupabaseConfigured && user && allQueries.length > 0) {
        // Insert queries in batches of 50
        for (let i = 0; i < allQueries.length; i += 50) {
          const batch = allQueries.slice(i, i + 50);
          const { error } = await supabase.from("dns_queries").insert(batch);
          if (error) {
            console.error("Supabase error:", error);
          }
        }`;

const replaceStr = `      // Save to Supabase (only when configured and user is logged in)
      if (isSupabaseConfigured && user && allQueries.length > 0) {
        // Insert queries in batches of 50 concurrently
        const insertPromises = [];
        for (let i = 0; i < allQueries.length; i += 50) {
          const batch = allQueries.slice(i, i + 50);
          insertPromises.push(
            supabase.from("dns_queries").insert(batch).then(({ error }) => {
              if (error) {
                console.error("Supabase error:", error);
              }
            })
          );
        }
        await Promise.all(insertPromises);`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(file, content);
  console.log('File successfully patched!');
} else {
  console.log('Search string not found.');
}
