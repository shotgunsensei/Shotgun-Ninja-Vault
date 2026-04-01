import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Copy, XCircle, ExternalLink, Check, Upload } from "lucide-react";

export default function IntakeRequestsPage() {
  const { toast } = useToast();
  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/secure-intake/requests"] });
  const { data: spaces } = useQuery<any[]>({ queryKey: ["/api/secure-intake/spaces"] });
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    spaceId: "", title: "", uploaderName: "", uploaderEmail: "", instructions: "",
    maxUploads: "", maxTotalSizeMb: "", oneTimeUse: false, requiresPassword: false, password: "",
    expiresAt: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/secure-intake/requests", data),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-intake/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/secure-intake/dashboard"] });
      const data = await res.json();
      if (data.uploadUrl) {
        await navigator.clipboard.writeText(data.uploadUrl);
        toast({ title: "Upload request created", description: "Upload link copied to clipboard" });
      } else {
        toast({ title: "Upload request created" });
      }
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/secure-intake/requests/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-intake/requests"] });
      toast({ title: "Request revoked" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ spaceId: "", title: "", uploaderName: "", uploaderEmail: "", instructions: "", maxUploads: "", maxTotalSizeMb: "", oneTimeUse: false, requiresPassword: false, password: "", expiresAt: "" });
    setOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      maxUploads: form.maxUploads ? parseInt(form.maxUploads) : null,
      maxTotalSizeMb: form.maxTotalSizeMb ? parseInt(form.maxTotalSizeMb) : null,
      expiresAt: form.expiresAt || null,
    });
  };

  const copyLink = async (token: string, id: string) => {
    const domain = window.location.origin;
    const url = `${domain}/t/upload/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast({ title: "Upload link copied" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually", variant: "destructive" });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "completed": return "secondary";
      case "expired": return "outline";
      case "revoked": return "destructive";
      default: return "secondary";
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-48" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-requests-title">Upload Requests</h1>
          <p className="text-muted-foreground">Generate and manage secure upload links</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-request"><Plus className="w-4 h-4 mr-2" />New Request</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Upload Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label>Intake Space *</Label>
                <Select value={form.spaceId} onValueChange={(v) => setForm({ ...form, spaceId: v })}>
                  <SelectTrigger data-testid="select-request-space"><SelectValue placeholder="Select a space" /></SelectTrigger>
                  <SelectContent>
                    {(spaces || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="input-request-title" placeholder="e.g., Medical Records Upload" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Recipient Name</Label>
                  <Input value={form.uploaderName} onChange={(e) => setForm({ ...form, uploaderName: e.target.value })} data-testid="input-request-name" />
                </div>
                <div className="space-y-2">
                  <Label>Recipient Email</Label>
                  <Input type="email" value={form.uploaderEmail} onChange={(e) => setForm({ ...form, uploaderEmail: e.target.value })} data-testid="input-request-email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} data-testid="input-request-instructions" placeholder="Instructions for the uploader..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Max Uploads</Label>
                  <Input type="number" min={1} value={form.maxUploads} onChange={(e) => setForm({ ...form, maxUploads: e.target.value })} data-testid="input-request-max-uploads" />
                </div>
                <div className="space-y-2">
                  <Label>Max Total Size (MB)</Label>
                  <Input type="number" min={1} value={form.maxTotalSizeMb} onChange={(e) => setForm({ ...form, maxTotalSizeMb: e.target.value })} data-testid="input-request-max-size" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} data-testid="input-request-expires" />
              </div>
              <div className="flex items-center justify-between">
                <Label>One-Time Use</Label>
                <Switch checked={form.oneTimeUse} onCheckedChange={(v) => setForm({ ...form, oneTimeUse: v })} data-testid="switch-one-time-use" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Password</Label>
                <Switch checked={form.requiresPassword} onCheckedChange={(v) => setForm({ ...form, requiresPassword: v })} data-testid="switch-require-password" />
              </div>
              {form.requiresPassword && (
                <div className="space-y-2">
                  <Label>Upload Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required data-testid="input-request-password" />
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || !form.spaceId || !form.title} data-testid="button-submit-request">
                  <Upload className="w-4 h-4 mr-2" />
                  Create Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(!requests || requests.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No upload requests yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a request to generate a secure upload link</p>
            <Button onClick={() => setOpen(true)}>Create Request</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploads</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req: any) => (
                <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                  <TableCell className="font-medium">{req.title}</TableCell>
                  <TableCell>
                    <div className="text-sm">{req.uploaderName || "-"}</div>
                    {req.uploaderEmail && <div className="text-xs text-muted-foreground">{req.uploaderEmail}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(req.status) as any}>{req.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {req.uploadCount}{req.maxUploads ? `/${req.maxUploads}` : ""}
                  </TableCell>
                  <TableCell>
                    {req.expiresAt ? new Date(req.expiresAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {req.status === "active" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => copyLink(req.token, req.id)} data-testid={`button-copy-link-${req.id}`}>
                            {copiedId === req.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => window.open(`/t/upload/${req.token}`, "_blank")} data-testid={`button-open-link-${req.id}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Revoke this request?")) revokeMutation.mutate(req.id); }} data-testid={`button-revoke-${req.id}`}>
                            <XCircle className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
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
