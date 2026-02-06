import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Building2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTenant = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tenants", {
        name: orgName,
        slug: orgSlug,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      navigate("/");
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSlugGenerate = (name: string) => {
    setOrgName(name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setOrgSlug(slug);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-md bg-primary flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Create your organization</CardTitle>
          <CardDescription>
            Set up your workspace to start managing evidence securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTenant.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="orgName"
                  placeholder="Acme IT Services"
                  value={orgName}
                  onChange={(e) => handleSlugGenerate(e.target.value)}
                  className="pl-9"
                  required
                  data-testid="input-org-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgSlug">URL slug</Label>
              <Input
                id="orgSlug"
                placeholder="acme-it-services"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                required
                data-testid="input-org-slug"
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, and hyphens only.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createTenant.isPending || !orgName || !orgSlug}
              data-testid="button-create-org"
            >
              {createTenant.isPending ? "Creating..." : "Create organization"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
