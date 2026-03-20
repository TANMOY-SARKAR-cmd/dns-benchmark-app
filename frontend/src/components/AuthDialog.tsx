import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { LogIn, Github } from "lucide-react";
import { DiscordLogoIcon } from "@radix-ui/react-icons";

export function AuthDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOAuthLogin = async (
    provider: "github" | "discord" | "gitlab"
  ) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message);
        console.error("Auth error:", error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeb3Login = async () => {
    setIsLoading(true);
    try {
      // @ts-ignore - Supabase types might not include signInWithWeb3 yet
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
      });

      if (error) {
        toast.error(error.message);
        console.error("Auth error:", error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LogIn className="w-4 h-4" />
          Login
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Choose a provider to sign in to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              type="button"
              disabled={isLoading}
              onClick={() => handleOAuthLogin("github")}
              className="gap-2"
            >
              <Github className="w-4 h-4" />
              GitHub
            </Button>

            <Button
              variant="outline"
              type="button"
              disabled={isLoading}
              onClick={() => handleOAuthLogin("discord")}
              className="gap-2"
            >
              <DiscordLogoIcon className="w-4 h-4" />
              Discord
            </Button>

            <Button
              variant="outline"
              type="button"
              disabled={isLoading}
              onClick={() => handleOAuthLogin("gitlab")}
              className="gap-2"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
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
              GitLab
            </Button>

            <Button
              variant="outline"
              type="button"
              disabled={isLoading}
              onClick={handleWeb3Login}
              className="gap-2"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.22l7.365 4.354 7.365-4.35L12.056 0z"
                  fill="currentColor"
                />
              </svg>
              Web3
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
