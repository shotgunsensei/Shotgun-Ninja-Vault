import type { VaultModuleManifest, ModuleRegistry } from "./types";

export const coreModule: VaultModuleManifest = {
  id: "core",
  name: "Core Platform",
  description: "Tenant management, user authentication, team roles, audit logging, and billing. Always enabled.",
  enabled: true,
  category: "core",
  version: "1.0.0",
  server: {
    mountPath: "/api",
    routesFile: "server/modules/core/routes.ts",
    emits: [
      "tenant.created",
      "client.created", "client.updated", "client.deleted",
      "site.created", "site.updated", "site.deleted",
      "asset.created", "asset.updated", "asset.deleted",
      "member.invited", "member.role_changed", "member.removed",
    ],
  },
  client: {
    navItems: [
      { title: "Dashboard", url: "/", icon: "LayoutDashboard" },
      { title: "Clients", url: "/clients", icon: "Users" },
      { title: "Sites", url: "/sites", icon: "MapPin", roles: ["OWNER", "ADMIN", "TECH"] },
      { title: "Assets", url: "/assets", icon: "Server", roles: ["OWNER", "ADMIN", "TECH"] },
    ],
    adminNavItems: [
      { title: "Team", url: "/team", icon: "Building2", roles: ["OWNER", "ADMIN"] },
      { title: "Client Access", url: "/client-access", icon: "KeyRound", roles: ["OWNER", "ADMIN"] },
      { title: "Audit Log", url: "/audit", icon: "Shield", roles: ["OWNER", "ADMIN"] },
      { title: "Settings", url: "/settings", icon: "Settings", roles: ["OWNER", "ADMIN", "TECH"] },
    ],
  },
  roles: ["OWNER", "ADMIN", "TECH", "CLIENT"],
};

export const evidenceModule: VaultModuleManifest = {
  id: "evidence",
  name: "Evidence Locker",
  description: "Secure evidence file management with upload, tagging, search, preview, and SHA-256 deduplication.",
  enabled: true,
  category: "feature",
  version: "1.0.0",
  requiredPlan: "free",
  server: {
    mountPath: "/api/evidence",
    routesFile: "server/modules/evidence/routes.ts",
    emits: ["evidence.uploaded", "evidence.deleted"],
  },
  client: {
    navItems: [
      { title: "Evidence", url: "/evidence", icon: "FileText" },
    ],
  },
};

export const licenseModule: VaultModuleManifest = {
  id: "license",
  name: "License Server",
  description: "Issue and validate software license keys with activation tracking, rate-limited public API, and developer documentation.",
  enabled: true,
  category: "feature",
  version: "1.0.0",
  requiredPlan: "free",
  server: {
    mountPath: "/api/license",
    routesFile: "server/modules/license/routes.ts",
    emits: [
      "license.product_created",
      "license.key_issued", "license.key_revoked",
      "license.activation",
    ],
  },
  client: {
    navItems: [
      { title: "Licenses", url: "/licenses", icon: "Key" },
    ],
  },
  roles: ["OWNER", "ADMIN"],
};

export const webhooksModule: VaultModuleManifest = {
  id: "webhooks",
  name: "Webhooks",
  description: "Outbound webhook delivery with HMAC signing, retry logic, and delivery logs. Integrates with Zapier, Make, n8n, or custom endpoints.",
  enabled: true,
  category: "feature",
  version: "1.0.0",
  requiredPlan: "free",
  server: {
    mountPath: "/api/webhooks",
    routesFile: "server/modules/webhooks/routes.ts",
    consumes: ["*"],
    emits: ["webhook.created", "webhook.updated", "webhook.deleted"],
  },
  client: {
    navItems: [
      { title: "Webhooks", url: "/webhooks", icon: "Webhook", roles: ["OWNER", "ADMIN"] },
    ],
  },
  roles: ["OWNER", "ADMIN"],
};

export const statusModule: VaultModuleManifest = {
  id: "status",
  name: "Status Pages",
  description: "Public status pages with component monitoring, incident tracking, and real-time status updates for your customers.",
  enabled: true,
  category: "feature",
  version: "1.0.0",
  requiredPlan: "free",
  server: {
    mountPath: "/api/status",
    routesFile: "server/modules/status/routes.ts",
    emits: [
      "status.page_updated",
      "status.component_created", "status.component_updated", "status.component_deleted",
      "status.incident_created", "status.incident_updated", "status.incident_deleted",
    ],
  },
  client: {
    navItems: [],
    adminNavItems: [
      { title: "Status", url: "/status-admin", icon: "Activity", roles: ["OWNER", "ADMIN"] },
    ],
  },
  roles: ["OWNER", "ADMIN"],
};

export const reportsModule: VaultModuleManifest = {
  id: "reports",
  name: "Compliance Reports",
  description: "Generate downloadable Evidence Packet ZIP exports with manifests, SHA-256 checksums, audit trails, and filtered evidence files.",
  enabled: true,
  category: "feature",
  version: "1.0.0",
  requiredPlan: "free",
  server: {
    mountPath: "/api/reports",
    routesFile: "server/modules/reports/routes.ts",
    emits: [
      "report.job_created", "report.job_completed", "report.job_failed",
    ],
  },
  client: {
    navItems: [
      { title: "Reports", url: "/reports", icon: "ClipboardList", roles: ["OWNER", "ADMIN", "TECH"] },
    ],
  },
  roles: ["OWNER", "ADMIN", "TECH"],
};

const allModules: VaultModuleManifest[] = [coreModule, evidenceModule, licenseModule, webhooksModule, statusModule, reportsModule];

export const moduleRegistry: ModuleRegistry = {
  modules: allModules,

  getModule(id: string): VaultModuleManifest | undefined {
    return allModules.find((m) => m.id === id);
  },

  getEnabledModules(): VaultModuleManifest[] {
    return allModules.filter((m) => m.enabled);
  },

  isEnabled(id: string): boolean {
    const mod = allModules.find((m) => m.id === id);
    return mod?.enabled ?? false;
  },
};

export type { VaultModuleManifest, ModuleDefinition, ModuleRegistry, ModuleNavItem } from "./types";
