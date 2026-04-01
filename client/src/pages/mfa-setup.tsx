import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Shield, Copy, Check, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { authFetch } from "@/lib/csrf";

export default function MfaSetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"start" | "scan" | "verify" | "done">("start");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/auth/mfa/setup", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Setup failed");
        setLoading(false);
        return;
      }
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("scan");
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Verification failed");
        setLoading(false);
        return;
      }
      setRecoveryCodes(data.recoveryCodes);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    toast({ title: "Recovery codes copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <CardTitle data-testid="text-mfa-success">MFA Enabled</CardTitle>
            <CardDescription>
              Save these recovery codes in a safe place. You'll need them if you lose access to your authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1" data-testid="text-recovery-codes">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="text-center">{code}</div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={copyRecoveryCodes} data-testid="button-copy-recovery">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Recovery Codes"}
            </Button>
            <Button className="w-full" onClick={() => setLocation("/account-security")} data-testid="button-mfa-done">
              Done
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "scan") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle data-testid="text-mfa-scan-title">Scan QR Code</CardTitle>
            <CardDescription>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" data-testid="img-mfa-qr" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Or enter this code manually:</p>
              <code className="text-sm bg-muted px-3 py-1 rounded select-all" data-testid="text-mfa-secret">
                {secret}
              </code>
            </div>
            <form onSubmit={verifyCode} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="verifyCode">Enter the 6-digit code from your app</Label>
                <Input
                  id="verifyCode"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  required
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                  autoComplete="one-time-code"
                  data-testid="input-mfa-verify-code"
                />
              </div>
              {error && <p className="text-sm text-destructive" data-testid="text-mfa-error">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || code.length < 6} data-testid="button-mfa-verify">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Verify & Enable
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <CardTitle data-testid="text-mfa-setup-title">Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>You'll need an authenticator app like:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Google Authenticator</li>
              <li>Authy</li>
              <li>Microsoft Authenticator</li>
            </ul>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={startSetup} disabled={loading} data-testid="button-mfa-start">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
            Start Setup
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setLocation("/account-security")} data-testid="button-mfa-cancel">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Account Security
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
