import { LayoutDashboard, Users, UserCircle, BarChart3, LogOut, Calendar, ListTodo, Settings, UsersRound, Store, Link2, Clock, Timer, Globe, ClipboardList } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { UserAvatar } from "@/components/UserAvatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import xprtsLogoFallback from "@/assets/xprts-logo-light.png";

const allItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["team_admin", "staff_member", "client"] },
  { title: "Leads", url: "/leads", icon: Users, roles: ["team_admin"] },
  { title: "Client Profiles", url: "/clients", icon: UserCircle, roles: ["team_admin"] },
  { title: "Open Roles", url: "/open-roles", icon: Users, roles: ["team_admin"] },
  { title: "Tasks", url: "/tasks", icon: ListTodo, roles: ["team_admin", "staff_member"] },
  { title: "Staff", url: "/staff", icon: UsersRound, roles: ["team_admin"] },
  { title: "Talent Pool", url: "/talent-pool", icon: Globe, roles: ["team_admin"] },
  { title: "Calendar", url: "/calendar", icon: Calendar, roles: ["team_admin", "staff_member"] },
  { title: "Vendors", url: "/vendors", icon: Store, roles: ["team_admin", "staff_member"] },
  { title: "Links", url: "/links", icon: Link2, roles: ["team_admin"] },
  { title: "Time Planner", url: "/time-planner", icon: Clock, roles: ["team_admin", "staff_member"] },
  { title: "Projects", url: "/activities", icon: Timer, roles: ["team_admin"] },
  { title: "Analytics", url: "/analytics", icon: BarChart3, roles: ["team_admin"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["team_admin"] },
  { title: "My Profile", url: "/my-profile", icon: UserCircle, roles: ["team_admin", "client", "staff_member"] },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const items = allItems.filter((item) => role && item.roles.includes(role));
  const logoSrc = branding.logo_url || xprtsLogoFallback;

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const profilePath = "/my-profile";
  const portalLabel = role === "team_admin" ? "Team Dashboard" : role === "staff_member" ? "Staff Portal" : "Client Portal";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className={`p-4 border-b border-sidebar-border ${collapsed ? "flex justify-center px-2" : ""}`}>
        <img src={logoSrc} alt={branding.app_name} className={collapsed ? "h-6" : "h-8 mb-1"} />
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/60 mt-0.5">
            {portalLabel}
          </p>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-widest">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className="hover:bg-sidebar-accent"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        >
                          <item.icon className={collapsed ? "h-5 w-5" : "mr-2 h-4 w-4"} />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">
                        {item.title}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border ${collapsed ? "p-2" : "p-4"}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate(profilePath)}
              className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} w-full rounded-md p-2 hover:bg-sidebar-accent transition-colors text-left`}
            >
              <UserAvatar
                avatarUrl={profile?.avatar_url}
                fullName={profile?.full_name || user?.email}
                size="sm"
              />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || "My Profile"}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {user?.email}
                  </p>
                </div>
              )}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">My Profile</TooltipContent>
          )}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full ${collapsed ? "justify-center px-0" : "justify-start"} text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent`}
              onClick={signOut}
            >
              <LogOut className={collapsed ? "h-5 w-5" : "mr-2 h-4 w-4"} />
              {!collapsed && "Sign Out"}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">Sign Out</TooltipContent>
          )}
        </Tooltip>
      </SidebarFooter>
    </Sidebar>
  );
}
