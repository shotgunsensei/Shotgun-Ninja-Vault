import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerCoreRoutes } from "./modules/core/routes";
import { registerEvidenceRoutes } from "./modules/evidence/routes";
import { registerLicenseRoutes } from "./modules/license/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  registerCoreRoutes(app);
  registerEvidenceRoutes(app);
  registerLicenseRoutes(app);

  return httpServer;
}
