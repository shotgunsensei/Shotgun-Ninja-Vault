import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  Building2,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { TenantWithMember } from "@/lib/types";
import type { DashboardStats } from "@/lib/types";

export default function SettingsPage() {
  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantWithMember>({
    queryKey: ["/api/tenant"],
  });
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  if (tenantLoading || statsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const tenant = tenantInfo?.tenant;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization settings and plan.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Organization</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Name</p>
              <p className="text-sm mt-0.5" data-testid="text-org-name">
                {tenant?.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Slug</p>
              <p className="text-sm mt-0.5 font-mono">{tenant?.slug}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Your Role</p>
            <Badge variant="secondary" className="mt-1">
              {tenantInfo?.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Plan & Usage</CardTitle>
            </div>
            <Badge variant="secondary" data-testid="text-plan-name">
              {tenant?.plan || "free"} plan
            </Badge>
          </div>
          <CardDescription>
            Your current usage against plan limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Clients</span>
              <span className="text-muted-foreground">
                {stats?.totalClients || 0} / {stats?.maxClients || 5}
              </span>
            </div>
            <Progress
              value={
                ((stats?.totalClients || 0) / (stats?.maxClients || 5)) * 100
              }
              className="h-2"
            />
            {stats && stats.totalClients >= (stats.maxClients || 5) && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="w-3 h-3" />
                Client limit reached. Upgrade to add more.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Evidence Items</span>
              <span className="text-muted-foreground">
                {stats?.totalEvidence || 0} / {stats?.maxEvidence || 50}
              </span>
            </div>
            <Progress
              value={
                ((stats?.totalEvidence || 0) / (stats?.maxEvidence || 50)) * 100
              }
              className="h-2"
            />
            {stats && stats.totalEvidence >= (stats.maxEvidence || 50) && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="w-3 h-3" />
                Evidence limit reached. Upgrade to add more.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
