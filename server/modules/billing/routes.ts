import type { Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../replit_integrations/auth";
import { requireRole } from "../../authz";
import { getStripe, getStripePriceId, isStripeConfigured } from "./stripe";
import { z } from "zod";

const APP_URL = process.env.APP_URL || "";

export function registerBillingRoutes(app: Express) {
  app.get("/api/billing/plans", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      const subscription = await storage.getTenantSubscription(req.tenantCtx.tenantId);
      res.json({ plans, subscription });
    } catch (error: any) {
      console.error("[billing] GET /plans error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/billing/subscription", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      const subscription = await storage.getTenantSubscription(req.tenantCtx.tenantId);
      if (!subscription) {
        return res.json({ subscription: null });
      }
      const plan = await storage.getSubscriptionPlanByCode(subscription.planCode);
      const monthKey = new Date().toISOString().slice(0, 7);
      const usage = await storage.getOrCreateUsageCounter(req.tenantCtx.tenantId, monthKey);
      res.json({ subscription, plan, usage });
    } catch (error: any) {
      console.error("[billing] GET /subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/billing/checkout-session", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const parsed = z.object({ planCode: z.string() }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "planCode is required" });
      }

      const { planCode } = parsed.data;
      const priceId = getStripePriceId(planCode);
      if (!priceId) {
        return res.status(400).json({ message: `No Stripe price configured for plan: ${planCode}` });
      }

      const stripe = getStripe();
      const { tenantId } = req.tenantCtx;

      let existingSub = await storage.getTenantSubscription(tenantId);
      let customerId = existingSub?.stripeCustomerId;

      if (!customerId) {
        const tenant = await storage.getTenantById(tenantId);
        const customer = await stripe.customers.create({
          metadata: { tenantId },
          name: tenant?.name || undefined,
        });
        customerId = customer.id;

        if (existingSub) {
          await storage.updateTenantSubscription(tenantId, { stripeCustomerId: customerId });
        } else {
          await storage.upsertTenantSubscription({
            tenantId,
            stripeCustomerId: customerId,
            planCode: "solo",
            status: "incomplete",
          });
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/billing/cancel`,
        metadata: { tenantId },
        subscription_data: { metadata: { tenantId } },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[billing] POST /checkout-session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/billing/customer-portal", isAuthenticated, requireRole("OWNER", "ADMIN"), async (req: any, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const stripe = getStripe();
      const { tenantId } = req.tenantCtx;
      const subscription = await storage.getTenantSubscription(tenantId);

      if (!subscription?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found. Subscribe to a plan first." });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${APP_URL}/billing`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[billing] POST /customer-portal error:", error);
      res.status(500).json({ message: error.message });
    }
  });
}
