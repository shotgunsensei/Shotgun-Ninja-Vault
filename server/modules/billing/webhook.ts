import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { getStripe, getPlanCodeFromPriceId, isStripeConfigured } from "./stripe";
import { storage } from "../../storage";
import { emitEvent } from "../../core/events/helpers";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    if (!isStripeConfigured() || !WEBHOOK_SECRET) {
      return res.status(503).json({ error: "Stripe webhooks not configured" });
    }

    const rawBody = req.rawBody;
    if (!rawBody || !(rawBody instanceof Buffer)) {
      return res.status(400).json({ error: "Missing raw body for signature verification" });
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("[stripe-webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    try {
      await handleStripeEvent(event);
    } catch (err: any) {
      console.error(`[stripe-webhook] Error handling event ${event.type}:`, err);
    }

    res.json({ received: true });
  });
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const tenantId = session.metadata?.tenantId;
  if (!tenantId) {
    console.error("[stripe-webhook] checkout.session.completed missing tenantId in metadata");
    return;
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!subscriptionId || !customerId) return;

  const stripe = getStripe();
  const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
  const subData = subResponse as Stripe.Subscription;
  const priceId = subData.items.data[0]?.price?.id;
  const planCode = priceId ? getPlanCodeFromPriceId(priceId) : undefined;
  const periodEnd = (subData as any).current_period_end;

  await storage.upsertTenantSubscription({
    tenantId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId || null,
    planCode: planCode || "solo",
    status: subData.status === "active" ? "active" : subData.status === "trialing" ? "trialing" : "active",
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subData.cancel_at_period_end,
  });

  await emitEvent("billing.subscription_updated", tenantId, undefined, "tenant_subscription", tenantId, {
    planCode: planCode || "solo",
    status: "active",
    stripeSubscriptionId: subscriptionId,
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  const tenantId = subscription.metadata?.tenantId;
  let sub = tenantId ? await storage.getTenantSubscription(tenantId) : null;

  if (!sub && subscription.id) {
    sub = await storage.getTenantSubscriptionByStripeSubscriptionId(subscription.id);
  }

  if (!sub) {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (customerId) {
      sub = await storage.getTenantSubscriptionByStripeCustomerId(customerId);
    }
  }

  if (!sub) {
    console.error(`[stripe-webhook] Cannot find tenant subscription for stripe sub ${subscription.id}`);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const planCode = priceId ? getPlanCodeFromPriceId(priceId) : sub.planCode;

  await storage.updateTenantSubscription(sub.tenantId, {
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId || sub.stripePriceId,
    planCode: planCode || sub.planCode,
    status: subscription.status,
    currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  await emitEvent("billing.subscription_updated", sub.tenantId, undefined, "tenant_subscription", sub.tenantId, {
    planCode,
    status: subscription.status,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  let sub = await storage.getTenantSubscriptionByStripeSubscriptionId(subscription.id);
  if (!sub) {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (customerId) {
      sub = await storage.getTenantSubscriptionByStripeCustomerId(customerId);
    }
  }
  if (!sub) return;

  await storage.updateTenantSubscription(sub.tenantId, {
    status: "canceled",
    cancelAtPeriodEnd: false,
  });

  await emitEvent("billing.subscription_updated", sub.tenantId, undefined, "tenant_subscription", sub.tenantId, {
    planCode: sub.planCode,
    status: "canceled",
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const sub = await storage.getTenantSubscriptionByStripeCustomerId(customerId);
  if (!sub) return;

  await storage.updateTenantSubscription(sub.tenantId, { status: "past_due" });

  await emitEvent("billing.payment_failed", sub.tenantId, undefined, "tenant_subscription", sub.tenantId, {
    invoiceId: invoice.id,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const sub = await storage.getTenantSubscriptionByStripeCustomerId(customerId);
  if (!sub) return;

  await storage.updateTenantSubscription(sub.tenantId, { status: "active" });

  await emitEvent("billing.subscription_updated", sub.tenantId, undefined, "tenant_subscription", sub.tenantId, {
    planCode: sub.planCode,
    status: "active",
    invoiceId: invoice.id,
  });
}
