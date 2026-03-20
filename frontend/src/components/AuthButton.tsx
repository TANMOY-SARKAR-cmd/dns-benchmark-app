import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { LogOut, User as UserIcon } from "lucide-react";
import { AuthDialog } from "./AuthDialog";
import { isSupabaseConfigured } from "@/config/env";
import { useAuth } from "@/contexts/AuthContext";
import { UsernameSetupModal } from "./UsernameSetupModal";

export function AuthButton() {
  const { user, profile, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        console.error("Auth error:", error);
      } else {
        toast.success("Logged out successfully");
      }
    } catch (error) {
      toast.error("An unexpected error occurred during logout");
      console.error(error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!isSupabaseConfigured || isLoading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-4">
        {(!profile?.username || profile?.username?.startsWith("user_")) && (
          <UsernameSetupModal />
        )}
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <UserIcon className="w-4 h-4" />
          <span className="hidden sm:inline">
            Logged in as {profile?.username || user.email || "user"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="gap-2"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
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
