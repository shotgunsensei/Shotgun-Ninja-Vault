import type { ModuleDefinition, ModuleRegistry } from "./types";

export const coreModule: ModuleDefinition = {
  id: "core",
  name: "Core Platform",
  description: "Tenant management, user authentication, team roles, audit logging, and billing. Always enabled.",
  enabled: true,
  category: "core",
  version: "1.0.0",
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
};

export const evidenceModule: ModuleDefinition = {
  id: "evidence",
  name: "Evidence Locker",
  description: "Secure evidence file management with upload, tagging, search, preview, and SHA-256 deduplication.",
  enabled: true,
  category: "feature",
  version: "1.0.0",
  requiredPlan: "free",
  navItems: [
    { title: "Evidence", url: "/evidence", icon: "FileText" },
  ],
};

export const licenseModule: ModuleDefinition = {
  id: "license",
  name: "License Server",
  description: "Issue and validate software license keys with activation tracking, rate-limited public API, and developer documentation.",
  enabled: true,
  category: "feature",
  version: "1.0.0",
  requiredPlan: "free",
  navItems: [
    { title: "Licenses", url: "/licenses", icon: "Key" },
  ],
};

const allModules: ModuleDefinition[] = [coreModule, evidenceModule, licenseModule];

export const moduleRegistry: ModuleRegistry = {
  modules: allModules,

  getModule(id: string): ModuleDefinition | undefined {
    return allModules.find((m) => m.id === id);
  },

  getEnabledModules(): ModuleDefinition[] {
    return allModules.filter((m) => m.enabled);
  },

  isEnabled(id: string): boolean {
    const mod = allModules.find((m) => m.id === id);
    return mod?.enabled ?? false;
  },
};

export type { ModuleDefinition, ModuleRegistry, ModuleNavItem } from "./types";
