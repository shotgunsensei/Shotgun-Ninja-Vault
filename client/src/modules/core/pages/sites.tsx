import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useRef } from "react";
import { MapPin, Plus, Search, ArrowRight, Home, Upload, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Site, Client } from "@shared/schema";

export default function SitesPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{imported: number, errors: {row: number, message: string}[]} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const createSite = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sites", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      toast({ title: "Site created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (csv: string) => {
      const res = await apiRequest("POST", "/api/sites/import", { csv });
      return res.json();
    },
    onSuccess: (data: {imported: number, errors: {row: number, message: string}[]}) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setImportResult(data);
      if (data.imported > 0) {
        toast({ title: `Imported ${data.imported} site${data.imported !== 1 ? 's' : ''}` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      setImportResult(null);
      importMutation.mutate(csv);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/api/sites/template.csv";
    a.download = "sites-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filtered = sites?.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-sites-title">
            Sites
          </h1>
          <p className="text-sm text-muted-foreground">
            Physical locations linked to clients.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setImportResult(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-sites">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Sites from CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Download the template, fill it in with your data (e.g. from Datto, Kaseya, ConnectWise), then upload the completed CSV file.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template-sites">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importMutation.isPending}
                    data-testid="button-upload-csv-sites"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {importMutation.isPending ? "Importing..." : "Upload CSV"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-file-csv-sites"
                  />
                </div>
                {importResult && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium" data-testid="text-import-result-sites">
                      Successfully imported {importResult.imported} record{importResult.imported !== 1 ? "s" : ""}
                    </p>
                    {importResult.errors.length > 0 && (
                      <div className="text-sm text-destructive space-y-1" data-testid="text-import-errors-sites">
                        <p className="font-medium">{importResult.errors.length} error{importResult.errors.length !== 1 ? "s" : ""}:</p>
                        {importResult.errors.slice(0, 10).map((err, i) => (
                          <p key={i}>Row {err.row}: {err.message}</p>
                        ))}
                        {importResult.errors.length > 10 && (
                          <p>...and {importResult.errors.length - 10} more</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-site">
                <Plus className="w-4 h-4 mr-1" />
                Add Site
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Site</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createSite.mutate({
                  name: fd.get("name") as string,
                  address: (fd.get("address") as string) || undefined,
                  clientId: (fd.get("clientId") as string) || undefined,
                  notes: (fd.get("notes") as string) || undefined,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required data-testid="input-site-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" data-testid="input-site-address" />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select name="clientId">
                  <SelectTrigger data-testid="select-site-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} data-testid="input-site-notes" />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createSite.isPending}
                data-testid="button-submit-site"
              >
                {createSite.isPending ? "Creating..." : "Create Site"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search sites..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-sites"
        />
      </div>

      {!filtered?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {search ? "No sites match your search" : "No sites yet"}
          </p>
          {!search && (
            <p className="text-xs mt-1">Add your first site to get started.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((site) => (
            <Card key={site.id} className="hover-elevate" data-testid={`card-site-${site.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{site.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {site.address && (
                          <span className="flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {site.address}
                          </span>
                        )}
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
