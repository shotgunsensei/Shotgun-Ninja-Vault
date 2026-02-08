import type { Express } from "express";
import { type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerCoreRoutes } from "./modules/core/routes";
import { registerEvidenceRoutes } from "./modules/evidence/routes";
import { registerLicenseRoutes } from "./modules/license/routes";
import { registerWebhookRoutes } from "./modules/webhooks/routes";
import { registerStatusRoutes } from "./modules/status/routes";
import { registerReportRoutes } from "./modules/reports/routes";
import { registerPortalRoutes } from "./modules/portal/routes";
import { registerApiV1Routes } from "./modules/api/routes";
import { registerApiTokenAdminRoutes } from "./modules/api/adminRoutes";
import { registerAuditSubscriber } from "./core/events/subscribers";
import { startWebhookWorker } from "./modules/webhooks/worker";
import { storage } from "./storage";

const isApiOnly = process.env.API_ONLY === "true";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuditSubscriber(storage.createAuditLog.bind(storage));

  registerApiV1Routes(app);

  if (isApiOnly) {
    app.get("/health", (_req, res) => res.json({ status: "ok", mode: "api_only" }));
  } else {
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
    registerApiTokenAdminRoutes(app);
  }

  return httpServer;
}
