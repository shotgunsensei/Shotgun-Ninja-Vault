import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";
import type { PlanLimits } from "@shared/schema";

async function getTenantPlanLimits(tenantId: string): Promise<PlanLimits | null> {
  const sub = await storage.getTenantSubscription(tenantId);
  const planCode = sub?.planCode || "solo";
  const plan = await storage.getSubscriptionPlanByCode(planCode);
  if (!plan) return null;
  return plan.limits as PlanLimits;
}

function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function requireFeature(feature: "api" | "portal" | "status" | "webhooks" | "reports") {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantCtx?.tenantId;
      if (!tenantId) return next();

      const limits = await getTenantPlanLimits(tenantId);
      if (!limits) return next();

      const featureMap: Record<string, keyof PlanLimits> = {
        api: "apiEnabled",
        portal: "portalEnabled",
        status: "statusEnabled",
        webhooks: "webhooksMax",
        reports: "reportsPerMonth",
      };

      const limitKey = featureMap[feature];
      if (!limitKey) return next();

      if (typeof limits[limitKey] === "boolean" && !limits[limitKey]) {
        return res.status(402).json({
          error: "plan_required",
          requiredPlan: "pro",
          feature,
          message: `The ${feature} feature requires a higher plan.`,
        });
      }

      return next();
    } catch (err) {
      console.error("[enforcePlan] requireFeature error:", err);
      return next();
    }
  };
}

export function checkLimit(limitType: "usersMax" | "webhooksMax" | "reportsPerMonth" | "storageGb") {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantCtx?.tenantId;
      if (!tenantId) return next();

      const limits = await getTenantPlanLimits(tenantId);
      if (!limits) return next();

      const maxValue = limits[limitType] as number;
      if (!maxValue || maxValue <= 0) return next();

      let currentValue = 0;

      switch (limitType) {
        case "usersMax": {
          currentValue = await storage.getMemberCountByTenant(tenantId);
          break;
        }
        case "webhooksMax": {
          currentValue = await storage.getWebhookEndpointCountByTenant(tenantId);
          break;
        }
        case "reportsPerMonth": {
          const monthKey = getCurrentMonthKey();
          const usage = await storage.getOrCreateUsageCounter(tenantId, monthKey);
          currentValue = usage.reportsGenerated;
          break;
        }
        case "storageGb": {
          const monthKey = getCurrentMonthKey();
          const usage = await storage.getOrCreateUsageCounter(tenantId, monthKey);
          currentValue = Math.ceil(usage.evidenceBytesStored / (1024 * 1024 * 1024));
          break;
        }
      }

      if (currentValue >= maxValue) {
        return res.status(402).json({
          error: "plan_limit_reached",
          requiredPlan: "pro",
          limit: limitType,
          current: currentValue,
          max: maxValue,
          message: `You have reached the ${limitType} limit for your current plan.`,
        });
      }

      return next();
    } catch (err) {
      console.error("[enforcePlan] checkLimit error:", err);
      return next();
    }
  };
}
