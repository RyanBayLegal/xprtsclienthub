import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Clients from "./pages/Clients";
import ClientProfile from "./pages/ClientProfile";
import MyProfile from "./pages/MyProfile";
import Analytics from "./pages/Analytics";
import CalendarPage from "./pages/CalendarPage";
import Tasks from "./pages/Tasks";
import Staff from "./pages/Staff";
import Settings from "./pages/Settings";
import Vendors from "./pages/Vendors";
import Links from "./pages/Links";
import TimePlanner from "./pages/TimePlanner";
import Activities from "./pages/Activities";
import OpenRoles from "./pages/OpenRoles";
import TalentPool from "./pages/TalentPool";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import AuditLogs from "./pages/AuditLogs";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function TeamRoute({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "team_admin") return <Navigate to="/my-profile" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <BrandingProvider>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute><TeamRoute><Leads /></TeamRoute></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute><TeamRoute><Clients /></TeamRoute></ProtectedRoute>} />
                <Route path="/clients/:id" element={<ProtectedRoute><TeamRoute><ClientProfile /></TeamRoute></ProtectedRoute>} />
                <Route path="/open-roles" element={<ProtectedRoute><TeamRoute><OpenRoles /></TeamRoute></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><TeamRoute><Analytics /></TeamRoute></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><TeamRoute><CalendarPage /></TeamRoute></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><TeamRoute><Tasks /></TeamRoute></ProtectedRoute>} />
                <Route path="/staff" element={<ProtectedRoute><TeamRoute><Staff /></TeamRoute></ProtectedRoute>} />
                <Route path="/talent-pool" element={<ProtectedRoute><TeamRoute><TalentPool /></TeamRoute></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><TeamRoute><Settings /></TeamRoute></ProtectedRoute>} />
                <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
                <Route path="/links" element={<ProtectedRoute><TeamRoute><Links /></TeamRoute></ProtectedRoute>} />
                <Route path="/time-planner" element={<ProtectedRoute><TimePlanner /></ProtectedRoute>} />
                <Route path="/activities" element={<ProtectedRoute><TeamRoute><Activities /></TeamRoute></ProtectedRoute>} />
                <Route path="/audit-logs" element={<ProtectedRoute><TeamRoute><AuditLogs /></TeamRoute></ProtectedRoute>} />
                <Route path="/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrandingProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
