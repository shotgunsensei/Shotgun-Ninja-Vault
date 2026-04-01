import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Shield } from "lucide-react";

export default function IntakeAuditPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: events, isLoading } = useQuery<any[]>({
    queryKey: ["/api/secure-intake/audit", { action: actionFilter, dateFrom, dateTo }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/secure-intake/audit?${params}`);
      if (!res.ok) throw new Error("Failed to load audit events");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-48" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-audit-title">Intake Audit Log</h1>
        <p className="text-muted-foreground">Immutable record of all secure intake activity</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={actionFilter || "__all__"} onValueChange={(v) => setActionFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[200px]" data-testid="select-audit-action"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actions</SelectItem>
            <SelectItem value="space.created">Space Created</SelectItem>
            <SelectItem value="space.updated">Space Updated</SelectItem>
            <SelectItem value="space.deleted">Space Deleted</SelectItem>
            <SelectItem value="request.created">Request Created</SelectItem>
            <SelectItem value="request.revoked">Request Revoked</SelectItem>
            <SelectItem value="file.uploaded">File Uploaded</SelectItem>
            <SelectItem value="file.downloaded">File Downloaded</SelectItem>
            <SelectItem value="file.approved">File Approved</SelectItem>
            <SelectItem value="file.rejected">File Rejected</SelectItem>
            <SelectItem value="file.deleted">File Deleted</SelectItem>
            <SelectItem value="policy.updated">Policy Updated</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" data-testid="input-audit-date-from" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" data-testid="input-audit-date-to" />
      </div>

      {(!events || events.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No audit events</h3>
            <p className="text-sm text-muted-foreground">Activity will be recorded here automatically</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Object</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event: any) => (
                <TableRow key={event.id} data-testid={`row-audit-${event.id}`}>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{event.actorType}</div>
                    {event.actorId && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{event.actorId}</div>}
                  </TableCell>
                  <TableCell>
                    {event.objectType && (
                      <div className="text-sm">
                        {event.objectType}
                        {event.objectId && <span className="text-xs text-muted-foreground ml-1">#{event.objectId.slice(0, 8)}</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {event.ipAddress || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
