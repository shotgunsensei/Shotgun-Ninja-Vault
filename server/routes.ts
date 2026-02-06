import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerCoreRoutes } from "./modules/core/routes";
import { registerEvidenceRoutes } from "./modules/evidence/routes";
import { registerLicenseRoutes } from "./modules/license/routes";
import { registerWebhookRoutes } from "./modules/webhooks/routes";
import { registerStatusRoutes } from "./modules/status/routes";
import { registerReportRoutes } from "./modules/reports/routes";
import { registerPortalRoutes } from "./modules/portal/routes";
import { registerAuditSubscriber } from "./core/events/subscribers";
import { startWebhookWorker } from "./modules/webhooks/worker";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuditSubscriber(storage.createAuditLog.bind(storage));
  startWebhookWorker();

  await setupAuth(app);
  registerAuthRoutes(app);

  registerCoreRoutes(app);
  registerEvidenceRoutes(app);
  registerLicenseRoutes(app);
  registerWebhookRoutes(app);
  registerStatusRoutes(app);
  registerReportRoutes(app);
  registerPortalRoutes(app);

  return httpServer;
}
