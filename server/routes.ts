import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fileStorage } from "./fileStorage";
import { isAuthenticated } from "./replit_integrations/auth";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import multer from "multer";
import path from "path";
import { z } from "zod";
import {
  insertClientSchema,
  insertSiteSchema,
  insertAssetSchema,
  insertTenantSchema,
} from "@shared/schema";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "application/octet-stream",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

async function getTenantContext(req: any) {
  const userId = getUserId(req);
  if (!userId) return null;
  const membership = await storage.getUserMembership(userId);
  if (!membership) return null;
  return { tenantId: membership.tenant.id, role: membership.role, userId };
}

function requireRole(...roles: string[]) {
  return async (req: any, res: any, next: any) => {
    const ctx = await getTenantContext(req);
    if (!ctx) return res.status(403).json({ message: "No tenant membership" });
    if (!roles.includes(ctx.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    req.tenantCtx = ctx;
    next();
  };
}

async function attachTenantCtx(req: any, res: any, next: any) {
  const ctx = await getTenantContext(req);
  if (!ctx) return res.status(403).json({ message: "No tenant membership" });
  req.tenantCtx = ctx;
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.post("/api/tenants", isAuthenticated, async (req: any, res) => {
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

      const userId = getUserId(req);
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
      });

      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tenant", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const membership = await storage.getUserMembership(userId);
      if (!membership) return res.status(404).json({ message: "No tenant" });
      res.json({ tenant: membership.tenant, role: membership.role });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard", isAuthenticated, attachTenantCtx, async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats(req.tenantCtx.tenantId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients", isAuthenticated, attachTenantCtx, async (req: any, res) => {
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

  app.get("/api/clients/:id", isAuthenticated, attachTenantCtx, async (req: any, res) => {
    try {
      const { tenantId, role, userId } = req.tenantCtx;

      if (role === "CLIENT") {
        const allowedIds = await storage.getClientIdsForUser(userId);
        if (!allowedIds.includes(req.params.id)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

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
        });

        res.json(client);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/sites", isAuthenticated, attachTenantCtx, async (req: any, res) => {
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
        });

        res.json(site);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/assets", isAuthenticated, attachTenantCtx, async (req: any, res) => {
    try {
      const assets = await storage.getAssetsByTenant(req.tenantCtx.tenantId);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/assets/:id", isAuthenticated, attachTenantCtx, async (req: any, res) => {
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
        });

        res.json(asset);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/evidence", isAuthenticated, attachTenantCtx, async (req: any, res) => {
    try {
      const { tenantId, role, userId } = req.tenantCtx;
      const { q, clientId } = req.query;

      let evidence;
      if (role === "CLIENT") {
        const allowedIds = await storage.getClientIdsForUser(userId);
        evidence = await storage.getEvidenceByTenant(tenantId, q as string, clientId as string);
        evidence = evidence.filter((e: any) => e.clientId && allowedIds.includes(e.clientId));
      } else {
        evidence = await storage.getEvidenceByTenant(tenantId, q as string, clientId as string);
      }

      res.json(evidence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/evidence/:id", isAuthenticated, attachTenantCtx, async (req: any, res) => {
    try {
      const { tenantId, role, userId } = req.tenantCtx;
      const item = await storage.getEvidenceById(tenantId, req.params.id);
      if (!item) return res.status(404).json({ message: "Evidence not found" });

      if (role === "CLIENT") {
        const allowedIds = await storage.getClientIdsForUser(userId);
        if (!item.clientId || !allowedIds.includes(item.clientId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get(
    "/api/evidence/:id/download",
    isAuthenticated,
    attachTenantCtx,
    async (req: any, res) => {
      try {
        const { tenantId, role, userId } = req.tenantCtx;
        const item = await storage.getEvidenceById(tenantId, req.params.id);
        if (!item) return res.status(404).json({ message: "Evidence not found" });

        if (role === "CLIENT") {
          const allowedIds = await storage.getClientIdsForUser(userId);
          if (!item.clientId || !allowedIds.includes(item.clientId)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const buffer = await fileStorage.read(item.filePath);
        res.setHeader("Content-Type", item.fileType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(item.fileName)}"`
        );
        res.send(buffer);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.post(
    "/api/evidence/upload",
    isAuthenticated,
    attachTenantCtx,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const { tenantId, role, userId } = req.tenantCtx;

        if (role === "CLIENT") {
          return res.status(403).json({ message: "Clients cannot upload evidence" });
        }

        const tenant = await storage.getTenantById(tenantId);
        const stats = await storage.getDashboardStats(tenantId);
        if (tenant && stats.totalEvidence >= tenant.maxEvidence) {
          return res.status(400).json({ message: "Evidence limit reached. Upgrade your plan." });
        }

        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file uploaded" });

        const originalName = file.originalname.replace(/[^\w.\-]/g, "_");
        if (originalName.includes("..") || originalName.includes("/")) {
          return res.status(400).json({ message: "Invalid filename" });
        }

        const filePath = await fileStorage.save(originalName, file.buffer);

        let tagIds: string[] = [];
        if (req.body.tagIds) {
          try {
            tagIds = JSON.parse(req.body.tagIds);
          } catch {}
        }

        if (req.body.newTags) {
          const tagNames = req.body.newTags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
          for (const tagName of tagNames) {
            let tag = await storage.getTagByName(tenantId, tagName);
            if (!tag) {
              tag = await storage.createTag({ tenantId, name: tagName });
            }
            if (!tagIds.includes(tag.id)) {
              tagIds.push(tag.id);
            }
          }
        }

        const evidence = await storage.createEvidence({
          tenantId,
          title: req.body.title || originalName,
          notes: req.body.notes || null,
          clientId: req.body.clientId || null,
          siteId: req.body.siteId || null,
          assetId: req.body.assetId || null,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          filePath,
          tagIds: tagIds.length > 0 ? tagIds : null,
          uploadedById: userId,
        });

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "upload_evidence",
          entityType: "evidence",
          entityId: evidence.id,
          details: { fileName: file.originalname, fileSize: file.size },
        });

        res.json(evidence);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.delete(
    "/api/evidence/:id",
    isAuthenticated,
    requireRole("OWNER", "ADMIN", "TECH"),
    async (req: any, res) => {
      try {
        const { tenantId, userId } = req.tenantCtx;
        const item = await storage.getEvidenceById(tenantId, req.params.id);
        if (!item) return res.status(404).json({ message: "Evidence not found" });

        await fileStorage.delete(item.filePath);
        await storage.deleteEvidence(tenantId, req.params.id);

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "delete_evidence",
          entityType: "evidence",
          entityId: req.params.id,
          details: { fileName: item.fileName },
        });

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.get("/api/tags", isAuthenticated, attachTenantCtx, async (req: any, res) => {
    try {
      const tags = await storage.getTagsByTenant(req.tenantCtx.tenantId);
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/members", isAuthenticated, attachTenantCtx, async (req: any, res) => {
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
        const { email, role } = req.body;

        if (!email || !role) {
          return res.status(400).json({ message: "Email and role are required" });
        }

        if (!["ADMIN", "TECH", "CLIENT"].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }

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

  app.get("/api/audit-logs", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const logs = await storage.getAuditLogsByTenant(req.tenantCtx.tenantId);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
