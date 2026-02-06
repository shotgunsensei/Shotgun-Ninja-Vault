import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import {
  Server,
  Plus,
  Search,
  ArrowRight,
  Monitor,
  Wifi,
  Hash,
} from "lucide-react";
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
import type { Asset, Client, Site } from "@shared/schema";

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: sites } = useQuery<Site[]>({ queryKey: ["/api/sites"] });

  const createAsset = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/assets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      toast({ title: "Asset created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = assets?.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.type?.toLowerCase().includes(search.toLowerCase()) ||
      a.serialNumber?.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-assets-title">
            Assets
          </h1>
          <p className="text-sm text-muted-foreground">
            Track devices, servers, and equipment.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-asset">
              <Plus className="w-4 h-4 mr-1" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Asset</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createAsset.mutate({
                  name: fd.get("name") as string,
                  type: (fd.get("type") as string) || undefined,
                  serialNumber: (fd.get("serialNumber") as string) || undefined,
                  ipAddress: (fd.get("ipAddress") as string) || undefined,
                  clientId: (fd.get("clientId") as string) || undefined,
                  siteId: (fd.get("siteId") as string) || undefined,
                  notes: (fd.get("notes") as string) || undefined,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required data-testid="input-asset-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Input
                    id="type"
                    name="type"
                    placeholder="Server, Workstation..."
                    data-testid="input-asset-type"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input id="serialNumber" name="serialNumber" data-testid="input-asset-serial" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input id="ipAddress" name="ipAddress" data-testid="input-asset-ip" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select name="clientId">
                    <SelectTrigger data-testid="select-asset-client">
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
                  <Label>Site</Label>
                  <Select name="siteId">
                    <SelectTrigger data-testid="select-asset-site">
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} data-testid="input-asset-notes" />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createAsset.isPending}
                data-testid="button-submit-asset"
              >
                {createAsset.isPending ? "Creating..." : "Create Asset"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search assets..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-assets"
        />
      </div>

      {!filtered?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Server className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {search ? "No assets match your search" : "No assets yet"}
          </p>
          {!search && (
            <p className="text-xs mt-1">Add your first asset to start tracking.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((asset) => (
            <Link key={asset.id} href={`/assets/${asset.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-asset-${asset.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Server className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{asset.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {asset.type && (
                            <span className="flex items-center gap-1">
                              <Monitor className="w-3 h-3" />
                              {asset.type}
                            </span>
                          )}
                          {asset.ipAddress && (
                            <span className="flex items-center gap-1">
                              <Wifi className="w-3 h-3" />
                              {asset.ipAddress}
                            </span>
                          )}
                          {asset.serialNumber && (
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {asset.serialNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
