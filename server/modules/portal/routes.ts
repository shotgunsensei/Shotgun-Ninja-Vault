import type { Express } from "express";
import { requireTenant } from "../../authz";
import { storage } from "../../storage";
import { and, eq, inArray, desc } from "drizzle-orm";
import { db } from "../../db";
import { evidenceItems, clients, sites, assets, tags } from "@shared/schema";
import { requireFeature } from "../../core/billing/enforcePlan";

export function registerPortalRoutes(app: Express) {
  const isAuthenticated = requireTenant();

  app.get("/api/portal/me", isAuthenticated, requireFeature("portal"), async (req: any, res) => {
    try {
      const { userId, tenantId, role } = req.tenantCtx;
      if (role !== "CLIENT") {
        return res.status(403).json({ message: "Portal is for CLIENT role users only" });
      }

      const membership = await storage.getUserMembership(userId);
      const tenant = await storage.getTenantById(tenantId);

      res.json({
        userId,
        role,
        tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
      });
    } catch (err: any) {
      console.error("[portal] GET /me error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/portal/clients", isAuthenticated, requireFeature("portal"), async (req: any, res) => {
    try {
      const { userId, tenantId, role } = req.tenantCtx;
      if (role !== "CLIENT") {
        return res.status(403).json({ message: "Portal is for CLIENT role users only" });
      }

      const allowedClientIds = await storage.getClientIdsForUser(userId);
      if (allowedClientIds.length === 0) {
        return res.json([]);
      }

      const clientList = await db
        .select()
        .from(clients)
        .where(and(eq(clients.tenantId, tenantId), inArray(clients.id, allowedClientIds)));

      res.json(clientList);
    } catch (err: any) {
      console.error("[portal] GET /clients error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/portal/clients/:id", isAuthenticated, requireFeature("portal"), async (req: any, res) => {
    try {
      const { userId, tenantId, role } = req.tenantCtx;
      if (role !== "CLIENT") {
        return res.status(403).json({ message: "Portal is for CLIENT role users only" });
      }

      const clientId = req.params.id;
      const allowedClientIds = await storage.getClientIdsForUser(userId);
      if (!allowedClientIds.includes(clientId)) {
        return res.status(403).json({ message: "Access denied to this client" });
      }

      const [client] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId)));

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const clientSites = await db
        .select()
        .from(sites)
        .where(and(eq(sites.tenantId, tenantId), eq(sites.clientId, clientId)));

      const clientAssets = await db
        .select()
        .from(assets)
        .where(and(eq(assets.tenantId, tenantId), eq(assets.clientId, clientId)));

      res.json({ ...client, sites: clientSites, assets: clientAssets });
    } catch (err: any) {
      console.error("[portal] GET /clients/:id error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/portal/evidence", isAuthenticated, requireFeature("portal"), async (req: any, res) => {
    try {
      const { userId, tenantId, role } = req.tenantCtx;
      if (role !== "CLIENT") {
        return res.status(403).json({ message: "Portal is for CLIENT role users only" });
      }

      const allowedClientIds = await storage.getClientIdsForUser(userId);
      if (allowedClientIds.length === 0) {
        return res.json([]);
      }

      const search = req.query.q as string | undefined;
      const clientFilter = req.query.clientId as string | undefined;

      let filterClientIds = allowedClientIds;
      if (clientFilter) {
        if (!allowedClientIds.includes(clientFilter)) {
          return res.status(403).json({ message: "Access denied to this client" });
        }
        filterClientIds = [clientFilter];
      }

      const results = await db
        .select({
          id: evidenceItems.id,
          tenantId: evidenceItems.tenantId,
          clientId: evidenceItems.clientId,
          siteId: evidenceItems.siteId,
          assetId: evidenceItems.assetId,
          title: evidenceItems.title,
          notes: evidenceItems.notes,
          fileName: evidenceItems.fileName,
          fileType: evidenceItems.fileType,
          fileSize: evidenceItems.fileSize,
          sha256: evidenceItems.sha256,
          tagIds: evidenceItems.tagIds,
          uploadedById: evidenceItems.uploadedById,
          createdAt: evidenceItems.createdAt,
          clientName: clients.name,
          assetName: assets.name,
          siteName: sites.name,
        })
        .from(evidenceItems)
        .leftJoin(clients, eq(evidenceItems.clientId, clients.id))
        .leftJoin(assets, eq(evidenceItems.assetId, assets.id))
        .leftJoin(sites, eq(evidenceItems.siteId, sites.id))
        .where(
          and(
            eq(evidenceItems.tenantId, tenantId),
            inArray(evidenceItems.clientId, filterClientIds)
          )
        )
        .orderBy(desc(evidenceItems.createdAt));

      let items = results;
      if (search) {
        const lower = search.toLowerCase();
        items = results.filter(
          (item) =>
            item.title.toLowerCase().includes(lower) ||
            item.fileName.toLowerCase().includes(lower) ||
            (item.notes && item.notes.toLowerCase().includes(lower))
        );
      }

      const allTagIds = new Set<string>();
      items.forEach((item) => {
        if (item.tagIds) {
          item.tagIds.forEach((id) => allTagIds.add(id));
        }
      });

      let tagMap: Record<string, string> = {};
      if (allTagIds.size > 0) {
        const tagRecords = await db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(inArray(tags.id, Array.from(allTagIds)));
        tagRecords.forEach((t) => {
          tagMap[t.id] = t.name;
        });
      }

      const itemsWithTags = items.map((item) => ({
        ...item,
        tags: (item.tagIds || []).map((id) => ({ id, name: tagMap[id] || id })),
      }));

      res.json(itemsWithTags);
    } catch (err: any) {
      console.error("[portal] GET /evidence error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
