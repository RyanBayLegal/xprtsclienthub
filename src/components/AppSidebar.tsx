import { LayoutDashboard, Users, UserCircle, BarChart3, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/lib/auth";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const teamItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Client Profiles", url: "/clients", icon: UserCircle },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const clientItems = [
  { title: "My Profile", url: "/my-profile", icon: UserCircle },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const items = role === "team_admin" ? teamItems : clientItems;

  return (
    <Sidebar className="border-r-0">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
          XPRTS CRM
        </h1>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">
          {role === "team_admin" ? "Team Dashboard" : "Client Portal"}
        </p>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-widest">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground/60 truncate mb-2">
          {user?.email}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
