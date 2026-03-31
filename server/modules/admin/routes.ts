import type { Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../replit_integrations/auth";
import { requireSystemAdmin } from "../../core/middleware/requireSystemAdmin";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/tenants", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json({ tenants });
    } catch (error: any) {
      console.error("[admin] GET /tenants error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ users });
    } catch (error: any) {
      console.error("[admin] GET /users error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/system-admin", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const parsed = z.object({ isSystemAdmin: z.boolean() }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "isSystemAdmin boolean required" });
      }

      await storage.setSystemAdmin(userId, parsed.data.isSystemAdmin);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[admin] POST /users/:id/system-admin error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/tenants/:tenantId/subscription", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const subscription = await storage.getTenantSubscription(tenantId);
      const plan = subscription ? await storage.getSubscriptionPlanByCode(subscription.planCode) : null;
      res.json({ subscription, plan });
    } catch (error: any) {
      console.error("[admin] GET /tenants/:id/subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/tenants/:tenantId/subscription", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const parsed = z.object({
        planCode: z.string().min(1),
        status: z.enum(["trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid"]).optional(),
      }).safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      }

      const { planCode, status } = parsed.data;

      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const plan = await storage.getSubscriptionPlanByCode(planCode);
      if (!plan) {
        return res.status(400).json({ message: `Plan "${planCode}" not found` });
      }

      const existing = await storage.getTenantSubscription(tenantId);
      if (existing) {
        const updateData: any = { planCode };
        if (status) updateData.status = status;
        if (status === "active") updateData.pausedAt = null;
        await storage.updateTenantSubscription(tenantId, updateData);
      } else {
        await storage.upsertTenantSubscription({
          tenantId,
          planCode,
          status: status || "active",
        });
      }

      const updated = await storage.getTenantSubscription(tenantId);
      res.json({ success: true, subscription: updated });
    } catch (error: any) {
      console.error("[admin] PATCH /tenants/:id/subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/plans", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json({ plans });
    } catch (error: any) {
      console.error("[admin] GET /plans error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/tenants/:tenantId/unpause", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      await storage.updateTenantSubscription(tenantId, { pausedAt: null, status: "active" });
      res.json({ success: true, message: "Tenant account unpaused" });
    } catch (error: any) {
      console.error("[admin] POST /tenants/:id/unpause error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/tenants/:tenantId/pause", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      await storage.updateTenantSubscription(tenantId, { pausedAt: new Date(), status: "past_due" });
      res.json({ success: true, message: "Tenant account paused" });
    } catch (error: any) {
      console.error("[admin] POST /tenants/:id/pause error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/tenants/:tenantId", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const uploadsDir = path.join(process.cwd(), "uploads", tenantId);
      if (fs.existsSync(uploadsDir)) {
        fs.rmSync(uploadsDir, { recursive: true, force: true });
      }
      await storage.deleteTenant(tenantId);
      res.json({ success: true, message: "Tenant and all data deleted" });
    } catch (error: any) {
      console.error("[admin] DELETE /tenants/:id error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/me", isAuthenticated, requireSystemAdmin(), async (req: any, res) => {
    res.json({ isSystemAdmin: true });
  });

  app.get("/api/auth/admin-check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.json({ isSystemAdmin: false });
      const isAdmin = await storage.isUserSystemAdmin(userId);
      res.json({ isSystemAdmin: isAdmin });
    } catch {
      res.json({ isSystemAdmin: false });
    }
  });
}
