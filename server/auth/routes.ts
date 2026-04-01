import type { Express } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import {
  registerUser,
  authenticateUser,
  getUser,
  generateTOTPSecret,
  verifyTOTPToken,
  generateRecoveryCodes,
  enableMfa,
  disableMfa,
  useRecoveryCode,
} from "./authService";
import { isAuthenticated } from "./middleware";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues[0]?.message || "Invalid input",
        });
      }

      const result = await registerUser(parsed.data);

      req.session.regenerate((err) => {
        if (err) {
          console.error("[auth] Session regeneration error:", err);
          return res.status(500).json({ message: "Registration failed" });
        }
        (req.session as any).userId = result.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[auth] Session save error:", saveErr);
            return res.status(500).json({ message: "Registration failed" });
          }
          res.status(201).json({ success: true, userId: result.id });
        });
      });
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ message: error.message });
      }
      console.error("[auth] Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { user, requiresMfa } = await authenticateUser(
        parsed.data.email,
        parsed.data.password
      );

      req.session.regenerate((err) => {
        if (err) {
          console.error("[auth] Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed" });
        }

        (req.session as any).userId = user.id;

        if (requiresMfa) {
          (req.session as any).mfaPending = true;
          req.session.save(() => res.json({ requiresMfa: true }));
        } else {
          (req.session as any).mfaPending = false;
          req.session.save(() => res.json({ success: true }));
        }
      });
    } catch (error: any) {
      if (error.message?.includes("locked")) {
        return res.status(423).json({ message: error.message });
      }
      res.status(401).json({ message: error.message || "Invalid credentials" });
    }
  });

  app.post("/api/auth/mfa/validate", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId || !req.session?.mfaPending) {
        return res.status(401).json({ message: "No pending MFA session" });
      }

      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "MFA code is required" });
      }

      const user = await getUser(userId);
      if (!user || !user.mfaSecret) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const isValid = verifyTOTPToken(code, user.mfaSecret);

      if (!isValid) {
        const recoveryUsed = await useRecoveryCode(userId, code);
        if (!recoveryUsed) {
          return res.status(401).json({ message: "Invalid MFA code" });
        }
      }

      req.session.mfaPending = false;
      res.json({ success: true });
    } catch (error) {
      console.error("[auth] MFA validation error:", error);
      res.status(500).json({ message: "MFA validation failed" });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("[auth] Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isSystemAdmin: user.isSystemAdmin,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error("[auth] Fetch user error:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/mfa/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is already enabled" });
      }

      const { secret, otpauthUrl } = generateTOTPSecret(user.email || "user");
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      (req.session as any).pendingMfaSecret = secret;

      res.json({
        secret,
        qrCode: qrCodeDataUrl,
      });
    } catch (error) {
      console.error("[auth] MFA setup error:", error);
      res.status(500).json({ message: "MFA setup failed" });
    }
  });

  app.post("/api/auth/mfa/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const pendingSecret = req.session.pendingMfaSecret;

      if (!pendingSecret) {
        return res.status(400).json({ message: "No MFA setup in progress. Start setup first." });
      }

      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Verification code is required" });
      }

      const isValid = verifyTOTPToken(code, pendingSecret);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code. Please try again." });
      }

      const recoveryCodes = generateRecoveryCodes();
      await enableMfa(userId, pendingSecret, recoveryCodes);

      delete req.session.pendingMfaSecret;

      res.json({
        success: true,
        recoveryCodes,
      });
    } catch (error) {
      console.error("[auth] MFA verify error:", error);
      res.status(500).json({ message: "MFA verification failed" });
    }
  });

  app.post("/api/auth/mfa/disable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Password is required to disable MFA" });
      }

      const user = await getUser(userId);
      if (!user || !user.passwordHash) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const { verifyPassword } = await import("./authService");
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid password" });
      }

      await disableMfa(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("[auth] MFA disable error:", error);
      res.status(500).json({ message: "Failed to disable MFA" });
    }
  });

  app.get("/api/auth/admin-check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await getUser(userId);
      res.json({ isSystemAdmin: user?.isSystemAdmin === true });
    } catch {
      res.json({ isSystemAdmin: false });
    }
  });
}
