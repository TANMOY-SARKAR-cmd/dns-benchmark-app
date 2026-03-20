import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { AuthDialog } from "./AuthDialog";
import { isSupabaseConfigured } from "@/config/env";

export function AuthButton() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Logged out successfully");
      }
    } catch (error) {
      toast.error("An unexpected error occurred during logout");
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured || loading) return null;

  if (session) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        className="gap-2"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </Button>
    );
  }

  return <AuthDialog />;
}
