import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";

export function requireNotPaused() {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantCtx?.tenantId;
      if (!tenantId) return next();

      const sub = await storage.getTenantSubscription(tenantId);
      if (!sub?.pausedAt) return next();

      const pausedDate = new Date(sub.pausedAt);
      const now = new Date();
      const daysPaused = Math.floor((now.getTime() - pausedDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 90 - daysPaused);

      return res.status(402).json({
        error: "account_paused",
        message: "Your account is paused due to a billing issue. You can only download your existing data.",
        pausedAt: sub.pausedAt,
        daysRemaining,
        reason: sub.status,
      });
    } catch (err) {
      console.error("[requireNotPaused] Error:", err);
      return next();
    }
  };
}
