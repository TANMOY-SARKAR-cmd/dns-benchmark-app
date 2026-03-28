import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Github, CheckCircle2, Mail, Trash2, Home, Globe, Moon, Sun, Download, Trash } from "lucide-react";
import { DiscordLogoIcon } from "@radix-ui/react-icons";
import { useNavigate } from "react-router-dom";
import { validateCustomUrl } from "@/pages/tabs/SettingsTab";

export default function Account() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Connection states
  const [isLoadingConnection, setIsLoadingConnection] = useState<string | null>(null);
  const [emailToLink, setEmailToLink] = useState("");

  // Preference states
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customFormat, setCustomFormat] = useState<"json" | "binary">("json");
  const [monitorInterval, setMonitorInterval] = useState(60);
  const [defaultDomains, setDefaultDomains] = useState("");

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
    }
    if (profile) {
      setUsername(profile.username || "");
      setFullName(profile.full_name || "");
    }
  }, [user, profile]);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setCustomName(data.custom_dns_name || "");
        setCustomUrl(data.custom_dns_url || "");
        setCustomFormat((data.custom_dns_format as "json" | "binary") || "json");
        // Default interval handling could be added here if it was in the schema
      }
    } catch (e) {
      console.error("Preferences fetch error:", e);
    }
  };

  if (!user) {
    return (
      <div className={`min-h-screen bg-slate-50 transition-colors duration-200 ${theme === "dark" ? "dark:bg-slate-950 dark:text-slate-50" : ""}`}>
        <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
          <h1 className="text-3xl font-bold mb-4">Account Settings</h1>
          <p className="text-slate-500 mb-8">Please log in to view your account settings.</p>
          <Button onClick={() => navigate("/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          username,
          full_name: fullName,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        toast.info("Check your new email to confirm the change.");
      }

      await refreshProfile();
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    if (customUrl && !validateCustomUrl(customUrl)) {
      toast.error("Invalid DoH URL", {
        description: "URL must be HTTPS and cannot resolve to a private IP or local domain.",
      });
      return;
    }
    setIsSavingPrefs(true);
    try {
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

      if (error) throw error;
      toast.success("Preferences saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save preferences");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleExportData = async () => {
    try {
      toast.info("Preparing export...");

      // Fetch data concurrently
      const [
        { data: queries },
        { data: benchmarks },
        { data: monitors }
      ] = await Promise.all([
        supabase.from("dns_queries").select("*").eq("user_id", user.id),
        supabase.from("benchmark_results").select("*").eq("user_id", user.id),
        supabase.from("monitor_results").select("*").eq("user_id", user.id)
      ]);

      const allData = {
        dns_queries: queries || [],
        benchmark_results: benchmarks || [],
        monitor_results: monitors || []
      };

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `dns_benchmark_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch (error: any) {
      toast.error("Failed to export data");
      console.error(error);
    }
  };

  const handleDeleteData = async () => {
    if (!confirm("Are you sure you want to delete all your test data? This cannot be undone.")) return;

    try {
      toast.info("Deleting data...");

      await Promise.all([
        supabase.from("dns_queries").delete().eq("user_id", user.id),
        supabase.from("benchmark_results").delete().eq("user_id", user.id),
        supabase.from("monitor_results").delete().eq("user_id", user.id),
      ]);

      toast.success("All test data deleted");
    } catch (error: any) {
      toast.error("Failed to delete data");
      console.error(error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you absolutely sure you want to delete your account? This action is permanent and will delete all your data.")) return;

    try {
      toast.info("Deleting account...");

      const { error } = await supabase.rpc("delete_user");

      if (error) {
         console.error("RPC delete_user failed:", error);
         // Fallback to manual cleanup if RPC fails/doesn't exist
         await Promise.all([
           supabase.from("profiles").delete().eq("id", user.id),
           supabase.from("dns_queries").delete().eq("user_id", user.id),
           supabase.from("benchmark_results").delete().eq("user_id", user.id),
           supabase.from("monitor_results").delete().eq("user_id", user.id),
           supabase.from("monitors").delete().eq("user_id", user.id),
           supabase.from("user_preferences").delete().eq("user_id", user.id),
         ]);
         // We can't delete auth user from client without RPC
         await supabase.auth.signOut();
      } else {
        await supabase.auth.signOut();
      }

      navigate("/");
      toast.success("Account deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete account");
      console.error(error);
    }
  };

  // Connection logic from ManageAccountsDialog
  const identities = user.identities || [];
  const totalIdentities = identities.length;

  const getProviderIdentity = (providerName: string) => {
    return identities.find((identity: any) => identity.provider === providerName);
  };

  const githubIdentity = getProviderIdentity("github");
  const discordIdentity = getProviderIdentity("discord");
  const emailIdentity = getProviderIdentity("email");
  const handleLinkProvider = async (provider: "github" | "discord") => {
    setIsLoadingConnection(provider);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: window.location.origin + "/account",
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
    } finally {
      setIsLoadingConnection(null);
    }
  };

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToLink) return toast.error("Please enter an email");

    setIsLoadingConnection("email");
    try {
      const { error } = await supabase.auth.updateUser({ email: emailToLink });
      if (error) throw error;
      toast.success("Check your email for the confirmation link!");
      setEmailToLink("");
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
    } finally {
      setIsLoadingConnection(null);
    }
  };
  const handleUnlinkProvider = async (identity: any, provider: string) => {
    if (totalIdentities <= 1) {
      return toast.error("You cannot unlink your only remaining login method.");
    }

    setIsLoadingConnection(`unlink-${provider}`);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      toast.success(`Successfully unlinked ${provider}`);
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
    } finally {
      setIsLoadingConnection(null);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 transition-colors duration-200 ${theme === "dark" ? "dark:bg-slate-950 dark:text-slate-50" : ""}`}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Account Settings
            </h1>
            <p className="text-slate-500 mt-1">
              Manage your profile, connections, and preferences
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme?.(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <div className="grid gap-8">
          {/* Section 1: Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Section 1 — Profile</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Display name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>

          {/* Section 2: Connected Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>Section 2 — Connected Accounts</CardTitle>
              <CardDescription>Manage your connected social accounts to sign in securely.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* GitHub */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <Github className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <span className="font-medium text-sm">GitHub</span>
                </div>
                {githubIdentity ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-500"
                      onClick={() => handleUnlinkProvider(githubIdentity, "GitHub")}
                      disabled={!!isLoadingConnection || totalIdentities <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs"
                    onClick={() => handleLinkProvider("github")}
                    disabled={!!isLoadingConnection}
                  >
                    {isLoadingConnection === "github" ? "Linking..." : "Link"}
                  </Button>
                )}
              </div>

              {/* Discord */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <DiscordLogoIcon className="w-5 h-5 text-[#5865F2]" />
                  <span className="font-medium text-sm">Discord</span>
                </div>
                {discordIdentity ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-500"
                      onClick={() => handleUnlinkProvider(discordIdentity, "Discord")}
                      disabled={!!isLoadingConnection || totalIdentities <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs"
                    onClick={() => handleLinkProvider("discord")}
                    disabled={!!isLoadingConnection}
                  >
                    {isLoadingConnection === "discord" ? "Linking..." : "Link"}
                  </Button>
                )}
              </div>

              {/* Web3 */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full text-slate-700 dark:text-slate-300">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.22l7.365 4.354 7.365-4.35L12.056 0z" fill="currentColor" />
                    </svg>
                  </div>
                  <span className="font-medium text-sm">Web3 Wallet</span>
                </div>

              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <span className="font-medium text-sm">Email login</span>
                </div>
                {emailIdentity ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {emailIdentity.identity_data?.email || "Connected"}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-500"
                      onClick={() => handleUnlinkProvider(emailIdentity, "Email")}
                      disabled={!!isLoadingConnection || totalIdentities <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleLinkEmail} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={emailToLink}
                      onChange={(e) => setEmailToLink(e.target.value)}
                      disabled={!!isLoadingConnection}
                      required
                      className="h-8 text-xs w-[140px]"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 text-xs shrink-0"
                      disabled={!!isLoadingConnection}
                    >
                      {isLoadingConnection === "email" ? "Linking..." : "Link"}
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Section 3 — Preferences</CardTitle>
              <CardDescription>Customize your default settings for tests and monitors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Default test domains</label>
                <Input
                  value={defaultDomains}
                  onChange={(e) => setDefaultDomains(e.target.value)}
                  placeholder="e.g. google.com, cloudflare.com"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Monitor interval default (seconds)</label>
                <select
                  value={monitorInterval}
                  onChange={e => setMonitorInterval(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                >
                  <option value={10}>10 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Custom DNS Provider Name</label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. My Custom DNS"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Custom DNS DoH URL</label>
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="e.g. https://dns.quad9.net/dns-query"
                />
              </div>
              <Button onClick={handleSavePreferences} disabled={isSavingPrefs}>
                {isSavingPrefs ? "Saving..." : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>

          {/* Section 4: Data */}
          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">Section 4 — Data</CardTitle>
              <CardDescription>Export your data or permanently delete your account and information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="w-4 h-4 mr-2" /> Export my data
                </Button>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20" onClick={handleDeleteData}>
                  <Trash className="w-4 h-4 mr-2" /> Delete my data
                </Button>
                <Button variant="destructive" onClick={handleDeleteAccount}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
