import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fileStorage } from "./fileStorage";
import { isAuthenticated } from "./replit_integrations/auth";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { requireUser, requireTenant, requireRole, requireClientAccess } from "./authz";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { z } from "zod";
import {
  insertClientSchema,
  insertSiteSchema,
  insertAssetSchema,
  insertTenantSchema,
} from "@shared/schema";

const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "pdf", "txt", "log", "csv", "json"];

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/octet-stream",
];

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "25", 10);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File extension .${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`));
    }
    cb(null, true);
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

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

  app.get("/api/dashboard", isAuthenticated, requireTenant(), async (req: any, res) => {
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

  app.get("/api/sites", isAuthenticated, requireTenant(), async (req: any, res) => {
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

  app.get("/api/assets", isAuthenticated, requireTenant(), async (req: any, res) => {
    try {
      const assets = await storage.getAssetsByTenant(req.tenantCtx.tenantId);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/assets/:id", isAuthenticated, requireTenant(), async (req: any, res) => {
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

  app.get("/api/evidence", isAuthenticated, requireTenant(), async (req: any, res) => {
    try {
      const { tenantId, role, userId } = req.tenantCtx;
      const { q, clientId, assetId, tag, dateFrom, dateTo, uploadedBy } = req.query;

      let evidence = await storage.searchEvidence(tenantId, {
        query: q as string,
        clientId: clientId as string,
        assetId: assetId as string,
        tag: tag as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        uploadedBy: uploadedBy as string,
      });

      if (role === "CLIENT") {
        const allowedIds = await storage.getClientIdsForUser(userId);
        evidence = evidence.filter((e: any) => e.clientId && allowedIds.includes(e.clientId));
      }

      res.json(evidence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/evidence/:id", isAuthenticated, requireTenant(), async (req: any, res) => {
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
    requireTenant(),
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
    requireRole("OWNER", "ADMIN", "TECH"),
    upload.single("file"),
    async (req: any, res) => {
      try {
        const { tenantId, userId } = req.tenantCtx;

        const tenant = await storage.getTenantById(tenantId);
        const stats = await storage.getDashboardStats(tenantId);
        if (tenant && stats.totalEvidence >= tenant.maxEvidence) {
          return res.status(400).json({ message: "Evidence limit reached. Upgrade your plan." });
        }

        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file uploaded" });

        const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");

        const duplicate = await storage.getEvidenceBySha256(tenantId, sha256);
        if (duplicate) {
          return res.status(409).json({
            message: `Duplicate file detected. This file already exists as "${duplicate.title}".`,
            existingId: duplicate.id,
          });
        }

        const originalName = file.originalname.replace(/[^\w.\-]/g, "_");
        if (originalName.includes("..") || originalName.includes("/")) {
          return res.status(400).json({ message: "Invalid filename" });
        }

        const filePath = await fileStorage.save(originalName, file.buffer, tenantId);

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
          sha256,
          tagIds: tagIds.length > 0 ? tagIds : null,
          uploadedById: userId,
        });

        await storage.createAuditLog({
          tenantId,
          userId,
          action: "upload_evidence",
          entityType: "evidence",
          entityId: evidence.id,
          details: { fileName: file.originalname, fileSize: file.size, sha256 },
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

        await storage.deleteEvidence(tenantId, req.params.id);
        await fileStorage.delete(item.filePath);

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

  app.get("/api/tags", isAuthenticated, requireTenant(), async (req: any, res) => {
    try {
      const tags = await storage.getTagsByTenant(req.tenantCtx.tenantId);
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

  return httpServer;
}
