import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Account from "./pages/Account";
import AuthCallback from "./pages/AuthCallback";

function Router() {
  return (
    <Routes>
      <Route path="/" element={<Home tab="benchmark" />} />
      <Route path="/logs" element={<Home tab="logs" />} />
      <Route path="/monitors" element={<Home tab="monitors" />} />
      <Route path="/history" element={<Home tab="history" />} />
      <Route path="/leaderboard" element={<Home tab="leaderboard" />} />
      <Route path="/settings" element={<Home tab="settings" />} />
      <Route path="/account" element={<Account />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/404" element={<NotFound />} />
      {/* Final fallback route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Router />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
