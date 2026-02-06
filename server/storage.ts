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
  licenseProducts,
  licenseKeys,
  licenseActivations,
  webhookEndpoints,
  statusPages,
  statusComponents,
  statusIncidents,
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
  type LicenseProduct,
  type InsertLicenseProduct,
  type LicenseKey,
  type InsertLicenseKey,
  type LicenseActivation,
  type InsertLicenseActivation,
  type WebhookEndpoint,
  type InsertWebhookEndpoint,
  webhookDeliveries,
  type WebhookDelivery,
  type InsertWebhookDelivery,
  type StatusPage,
  type InsertStatusPage,
  type StatusComponent,
  type InsertStatusComponent,
  type StatusIncident,
  type InsertStatusIncident,
  reportJobs,
  type ReportJob,
  type InsertReportJob,
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

export interface AuditFilters {
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
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
  getAuditLogsByTenant(tenantId: string, filters?: AuditFilters): Promise<any[]>;
  getAuditActionTypes(tenantId: string): Promise<string[]>;

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

  createLicenseProduct(data: InsertLicenseProduct): Promise<LicenseProduct>;
  getLicenseProductsByTenant(tenantId: string): Promise<LicenseProduct[]>;
  getLicenseProductById(tenantId: string, id: string): Promise<LicenseProduct | undefined>;
  getLicenseProductBySlug(tenantId: string, slug: string): Promise<LicenseProduct | undefined>;
  updateLicenseProduct(tenantId: string, id: string, data: Partial<Pick<LicenseProduct, "name" | "slug" | "description" | "isActive">>): Promise<LicenseProduct | undefined>;

  createLicenseKey(data: InsertLicenseKey): Promise<LicenseKey>;
  getLicenseKeysByProduct(tenantId: string, productId: string): Promise<LicenseKey[]>;
  getLicenseKeyById(tenantId: string, id: string): Promise<LicenseKey | undefined>;
  getLicenseKeyByHash(keyHash: string): Promise<(LicenseKey & { productSlug: string; productIsActive: boolean }) | undefined>;
  revokeLicenseKey(tenantId: string, id: string): Promise<void>;

  createLicenseActivation(data: InsertLicenseActivation): Promise<LicenseActivation>;
  getActivationsByKey(tenantId: string, licenseKeyId: string): Promise<LicenseActivation[]>;
  getActivationCountByKey(licenseKeyId: string): Promise<number>;
  getActivationByFingerprint(licenseKeyId: string, deviceFingerprint: string): Promise<LicenseActivation | undefined>;

  createWebhookEndpoint(data: InsertWebhookEndpoint): Promise<WebhookEndpoint>;
  getWebhookEndpointsByTenant(tenantId: string): Promise<WebhookEndpoint[]>;
  getWebhookEndpointById(tenantId: string, id: string): Promise<WebhookEndpoint | undefined>;
  updateWebhookEndpoint(tenantId: string, id: string, data: Partial<Pick<WebhookEndpoint, "url" | "enabled" | "eventTypes" | "description">>): Promise<WebhookEndpoint | undefined>;
  deleteWebhookEndpoint(tenantId: string, id: string): Promise<void>;
  getEnabledWebhooksForEvent(tenantId: string, eventType: string): Promise<WebhookEndpoint[]>;

  createWebhookDelivery(data: InsertWebhookDelivery): Promise<WebhookDelivery>;
  getWebhookDeliveriesByEndpoint(tenantId: string, endpointId: string, limit?: number): Promise<WebhookDelivery[]>;
  getPendingWebhookDeliveries(limit?: number): Promise<WebhookDelivery[]>;
  updateWebhookDelivery(id: string, data: Partial<Pick<WebhookDelivery, "status" | "responseCode" | "responseBody" | "durationMs" | "attempts" | "nextRetryAt" | "completedAt">>): Promise<void>;

  getStatusPageByTenant(tenantId: string): Promise<StatusPage | undefined>;
  getStatusPageBySlug(slug: string): Promise<StatusPage | undefined>;
  upsertStatusPage(tenantId: string, data: Partial<Pick<StatusPage, "publicSlug" | "isPublic" | "title" | "description">>): Promise<StatusPage>;

  createStatusComponent(data: InsertStatusComponent): Promise<StatusComponent>;
  getStatusComponentsByTenant(tenantId: string): Promise<StatusComponent[]>;
  getStatusComponentById(tenantId: string, id: string): Promise<StatusComponent | undefined>;
  updateStatusComponent(tenantId: string, id: string, data: Partial<Pick<StatusComponent, "name" | "description" | "status" | "displayOrder">>): Promise<StatusComponent | undefined>;
  deleteStatusComponent(tenantId: string, id: string): Promise<void>;

  createStatusIncident(data: InsertStatusIncident): Promise<StatusIncident>;
  getStatusIncidentsByTenant(tenantId: string): Promise<StatusIncident[]>;
  getStatusIncidentById(tenantId: string, id: string): Promise<StatusIncident | undefined>;
  updateStatusIncident(tenantId: string, id: string, data: Partial<Pick<StatusIncident, "title" | "description" | "severity" | "status" | "resolvedAt">>): Promise<StatusIncident | undefined>;
  deleteStatusIncident(tenantId: string, id: string): Promise<void>;
  getActiveIncidentsByTenant(tenantId: string): Promise<StatusIncident[]>;
  getRecentResolvedIncidents(tenantId: string, limit?: number): Promise<StatusIncident[]>;

  createReportJob(data: InsertReportJob): Promise<ReportJob>;
  updateReportJobStatus(id: string, tenantId: string, status: string, updates?: { outputPath?: string; errorMessage?: string }): Promise<ReportJob | undefined>;
  getReportJob(tenantId: string, id: string): Promise<ReportJob | undefined>;
  listReportJobs(tenantId: string): Promise<ReportJob[]>;
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

  async getAuditLogsByTenant(tenantId: string, filters?: AuditFilters): Promise<any[]> {
    const conditions = [eq(auditLogs.tenantId, tenantId)];

    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

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
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);

    return result.map((r) => ({
      ...r,
      userName: [r.userFirstName, r.userLastName].filter(Boolean).join(" ") || undefined,
    }));
  }

  async getAuditActionTypes(tenantId: string): Promise<string[]> {
    const result = await db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(auditLogs.action);
    return result.map((r) => r.action);
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

  async createLicenseProduct(data: InsertLicenseProduct): Promise<LicenseProduct> {
    const [product] = await db.insert(licenseProducts).values(data).returning();
    return product;
  }

  async getLicenseProductsByTenant(tenantId: string): Promise<LicenseProduct[]> {
    return db
      .select()
      .from(licenseProducts)
      .where(eq(licenseProducts.tenantId, tenantId))
      .orderBy(desc(licenseProducts.createdAt));
  }

  async getLicenseProductById(tenantId: string, id: string): Promise<LicenseProduct | undefined> {
    const [product] = await db
      .select()
      .from(licenseProducts)
      .where(and(eq(licenseProducts.tenantId, tenantId), eq(licenseProducts.id, id)));
    return product;
  }

  async getLicenseProductBySlug(tenantId: string, slug: string): Promise<LicenseProduct | undefined> {
    const [product] = await db
      .select()
      .from(licenseProducts)
      .where(and(eq(licenseProducts.tenantId, tenantId), eq(licenseProducts.slug, slug)));
    return product;
  }

  async updateLicenseProduct(tenantId: string, id: string, data: Partial<Pick<LicenseProduct, "name" | "slug" | "description" | "isActive">>): Promise<LicenseProduct | undefined> {
    const [product] = await db
      .update(licenseProducts)
      .set(data)
      .where(and(eq(licenseProducts.tenantId, tenantId), eq(licenseProducts.id, id)))
      .returning();
    return product;
  }

  async createLicenseKey(data: InsertLicenseKey): Promise<LicenseKey> {
    const [key] = await db.insert(licenseKeys).values(data).returning();
    return key;
  }

  async getLicenseKeysByProduct(tenantId: string, productId: string): Promise<LicenseKey[]> {
    return db
      .select()
      .from(licenseKeys)
      .where(and(eq(licenseKeys.tenantId, tenantId), eq(licenseKeys.productId, productId)))
      .orderBy(desc(licenseKeys.createdAt));
  }

  async getLicenseKeyById(tenantId: string, id: string): Promise<LicenseKey | undefined> {
    const [key] = await db
      .select()
      .from(licenseKeys)
      .where(and(eq(licenseKeys.tenantId, tenantId), eq(licenseKeys.id, id)));
    return key;
  }

  async getLicenseKeyByHash(keyHash: string): Promise<(LicenseKey & { productSlug: string; productIsActive: boolean }) | undefined> {
    const [result] = await db
      .select({
        id: licenseKeys.id,
        tenantId: licenseKeys.tenantId,
        productId: licenseKeys.productId,
        keyHash: licenseKeys.keyHash,
        label: licenseKeys.label,
        maxActivations: licenseKeys.maxActivations,
        expiresAt: licenseKeys.expiresAt,
        isRevoked: licenseKeys.isRevoked,
        createdAt: licenseKeys.createdAt,
        productSlug: licenseProducts.slug,
        productIsActive: licenseProducts.isActive,
      })
      .from(licenseKeys)
      .innerJoin(licenseProducts, eq(licenseKeys.productId, licenseProducts.id))
      .where(eq(licenseKeys.keyHash, keyHash));
    return result;
  }

  async revokeLicenseKey(tenantId: string, id: string): Promise<void> {
    await db
      .update(licenseKeys)
      .set({ isRevoked: true })
      .where(and(eq(licenseKeys.tenantId, tenantId), eq(licenseKeys.id, id)));
  }

  async createLicenseActivation(data: InsertLicenseActivation): Promise<LicenseActivation> {
    const [activation] = await db.insert(licenseActivations).values(data).returning();
    return activation;
  }

  async getActivationsByKey(tenantId: string, licenseKeyId: string): Promise<LicenseActivation[]> {
    return db
      .select()
      .from(licenseActivations)
      .where(and(eq(licenseActivations.tenantId, tenantId), eq(licenseActivations.licenseKeyId, licenseKeyId)))
      .orderBy(desc(licenseActivations.createdAt));
  }

  async getActivationCountByKey(licenseKeyId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(licenseActivations)
      .where(eq(licenseActivations.licenseKeyId, licenseKeyId));
    return result.count;
  }

  async getActivationByFingerprint(licenseKeyId: string, deviceFingerprint: string): Promise<LicenseActivation | undefined> {
    const [result] = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.licenseKeyId, licenseKeyId),
          eq(licenseActivations.deviceFingerprint, deviceFingerprint)
        )
      );
    return result;
  }

  async createWebhookEndpoint(data: InsertWebhookEndpoint): Promise<WebhookEndpoint> {
    const [endpoint] = await db.insert(webhookEndpoints).values(data).returning();
    return endpoint;
  }

  async getWebhookEndpointsByTenant(tenantId: string): Promise<WebhookEndpoint[]> {
    return db.select().from(webhookEndpoints).where(eq(webhookEndpoints.tenantId, tenantId)).orderBy(desc(webhookEndpoints.createdAt));
  }

  async getWebhookEndpointById(tenantId: string, id: string): Promise<WebhookEndpoint | undefined> {
    const [endpoint] = await db.select().from(webhookEndpoints).where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.id, id)));
    return endpoint;
  }

  async updateWebhookEndpoint(tenantId: string, id: string, data: Partial<Pick<WebhookEndpoint, "url" | "enabled" | "eventTypes" | "description">>): Promise<WebhookEndpoint | undefined> {
    const [updated] = await db.update(webhookEndpoints).set(data).where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.id, id))).returning();
    return updated;
  }

  async deleteWebhookEndpoint(tenantId: string, id: string): Promise<void> {
    await db.delete(webhookEndpoints).where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.id, id)));
  }

  async getEnabledWebhooksForEvent(tenantId: string, eventType: string): Promise<WebhookEndpoint[]> {
    const endpoints = await db.select().from(webhookEndpoints).where(
      and(
        eq(webhookEndpoints.tenantId, tenantId),
        eq(webhookEndpoints.enabled, true)
      )
    );
    return endpoints.filter((ep) => {
      if (!ep.eventTypes || ep.eventTypes.length === 0) return true;
      return ep.eventTypes.includes(eventType) || ep.eventTypes.includes("*");
    });
  }

  async createWebhookDelivery(data: InsertWebhookDelivery): Promise<WebhookDelivery> {
    const [delivery] = await db.insert(webhookDeliveries).values(data).returning();
    return delivery;
  }

  async getWebhookDeliveriesByEndpoint(tenantId: string, endpointId: string, limit = 50): Promise<WebhookDelivery[]> {
    return db.select().from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.tenantId, tenantId), eq(webhookDeliveries.webhookEndpointId, endpointId)))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  }

  async getPendingWebhookDeliveries(limit = 20): Promise<WebhookDelivery[]> {
    return db.select().from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, "pending"),
          or(
            sql`${webhookDeliveries.nextRetryAt} IS NULL`,
            lte(webhookDeliveries.nextRetryAt, new Date())
          )
        )
      )
      .orderBy(webhookDeliveries.createdAt)
      .limit(limit);
  }

  async updateWebhookDelivery(id: string, data: Partial<Pick<WebhookDelivery, "status" | "responseCode" | "responseBody" | "durationMs" | "attempts" | "nextRetryAt" | "completedAt">>): Promise<void> {
    await db.update(webhookDeliveries).set(data).where(eq(webhookDeliveries.id, id));
  }

  async getStatusPageByTenant(tenantId: string): Promise<StatusPage | undefined> {
    const [page] = await db.select().from(statusPages).where(eq(statusPages.tenantId, tenantId));
    return page;
  }

  async getStatusPageBySlug(slug: string): Promise<StatusPage | undefined> {
    const [page] = await db.select().from(statusPages).where(eq(statusPages.publicSlug, slug));
    return page;
  }

  async upsertStatusPage(tenantId: string, data: Partial<Pick<StatusPage, "publicSlug" | "isPublic" | "title" | "description">>): Promise<StatusPage> {
    const existing = await this.getStatusPageByTenant(tenantId);
    if (existing) {
      const [updated] = await db.update(statusPages).set({ ...data, updatedAt: new Date() }).where(eq(statusPages.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(statusPages).values({
      tenantId,
      publicSlug: data.publicSlug || tenantId.slice(0, 8),
      isPublic: data.isPublic ?? false,
      title: data.title || "Status Page",
      description: data.description,
    }).returning();
    return created;
  }

  async createStatusComponent(data: InsertStatusComponent): Promise<StatusComponent> {
    const [component] = await db.insert(statusComponents).values(data).returning();
    return component;
  }

  async getStatusComponentsByTenant(tenantId: string): Promise<StatusComponent[]> {
    return db.select().from(statusComponents).where(eq(statusComponents.tenantId, tenantId)).orderBy(statusComponents.displayOrder);
  }

  async getStatusComponentById(tenantId: string, id: string): Promise<StatusComponent | undefined> {
    const [component] = await db.select().from(statusComponents).where(and(eq(statusComponents.tenantId, tenantId), eq(statusComponents.id, id)));
    return component;
  }

  async updateStatusComponent(tenantId: string, id: string, data: Partial<Pick<StatusComponent, "name" | "description" | "status" | "displayOrder">>): Promise<StatusComponent | undefined> {
    const [updated] = await db.update(statusComponents).set({ ...data, updatedAt: new Date() }).where(and(eq(statusComponents.tenantId, tenantId), eq(statusComponents.id, id))).returning();
    return updated;
  }

  async deleteStatusComponent(tenantId: string, id: string): Promise<void> {
    await db.delete(statusComponents).where(and(eq(statusComponents.tenantId, tenantId), eq(statusComponents.id, id)));
  }

  async createStatusIncident(data: InsertStatusIncident): Promise<StatusIncident> {
    const [incident] = await db.insert(statusIncidents).values(data).returning();
    return incident;
  }

  async getStatusIncidentsByTenant(tenantId: string): Promise<StatusIncident[]> {
    return db.select().from(statusIncidents).where(eq(statusIncidents.tenantId, tenantId)).orderBy(desc(statusIncidents.createdAt));
  }

  async getStatusIncidentById(tenantId: string, id: string): Promise<StatusIncident | undefined> {
    const [incident] = await db.select().from(statusIncidents).where(and(eq(statusIncidents.tenantId, tenantId), eq(statusIncidents.id, id)));
    return incident;
  }

  async updateStatusIncident(tenantId: string, id: string, data: Partial<Pick<StatusIncident, "title" | "description" | "severity" | "status" | "resolvedAt">>): Promise<StatusIncident | undefined> {
    const [updated] = await db.update(statusIncidents).set({ ...data, updatedAt: new Date() }).where(and(eq(statusIncidents.tenantId, tenantId), eq(statusIncidents.id, id))).returning();
    return updated;
  }

  async deleteStatusIncident(tenantId: string, id: string): Promise<void> {
    await db.delete(statusIncidents).where(and(eq(statusIncidents.tenantId, tenantId), eq(statusIncidents.id, id)));
  }

  async getActiveIncidentsByTenant(tenantId: string): Promise<StatusIncident[]> {
    return db.select().from(statusIncidents).where(
      and(
        eq(statusIncidents.tenantId, tenantId),
        sql`${statusIncidents.status} != 'resolved'`
      )
    ).orderBy(desc(statusIncidents.createdAt));
  }

  async getRecentResolvedIncidents(tenantId: string, limit = 10): Promise<StatusIncident[]> {
    return db.select().from(statusIncidents).where(
      and(
        eq(statusIncidents.tenantId, tenantId),
        sql`${statusIncidents.status} = 'resolved'`
      )
    ).orderBy(desc(statusIncidents.resolvedAt)).limit(limit);
  }
  async createReportJob(data: InsertReportJob): Promise<ReportJob> {
    const [job] = await db.insert(reportJobs).values(data).returning();
    return job;
  }

  async updateReportJobStatus(id: string, tenantId: string, status: string, updates?: { outputPath?: string; errorMessage?: string }): Promise<ReportJob | undefined> {
    const [updated] = await db.update(reportJobs).set({
      status: status as any,
      updatedAt: new Date(),
      ...(updates?.outputPath !== undefined ? { outputPath: updates.outputPath } : {}),
      ...(updates?.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
    }).where(and(eq(reportJobs.id, id), eq(reportJobs.tenantId, tenantId))).returning();
    return updated;
  }

  async getReportJob(tenantId: string, id: string): Promise<ReportJob | undefined> {
    const [job] = await db.select().from(reportJobs).where(and(eq(reportJobs.tenantId, tenantId), eq(reportJobs.id, id)));
    return job;
  }

  async listReportJobs(tenantId: string): Promise<ReportJob[]> {
    return db.select().from(reportJobs).where(eq(reportJobs.tenantId, tenantId)).orderBy(desc(reportJobs.createdAt));
  }
}

export const storage = new DatabaseStorage();
