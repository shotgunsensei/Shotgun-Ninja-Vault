import Stripe from "stripe";
import { storage } from "../../storage";
import type { PlanLimits } from "@shared/schema";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

const PRICE_MAP: Record<string, string | undefined> = {
  solo: process.env.STRIPE_PRICE_SOLO,
  pro: process.env.STRIPE_PRICE_PRO,
  msp: process.env.STRIPE_PRICE_MSP,
};

export function getStripePriceId(planCode: string): string | undefined {
  return PRICE_MAP[planCode];
}

export function getPlanCodeFromPriceId(priceId: string): string | undefined {
  for (const [code, id] of Object.entries(PRICE_MAP)) {
    if (id === priceId) return code;
  }
  return undefined;
}

export const DEFAULT_PLANS: Array<{
  code: string;
  name: string;
  monthlyPriceCents: number;
  limits: PlanLimits;
}> = [
  {
    code: "solo",
    name: "Solo",
    monthlyPriceCents: 0,
    limits: {
      usersMax: 1,
      storageGb: 1,
      reportsPerMonth: 5,
      webhooksMax: 2,
      apiEnabled: false,
      portalEnabled: false,
      statusEnabled: false,
    },
  },
  {
    code: "pro",
    name: "Pro",
    monthlyPriceCents: 2900,
    limits: {
      usersMax: 5,
      storageGb: 25,
      reportsPerMonth: 50,
      webhooksMax: 10,
      apiEnabled: true,
      portalEnabled: true,
      statusEnabled: true,
    },
  },
  {
    code: "msp",
    name: "MSP",
    monthlyPriceCents: 7900,
    limits: {
      usersMax: 25,
      storageGb: 100,
      reportsPerMonth: 500,
      webhooksMax: 50,
      apiEnabled: true,
      portalEnabled: true,
      statusEnabled: true,
    },
  },
  {
    code: "enterprise",
    name: "Enterprise",
    monthlyPriceCents: 0,
    limits: {
      usersMax: 999,
      storageGb: 999,
      reportsPerMonth: 9999,
      webhooksMax: 999,
      apiEnabled: true,
      portalEnabled: true,
      statusEnabled: true,
    },
  },
];

export async function seedSubscriptionPlans(): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await storage.upsertSubscriptionPlan({
      code: plan.code,
      name: plan.name,
      monthlyPriceCents: plan.monthlyPriceCents,
      limits: plan.limits,
    });
  }
}
