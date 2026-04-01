import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getUser } from "./authService";

declare global {
  namespace Express {
    interface Request {
      user?: {
        claims: { sub: string };
        profile: Record<string, unknown>;
      };
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    mfaPending: boolean;
    pendingMfaSecret: string;
  }
}

export const hydrateUser: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId && !req.session.mfaPending && !req.user) {
    const user = await getUser(req.session.userId);
    if (user) {
      req.user = { claims: { sub: user.id }, profile: user as unknown as Record<string, unknown> };
    }
  }
  next();
};

export const isAuthenticated: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.session.mfaPending) {
    return res.status(401).json({ message: "MFA verification required" });
  }

  if (!req.user) {
    const user = await getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = { claims: { sub: user.id }, profile: user as unknown as Record<string, unknown> };
  }

  next();
};
