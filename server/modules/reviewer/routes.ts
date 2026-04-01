import type { Express, Request, Response } from "express";
import { upsertUser, hashPassword } from "../../auth/authService";
import { enforceHttps } from "../../auth/httpsEnforce";
import { csrfProtection } from "../../auth/csrf";
import { db } from "../../db";
import { tenants, tenantMembers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const REVIEWER_USER_ID = "reviewer-google-play";
const REVIEWER_TENANT_SLUG = "reviewer-demo";

async function ensureReviewerSetup() {
  const password = process.env.REVIEWER_PASSWORD || "ReviewerPass1!";
  const passwordHash = await hashPassword(password);

  await upsertUser({
    id: REVIEWER_USER_ID,
    email: "reviewer@techdeck.app",
    firstName: "Reviewer",
    lastName: "Account",
    profileImageUrl: null,
    passwordHash,
  });

  const [existingTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, REVIEWER_TENANT_SLUG));

  let tenantId: string;

  if (existingTenant) {
    tenantId = existingTenant.id;
  } else {
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: "Tech Deck Demo",
        slug: REVIEWER_TENANT_SLUG,
        plan: "pro",
        maxClients: 100,
        maxEvidence: 1000,
      })
      .returning();
    tenantId = newTenant.id;
  }

  const [existingMember] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, REVIEWER_USER_ID)
      )
    );

  if (!existingMember) {
    await db.insert(tenantMembers).values({
      tenantId,
      userId: REVIEWER_USER_ID,
      role: "OWNER",
    });
  }

  return tenantId;
}

export function registerReviewerRoutes(app: Express): void {
  app.post("/api/reviewer-login", enforceHttps, csrfProtection, async (req: Request, res: Response) => {
    const expectedUser = process.env.REVIEWER_USERNAME;
    const expectedPass = process.env.REVIEWER_PASSWORD;

    if (!expectedUser || !expectedPass) {
      return res.status(404).json({ message: "Not found" });
    }

    const { username, password } = req.body;

    if (username !== expectedUser || password !== expectedPass) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    try {
      await ensureReviewerSetup();

      req.session.regenerate((err) => {
        if (err) {
          console.error("[reviewer] Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        req.session.userId = REVIEWER_USER_ID;
        req.session.mfaPending = false;
        req.session.save(() => res.json({ success: true }));
      });
    } catch (error) {
      console.error("[reviewer] Setup error:", error);
      res.status(500).json({ message: "Setup failed" });
    }
  });
}
