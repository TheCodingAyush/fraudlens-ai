import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import ClaimSubmission from "./pages/ClaimSubmission";
import Dashboard from "./pages/Dashboard";
import ClaimDetail from "./pages/ClaimDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyClaims from "./pages/MyClaims";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Protected route wrapper for admin pages
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/my-claims" replace />;
  }

  return <>{children}</>;
};

// Protected route wrapper for authenticated users
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  }

  return <>{children}</>;
};

// Redirect if already logged in
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to={isAdmin ? "/dashboard" : "/my-claims"} replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            {/* Protected routes within Layout */}
            <Route element={<Layout />}>
              {/* User routes */}
              <Route path="/submit" element={<ProtectedRoute><ClaimSubmission /></ProtectedRoute>} />
              <Route path="/my-claims" element={<ProtectedRoute><MyClaims /></ProtectedRoute>} />
              <Route path="/claim/:id" element={<ProtectedRoute><ClaimDetail /></ProtectedRoute>} />

              {/* Admin routes */}
              <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
