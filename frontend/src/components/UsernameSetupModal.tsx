import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isDefaultUsername } from "@/lib/utils";

export function UsernameSetupModal() {
  const { user, profile, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Open modal if username is null or matches the default fallback "user_XXXXXX"
    if (profile && isDefaultUsername(profile.username)) {
      setIsOpen(true);
      setUsername(profile.username || "");
      setFullName(profile.full_name || "");
    } else {
      setIsOpen(false);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !user) return;

    // basic length validation
    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username, full_name: fullName })
        .eq("id", user.id);

      if (error) {
        if (error.code === "23505") {
          // unique violation
          toast.error("Username is already taken");
        } else {
          toast.error(error.message);
        }
        console.error("Profile update error:", error);
      } else {
        toast.success("Profile updated successfully!");
        setIsOpen(false);
        await refreshProfile();
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please set a unique username and display name to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username <span className="text-red-500">*</span></Label>
            <Input
              id="username"
              type="text"
              placeholder="e.g. awesome_user"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Display Name (optional)</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="e.g. Jane Doe"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
