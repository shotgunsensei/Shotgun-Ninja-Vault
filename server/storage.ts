import {
  tenants,
  tenantMembers,
  clients,
  sites,
  assets,
  evidenceItems,
  tags,
  auditLogs,
  clientUserAssignments,
  type Tenant,
  type InsertTenant,
  type TenantMember,
  type Client,
  type InsertClient,
  type Site,
  type InsertSite,
  type Asset,
  type InsertAsset,
  type EvidenceItem,
  type InsertEvidence,
  type Tag,
  type InsertTag,
  type AuditLog,
  type ClientUserAccess,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, or, ilike, desc, sql, inArray, gte, lte } from "drizzle-orm";

export interface SearchFilters {
  query?: string;
  clientId?: string;
  assetId?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  uploadedBy?: string;
}

export interface IStorage {
  createTenant(data: InsertTenant): Promise<Tenant>;
  getTenantById(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;

  addMember(tenantId: string, userId: string, role: string): Promise<TenantMember>;
  getMembersByTenant(tenantId: string): Promise<any[]>;
  getUserMembership(userId: string): Promise<{ tenant: Tenant; role: string } | undefined>;
  getMemberRole(tenantId: string, userId: string): Promise<string | undefined>;
  updateMemberRole(tenantId: string, memberId: string, role: string): Promise<void>;

  createClient(data: InsertClient): Promise<Client>;
  getClientsByTenant(tenantId: string): Promise<Client[]>;
  getClientById(tenantId: string, id: string): Promise<Client | undefined>;
  getClientDetail(tenantId: string, id: string): Promise<any>;

  createSite(data: InsertSite): Promise<Site>;
  getSitesByTenant(tenantId: string): Promise<Site[]>;

  createAsset(data: InsertAsset): Promise<Asset>;
  getAssetsByTenant(tenantId: string): Promise<Asset[]>;
  getAssetById(tenantId: string, id: string): Promise<Asset | undefined>;

  createEvidence(data: InsertEvidence): Promise<EvidenceItem>;
  searchEvidence(tenantId: string, filters: SearchFilters): Promise<any[]>;
  getEvidenceById(tenantId: string, id: string): Promise<any>;
  getEvidenceBySha256(tenantId: string, sha256: string): Promise<EvidenceItem | undefined>;
  deleteEvidence(tenantId: string, id: string): Promise<void>;
  getRecentEvidence(tenantId: string, limit?: number): Promise<any[]>;
  getEvidenceByClient(tenantId: string, clientId: string): Promise<EvidenceItem[]>;

  createTag(data: InsertTag): Promise<Tag>;
  getTagsByTenant(tenantId: string): Promise<Tag[]>;
  getTagByName(tenantId: string, name: string): Promise<Tag | undefined>;
  getTagsByIds(ids: string[]): Promise<Tag[]>;

  createAuditLog(data: {
    tenantId: string;
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: any;
  }): Promise<AuditLog>;
  getAuditLogsByTenant(tenantId: string): Promise<any[]>;

  getDashboardStats(tenantId: string): Promise<{
    totalClients: number;
    totalAssets: number;
    totalEvidence: number;
    totalSites: number;
    maxClients: number;
    maxEvidence: number;
    recentEvidence: any[];
  }>;

  getClientIdsForUser(userId: string): Promise<string[]>;
  getClientAccessForUser(userId: string): Promise<Array<{ clientId: string; canUpload: boolean }>>;
  getClientAccessByTenant(tenantId: string): Promise<any[]>;
  addClientAccess(tenantId: string, userId: string, clientId: string, canUpload?: boolean): Promise<ClientUserAccess>;
  removeClientAccess(tenantId: string, id: string): Promise<void>;
  updateClientAccessCanUpload(tenantId: string, id: string, canUpload: boolean): Promise<void>;
  canUserUploadForClient(userId: string, clientId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createTenant(data: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(data).returning();
    return tenant;
  }

  async getTenantById(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant;
  }

  async addMember(tenantId: string, userId: string, role: string): Promise<TenantMember> {
    const [member] = await db
      .insert(tenantMembers)
      .values({ tenantId, userId, role: role as any })
      .returning();
    return member;
  }

  async getMembersByTenant(tenantId: string): Promise<any[]> {
    const result = await db
      .select({
        id: tenantMembers.id,
        tenantId: tenantMembers.tenantId,
        userId: tenantMembers.userId,
        role: tenantMembers.role,
        createdAt: tenantMembers.createdAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(tenantMembers)
      .leftJoin(users, eq(tenantMembers.userId, users.id))
      .where(eq(tenantMembers.tenantId, tenantId));
    return result;
  }

  async getUserMembership(userId: string): Promise<{ tenant: Tenant; role: string } | undefined> {
    const result = await db
      .select({
        tenant: tenants,
        role: tenantMembers.role,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(eq(tenantMembers.userId, userId))
      .limit(1);

    if (result.length === 0) return undefined;
    return { tenant: result[0].tenant, role: result[0].role };
  }

  async getMemberRole(tenantId: string, userId: string): Promise<string | undefined> {
    const [member] = await db
      .select({ role: tenantMembers.role })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, userId)
        )
      );
    return member?.role;
  }

  async updateMemberRole(tenantId: string, memberId: string, role: string): Promise<void> {
    await db
      .update(tenantMembers)
      .set({ role: role as any })
      .where(and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId)));
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async getClientsByTenant(tenantId: string): Promise<Client[]> {
    return db
      .select()
      .from(clients)
      .where(eq(clients.tenantId, tenantId))
      .orderBy(desc(clients.createdAt));
  }

  async getClientById(tenantId: string, id: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)));
    return client;
  }

  async getClientDetail(tenantId: string, id: string): Promise<any> {
    const client = await this.getClientById(tenantId, id);
    if (!client) return undefined;

    const clientSites = await db
      .select()
      .from(sites)
      .where(and(eq(sites.tenantId, tenantId), eq(sites.clientId, id)));

    const clientAssets = await db
      .select()
      .from(assets)
      .where(and(eq(assets.tenantId, tenantId), eq(assets.clientId, id)));

    const clientEvidence = await db
      .select()
      .from(evidenceItems)
      .where(and(eq(evidenceItems.tenantId, tenantId), eq(evidenceItems.clientId, id)))
      .orderBy(desc(evidenceItems.createdAt));

    return {
      ...client,
      sites: clientSites,
      assets: clientAssets,
      evidenceItems: clientEvidence,
    };
  }

  async createSite(data: InsertSite): Promise<Site> {
    const [site] = await db.insert(sites).values(data).returning();
    return site;
  }

  async getSitesByTenant(tenantId: string): Promise<Site[]> {
    return db
      .select()
      .from(sites)
      .where(eq(sites.tenantId, tenantId))
      .orderBy(desc(sites.createdAt));
  }

  async createAsset(data: InsertAsset): Promise<Asset> {
    const [asset] = await db.insert(assets).values(data).returning();
    return asset;
  }

  async getAssetsByTenant(tenantId: string): Promise<Asset[]> {
    return db
      .select()
      .from(assets)
      .where(eq(assets.tenantId, tenantId))
      .orderBy(desc(assets.createdAt));
  }

  async getAssetById(tenantId: string, id: string): Promise<Asset | undefined> {
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.tenantId, tenantId), eq(assets.id, id)));
    return asset;
  }

  async createEvidence(data: InsertEvidence): Promise<EvidenceItem> {
    const [item] = await db.insert(evidenceItems).values(data).returning();
    return item;
  }

  async searchEvidence(tenantId: string, filters: SearchFilters): Promise<any[]> {
    let conditions: any[] = [eq(evidenceItems.tenantId, tenantId)];

    if (filters.clientId) {
      conditions.push(eq(evidenceItems.clientId, filters.clientId));
    }

    if (filters.assetId) {
      conditions.push(eq(evidenceItems.assetId, filters.assetId));
    }

    if (filters.uploadedBy) {
      conditions.push(eq(evidenceItems.uploadedById, filters.uploadedBy));
    }

    if (filters.dateFrom) {
      conditions.push(gte(evidenceItems.createdAt, new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(evidenceItems.createdAt, endDate));
    }

    if (filters.query) {
      const searchTerm = filters.query.trim();
      const tsQuery = searchTerm.split(/\s+/).filter(Boolean).join(" & ");
      conditions.push(
        sql`(
          to_tsvector('english', coalesce(${evidenceItems.title}, '') || ' ' || coalesce(${evidenceItems.notes}, '') || ' ' || coalesce(${evidenceItems.fileName}, ''))
          @@ to_tsquery('english', ${tsQuery + ":*"})
          OR ${evidenceItems.title} ILIKE ${"%" + searchTerm + "%"}
          OR ${evidenceItems.notes} ILIKE ${"%" + searchTerm + "%"}
          OR ${evidenceItems.fileName} ILIKE ${"%" + searchTerm + "%"}
          OR ${clients.name} ILIKE ${"%" + searchTerm + "%"}
          OR ${assets.name} ILIKE ${"%" + searchTerm + "%"}
          OR ${sites.name} ILIKE ${"%" + searchTerm + "%"}
        )`
      );
    }

    let results = await db
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
        filePath: evidenceItems.filePath,
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
      .where(and(...conditions))
      .orderBy(desc(evidenceItems.createdAt));

    if (filters.tag) {
      const tagRecord = await this.getTagByName(tenantId, filters.tag);
      if (tagRecord) {
        results = results.filter(
          (r) => r.tagIds && r.tagIds.includes(tagRecord.id)
        );
      } else {
        return [];
      }
    }

    return results;
  }

  async getEvidenceById(tenantId: string, id: string): Promise<any> {
    const [result] = await db
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
        filePath: evidenceItems.filePath,
        sha256: evidenceItems.sha256,
        tagIds: evidenceItems.tagIds,
        uploadedById: evidenceItems.uploadedById,
        createdAt: evidenceItems.createdAt,
        clientName: clients.name,
        assetName: assets.name,
        siteName: sites.name,
        uploadedByFirstName: users.firstName,
        uploadedByLastName: users.lastName,
      })
      .from(evidenceItems)
      .leftJoin(clients, eq(evidenceItems.clientId, clients.id))
      .leftJoin(assets, eq(evidenceItems.assetId, assets.id))
      .leftJoin(sites, eq(evidenceItems.siteId, sites.id))
      .leftJoin(users, eq(evidenceItems.uploadedById, users.id))
      .where(and(eq(evidenceItems.tenantId, tenantId), eq(evidenceItems.id, id)));

    if (!result) return undefined;

    let tagNames: string[] = [];
    if (result.tagIds && result.tagIds.length > 0) {
      const tagRecords = await this.getTagsByIds(result.tagIds);
      tagNames = tagRecords.map((t) => t.name);
    }

    return {
      ...result,
      uploadedByName: [result.uploadedByFirstName, result.uploadedByLastName]
        .filter(Boolean)
        .join(" ") || undefined,
      tagNames,
    };
  }

  async getEvidenceBySha256(tenantId: string, sha256: string): Promise<EvidenceItem | undefined> {
    const [result] = await db
      .select()
      .from(evidenceItems)
      .where(and(eq(evidenceItems.tenantId, tenantId), eq(evidenceItems.sha256, sha256)));
    return result;
  }

  async deleteEvidence(tenantId: string, id: string): Promise<void> {
    await db
      .delete(evidenceItems)
      .where(and(eq(evidenceItems.tenantId, tenantId), eq(evidenceItems.id, id)));
  }

  async getRecentEvidence(tenantId: string, limit = 5): Promise<any[]> {
    return db
      .select({
        id: evidenceItems.id,
        tenantId: evidenceItems.tenantId,
        clientId: evidenceItems.clientId,
        title: evidenceItems.title,
        fileName: evidenceItems.fileName,
        fileType: evidenceItems.fileType,
        fileSize: evidenceItems.fileSize,
        filePath: evidenceItems.filePath,
        createdAt: evidenceItems.createdAt,
        clientName: clients.name,
      })
      .from(evidenceItems)
      .leftJoin(clients, eq(evidenceItems.clientId, clients.id))
      .where(eq(evidenceItems.tenantId, tenantId))
      .orderBy(desc(evidenceItems.createdAt))
      .limit(limit);
  }

  async getEvidenceByClient(tenantId: string, clientId: string): Promise<EvidenceItem[]> {
    return db
      .select()
      .from(evidenceItems)
      .where(
        and(eq(evidenceItems.tenantId, tenantId), eq(evidenceItems.clientId, clientId))
      )
      .orderBy(desc(evidenceItems.createdAt));
  }

  async createTag(data: InsertTag): Promise<Tag> {
    const [tag] = await db.insert(tags).values(data).returning();
    return tag;
  }

  async getTagsByTenant(tenantId: string): Promise<Tag[]> {
    return db.select().from(tags).where(eq(tags.tenantId, tenantId));
  }

  async getTagByName(tenantId: string, name: string): Promise<Tag | undefined> {
    const [tag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.tenantId, tenantId), eq(tags.name, name)));
    return tag;
  }

  async getTagsByIds(ids: string[]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    return db.select().from(tags).where(inArray(tags.id, ids));
  }

  async createAuditLog(data: {
    tenantId: string;
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: any;
  }): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  async getAuditLogsByTenant(tenantId: string): Promise<any[]> {
    const result = await db
      .select({
        id: auditLogs.id,
        tenantId: auditLogs.tenantId,
        userId: auditLogs.userId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);

    return result.map((r) => ({
      ...r,
      userName: [r.userFirstName, r.userLastName].filter(Boolean).join(" ") || undefined,
    }));
  }

  async getDashboardStats(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);

    const [clientCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(eq(clients.tenantId, tenantId));

    const [siteCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sites)
      .where(eq(sites.tenantId, tenantId));

    const [assetCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assets)
      .where(eq(assets.tenantId, tenantId));

    const [evidenceCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evidenceItems)
      .where(eq(evidenceItems.tenantId, tenantId));

    const recentEvidence = await this.getRecentEvidence(tenantId, 5);

    return {
      totalClients: clientCount.count,
      totalAssets: assetCount.count,
      totalEvidence: evidenceCount.count,
      totalSites: siteCount.count,
      maxClients: tenant?.maxClients || 5,
      maxEvidence: tenant?.maxEvidence || 50,
      recentEvidence,
    };
  }

  async getClientIdsForUser(userId: string): Promise<string[]> {
    const assignments = await db
      .select({ clientId: clientUserAssignments.clientId })
      .from(clientUserAssignments)
      .where(eq(clientUserAssignments.userId, userId));
    return assignments.map((a) => a.clientId);
  }

  async getClientAccessForUser(userId: string): Promise<Array<{ clientId: string; canUpload: boolean }>> {
    return db
      .select({
        clientId: clientUserAssignments.clientId,
        canUpload: clientUserAssignments.canUpload,
      })
      .from(clientUserAssignments)
      .where(eq(clientUserAssignments.userId, userId));
  }

  async getClientAccessByTenant(tenantId: string): Promise<any[]> {
    return db
      .select({
        id: clientUserAssignments.id,
        tenantId: clientUserAssignments.tenantId,
        clientId: clientUserAssignments.clientId,
        userId: clientUserAssignments.userId,
        canUpload: clientUserAssignments.canUpload,
        createdAt: clientUserAssignments.createdAt,
        clientName: clients.name,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(clientUserAssignments)
      .leftJoin(clients, eq(clientUserAssignments.clientId, clients.id))
      .leftJoin(users, eq(clientUserAssignments.userId, users.id))
      .where(eq(clientUserAssignments.tenantId, tenantId))
      .orderBy(desc(clientUserAssignments.createdAt));
  }

  async addClientAccess(tenantId: string, userId: string, clientId: string, canUpload = false): Promise<ClientUserAccess> {
    const [access] = await db
      .insert(clientUserAssignments)
      .values({ tenantId, userId, clientId, canUpload })
      .returning();
    return access;
  }

  async removeClientAccess(tenantId: string, id: string): Promise<void> {
    await db
      .delete(clientUserAssignments)
      .where(and(eq(clientUserAssignments.tenantId, tenantId), eq(clientUserAssignments.id, id)));
  }

  async updateClientAccessCanUpload(tenantId: string, id: string, canUpload: boolean): Promise<void> {
    await db
      .update(clientUserAssignments)
      .set({ canUpload })
      .where(and(eq(clientUserAssignments.tenantId, tenantId), eq(clientUserAssignments.id, id)));
  }

  async canUserUploadForClient(userId: string, clientId: string): Promise<boolean> {
    const [access] = await db
      .select({ canUpload: clientUserAssignments.canUpload })
      .from(clientUserAssignments)
      .where(
        and(
          eq(clientUserAssignments.userId, userId),
          eq(clientUserAssignments.clientId, clientId)
        )
      );
    return access?.canUpload ?? false;
  }
}

export const storage = new DatabaseStorage();
