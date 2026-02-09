import type { Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../replit_integrations/auth";
import { requireUser, requireTenant, requireRole, requireClientAccess } from "../../authz";
import { z } from "zod";
import {
  insertClientSchema,
  insertSiteSchema,
  insertAssetSchema,
  insertTenantSchema,
} from "@shared/schema";
import { emitEvent } from "../../core/events/helpers";
import { requireNotPaused } from "../../core/middleware/requireNotPaused";

export function registerCoreRoutes(app: Express) {
  app.post("/api/tenants", isAuthenticated, requireUser(), requireNotPaused(), async (req: any, res) => {
    try {
      const parsed = insertTenantSchema.pick({ name: true, slug: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { name, slug } = parsed.data;

      const existing = await storage.getTenantBySlug(slug);
      if (existing) {
        return res.status(400).json({ message: "Slug already taken" });
      }

      const userId = req.userId;
      const existingMembership = await storage.getUserMembership(userId);
      if (existingMembership) {
        return res.status(400).json({ message: "You already belong to an organization" });
      }

      const tenant = await storage.createTenant({ name, slug });
      await storage.addMember(tenant.id, userId, "OWNER");

      await emitEvent("create_tenant", tenant.id, userId, "tenant", tenant.id, { name, slug });

      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tenant", isAuthenticated, requireUser(), async (req: any, res) => {
    try {
      const membership = await storage.getUserMembership(req.userId);
      if (!membership) return res.status(404).json({ message: "No tenant" });
      res.json({ tenant: membership.tenant, role: membership.role });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats(req.tenantCtx.tenantId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients", isAuthenticated, requireTenant(), async (req: any, res) => {
    try {
      const { tenantId, role, userId } = req.tenantCtx;

      if (role === "CLIENT") {
        const allowedIds = await storage.getClientIdsForUser(userId);
        const allClients = await storage.getClientsByTenant(tenantId);
        return res.json(allClients.filter((c) => allowedIds.includes(c.id)));
      }

      const clients = await storage.getClientsByTenant(tenantId);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, requireClientAccess("id"), async (req: any, res) => {
    try {
      const { tenantId } = req.tenantCtx;
      const client = await storage.getClientDetail(tenantId, req.params.id);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(
    "/api/clients",
    isAuthenticated,
    requireRole("OWNER", "ADMIN", "TECH"),
    requireNotPaused(),
    async (req: any, res) => {
      try {
        const { tenantId, userId } = req.tenantCtx;

        const parsed = insertClientSchema.omit({ tenantId: true }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }

        const tenant = await storage.getTenantById(tenantId);
        const clientCount = (await storage.getClientsByTenant(tenantId)).length;
        if (tenant && clientCount >= tenant.maxClients) {
          return res.status(400).json({ message: "Client limit reached. Upgrade your plan." });
        }

        const client = await storage.createClient({
          ...parsed.data,
          tenantId,
        });

        await emitEvent("create_client", tenantId, userId, "client", client.id, { name: parsed.data.name });

        res.json(client);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/sites", isAuthenticated, requireRole("OWNER", "ADMIN", "TECH"), async (req: any, res) => {
    try {
      const sites = await storage.getSitesByTenant(req.tenantCtx.tenantId);
      res.json(sites);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(
    "/api/sites",
    isAuthenticated,
    requireRole("OWNER", "ADMIN", "TECH"),
    requireNotPaused(),
    async (req: any, res) => {
      try {
        const { tenantId, userId } = req.tenantCtx;

        const parsed = insertSiteSchema.omit({ tenantId: true }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }

        const site = await storage.createSite({
          ...parsed.data,
          tenantId,
        });

        await emitEvent("create_site", tenantId, userId, "site", site.id, { name: parsed.data.name });

        res.json(site);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/assets", isAuthenticated, requireRole("OWNER", "ADMIN", "TECH"), async (req: any, res) => {
    try {
      const assets = await storage.getAssetsByTenant(req.tenantCtx.tenantId);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/assets/:id", isAuthenticated, requireRole("OWNER", "ADMIN", "TECH"), async (req: any, res) => {
    try {
      const asset = await storage.getAssetById(req.tenantCtx.tenantId, req.params.id);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(
    "/api/assets",
    isAuthenticated,
    requireRole("OWNER", "ADMIN", "TECH"),
    requireNotPaused(),
    async (req: any, res) => {
      try {
        const { tenantId, userId } = req.tenantCtx;

        const parsed = insertAssetSchema.omit({ tenantId: true }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }

        const asset = await storage.createAsset({
          ...parsed.data,
          tenantId,
        });

        await emitEvent("create_asset", tenantId, userId, "asset", asset.id, { name: parsed.data.name });

        res.json(asset);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/members", isAuthenticated, requireTenant(), async (req: any, res) => {
    try {
      const members = await storage.getMembersByTenant(req.tenantCtx.tenantId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(
    "/api/members/invite",
    isAuthenticated,
    requireRole("OWNER", "ADMIN"),
    requireNotPaused(),
    async (req: any, res) => {
      try {
        const { tenantId, userId } = req.tenantCtx;
        const inviteSchema = z.object({
          email: z.string().email(),
          role: z.enum(["ADMIN", "TECH", "CLIENT"]),
        });

        const parsed = inviteSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }

        const { email, role } = parsed.data;

        await emitEvent("invite_member", tenantId, userId, "member", undefined, { email, role });

        res.json({ success: true, message: `Invite sent to ${email} as ${role}` });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.patch(
    "/api/members/:id/role",
    isAuthenticated,
    requireRole("OWNER", "ADMIN"),
    requireNotPaused(),
    async (req: any, res) => {
      try {
        const { tenantId, userId } = req.tenantCtx;
        const roleSchema = z.object({
          role: z.enum(["ADMIN", "TECH", "CLIENT"]),
        });

        const parsed = roleSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }

        await storage.updateMemberRole(tenantId, req.params.id, parsed.data.role);

        await emitEvent("change_role", tenantId, userId, "member", req.params.id, { newRole: parsed.data.role });

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/audit-logs", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const { action, entityType, dateFrom, dateTo, userId } = req.query;
      const filters: Record<string, string> = {};
      if (action) filters.action = action as string;
      if (entityType) filters.entityType = entityType as string;
      if (dateFrom) filters.dateFrom = dateFrom as string;
      if (dateTo) filters.dateTo = dateTo as string;
      if (userId) filters.userId = userId as string;

      const logs = await storage.getAuditLogsByTenant(req.tenantCtx.tenantId, Object.keys(filters).length > 0 ? filters : undefined);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/audit-actions", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const actions = await storage.getAuditActionTypes(req.tenantCtx.tenantId);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/client-access", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const access = await storage.getClientAccessByTenant(req.tenantCtx.tenantId);
      res.json(access);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/client-access", isAuthenticated, requireRole("OWNER", "ADMIN"), requireNotPaused(), async (req: any, res) => {
    try {
      const { tenantId, userId } = req.tenantCtx;
      const schema = z.object({
        userId: z.string().min(1),
        clientId: z.string().min(1),
        canUpload: z.boolean().optional().default(false),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const { userId: targetUserId, clientId, canUpload } = parsed.data;

      const memberRole = await storage.getMemberRole(tenantId, targetUserId);
      if (memberRole !== "CLIENT") {
        return res.status(400).json({ message: "User must have CLIENT role to be assigned client access" });
      }

      const existing = await storage.getClientIdsForUser(targetUserId);
      if (existing.includes(clientId)) {
        return res.status(400).json({ message: "User already has access to this client" });
      }

      const access = await storage.addClientAccess(tenantId, targetUserId, clientId, canUpload);

      await emitEvent("grant_client_access", tenantId, userId, "client_access", access.id, { targetUserId, clientId, canUpload });

      res.json(access);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/client-access/:id", isAuthenticated, requireRole("OWNER", "ADMIN"), requireNotPaused(), async (req: any, res) => {
    try {
      const { tenantId, userId } = req.tenantCtx;
      const schema = z.object({ canUpload: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      await storage.updateClientAccessCanUpload(tenantId, req.params.id, parsed.data.canUpload);

      await emitEvent("update_client_access", tenantId, userId, "client_access", req.params.id, { canUpload: parsed.data.canUpload });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/client-access/:id", isAuthenticated, requireRole("OWNER", "ADMIN"), requireNotPaused(), async (req: any, res) => {
    try {
      const { tenantId, userId } = req.tenantCtx;

      await storage.removeClientAccess(tenantId, req.params.id);

      await emitEvent("revoke_client_access", tenantId, userId, "client_access", req.params.id);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tenant/pause-status", isAuthenticated, requireRole("OWNER", "ADMIN", "TECH", "CLIENT"), async (req: any, res) => {
    try {
      const sub = await storage.getTenantSubscription(req.tenantCtx.tenantId);
      if (!sub?.pausedAt) {
        return res.json({ paused: false });
      }
      const pausedDate = new Date(sub.pausedAt);
      const now = new Date();
      const daysPaused = Math.floor((now.getTime() - pausedDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 90 - daysPaused);
      res.json({ paused: true, pausedAt: sub.pausedAt, daysRemaining, status: sub.status });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/modules", isAuthenticated, requireTenant(), async (_req: any, res) => {
    try {
      const { moduleRegistry } = await import("@shared/modules");
      res.json(moduleRegistry.modules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
