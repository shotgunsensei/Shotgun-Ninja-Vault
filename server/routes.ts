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
import { pool } from "./db";

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const isApiOnly = process.env.API_ONLY === "true";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuditSubscriber(storage.createAuditLog.bind(storage));

  app.get("/health", async (_req, res) => {
    let dbOk = false;
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch {}
    const status = dbOk ? "ok" : "degraded";
    res.status(dbOk ? 200 : 503).json({
      status,
      mode: isApiOnly ? "api_only" : "full",
      version: APP_VERSION,
      database: dbOk ? "connected" : "unreachable",
    });
  });

  registerApiV1Routes(app);

  if (!isApiOnly) {
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
