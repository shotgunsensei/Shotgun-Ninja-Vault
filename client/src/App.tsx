import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import {
  LandingPage,
  OnboardingPage,
  DashboardPage,
  ClientsPage,
  ClientDetailPage,
  SitesPage,
  AssetsPage,
  TeamPage,
  AuditPage,
  ClientAccessPage,
  SettingsPage,
} from "@/modules/core";

import {
  EvidencePage,
  EvidenceUploadPage,
  EvidenceDetailPage,
} from "@/modules/evidence";

import {
  LicensesPage,
  DeveloperPage,
} from "@/modules/license";

import { WebhooksPage } from "@/modules/webhooks";
import { StatusAdminPage, PublicStatusPage } from "@/modules/status";
import { ReportsPage } from "@/modules/reports";
import { PortalHomePage, PortalClientDetailPage, PortalEvidencePage } from "@/modules/portal";

import NotFound from "@/pages/not-found";

import type { TenantWithMember } from "@/lib/types";

function AuthenticatedApp() {
  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantWithMember | null>({
    queryKey: ["/api/tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load tenant");
      return res.json();
    },
  });

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-3 w-64">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!tenantInfo) {
    return <OnboardingPage />;
  }

  const role = tenantInfo.role as "OWNER" | "ADMIN" | "TECH" | "CLIENT";
  const isClient = role === "CLIENT";
  const isAdminOrOwner = role === "OWNER" || role === "ADMIN";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar role={role} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-2 border-b sticky top-0 z-50 bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              {isClient ? (
                <Route path="/">{() => <Redirect to="/portal" />}</Route>
              ) : (
                <Route path="/" component={DashboardPage} />
              )}
              {isClient && <Route path="/portal" component={PortalHomePage} />}
              {isClient && <Route path="/portal/clients/:id" component={PortalClientDetailPage} />}
              {isClient && <Route path="/portal/evidence" component={PortalEvidencePage} />}
              {!isClient && <Route path="/clients" component={ClientsPage} />}
              {!isClient && <Route path="/clients/:id" component={ClientDetailPage} />}
              {!isClient && <Route path="/sites" component={SitesPage} />}
              {!isClient && <Route path="/assets" component={AssetsPage} />}
              {!isClient && <Route path="/evidence" component={EvidencePage} />}
              {!isClient && <Route path="/evidence/upload" component={EvidenceUploadPage} />}
              {!isClient && <Route path="/evidence/:id" component={EvidenceDetailPage} />}
              {isAdminOrOwner && <Route path="/team" component={TeamPage} />}
              {isAdminOrOwner && <Route path="/audit" component={AuditPage} />}
              {isAdminOrOwner && <Route path="/client-access" component={ClientAccessPage} />}
              {isAdminOrOwner && <Route path="/licenses" component={LicensesPage} />}
              {isAdminOrOwner && <Route path="/licenses/developer" component={DeveloperPage} />}
              {isAdminOrOwner && <Route path="/webhooks" component={WebhooksPage} />}
              {isAdminOrOwner && <Route path="/status-admin" component={StatusAdminPage} />}
              {!isClient && <Route path="/reports" component={ReportsPage} />}
              {!isClient && <Route path="/settings" component={SettingsPage} />}
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/status/:slug" component={PublicStatusPage} />
      <Route>
        {() => {
          if (isLoading) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <div className="space-y-3 w-64">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            );
          }

          if (!user) {
            return <LandingPage />;
          }

          return <AuthenticatedApp />;
        }}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
