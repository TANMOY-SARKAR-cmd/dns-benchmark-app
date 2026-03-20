import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Github, CheckCircle2 } from "lucide-react";
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

  if (!user) return null;

  // The identities array from the user object
  const identities = user.identities || [];

  // Check which providers are already linked
  const hasProvider = (providerName: string) => {
    return identities.some(identity => identity.provider === providerName);
  };

  const isGithubLinked = hasProvider("github");
  const isDiscordLinked = hasProvider("discord");
  const isGitlabLinked = hasProvider("gitlab");

  // Custom logic for Web3 if needed, assuming the provider name is 'ethereum' or similar
  // Adjust based on how Supabase represents Web3 identities
  const isWeb3Linked = hasProvider("ethereum");

  const handleLinkProvider = async (
    provider: "github" | "discord" | "gitlab"
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
              {isGithubLinked ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  connected
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
              {isDiscordLinked ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  connected
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

            {/* GitLab */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M23.955 13.587l-2.286-7.03a1.534 1.534 0 00-2.91 0l-1.464 4.502H6.705L5.24 6.557a1.534 1.534 0 00-2.91 0l-2.286 7.03c-.22.673-.027 1.417.498 1.888l11.458 8.64a.765.765 0 00.902 0l11.458-8.64c.525-.47.717-1.215.498-1.888z"
                    fill="#FC6D26"
                  />
                  <path
                    d="M12 24.116L24.455 15.48h-8.214L12 24.116z"
                    fill="#E24329"
                  />
                  <path
                    d="M12 24.116L-.455 15.48h8.214L12 24.116z"
                    fill="#E24329"
                  />
                  <path
                    d="M6.705 11.06H1.465l1.91-5.877c.22-.676 1.157-.676 1.378 0l1.952 5.877z"
                    fill="#FCA326"
                  />
                  <path
                    d="M17.295 11.06h5.24l-1.91-5.877c-.22-.676-1.157-.676-1.378 0l-1.952 5.877z"
                    fill="#FCA326"
                  />
                </svg>
                <span className="font-medium text-sm">GitLab</span>
              </div>
              {isGitlabLinked ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  connected
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={() => handleLinkProvider("gitlab")}
                  disabled={!!isLoading}
                >
                  {isLoading === "gitlab" ? "Linking..." : "Link"}
                </Button>
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
              {isWeb3Linked ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  connected
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
