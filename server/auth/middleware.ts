import type { RequestHandler } from "express";
import { getUser } from "./authService";

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
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
    req.user = { claims: { sub: user.id }, profile: user };
  }

  next();
};
