import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const roleEnum = pgEnum("member_role", [
  "OWNER",
  "ADMIN",
  "TECH",
  "CLIENT",
]);

export const tenants = pgTable("tenants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  maxClients: integer("max_clients").notNull().default(5),
  maxEvidence: integer("max_evidence").notNull().default(50),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMembers),
  clients: many(clients),
  assets: many(assets),
  evidenceItems: many(evidenceItems),
  auditLogs: many(auditLogs),
}));

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("TECH"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_member_tenant").on(table.tenantId),
    index("idx_member_user").on(table.userId),
  ]
);

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(usersTable, {
    fields: [tenantMembers.userId],
    references: [usersTable.id],
  }),
}));

import { users as usersTable } from "./models/auth";

export const clients = pgTable(
  "clients",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_client_tenant").on(table.tenantId)]
);

export const clientsRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clients.tenantId],
    references: [tenants.id],
  }),
  sites: many(sites),
  evidenceItems: many(evidenceItems),
  clientAssignments: many(clientUserAssignments),
}));

export const clientUserAssignments = pgTable(
  "client_user_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: varchar("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    canUpload: boolean("can_upload").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_assignment_client").on(table.clientId),
    index("idx_assignment_user").on(table.userId),
    index("idx_assignment_tenant").on(table.tenantId),
  ]
);

export const clientUserAssignmentsRelations = relations(
  clientUserAssignments,
  ({ one }) => ({
    client: one(clients, {
      fields: [clientUserAssignments.clientId],
      references: [clients.id],
    }),
    user: one(usersTable, {
      fields: [clientUserAssignments.userId],
      references: [usersTable.id],
    }),
  })
);

export const sites = pgTable(
  "sites",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: varchar("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_site_tenant").on(table.tenantId)]
);

export const sitesRelations = relations(sites, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [sites.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [sites.clientId],
    references: [clients.id],
  }),
  assets: many(assets),
}));

export const assets = pgTable(
  "assets",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: varchar("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    siteId: varchar("site_id").references(() => sites.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    type: text("type"),
    serialNumber: text("serial_number"),
    ipAddress: text("ip_address"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_asset_tenant").on(table.tenantId)]
);

export const assetsRelations = relations(assets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [assets.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [assets.clientId],
    references: [clients.id],
  }),
  site: one(sites, {
    fields: [assets.siteId],
    references: [sites.id],
  }),
  evidenceItems: many(evidenceItems),
}));

export const tags = pgTable(
  "tags",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (table) => [index("idx_tag_tenant").on(table.tenantId)]
);

export const tagsRelations = relations(tags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tags.tenantId],
    references: [tenants.id],
  }),
}));

export const evidenceItems = pgTable(
  "evidence_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: varchar("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    siteId: varchar("site_id").references(() => sites.id, {
      onDelete: "set null",
    }),
    assetId: varchar("asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size").notNull(),
    filePath: text("file_path").notNull(),
    sha256: text("sha256"),
    tagIds: text("tag_ids").array(),
    uploadedById: varchar("uploaded_by_id").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_evidence_tenant").on(table.tenantId),
    index("idx_evidence_client").on(table.clientId),
    index("idx_evidence_sha256").on(table.sha256),
  ]
);

export const evidenceItemsRelations = relations(evidenceItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [evidenceItems.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [evidenceItems.clientId],
    references: [clients.id],
  }),
  site: one(sites, {
    fields: [evidenceItems.siteId],
    references: [sites.id],
  }),
  asset: one(assets, {
    fields: [evidenceItems.assetId],
    references: [assets.id],
  }),
  uploadedBy: one(usersTable, {
    fields: [evidenceItems.uploadedById],
    references: [usersTable.id],
  }),
}));

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: varchar("user_id").references(() => usersTable.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: varchar("entity_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_audit_tenant").on(table.tenantId)]
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(usersTable, {
    fields: [auditLogs.userId],
    references: [usersTable.id],
  }),
}));

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});
export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
  createdAt: true,
});
export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
});
export const insertEvidenceSchema = createInsertSchema(evidenceItems).omit({
  id: true,
  createdAt: true,
});
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export const insertClientUserAccessSchema = createInsertSchema(clientUserAssignments).omit({
  id: true,
  createdAt: true,
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type TenantMember = typeof tenantMembers.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type EvidenceItem = typeof evidenceItems.$inferSelect;
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ClientUserAccess = typeof clientUserAssignments.$inferSelect;
export type InsertClientUserAccess = z.infer<typeof insertClientUserAccessSchema>;
export type MemberRole = "OWNER" | "ADMIN" | "TECH" | "CLIENT";
