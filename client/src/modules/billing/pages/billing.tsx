import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard,
  ExternalLink,
  Check,
  Zap,
  Users,
  HardDrive,
  FileText,
  Webhook,
  Shield,
  Globe,
  Key,
} from "lucide-react";
import type { SubscriptionPlan, TenantSubscription } from "@shared/schema";

interface BillingData {
  plans: SubscriptionPlan[];
  subscription: TenantSubscription | null;
}

interface SubscriptionData {
  subscription: TenantSubscription | null;
  plan: SubscriptionPlan | null;
  usage: {
    reportsGenerated: number;
    webhookDeliveries: number;
    evidenceBytesStored: number;
  } | null;
}

const PLAN_FEATURES: Record<string, string[]> = {
  solo: [
    "1 user",
    "1 GB storage",
    "5 reports per month",
    "2 webhook endpoints",
    "Basic evidence management",
  ],
  pro: [
    "Up to 5 users",
    "25 GB storage",
    "50 reports per month",
    "10 webhook endpoints",
    "API access",
    "Client portal",
    "Status pages",
  ],
  msp: [
    "Up to 25 users",
    "100 GB storage",
    "500 reports per month",
    "50 webhook endpoints",
    "API access",
    "Client portal",
    "Status pages",
  ],
  enterprise: [
    "Unlimited users",
    "Unlimited storage",
    "Unlimited reports",
    "Unlimited webhooks",
    "Full API access",
    "Client portal",
    "Status pages",
    "Priority support",
  ],
};

const PLAN_ICONS: Record<string, typeof Zap> = {
  solo: Shield,
  pro: Zap,
  msp: Globe,
  enterprise: Key,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function UsageBar({
  label,
  icon: Icon,
  current,
  max,
  unit,
}: {
  label: string;
  icon: typeof Users;
  current: number;
  max: number;
  unit?: string;
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const displayMax = max <= 0 ? "Unlimited" : `${max}${unit ? " " + unit : ""}`;
  const displayCurrent = `${current}${unit ? " " + unit : ""}`;

  return (
    <div className="space-y-1.5" data-testid={`usage-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
          {label}
        </span>
        <span className="font-medium">
          {displayCurrent} / {displayMax}
        </span>
      </div>
      {max > 0 && <Progress value={pct} className="h-1.5" />}
    </div>
  );
}

export default function BillingPage() {
  const { toast } = useToast();

  const { data: billingData, isLoading: plansLoading } = useQuery<BillingData>({
    queryKey: ["/api/billing/plans"],
  });

  const { data: subData, isLoading: subLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/billing/subscription"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planCode: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout-session", { planCode });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({
        title: "Checkout Error",
        description: err.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/customer-portal");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({
        title: "Portal Error",
        description: err.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  if (plansLoading || subLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  const plans = billingData?.plans || [];
  const subscription = subData?.subscription;
  const currentPlan = subData?.plan;
  const usage = subData?.usage;
  const activePlanCode = subscription?.planCode || "solo";
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const sortedPlans = [...plans].sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-billing-title">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your subscription plan and usage
          </p>
        </div>
        {subscription?.stripeCustomerId && (
          <Button
            variant="outline"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            data-testid="button-manage-billing"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Manage Billing
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>

      {currentPlan && usage && (
        <Card data-testid="card-current-plan">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Current Plan: {currentPlan.name}
                {isActive && <Badge variant="default" data-testid="badge-plan-status">Active</Badge>}
                {subscription?.status === "trialing" && (
                  <Badge variant="secondary" data-testid="badge-plan-status">Trial</Badge>
                )}
                {subscription?.cancelAtPeriodEnd && (
                  <Badge variant="destructive" data-testid="badge-cancel-pending">Cancelling</Badge>
                )}
              </CardTitle>
              {subscription?.currentPeriodEnd && (
                <span className="text-xs text-muted-foreground" data-testid="text-period-end">
                  {subscription.cancelAtPeriodEnd ? "Expires" : "Renews"}{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UsageBar
                label="Reports"
                icon={FileText}
                current={usage.reportsGenerated}
                max={(currentPlan.limits as any)?.reportsPerMonth || 0}
                unit="/mo"
              />
              <UsageBar
                label="Webhooks"
                icon={Webhook}
                current={usage.webhookDeliveries}
                max={(currentPlan.limits as any)?.webhooksMax || 0}
              />
              <UsageBar
                label="Storage"
                icon={HardDrive}
                current={Math.round(usage.evidenceBytesStored / (1024 * 1024 * 1024))}
                max={(currentPlan.limits as any)?.storageGb || 0}
                unit="GB"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-medium mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sortedPlans.map((plan) => {
            const isCurrent = plan.code === activePlanCode;
            const PlanIcon = PLAN_ICONS[plan.code] || Shield;
            const features = PLAN_FEATURES[plan.code] || [];

            return (
              <Card
                key={plan.id}
                className={isCurrent ? "border-primary" : ""}
                data-testid={`card-plan-${plan.code}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PlanIcon className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold" data-testid={`text-plan-price-${plan.code}`}>
                      ${Math.round(plan.monthlyPriceCents / 100)}
                    </span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full" disabled data-testid={`button-plan-current-${plan.code}`}>
                      Current Plan
                    </Button>
                  ) : plan.monthlyPriceCents === 0 ? (
                    <Button variant="secondary" className="w-full" disabled data-testid={`button-plan-free-${plan.code}`}>
                      Free Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => checkoutMutation.mutate(plan.code)}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-plan-subscribe-${plan.code}`}
                    >
                      {checkoutMutation.isPending ? "Processing..." : "Subscribe"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
