import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users,
  Server,
  FileText,
  MapPin,
  ArrowRight,
  AlertTriangle,
  Search,
  Upload,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import type { DashboardStats, TenantWithMember, EvidenceWithRelations } from "@/lib/types";
import type { Client } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function StatCard({
  title,
  value,
  max,
  icon: Icon,
  href,
}: {
  title: string;
  value: number;
  max?: number;
  icon: any;
  href: string;
}) {
  const nearLimit = max !== undefined && value >= max * 0.8;
  const atLimit = max !== undefined && value >= max;

  return (
    <Link href={href}>
      <Card className="hover-elevate cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{title}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              {max !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  {atLimit ? (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Limit reached
                    </Badge>
                  ) : nearLimit ? (
                    <Badge variant="secondary" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {max - value} remaining
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">of {max}</span>
                  )}
                </div>
              )}
            </div>
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ClientPortalDashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: myClients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const evidenceUrl = `/api/evidence${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`;
  const { data: evidence, isLoading: evidenceLoading } = useQuery<EvidenceWithRelations[]>({
    queryKey: [evidenceUrl],
  });

  const isLoading = clientsLoading || evidenceLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          Client Portal
        </h1>
        <p className="text-sm text-muted-foreground">
          Your assigned clients and evidence.
        </p>
      </div>

      {myClients && myClients.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {myClients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-client-${client.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Client</p>
                      <p className="text-lg font-bold mt-1 truncate">{client.name}</p>
                      {client.company && (
                        <p className="text-xs text-muted-foreground mt-0.5">{client.company}</p>
                      )}
                    </div>
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              window.location.href = `/evidence?q=${encodeURIComponent(searchQuery)}`;
            }
          }}
        >
          <Input
            type="search"
            placeholder="Search your evidence..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-evidence"
          />
        </form>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base font-semibold">Recent Evidence</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evidence">
              View all
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!evidence?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No evidence available</p>
              <p className="text-xs mt-1">Evidence shared with you will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {evidence.slice(0, 10).map((item) => (
                <Link key={item.id} href={`/evidence/${item.id}`}>
                  <div
                    className="flex items-center justify-between gap-4 p-3 rounded-md hover-elevate cursor-pointer"
                    data-testid={`evidence-item-${item.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.clientName && <span>{item.clientName}</span>}
                          <span>{formatFileSize(item.fileSize)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {item.createdAt
                        ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                        : "Just now"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantWithMember>({
    queryKey: ["/api/tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const role = tenantInfo?.role;
  const isClient = role === "CLIENT";
  const roleResolved = !!tenantInfo;

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: roleResolved && !isClient,
  });

  if (tenantLoading || !roleResolved) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (isClient) {
    return <ClientPortalDashboard />;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your evidence vault.
          </p>
        </div>
        <Button asChild data-testid="button-upload-evidence">
          <Link href="/evidence/upload">
            <Upload className="w-4 h-4 mr-1" />
            Upload Evidence
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Clients"
          value={stats?.totalClients || 0}
          max={stats?.maxClients}
          icon={Users}
          href="/clients"
        />
        <StatCard
          title="Sites"
          value={stats?.totalSites || 0}
          icon={MapPin}
          href="/sites"
        />
        <StatCard
          title="Assets"
          value={stats?.totalAssets || 0}
          icon={Server}
          href="/assets"
        />
        <StatCard
          title="Evidence Items"
          value={stats?.totalEvidence || 0}
          max={stats?.maxEvidence}
          icon={FileText}
          href="/evidence"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              window.location.href = `/evidence?q=${encodeURIComponent(searchQuery)}`;
            }
          }}
        >
          <Input
            type="search"
            placeholder="Search evidence by title, notes, tags, or client name..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-evidence"
          />
        </form>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base font-semibold">Recent uploads</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evidence">
              View all
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!stats?.recentEvidence?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No evidence uploaded yet</p>
              <p className="text-xs mt-1">Upload your first file to get started.</p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/evidence/upload">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload Evidence
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentEvidence.map((item) => (
                <Link key={item.id} href={`/evidence/${item.id}`}>
                  <div
                    className="flex items-center justify-between gap-4 p-3 rounded-md hover-elevate cursor-pointer"
                    data-testid={`evidence-item-${item.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.clientName && <span>{item.clientName}</span>}
                          <span>{formatFileSize(item.fileSize)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {item.createdAt
                        ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                        : "Just now"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
