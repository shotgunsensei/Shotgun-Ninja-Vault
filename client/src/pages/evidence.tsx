import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Upload,
  Clock,
  Download,
  Filter,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import type { EvidenceWithRelations } from "@/lib/types";
import type { Client, Tag } from "@shared/schema";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function getFileIcon(fileType: string): string {
  if (fileType.startsWith("image/")) return "img";
  if (fileType === "application/pdf") return "pdf";
  if (fileType.startsWith("text/")) return "txt";
  return "file";
}

export default function EvidencePage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialQ = params.get("q") || "";

  const [search, setSearch] = useState(initialQ);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("q", search);
  if (clientFilter && clientFilter !== "all") queryParams.set("clientId", clientFilter);
  const queryString = queryParams.toString();

  const { data: evidence, isLoading } = useQuery<EvidenceWithRelations[]>({
    queryKey: ["/api/evidence" + (queryString ? `?${queryString}` : "")],
  });

  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: tags } = useQuery<Tag[]>({ queryKey: ["/api/tags"] });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
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
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-evidence-title">
            Evidence Locker
          </h1>
          <p className="text-sm text-muted-foreground">
            All uploaded evidence files and metadata.
          </p>
        </div>
        <Button asChild data-testid="button-upload-evidence-page">
          <Link href="/evidence/upload">
            <Upload className="w-4 h-4 mr-1" />
            Upload Evidence
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search evidence..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-evidence-page"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          data-testid="button-toggle-filters"
        >
          <Filter className="w-4 h-4 mr-1" />
          Filters
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Client</p>
                <Select
                  value={clientFilter}
                  onValueChange={setClientFilter}
                >
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-client">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(clientFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClientFilter("all")}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!evidence?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {search || clientFilter !== "all"
              ? "No evidence matches your filters"
              : "No evidence uploaded yet"}
          </p>
          {!search && clientFilter === "all" && (
            <>
              <p className="text-xs mt-1">Upload your first evidence file to get started.</p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/evidence/upload">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload Evidence
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {evidence.map((item) => (
            <Link key={item.id} href={`/evidence/${item.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-evidence-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
                          {getFileIcon(item.fileType)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span>{item.fileName}</span>
                          <span>{formatFileSize(item.fileSize)}</span>
                          {item.clientName && (
                            <Badge variant="secondary" className="text-xs">
                              {item.clientName}
                            </Badge>
                          )}
                          {item.assetName && (
                            <Badge variant="secondary" className="text-xs">
                              {item.assetName}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {item.createdAt
                          ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                          : "Just now"}
                      </div>
                    </div>
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
