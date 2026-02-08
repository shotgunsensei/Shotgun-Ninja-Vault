import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function BillingCancelPage() {
  const [, navigate] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center pt-8 pb-6 space-y-4">
          <XCircle className="w-16 h-16 text-muted-foreground" data-testid="icon-cancel" />
          <h2 className="text-xl font-semibold" data-testid="text-cancel-title">Checkout Cancelled</h2>
          <p className="text-sm text-muted-foreground">
            Your checkout was cancelled. No charges have been made. You can try again whenever you're ready.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/")} data-testid="button-go-home">
              Go Home
            </Button>
            <Button onClick={() => navigate("/billing")} data-testid="button-view-plans">
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
