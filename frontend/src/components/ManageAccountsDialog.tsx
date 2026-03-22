import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Github, CheckCircle2, Mail, Trash2 } from "lucide-react";
import { DiscordLogoIcon } from "@radix-ui/react-icons";
import { useAuth } from "@/contexts/AuthContext";

interface ManageAccountsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageAccountsDialog({
  isOpen,
  onOpenChange,
}: ManageAccountsDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [emailToLink, setEmailToLink] = useState("");

  if (!user) return null;

  // The identities array from the user object
  const identities = user.identities || [];
  const totalIdentities = identities.length;

  // Check which providers are already linked
  const getProviderIdentity = (providerName: string) => {
    return identities.find((identity: any) => identity.provider === providerName);
  };

  const githubIdentity = getProviderIdentity("github");
  const discordIdentity = getProviderIdentity("discord");
  const emailIdentity = getProviderIdentity("email");
  // Adjust based on how Supabase represents Web3 identities
  const web3Identity = getProviderIdentity("ethereum");

  const handleLinkProvider = async (
    provider: "github" | "discord"
  ) => {
    setIsLoading(provider);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message);
        console.error("Link identity error:", error);
      } else {
        // Redirection should happen
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToLink) {
      toast.error("Please enter an email");
      return;
    }

    setIsLoading("email");
    try {
      const { error } = await supabase.auth.updateUser({ email: emailToLink });

      if (error) {
        toast.error(error.message);
        console.error("Link identity error:", error);
      } else {
        toast.success("Check your email for the confirmation link to complete linking!");
        setEmailToLink("");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleLinkWeb3 = async () => {
    setIsLoading("web3");
    try {
      // Supabase signInWithWeb3 can act as linking if the user is already authenticated
      // Note: This relies on the frontend SDK version
      // @ts-ignore
      const { error } = await supabase.auth.linkIdentity({
        provider: "ethereum",
        // @ts-ignore (fallback if linkIdentity Web3 behaves differently)
        chain: "ethereum",
      });

      if (error) {
        toast.error(error.message);
        console.error("Link identity error:", error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleUnlinkProvider = async (identity: any, provider: string) => {
    if (totalIdentities <= 1) {
      toast.error("You cannot unlink your only remaining login method.");
      return;
    }

    setIsLoading(`unlink-${provider}`);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);

      if (error) {
        toast.error(error.message);
        console.error("Unlink identity error:", error);
      } else {
        toast.success(`Successfully unlinked ${provider}`);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Linked Accounts</DialogTitle>
          <DialogDescription>
            Manage your connected social accounts to sign in securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col gap-3">
            {/* GitHub */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Github className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <span className="font-medium text-sm">GitHub</span>
              </div>
              {githubIdentity ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    connected
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-500"
                    onClick={() => handleUnlinkProvider(githubIdentity, "GitHub")}
                    disabled={!!isLoading || totalIdentities <= 1}
                    title="Unlink GitHub"
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
                  disabled={!!isLoading}
                >
                  {isLoading === "github" ? "Linking..." : "Link"}
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
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    connected
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-500"
                    onClick={() => handleUnlinkProvider(discordIdentity, "Discord")}
                    disabled={!!isLoading || totalIdentities <= 1}
                    title="Unlink Discord"
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
                  disabled={!!isLoading}
                >
                  {isLoading === "discord" ? "Linking..." : "Link"}
                </Button>
              )}
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <span className="font-medium text-sm">Email</span>
              </div>
              {emailIdentity ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {emailIdentity.identity_data?.email || "connected"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-500"
                    onClick={() => handleUnlinkProvider(emailIdentity, "Email")}
                    disabled={!!isLoading || totalIdentities <= 1}
                    title="Unlink Email"
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
                    disabled={!!isLoading}
                    required
                    className="h-8 text-xs w-[140px]"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs shrink-0"
                    disabled={!!isLoading}
                  >
                    {isLoading === "email" ? "Linking..." : "Link"}
                  </Button>
                </form>
              )}
            </div>

            {/* Web3 */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full text-slate-700 dark:text-slate-300">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3 h-3"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.22l7.365 4.354 7.365-4.35L12.056 0z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <span className="font-medium text-sm">Web3 Wallet</span>
              </div>
              {web3Identity ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    connected
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-500"
                    onClick={() => handleUnlinkProvider(web3Identity, "Web3 Wallet")}
                    disabled={!!isLoading || totalIdentities <= 1}
                    title="Unlink Web3 Wallet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={handleLinkWeb3}
                  disabled={!!isLoading}
                >
                  {isLoading === "web3" ? "Linking..." : "Link"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
