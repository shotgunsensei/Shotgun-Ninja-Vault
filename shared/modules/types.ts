export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "core" | "feature";
  version: string;
  requiredPlan?: string;
  navItems?: ModuleNavItem[];
  adminNavItems?: ModuleNavItem[];
}

export interface ModuleNavItem {
  title: string;
  url: string;
  icon: string;
  roles?: string[];
}

export interface ModuleRegistry {
  modules: ModuleDefinition[];
  getModule(id: string): ModuleDefinition | undefined;
  getEnabledModules(): ModuleDefinition[];
  isEnabled(id: string): boolean;
}
