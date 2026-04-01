import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { FileText, Download, Trash2, CheckCircle, XCircle, Eye, Search } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function IntakeFilesPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [spaceFilter, setSpaceFilter] = useState("");
  const { data: files, isLoading } = useQuery<any[]>({
    queryKey: ["/api/secure-intake/files", { query, status: statusFilter, spaceId: spaceFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter) params.set("status", statusFilter);
      if (spaceFilter) params.set("spaceId", spaceFilter);
      const res = await fetch(`/api/secure-intake/files?${params}`);
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
  });
  const { data: spaces } = useQuery<any[]>({ queryKey: ["/api/secure-intake/spaces"] });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/secure-intake/files/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-intake/files"] });
      toast({ title: "File updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/secure-intake/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-intake/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/secure-intake/dashboard"] });
      toast({ title: "File deleted" });
    },
  });

  const downloadFile = (id: string, name: string) => {
    const link = document.createElement("a");
    link.href = `/api/secure-intake/files/${id}/download`;
    link.download = name;
    link.click();
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "uploaded": return "default";
      case "reviewed": return "secondary";
      case "approved": return "outline";
      case "rejected": return "destructive";
      case "archived": return "secondary";
      default: return "secondary";
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-48" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-files-title">Uploaded Files</h1>
        <p className="text-muted-foreground">Review and manage files received through secure intake</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files..." className="pl-9" data-testid="input-file-search" />
        </div>
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[160px]" data-testid="select-file-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={spaceFilter || "__all__"} onValueChange={(v) => setSpaceFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]" data-testid="select-file-space"><SelectValue placeholder="All spaces" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All spaces</SelectItem>
            {(spaces || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {(!files || files.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No files found</h3>
            <p className="text-sm text-muted-foreground">Files will appear here when external users upload through secure links</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file: any) => (
                <TableRow key={file.id} data-testid={`row-file-${file.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate max-w-[200px]">{file.originalName}</span>
                    </div>
                    {file.mimeType && <div className="text-xs text-muted-foreground mt-0.5">{file.mimeType}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{file.uploaderName || "-"}</div>
                    {file.uploaderEmail && <div className="text-xs text-muted-foreground">{file.uploaderEmail}</div>}
                  </TableCell>
                  <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(file.status) as any}>{file.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => downloadFile(file.id, file.originalName)} data-testid={`button-download-${file.id}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => updateMutation.mutate({ id: file.id, status: "approved" })} data-testid={`button-approve-${file.id}`}>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => updateMutation.mutate({ id: file.id, status: "rejected" })} data-testid={`button-reject-${file.id}`}>
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this file?")) deleteMutation.mutate(file.id); }} data-testid={`button-delete-file-${file.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
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
