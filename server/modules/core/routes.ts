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

export function registerCoreRoutes(app: Express) {
  app.post("/api/tenants", isAuthenticated, requireUser(), async (req: any, res) => {
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

      await storage.createAuditLog({
        tenantId: tenant.id,
        userId,
        action: "create_tenant",
        entityType: "tenant",
        entityId: tenant.id,
        details: { name, slug },
      });

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

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "create_client",
          entityType: "client",
          entityId: client.id,
          details: { name: parsed.data.name },
        });

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

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "create_site",
          entityType: "site",
          entityId: site.id,
          details: { name: parsed.data.name },
        });

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

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "create_asset",
          entityType: "asset",
          entityId: asset.id,
          details: { name: parsed.data.name },
        });

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

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "invite_member",
          entityType: "member",
          details: { email, role },
        });

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

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "change_role",
          entityType: "member",
          entityId: req.params.id,
          details: { newRole: parsed.data.role },
        });

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/audit-logs", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const logs = await storage.getAuditLogsByTenant(req.tenantCtx.tenantId);
      res.json(logs);
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

  app.post("/api/client-access", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
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

      await storage.createAuditLog({
        tenantId,
        userId,
        action: "grant_client_access",
        entityType: "client_access",
        entityId: access.id,
        details: { targetUserId, clientId, canUpload },
      });

      res.json(access);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/client-access/:id", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const { tenantId, userId } = req.tenantCtx;
      const schema = z.object({ canUpload: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      await storage.updateClientAccessCanUpload(tenantId, req.params.id, parsed.data.canUpload);

      await storage.createAuditLog({
        tenantId,
        userId,
        action: "update_client_access",
        entityType: "client_access",
        entityId: req.params.id,
        details: { canUpload: parsed.data.canUpload },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/client-access/:id", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const { tenantId, userId } = req.tenantCtx;

      await storage.removeClientAccess(tenantId, req.params.id);

      await storage.createAuditLog({
        tenantId,
        userId,
        action: "revoke_client_access",
        entityType: "client_access",
        entityId: req.params.id,
      });

      res.json({ success: true });
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
