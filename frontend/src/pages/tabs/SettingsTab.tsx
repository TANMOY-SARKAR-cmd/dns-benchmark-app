import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/ui/EmptyState";
import { DOH_PROVIDERS } from "@/lib/doh";


export function validateCustomUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    // Block private IP ranges
    const hostname = parsed.hostname;
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipPattern);
    if (match) {
      const parts = match.slice(1, 5).map(Number);
      if (
        parts[0] === 127 ||
        parts[0] === 10 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      ) {
        return false;
      }
    }

    // Block local domains
    if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function SettingsTab({ user, customName, setCustomName, customUrl, setCustomUrl, customFormat, setCustomFormat, setUserProviders }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings & Preferences</CardTitle>
        <CardDescription>
          Configure custom DNS providers and behavior
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!user ? (
          <EmptyState
            icon={AlertCircle}
            title="Authentication Required"
            description="Please log in to manage settings."
          />
        ) : (
          <div className="space-y-6 max-w-md">
            <div className="space-y-4">
              <h3 className="text-sm font-medium mb-2">Custom DNS Provider</h3>
              <div className="grid gap-2">
                <Input
                  placeholder="Provider Name (e.g. My Custom DNS)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
                <Input
                  placeholder="DoH URL (e.g. https://dns.quad9.net/dns-query)"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
                <select
                  value={customFormat}
                  onChange={(e) => setCustomFormat(e.target.value as "json" | "binary")}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                >
                  <option value="json">JSON</option>
                  <option value="binary">Binary (DNS-wire)</option>
                </select>
              </div>
              <div className="flex justify-end mt-2">
                <Button
                  onClick={async () => {
                    if (customUrl && !validateCustomUrl(customUrl)) {
                      toast.error("Invalid DoH URL", {
                        description: "URL must be HTTPS and cannot resolve to a private IP or local domain.",
                      });
                      return;
                    }
                    if (!user) {
                      toast.error("Login required", {
                        description: "You must be logged in to save settings.",
                      });
                      return;
                    }
                    const { error } = await supabase
                      .from("user_preferences")
                      .upsert(
                        {
                          user_id: user.id,
                          custom_dns_name: customName || null,
                          custom_dns_url: customUrl || null,
                          custom_dns_format: customFormat || "json",
                        },
                        { onConflict: "user_id" }
                      );
                    if (error) {
                      toast.error("Failed to save settings");
                    } else {
                      toast.success("Settings saved!");
                      if (customName && customUrl) {
                        setUserProviders([
                          ...DOH_PROVIDERS,
                          {
                            key: "custom",
                            name: customName,
                            url: customUrl,
                            color: "#8b5cf6",
                            format: customFormat || "json",
                          },
                        ]);
                      } else {
                        setUserProviders([...DOH_PROVIDERS]);
                      }
                    }
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Provide a valid DoH endpoint URL for a custom DNS resolver. This will add your provider to the benchmark list.
              </p>
            </div>
            <div className="pt-6 border-t dark:border-slate-800"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
