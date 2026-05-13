import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { SessionWarningDialog } from "@/components/SessionWarningDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const profilePath = "/my-profile";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="relative flex-1 flex flex-col">
          {/* Floating sidebar trigger at the edge, vertically centered */}
          <SidebarTrigger className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 h-8 w-8 rounded-full border bg-card shadow-md hover:bg-muted" />
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 gap-2">
            <div className="flex-1 flex items-center pl-6">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <NotificationBell />
              <button
                onClick={() => navigate(profilePath)}
                className="rounded-full hover:ring-2 hover:ring-primary/50 transition-all"
                title="My Profile"
              >
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  fullName={profile?.full_name || user?.email}
                  size="sm"
                />
              </button>
            </div>
          </header>
          <div className="flex-1 p-6 overflow-auto">{children}</div>
        </div>
      </div>
      <SessionWarningDialog />
    </SidebarProvider>
  );
}
