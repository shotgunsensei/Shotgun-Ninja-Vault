import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Shield, ShieldCheck, ShieldOff, KeyRound, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/csrf";
import { queryClient } from "@/lib/queryClient";

export default function AccountSecurityPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user } = useQuery<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    mfaEnabled: boolean;
  }>({
    queryKey: ["/api/auth/user"],
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [disablePassword, setDisablePassword] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");

  const passwordStrength = getPasswordStrength(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.message || "Failed to change password");
        setPasswordLoading(false);
        return;
      }
      toast({ title: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Connection error. Please try again.");
    }
    setPasswordLoading(false);
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError("");
    setDisableLoading(true);
    try {
      const res = await authFetch("/api/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisableError(data.message || "Failed to disable MFA");
        setDisableLoading(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Two-factor authentication disabled" });
      setDisablePassword("");
    } catch {
      setDisableError("Connection error. Please try again.");
    }
    setDisableLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-account-security-title">Account Security</h1>
        <p className="text-muted-foreground mt-1">
          Manage your password and two-factor authentication settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password. You'll need to enter your current password for verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  data-testid="input-current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  data-testid="button-toggle-current-password"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {newPassword && (
                <div className="space-y-1" data-testid="text-password-strength">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full ${
                          level <= passwordStrength.level
                            ? passwordStrength.level <= 1
                              ? "bg-red-500"
                              : passwordStrength.level <= 2
                                ? "bg-orange-500"
                                : passwordStrength.level <= 3
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-confirm-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            {passwordError && (
              <p className="text-sm text-destructive" data-testid="text-password-error">{passwordError}</p>
            )}

            <Button
              type="submit"
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              data-testid="button-change-password"
            >
              {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
            </div>
            {user?.mfaEnabled ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid="badge-mfa-enabled">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-mfa-disabled">
                <ShieldOff className="w-3 h-3 mr-1" />
                Disabled
              </Badge>
            )}
          </div>
          <CardDescription>
            {user?.mfaEnabled
              ? "Your account is protected with two-factor authentication using an authenticator app."
              : "Add an extra layer of security by requiring a code from your authenticator app when signing in."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.mfaEnabled ? (
            <form onSubmit={handleDisableMfa} className="space-y-4">
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                Disabling MFA will make your account less secure. Enter your password to confirm.
              </div>
              <div className="space-y-2">
                <Label htmlFor="disablePassword">Confirm Password</Label>
                <Input
                  id="disablePassword"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  required
                  data-testid="input-disable-mfa-password"
                />
              </div>
              {disableError && (
                <p className="text-sm text-destructive" data-testid="text-mfa-disable-error">{disableError}</p>
              )}
              <Button
                type="submit"
                variant="destructive"
                disabled={disableLoading || !disablePassword}
                data-testid="button-disable-mfa"
              >
                {disableLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldOff className="w-4 h-4 mr-2" />}
                Disable Two-Factor Authentication
              </Button>
            </form>
          ) : (
            <Button onClick={() => setLocation("/mfa-setup")} data-testid="button-enable-mfa">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Enable Two-Factor Authentication
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getPasswordStrength(password: string): { level: number; label: string } {
  if (!password) return { level: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: "Weak" };
  if (score <= 2) return { level: 2, label: "Fair" };
  if (score <= 3) return { level: 3, label: "Good" };
  return { level: 4, label: "Strong" };
}
