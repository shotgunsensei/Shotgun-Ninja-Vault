import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Users,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { useState } from "react";

interface TenantSub {
  id: string;
  tenantId: string;
  planCode: string;
  status: string;
  pausedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
  createdAt: string;
  subscription: TenantSub | null;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  isSystemAdmin: boolean;
  createdAt: string;
}

function getPauseDaysRemaining(pausedAt: string | null): number | null {
  if (!pausedAt) return null;
  const paused = new Date(pausedAt);
  const now = new Date();
  const daysPaused = Math.floor((now.getTime() - paused.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, 90 - daysPaused);
}

interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  monthlyPriceCents: number;
}

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past Due" },
  { value: "canceled", label: "Canceled" },
  { value: "incomplete", label: "Incomplete" },
  { value: "incomplete_expired", label: "Incomplete (Expired)" },
  { value: "unpaid", label: "Unpaid" },
];

function ChangeSubscriptionDialog({
  open,
  onClose,
  tenant,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  tenant: AdminTenant;
  plans: SubscriptionPlan[];
}) {
  const { toast } = useToast();
  const currentPlan = tenant.subscription?.planCode || "solo";
  const currentStatus = tenant.subscription?.status || "active";
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/tenants/${tenant.id}/subscription`, {
        planCode: selectedPlan,
        status: selectedStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Subscription updated" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const selectedPlanData = plans.find((p) => p.code === selectedPlan);
  const hasChanges = selectedPlan !== currentPlan || selectedStatus !== currentStatus;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Change Subscription — {tenant.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {plans.length === 0 && (
            <p className="text-sm text-destructive" data-testid="text-plans-error">
              Unable to load subscription plans. Please try again later.
            </p>
          )}
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan} disabled={plans.length === 0}>
              <SelectTrigger data-testid="select-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.code} value={plan.code} data-testid={`option-plan-${plan.code}`}>
                    {plan.name} — ${(plan.monthlyPriceCents / 100).toFixed(0)}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPlanData && (
              <p className="text-xs text-muted-foreground">
                ${(selectedPlanData.monthlyPriceCents / 100).toFixed(0)}/month
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value} data-testid={`option-status-${s.value}`}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tenant.subscription?.stripeSubscriptionId && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This tenant has an active Stripe subscription. Changing the plan here will override the local record but won't modify the Stripe subscription itself.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-sub-change">
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !hasChanges || plans.length === 0}
              data-testid="button-confirm-sub-change"
            >
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status, pausedAt }: { status: string; pausedAt: string | null }) {
  if (pausedAt) {
    const daysLeft = getPauseDaysRemaining(pausedAt);
    return (
      <Badge variant="destructive" data-testid="badge-paused">
        Paused ({daysLeft}d left)
      </Badge>
    );
  }
  switch (status) {
    case "active":
      return <Badge variant="default" data-testid="badge-active">Active</Badge>;
    case "trialing":
      return <Badge variant="secondary" data-testid="badge-trialing">Trialing</Badge>;
    case "past_due":
      return <Badge variant="destructive" data-testid="badge-past-due">Past Due</Badge>;
    case "canceled":
      return <Badge variant="destructive" data-testid="badge-canceled">Canceled</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status">{status || "No Subscription"}</Badge>;
  }
}

export function AdminPanelPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"tenants" | "users">("tenants");
  const [subDialogTenant, setSubDialogTenant] = useState<AdminTenant | null>(null);

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery<{ tenants: AdminTenant[] }>({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ["/api/admin/users"],
  });

  const { data: plansData } = useQuery<{ plans: SubscriptionPlan[] }>({
    queryKey: ["/api/admin/plans"],
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isSystemAdmin }: { userId: string; isSystemAdmin: boolean }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/system-admin`, { isSystemAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("POST", `/api/admin/tenants/${tenantId}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Tenant paused" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const unpauseMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("POST", `/api/admin/tenants/${tenantId}/unpause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Tenant unpaused" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("DELETE", `/api/admin/tenants/${tenantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Tenant deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const tenants = tenantsData?.tenants || [];
  const users = usersData?.users || [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-admin-title">System Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all tenants, users, and system settings
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "tenants" ? "default" : "outline"}
          onClick={() => setActiveTab("tenants")}
          data-testid="button-tab-tenants"
        >
          <Building2 className="w-4 h-4 mr-2" />
          Tenants ({tenants.length})
        </Button>
        <Button
          variant={activeTab === "users" ? "default" : "outline"}
          onClick={() => setActiveTab("users")}
          data-testid="button-tab-users"
        >
          <Users className="w-4 h-4 mr-2" />
          Users ({users.length})
        </Button>
      </div>

      {activeTab === "tenants" && (
        <div className="space-y-3">
          {tenantsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : tenants.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No tenants found
              </CardContent>
            </Card>
          ) : (
            tenants.map((tenant) => (
              <Card key={tenant.id} data-testid={`card-tenant-${tenant.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium" data-testid={`text-tenant-name-${tenant.id}`}>
                          {tenant.name}
                        </h3>
                        <StatusBadge
                          status={tenant.subscription?.status || "none"}
                          pausedAt={tenant.subscription?.pausedAt || null}
                        />
                        {tenant.subscription?.planCode && (
                          <Badge variant="outline" data-testid={`badge-plan-${tenant.id}`}>
                            {tenant.subscription.planCode}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tenant.slug} - {tenant.memberCount} member(s) - Created {new Date(tenant.createdAt).toLocaleDateString()}
                      </p>
                      {tenant.subscription?.pausedAt && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Account paused since {new Date(tenant.subscription.pausedAt).toLocaleDateString()}
                          {" - "}
                          {getPauseDaysRemaining(tenant.subscription.pausedAt)} days until deletion
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSubDialogTenant(tenant)}
                        data-testid={`button-change-sub-${tenant.id}`}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        Change Plan
                      </Button>
                      {tenant.subscription?.pausedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unpauseMutation.mutate(tenant.id)}
                          disabled={unpauseMutation.isPending}
                          data-testid={`button-unpause-${tenant.id}`}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Unpause
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseMutation.mutate(tenant.id)}
                          disabled={pauseMutation.isPending}
                          data-testid={`button-pause-${tenant.id}`}
                        >
                          <Pause className="w-3 h-3 mr-1" />
                          Pause
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            data-testid={`button-delete-tenant-${tenant.id}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{tenant.name}" and ALL associated data
                              including evidence files, clients, users, and settings. This action
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTenantMutation.mutate(tenant.id)}
                              className="bg-destructive text-destructive-foreground"
                              data-testid="button-confirm-delete"
                            >
                              Delete Everything
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-3">
          {usersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : users.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No users found
              </CardContent>
            </Card>
          ) : (
            users.map((user) => (
              <Card key={user.id} data-testid={`card-user-${user.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {(user.firstName?.[0] || "") + (user.lastName?.[0] || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium" data-testid={`text-user-name-${user.id}`}>
                            {user.firstName} {user.lastName}
                          </span>
                          {user.isSystemAdmin && (
                            <Badge variant="default" data-testid={`badge-sysadmin-${user.id}`}>
                              System Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={user.isSystemAdmin ? "destructive" : "outline"}
                      onClick={() =>
                        toggleAdminMutation.mutate({
                          userId: user.id,
                          isSystemAdmin: !user.isSystemAdmin,
                        })
                      }
                      disabled={toggleAdminMutation.isPending}
                      data-testid={`button-toggle-admin-${user.id}`}
                    >
                      {user.isSystemAdmin ? (
                        <>
                          <ShieldOff className="w-3 h-3 mr-1" />
                          Remove Admin
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Make Admin
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {subDialogTenant && (
        <ChangeSubscriptionDialog
          open={!!subDialogTenant}
          onClose={() => setSubDialogTenant(null)}
          tenant={subDialogTenant}
          plans={plansData?.plans || []}
        />
      )}
    </div>
  );
}
