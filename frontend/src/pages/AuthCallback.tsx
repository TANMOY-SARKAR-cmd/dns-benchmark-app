import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Log all params to debug
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);

        // Supabase often puts tokens in the hash or the query string
        const errorDescription = hashParams.get("error_description") || searchParams.get("error_description");
        if (errorDescription) {
          throw new Error(errorDescription);
        }

        const code = searchParams.get("code");

        if (code) {
          // PKCE flow
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // Implicit flow handles sessions automatically via the Supabase client
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) {
            // Give the supabase client a moment to parse the hash fragment
            await new Promise(resolve => setTimeout(resolve, 500));
            const { data: retryData, error: retryError } = await supabase.auth.getSession();
            if (retryError) throw retryError;
            if (!retryData.session) {
               throw new Error("No session found in callback.");
            }
          }
        }

        toast.success("Successfully logged in!");
        // We use window.location.href or navigate("/") depending on needs, but navigate("/") is smoother
        navigate("/", { replace: true });

      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "An error occurred during login.");
        toast.error("Login failed: " + (err.message || "Unknown error"));

        // redirect after a short delay so the user can see the error
        setTimeout(() => {
           navigate("/", { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      {error ? (
        <div className="max-w-md w-full p-6 bg-destructive/10 rounded-lg border border-destructive text-destructive">
          <h2 className="text-xl font-semibold mb-2">Login Failed</h2>
          <p>{error}</p>
          <p className="mt-4 text-sm opacity-80">Redirecting to home...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Completing login...</h2>
          <p className="text-muted-foreground">Please wait while we verify your credentials.</p>
        </div>
      )}
    </div>
  );
}
