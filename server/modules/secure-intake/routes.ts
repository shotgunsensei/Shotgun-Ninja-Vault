import type { Express, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { storage } from "../../storage";
import { fileStorage } from "../../fileStorage";
import { isAuthenticated, requireTenant, requireRole } from "../../authz";
import { requireNotPaused } from "../../core/middleware/requireNotPaused";
import type { PlanLimits } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many upload attempts. Please try again later." },
});

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function getTenantPlanLimits(tenantId: string): Promise<PlanLimits | null> {
  const sub = await storage.getTenantSubscription(tenantId);
  const planCode = sub?.planCode || "solo";
  const plan = await storage.getSubscriptionPlanByCode(planCode);
  if (!plan) return null;
  return plan.limits as PlanLimits;
}

async function logIntakeAudit(tenantId: string, action: string, req: Request, extra?: { actorType?: string; actorId?: string; objectType?: string; objectId?: string; metadata?: any }) {
  await storage.createIntakeAuditEvent({
    tenantId,
    actorType: extra?.actorType || "user",
    actorId: extra?.actorId || (req as any).tenantCtx?.userId || (req as any).session?.userId,
    action,
    objectType: extra?.objectType,
    objectId: extra?.objectId,
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null,
    metadata: extra?.metadata,
  });
}

export function registerSecureIntakeRoutes(app: Express) {
  app.get("/api/secure-intake/dashboard", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const stats = await storage.getIntakeDashboardStats(tenantId);
      const limits = await getTenantPlanLimits(tenantId);
      res.json({ ...stats, limits: { intakeStorageGb: limits?.intakeStorageGb || 1, intakeSpacesMax: limits?.intakeSpacesMax || 1, intakeRequestsPerMonth: limits?.intakeRequestsPerMonth || 5 } });
    } catch (error) {
      console.error("[secure-intake] Dashboard error:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.get("/api/secure-intake/spaces", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const spaces = await storage.getIntakeSpacesByTenant(tenantId);
      res.json(spaces);
    } catch (error) {
      res.status(500).json({ message: "Failed to load spaces" });
    }
  });

  app.post("/api/secure-intake/spaces", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const limits = await getTenantPlanLimits(tenantId);
      const currentCount = await storage.getIntakeSpaceCount(tenantId);
      if (limits?.intakeSpacesMax && currentCount >= limits.intakeSpacesMax) {
        return res.status(402).json({ error: "plan_limit_reached", message: "You have reached the intake spaces limit for your current plan." });
      }
      const body = z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
        description: z.string().optional(),
        allowedFileTypes: z.array(z.string()).optional(),
        maxFileSizeMb: z.number().min(1).max(500).optional(),
        requireMetadata: z.boolean().optional(),
        metadataFields: z.any().optional(),
        retentionDays: z.number().min(1).optional().nullable(),
        externalUploadsEnabled: z.boolean().optional(),
      }).parse(req.body);
      const existing = await storage.getIntakeSpaceBySlug(tenantId, body.slug);
      if (existing) return res.status(409).json({ message: "A space with this slug already exists" });
      const space = await storage.createIntakeSpace({ tenantId, ...body });
      await logIntakeAudit(tenantId, "space.created", req, { objectType: "space", objectId: space.id });
      res.status(201).json(space);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: error.errors });
      console.error("[secure-intake] Create space error:", error);
      res.status(500).json({ message: "Failed to create space" });
    }
  });

  app.patch("/api/secure-intake/spaces/:id", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const space = await storage.updateIntakeSpace(tenantId, req.params.id, req.body);
      if (!space) return res.status(404).json({ message: "Space not found" });
      await logIntakeAudit(tenantId, "space.updated", req, { objectType: "space", objectId: space.id });
      res.json(space);
    } catch (error) {
      res.status(500).json({ message: "Failed to update space" });
    }
  });

  app.delete("/api/secure-intake/spaces/:id", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      await storage.deleteIntakeSpace(tenantId, req.params.id);
      await logIntakeAudit(tenantId, "space.deleted", req, { objectType: "space", objectId: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete space" });
    }
  });

  app.get("/api/secure-intake/requests", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const requests = await storage.getUploadRequestsByTenant(tenantId, {
        spaceId: req.query.spaceId as string,
        status: req.query.status as string,
      });
      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "Failed to load requests" });
    }
  });

  app.post("/api/secure-intake/requests", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = (req as any).tenantCtx;
      const body = z.object({
        spaceId: z.string().min(1),
        title: z.string().min(1).max(200),
        uploaderName: z.string().optional(),
        uploaderEmail: z.string().email().optional().or(z.literal("")),
        instructions: z.string().optional(),
        maxUploads: z.number().min(1).optional().nullable(),
        maxTotalSizeMb: z.number().min(1).optional().nullable(),
        allowedFileTypes: z.array(z.string()).optional(),
        oneTimeUse: z.boolean().optional(),
        expiresAt: z.string().optional().nullable(),
        requiresPassword: z.boolean().optional(),
        password: z.string().optional(),
      }).parse(req.body);

      const space = await storage.getIntakeSpaceById(tenantId, body.spaceId);
      if (!space) return res.status(404).json({ message: "Intake space not found" });

      const token = generateSecureToken();
      let passwordHash: string | null = null;
      if (body.requiresPassword && body.password) {
        passwordHash = await bcrypt.hash(body.password, 10);
      }

      const request = await storage.createUploadRequest({
        tenantId,
        spaceId: body.spaceId,
        title: body.title,
        uploaderName: body.uploaderName || null,
        uploaderEmail: body.uploaderEmail || null,
        instructions: body.instructions || null,
        token,
        maxUploads: body.maxUploads ?? null,
        maxTotalSizeMb: body.maxTotalSizeMb ?? null,
        allowedFileTypes: body.allowedFileTypes || null,
        oneTimeUse: body.oneTimeUse || false,
        requiresPassword: !!body.requiresPassword,
        passwordHash,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdById: userId,
        status: "active",
      });

      await logIntakeAudit(tenantId, "request.created", req, { objectType: "upload_request", objectId: request.id, metadata: { uploaderEmail: body.uploaderEmail } });

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || req.hostname;
      const tenant = await storage.getTenantById(tenantId);
      const uploadUrl = `https://${domain}/t/${tenant?.slug}/secure-intake/upload/${token}`;

      res.status(201).json({ ...request, uploadUrl });
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: error.errors });
      console.error("[secure-intake] Create request error:", error);
      res.status(500).json({ message: "Failed to create upload request" });
    }
  });

  app.post("/api/secure-intake/requests/:id/revoke", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      await storage.revokeUploadRequest(tenantId, req.params.id);
      await logIntakeAudit(tenantId, "request.revoked", req, { objectType: "upload_request", objectId: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to revoke request" });
    }
  });

  app.get("/api/secure-intake/files", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const files = await storage.getIntakeFilesByTenant(tenantId, {
        spaceId: req.query.spaceId as string,
        status: req.query.status as string,
        uploadRequestId: req.query.uploadRequestId as string,
        query: req.query.query as string,
      });
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to load files" });
    }
  });

  app.get("/api/secure-intake/files/:id/download", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const file = await storage.getIntakeFileById(tenantId, req.params.id);
      if (!file) return res.status(404).json({ message: "File not found" });
      const buffer = await fileStorage.read(file.storagePath);
      await logIntakeAudit(tenantId, "file.downloaded", req, { objectType: "file", objectId: file.id });
      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.send(buffer);
    } catch (error) {
      console.error("[secure-intake] Download error:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  app.patch("/api/secure-intake/files/:id", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN", "TECH"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = (req as any).tenantCtx;
      const body = z.object({
        status: z.enum(["uploaded", "reviewed", "approved", "rejected", "archived"]).optional(),
        reviewNotes: z.string().optional(),
      }).parse(req.body);
      const updates: any = { ...body };
      if (body.status && ["reviewed", "approved", "rejected"].includes(body.status)) {
        updates.reviewedById = userId;
        updates.reviewedAt = new Date();
      }
      const file = await storage.updateIntakeFile(tenantId, req.params.id, updates);
      if (!file) return res.status(404).json({ message: "File not found" });
      await logIntakeAudit(tenantId, `file.${body.status || "updated"}`, req, { objectType: "file", objectId: file.id });
      res.json(file);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ message: "Validation failed" });
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  app.delete("/api/secure-intake/files/:id", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const file = await storage.getIntakeFileById(tenantId, req.params.id);
      if (!file) return res.status(404).json({ message: "File not found" });
      await fileStorage.delete(file.storagePath);
      await storage.deleteIntakeFile(tenantId, req.params.id);
      await logIntakeAudit(tenantId, "file.deleted", req, { objectType: "file", objectId: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  app.get("/api/secure-intake/storage", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const usedBytes = await storage.getIntakeStorageUsed(tenantId);
      const limits = await getTenantPlanLimits(tenantId);
      res.json({ usedBytes, limitGb: limits?.intakeStorageGb || 1 });
    } catch (error) {
      res.status(500).json({ message: "Failed to load storage info" });
    }
  });

  app.get("/api/secure-intake/audit", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const events = await storage.getIntakeAuditEvents(tenantId, {
        action: req.query.action as string,
        objectType: req.query.objectType as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      });
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to load audit events" });
    }
  });

  app.get("/api/secure-intake/policies", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const policy = await storage.getIntakePolicy(tenantId);
      res.json(policy || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to load policies" });
    }
  });

  app.put("/api/secure-intake/policies", isAuthenticated, requireTenant(), requireRole("OWNER", "ADMIN"), requireNotPaused, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).tenantCtx;
      const body = z.object({
        defaultMaxFileSizeMb: z.number().min(1).max(500).optional(),
        defaultAllowedFileTypes: z.array(z.string()).optional().nullable(),
        defaultRetentionDays: z.number().min(1).optional().nullable(),
        defaultExpirationHours: z.number().min(1).optional(),
        requirePasswordForLinks: z.boolean().optional(),
        autoDeleteExpiredFiles: z.boolean().optional(),
        complianceNotice: z.string().optional().nullable(),
      }).parse(req.body);
      const policy = await storage.upsertIntakePolicy(tenantId, body);
      await logIntakeAudit(tenantId, "policy.updated", req, { objectType: "policy", objectId: policy.id });
      res.json(policy);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ message: "Validation failed" });
      res.status(500).json({ message: "Failed to update policies" });
    }
  });

  app.get("/api/public/intake/:token", uploadLimiter, async (req: Request, res: Response) => {
    try {
      const request = await storage.getUploadRequestByToken(req.params.token);
      if (!request) return res.status(404).json({ message: "Upload request not found" });
      if (request.status === "revoked") return res.status(410).json({ message: "This upload link has been revoked" });
      if (request.status === "expired" || (request.expiresAt && new Date(request.expiresAt) < new Date())) {
        return res.status(410).json({ message: "This upload link has expired" });
      }
      if (request.status === "completed") return res.status(410).json({ message: "This upload request has already been completed" });
      res.json({
        title: request.title,
        instructions: request.instructions,
        spaceName: request.spaceName,
        maxUploads: request.maxUploads,
        maxTotalSizeMb: request.maxTotalSizeMb,
        allowedFileTypes: request.allowedFileTypes,
        uploadCount: request.uploadCount,
        requiresPassword: request.requiresPassword,
        uploaderName: request.uploaderName,
      });
    } catch (error) {
      console.error("[secure-intake] Public intake info error:", error);
      res.status(500).json({ message: "Failed to load upload request" });
    }
  });

  app.post("/api/public/intake/:token/verify-password", uploadLimiter, async (req: Request, res: Response) => {
    try {
      const request = await storage.getUploadRequestByToken(req.params.token);
      if (!request || !request.requiresPassword || !request.passwordHash) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "Password required" });
      const valid = await bcrypt.compare(password, request.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid password" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/public/intake/:token/upload", uploadLimiter, upload.array("files", 10), async (req: Request, res: Response) => {
    try {
      const request = await storage.getUploadRequestByToken(req.params.token);
      if (!request) return res.status(404).json({ message: "Upload request not found" });
      if (request.status !== "active") return res.status(410).json({ message: "This upload link is no longer active" });
      if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
        await storage.updateUploadRequest(request.tenantId, request.id, { status: "expired" });
        return res.status(410).json({ message: "This upload link has expired" });
      }

      if (request.requiresPassword && request.passwordHash) {
        const password = req.body?.password || req.headers["x-upload-password"];
        if (!password) return res.status(401).json({ message: "Password required" });
        const valid = await bcrypt.compare(String(password), request.passwordHash);
        if (!valid) return res.status(401).json({ message: "Invalid password" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ message: "No files provided" });

      if (request.maxUploads && (request.uploadCount + files.length) > request.maxUploads) {
        return res.status(400).json({ message: `Upload limit exceeded. ${request.maxUploads - request.uploadCount} uploads remaining.` });
      }

      const totalNewBytes = files.reduce((sum, f) => sum + f.size, 0);
      if (request.maxTotalSizeMb && (request.totalUploadedBytes + totalNewBytes) > request.maxTotalSizeMb * 1024 * 1024) {
        return res.status(400).json({ message: "Total size limit exceeded" });
      }

      const limits = await getTenantPlanLimits(request.tenantId);
      const currentStorage = await storage.getIntakeStorageUsed(request.tenantId);
      const storageLimit = (limits?.intakeStorageGb || 1) * 1024 * 1024 * 1024;
      if (currentStorage + totalNewBytes > storageLimit) {
        return res.status(402).json({ message: "Storage quota exceeded for this organization" });
      }

      const space = await storage.getIntakeSpaceById(request.tenantId, request.spaceId);
      const allowedTypes = request.allowedFileTypes || space?.allowedFileTypes;
      const maxSizeMb = space?.maxFileSizeMb || 25;

      const uploadedFiles = [];
      for (const file of files) {
        if (file.size > maxSizeMb * 1024 * 1024) {
          continue;
        }

        if (allowedTypes && allowedTypes.length > 0) {
          const ext = file.originalname.split(".").pop()?.toLowerCase();
          if (ext && !allowedTypes.includes(ext)) continue;
        }

        const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
        const storagePath = await fileStorage.save(file.originalname, file.buffer, `intake/${request.tenantId}/${request.spaceId}`);

        const metadata = req.body?.metadata ? (typeof req.body.metadata === "string" ? JSON.parse(req.body.metadata) : req.body.metadata) : null;

        const intakeFile = await storage.createIntakeFile({
          tenantId: request.tenantId,
          spaceId: request.spaceId,
          uploadRequestId: request.id,
          originalName: file.originalname,
          storagePath,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          sha256,
          status: "uploaded",
          uploaderName: request.uploaderName || req.body?.uploaderName || null,
          uploaderEmail: request.uploaderEmail || req.body?.uploaderEmail || null,
          uploaderIp: req.ip || req.socket.remoteAddress || null,
          metadata,
        });

        await storage.incrementUploadRequestCount(request.id, file.size);
        uploadedFiles.push(intakeFile);

        await storage.createIntakeAuditEvent({
          tenantId: request.tenantId,
          actorType: "external",
          actorId: request.uploaderEmail || "anonymous",
          action: "file.uploaded",
          objectType: "file",
          objectId: intakeFile.id,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
          metadata: { fileName: file.originalname, fileSize: file.size, requestId: request.id },
        });
      }

      if (request.oneTimeUse) {
        await storage.updateUploadRequest(request.tenantId, request.id, { status: "completed", completedAt: new Date() });
      }

      res.json({ success: true, uploadedCount: uploadedFiles.length, files: uploadedFiles.map((f) => ({ id: f.id, name: f.originalName, size: f.sizeBytes })) });
    } catch (error) {
      console.error("[secure-intake] Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });
}
