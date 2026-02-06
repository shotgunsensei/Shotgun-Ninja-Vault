import { useQuery } from "@tanstack/react-query";
import { Shield, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { AuditLog } from "@shared/schema";

interface AuditLogWithUser extends AuditLog {
  userName?: string;
}

function getActionColor(action: string): "default" | "secondary" | "destructive" {
  if (action.includes("delete") || action.includes("remove")) return "destructive";
  if (action.includes("create") || action.includes("upload")) return "default";
  return "secondary";
}

export default function AuditPage() {
  const { data: logs, isLoading } = useQuery<AuditLogWithUser[]>({
    queryKey: ["/api/audit-logs"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-audit-title">
          Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Track all actions taken within your organization.
        </p>
      </div>

      {!logs?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No audit logs yet</p>
          <p className="text-xs mt-1">Actions will appear here as they happen.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {logs.map((log) => (
            <Card key={log.id} data-testid={`card-audit-${log.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getActionColor(log.action)} className="text-xs">
                          {log.action}
                        </Badge>
                        {log.entityType && (
                          <span className="text-xs text-muted-foreground">
                            on {log.entityType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        {log.userName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.userName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {log.createdAt
                            ? formatDistanceToNow(new Date(log.createdAt), {
                                addSuffix: true,
                              })
                            : "Just now"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
