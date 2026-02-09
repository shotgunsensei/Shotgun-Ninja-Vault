import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface PauseStatus {
  paused: boolean;
  pausedAt?: string;
  daysRemaining?: number;
  status?: string;
}

export function PausedBanner() {
  const { data } = useQuery<PauseStatus>({
    queryKey: ["/api/tenant/pause-status"],
    refetchInterval: 60000,
  });

  if (!data?.paused) return null;

  return (
    <div
      className="bg-destructive/10 border-b border-destructive/20 px-4 py-3"
      data-testid="banner-paused"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <div>
            <span className="font-medium text-destructive">Account Paused</span>
            <span className="text-muted-foreground ml-1">
              - Your account has been paused due to a billing issue.
              You can download your existing data for{" "}
              <span className="font-semibold text-destructive">{data.daysRemaining} days</span>
              {" "}before your data is permanently deleted.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/evidence">
            <Button size="sm" variant="outline" data-testid="button-download-data">
              <Download className="w-3 h-3 mr-1" />
              Download Data
            </Button>
          </Link>
          <Link href="/billing">
            <Button size="sm" data-testid="button-fix-billing">
              <CreditCard className="w-3 h-3 mr-1" />
              Fix Billing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
