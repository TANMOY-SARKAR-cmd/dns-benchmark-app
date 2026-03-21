const fs = require("fs");
let content = fs.readFileSync("frontend/src/pages/Home.tsx", "utf8");

// Ensure that custom DNS works using only the backend.
// This is actually handled mostly in doh.ts, where if provider="Custom" and url is empty/invalid, it does not fallback properly or fails gracefully.
// Let's modify doh.ts previously. Actually, in doh.ts we already fail early if it is custom and url is not https.
// We just need to make sure it runs the server first. `api/dns-query.ts` handles the customIp properly.

// Let's make sure the Custom provider is loaded from user_preferences when Home.tsx mounts.
content = content.replace(
  `    if (user) {
      fetchMonitors();
    }`,
  `    if (user) {
      fetchMonitors();
      fetchPreferences();
    }`
);

content = content.replace(
  `  const fetchMonitors = async () => {`,
  `  const fetchPreferences = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data && data.custom_dns && Array.isArray(data.custom_dns) && data.custom_dns.length > 0) {
        const customIp = data.custom_dns[0];
        setCustomIp(customIp);
        setUserProviders([
          ...DOH_PROVIDERS,
          {
            name: "Custom",
            url: "",
            customIp,
            color: "#8b5cf6",
            format: "json",
          },
        ]);
      }
    } catch (e) {
      console.error("Preferences fetch error:", e);
    }
  };

  const fetchMonitors = async () => {`
);

fs.writeFileSync("frontend/src/pages/Home.tsx", content);
