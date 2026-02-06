import { authStorage } from "./replit_integrations/auth";
import { storage } from "./storage";

/**
 * DEV ONLY: Creates a predictable user + tenant so you can run the app without OIDC.
 * Enabled when DEV_AUTH_BYPASS=true and NODE_ENV !== "production".
 */
export async function ensureDevSeed() {
  const bypass = process.env.DEV_AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production";
  if (!bypass) return;

  const userId = process.env.DEV_USER_ID ?? "dev-user";
  const email = process.env.DEV_USER_EMAIL ?? "dev@localhost";

  // Ensure user exists
  await authStorage.upsertUser({
    id: userId,
    email,
    firstName: "Dev",
    lastName: "User",
    profileImageUrl: null,
  });

  // Ensure tenant exists
  const slug = process.env.DEV_TENANT_SLUG ?? "dev";
  let tenant = await storage.getTenantBySlug(slug);
  if (!tenant) {
    tenant = await storage.createTenant({
      name: "Dev Tenant",
      slug,
      plan: "free",
    });
  }

  // Ensure membership exists (OWNER)
  const membership = await storage.getUserMembership(userId);
  if (!membership) {
    await storage.addMember(tenant.id, userId, "OWNER");
  }
}
