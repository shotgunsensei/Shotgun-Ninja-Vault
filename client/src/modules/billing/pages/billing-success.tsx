import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function BillingSuccessPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
    queryClient.invalidateQueries({ queryKey: ["/api/billing/plans"] });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center pt-8 pb-6 space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500" data-testid="icon-success" />
          <h2 className="text-xl font-semibold" data-testid="text-success-title">Subscription Activated</h2>
          <p className="text-sm text-muted-foreground">
            Your subscription has been successfully activated. You now have access to all the features included in your plan.
          </p>
          <Button onClick={() => navigate("/billing")} data-testid="button-go-to-billing">
            View Billing Details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
