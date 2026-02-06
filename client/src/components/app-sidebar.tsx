import {
  LayoutDashboard,
  Users,
  Server,
  FileText,
  Settings,
  Building2,
  MapPin,
  KeyRound,
  Key,
  Code,
  Webhook,
  Shield,
  Activity,
  ClipboardList,
  Home,
} from "lucide-react";
import logoImage from "@assets/ShotgunNinjaVaulticon_1770412982737.png";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronUp } from "lucide-react";
import type { MemberRole } from "@shared/schema";

interface AppSidebarProps {
  role: MemberRole;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const isClient = role === "CLIENT";
  const isAdminOrOwner = role === "OWNER" || role === "ADMIN";

  const portalNavItems = isClient
    ? [
        { title: "Portal", url: "/portal", icon: Home, show: true },
        { title: "My Evidence", url: "/portal/evidence", icon: FileText, show: true },
      ].filter((item) => item.show)
    : [];

  const mainNavItems = isClient
    ? []
    : [
        { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
        { title: "Clients", url: "/clients", icon: Users, show: true },
        { title: "Sites", url: "/sites", icon: MapPin, show: true },
        { title: "Assets", url: "/assets", icon: Server, show: true },
        { title: "Evidence", url: "/evidence", icon: FileText, show: true },
        { title: "Reports", url: "/reports", icon: ClipboardList, show: true },
      ].filter((item) => item.show);

  const licenseNavItems = [
    { title: "Licenses", url: "/licenses", icon: Key, show: isAdminOrOwner },
    { title: "Developer", url: "/licenses/developer", icon: Code, show: isAdminOrOwner },
  ].filter((item) => item.show);

  const adminNavItems = [
    { title: "Status", url: "/status-admin", icon: Activity, show: isAdminOrOwner },
    { title: "Webhooks", url: "/webhooks", icon: Webhook, show: isAdminOrOwner },
    { title: "Team", url: "/team", icon: Building2, show: isAdminOrOwner },
    { title: "Client Access", url: "/client-access", icon: KeyRound, show: isAdminOrOwner },
    { title: "Audit Log", url: "/audit", icon: Shield, show: isAdminOrOwner },
    { title: "Settings", url: "/settings", icon: Settings, show: !isClient },
  ].filter((item) => item.show);

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`
    : "?";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <img
              src={logoImage}
              alt="Shotgun Ninja Vault"
              className="w-8 h-8 rounded-md object-cover"
            />
            <div>
              <h2 className="text-sm font-semibold tracking-tight leading-none">
                Shotgun Ninja
              </h2>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">
                Vault
              </p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {portalNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Client Portal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {portalNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        item.url === "/portal"
                          ? location === "/portal"
                          : location.startsWith(item.url)
                      }
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {mainNavItems.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.url === "/"
                        ? location === "/"
                        : location.startsWith(item.url)
                    }
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
        {licenseNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>License Server</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {licenseNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        item.url === "/licenses"
                          ? location === "/licenses"
                          : location.startsWith(item.url)
                      }
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {adminNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.startsWith(item.url)}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2"
              data-testid="button-user-menu"
            >
              <Avatar className="w-7 h-7">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left flex-1 min-w-0">
                <span className="text-sm font-medium truncate w-full">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs text-muted-foreground truncate w-full">
                  {user?.email}
                </span>
              </div>
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem asChild>
              <a href="/api/logout" data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
