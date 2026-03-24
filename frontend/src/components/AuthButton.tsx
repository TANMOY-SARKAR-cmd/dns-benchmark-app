import { useState } from "react";
import { Button } from "@/components/ui/button";
import { User as UserIcon } from "lucide-react";
import { AuthDialog } from "./AuthDialog";
import { isSupabaseConfigured } from "@/config/env";
import { useAuth } from "@/contexts/AuthContext";
import { UsernameSetupModal } from "./UsernameSetupModal";
import { AccountPanel } from "./AccountPanel";
import { isDefaultUsername } from "@/lib/utils";

export function AuthButton() {
  const { user, profile, isLoading } = useAuth();

  if (!isSupabaseConfigured || isLoading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-4">
        {isDefaultUsername(profile?.username) && <UsernameSetupModal />}
        <AccountPanel />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-slate-500 italic">
        <UserIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Using as Guest</span>
      </div>
      <AuthDialog />
    </div>
  );
}
