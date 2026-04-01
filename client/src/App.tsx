import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PausedBanner } from "@/components/paused-banner";
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
import { PortalHomePage, PortalClientDetailPage, PortalEvidencePage, PortalTicketsPage, PortalInvoicesPage } from "@/modules/portal";
import { ApiTokensPage } from "@/modules/api";
import { BillingPage, BillingSuccessPage, BillingCancelPage } from "@/modules/billing";
import { AdminPanelPage } from "@/modules/admin";
import { TicketsPage, TicketDetailPage } from "@/modules/tickets";
import { CalendarPage } from "@/modules/calendar";
import { TimeEntriesPage } from "@/modules/time";
import { BillingSettingsPage, InvoicesPage, InvoiceDetailPage } from "@/modules/invoicing";
import { KbListPage, KbArticlePage } from "@/modules/kb";
import AccountSecurityPage from "@/pages/account-security";
import { RecurringTemplatesPage } from "@/modules/recurring";
import { ItOpsConsolePage } from "@/modules/itops";
import {
  MobileLayout,
  MobileTicketsPage,
  MobileTicketDetailPage,
  MobileTimePage,
  MobileCalendarPage,
} from "@/modules/mobile";

import NotFound from "@/pages/not-found";
import PrivacyPage from "@/pages/privacy";
import ReviewerLoginPage from "@/pages/reviewer-login";
import DeleteAccountPage from "@/pages/delete-account";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import MfaSetupPage from "@/pages/mfa-setup";

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

  const { data: adminCheck } = useQuery<{ isSystemAdmin: boolean }>({
    queryKey: ["/api/auth/admin-check"],
  });

  const { data: pauseStatus } = useQuery<{ paused: boolean; daysRemaining?: number }>({
    queryKey: ["/api/tenant/pause-status"],
    refetchInterval: 60000,
  });

  const [location] = useLocation();
  const isSystemAdmin = adminCheck?.isSystemAdmin === true;
  const isPaused = pauseStatus?.paused === true;

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

  if (location.startsWith("/m") && !isClient) {
    return (
      <MobileLayout>
        <Switch>
          <Route path="/m">{() => <MobileTicketsPage />}</Route>
          <Route path="/m/tickets" component={MobileTicketsPage} />
          <Route path="/m/tickets/:id" component={MobileTicketDetailPage} />
          <Route path="/m/time" component={MobileTimePage} />
          <Route path="/m/calendar" component={MobileCalendarPage} />
          <Route>{() => <MobileTicketsPage />}</Route>
        </Switch>
      </MobileLayout>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar role={role} isSystemAdmin={isSystemAdmin} isPaused={isPaused} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-2 border-b sticky top-0 z-50 bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <PausedBanner />
          <main className="flex-1 overflow-auto">
            {isPaused ? (
              <Switch>
                <Route path="/">{() => <Redirect to="/evidence" />}</Route>
                <Route path="/evidence" component={EvidencePage} />
                <Route path="/evidence/:id" component={EvidenceDetailPage} />
                {isAdminOrOwner && <Route path="/billing" component={BillingPage} />}
                {isAdminOrOwner && <Route path="/billing/success" component={BillingSuccessPage} />}
                {isAdminOrOwner && <Route path="/billing/cancel" component={BillingCancelPage} />}
                {isSystemAdmin && <Route path="/system-admin" component={AdminPanelPage} />}
                <Route>{() => <Redirect to="/evidence" />}</Route>
              </Switch>
            ) : (
              <Switch>
                {isClient ? (
                  <Route path="/">{() => <Redirect to="/portal" />}</Route>
                ) : (
                  <Route path="/" component={DashboardPage} />
                )}
                {isClient && <Route path="/portal" component={PortalHomePage} />}
                {isClient && <Route path="/portal/clients/:id" component={PortalClientDetailPage} />}
                {isClient && <Route path="/portal/evidence" component={PortalEvidencePage} />}
                {isClient && <Route path="/portal/tickets" component={PortalTicketsPage} />}
                {isClient && <Route path="/portal/invoices" component={PortalInvoicesPage} />}
                {!isClient && <Route path="/tickets" component={TicketsPage} />}
                {!isClient && <Route path="/tickets/:id" component={TicketDetailPage} />}
                {!isClient && <Route path="/clients" component={ClientsPage} />}
                {!isClient && <Route path="/clients/:id" component={ClientDetailPage} />}
                {!isClient && <Route path="/sites" component={SitesPage} />}
                {!isClient && <Route path="/assets" component={AssetsPage} />}
                {!isClient && <Route path="/calendar" component={CalendarPage} />}
                {!isClient && <Route path="/time" component={TimeEntriesPage} />}
                {!isClient && <Route path="/kb" component={KbListPage} />}
                {!isClient && <Route path="/kb/:id" component={KbArticlePage} />}
                {!isClient && <Route path="/evidence" component={EvidencePage} />}
                {!isClient && <Route path="/evidence/upload" component={EvidenceUploadPage} />}
                {!isClient && <Route path="/evidence/:id" component={EvidenceDetailPage} />}
                {isAdminOrOwner && <Route path="/invoices" component={InvoicesPage} />}
                {isAdminOrOwner && <Route path="/invoices/:id" component={InvoiceDetailPage} />}
                {isAdminOrOwner && <Route path="/billing-settings" component={BillingSettingsPage} />}
                {isAdminOrOwner && <Route path="/recurring-tickets" component={RecurringTemplatesPage} />}
                {isAdminOrOwner && <Route path="/team" component={TeamPage} />}
                {isAdminOrOwner && <Route path="/audit" component={AuditPage} />}
                {isAdminOrOwner && <Route path="/client-access" component={ClientAccessPage} />}
                {isAdminOrOwner && <Route path="/licenses" component={LicensesPage} />}
                {isAdminOrOwner && <Route path="/licenses/developer" component={DeveloperPage} />}
                {isAdminOrOwner && <Route path="/webhooks" component={WebhooksPage} />}
                {isAdminOrOwner && <Route path="/status-admin" component={StatusAdminPage} />}
                {isAdminOrOwner && <Route path="/api-tokens" component={ApiTokensPage} />}
                {isAdminOrOwner && <Route path="/billing" component={BillingPage} />}
                {isAdminOrOwner && <Route path="/billing/success" component={BillingSuccessPage} />}
                {isAdminOrOwner && <Route path="/billing/cancel" component={BillingCancelPage} />}
                {!isClient && <Route path="/reports" component={ReportsPage} />}
                {!isClient && <Route path="/itops" component={ItOpsConsolePage} />}
                {!isClient && <Route path="/settings" component={SettingsPage} />}
                <Route path="/account-security" component={AccountSecurityPage} />
                <Route path="/mfa-setup" component={MfaSetupPage} />
                {isSystemAdmin && <Route path="/system-admin" component={AdminPanelPage} />}
                <Route component={NotFound} />
              </Switch>
            )}
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
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/delete-account" component={DeleteAccountPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/reviewer-login" component={ReviewerLoginPage} />
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
