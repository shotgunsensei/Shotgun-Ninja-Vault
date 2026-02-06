import { Switch, Route } from "wouter";
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

import LandingPage from "@/pages/landing";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import SitesPage from "@/pages/sites";
import AssetsPage from "@/pages/assets";
import EvidencePage from "@/pages/evidence";
import EvidenceUploadPage from "@/pages/evidence-upload";
import EvidenceDetailPage from "@/pages/evidence-detail";
import TeamPage from "@/pages/team";
import AuditPage from "@/pages/audit";
import SettingsPage from "@/pages/settings";
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

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-2 border-b sticky top-0 z-50 bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/clients" component={ClientsPage} />
              <Route path="/clients/:id" component={ClientDetailPage} />
              <Route path="/sites" component={SitesPage} />
              <Route path="/assets" component={AssetsPage} />
              <Route path="/evidence" component={EvidencePage} />
              <Route path="/evidence/upload" component={EvidenceUploadPage} />
              <Route path="/evidence/:id" component={EvidenceDetailPage} />
              <Route path="/team" component={TeamPage} />
              <Route path="/audit" component={AuditPage} />
              <Route path="/settings" component={SettingsPage} />
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
