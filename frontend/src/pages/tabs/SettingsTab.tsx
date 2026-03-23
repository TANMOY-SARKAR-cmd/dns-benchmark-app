import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/ui/EmptyState";
import { DOH_PROVIDERS } from "@/lib/doh";

export function SettingsTab({ user, customName, setCustomName, customUrl, setCustomUrl, setUserProviders }: any) {
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
              </div>
              <div className="flex justify-end mt-2">
                <Button
                  onClick={async () => {
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
                            format: "json",
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
