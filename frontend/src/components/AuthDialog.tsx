declare global {
  interface Window {
    ethereum?: any;
  }
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/utils/supabaseClient";
import { toast } from "sonner";
import { LogIn, Github, Mail } from "lucide-react";
import { DiscordLogoIcon } from "@radix-ui/react-icons";

export function AuthDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const handleOAuthLogin = async (
    provider: "github" | "discord"
  ) => {
    setIsLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
      setIsLoading(null);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setIsLoading("email");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
        console.error("Auth error:", error);
      } else {
        toast.success("Check your email for the login link!");
        setIsOpen(false);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };



  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open);
        if (!open) setEmail("");
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
          <form onSubmit={handleEmailLogin} className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!isLoading}
                required
              />
              <Button type="submit" disabled={!!isLoading} className="gap-2 shrink-0">
                <Mail className="w-4 h-4" />
                {isLoading === "email" ? "Sending..." : "Email Link"}
              </Button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            size="lg"
            disabled={!!isLoading}
            onClick={() => handleOAuthLogin("github")}
            className="w-full justify-start gap-3 px-4"
          >
            <Github className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <span className="flex-1 text-left">Continue with GitHub</span>
            {isLoading === "github" && (
              <span className="text-xs">Loading...</span>
            )}
          </Button>

          <Button
            variant="outline"
            type="button"
            size="lg"
            disabled={!!isLoading}
            onClick={() => handleOAuthLogin("discord")}
            className="w-full justify-start gap-3 px-4"
          >
            <DiscordLogoIcon className="w-5 h-5 text-[#5865F2]" />
            <span className="flex-1 text-left">Continue with Discord</span>
            {isLoading === "discord" && (
              <span className="text-xs">Loading...</span>
            )}
          </Button>

              </div>
      </DialogContent>
    </Dialog>
  );
}
