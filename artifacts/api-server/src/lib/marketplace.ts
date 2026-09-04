import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db, marketplaceSettings, payments, subscriptionPlans, subscriptions, type RankingWeights } from "@workspace/db";
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageSettings } from "./homepageSettings";
import {
  DEFAULT_ADVERTISING_SETTINGS,
  DEFAULT_APPEARANCE,
  DEFAULT_BRANDING,
  normalizeAdvertisingSettings,
  normalizeAppearance,
  normalizeBranding,
} from "./appSettings";
export { DEFAULT_HOMEPAGE_SETTINGS, HOMEPAGE_SECTION_IDS, isHomepageSettings, normalizeHomepageSettings } from "./homepageSettings";

export const DEFAULT_SETTINGS = {
  trialMonths: 1,
  defaultPriceOmaniRial: 30.8,
  rankingWeights: { rating: 35, reviews: 15, projects: 15, profile: 10, verification: 10, activity: 10, engagement: 5 } satisfies RankingWeights,
};

export const SUBSCRIPTION_PLAN_DEFINITIONS = [
  { code: "service-monthly", name: "Service Monthly", category: "service", priceUsd: "10.00", priceOmaniRial: "3.850", billingMonths: 1 },
  { code: "service-annual", name: "Service Annual", category: "service", priceUsd: "80.00", priceOmaniRial: "30.800", billingMonths: 12 },
  { code: "real-estate-monthly", name: "Real Estate Monthly", category: "real-estate", priceUsd: "15.00", priceOmaniRial: "5.775", billingMonths: 1 },
  { code: "real-estate-annual", name: "Real Estate Annual", category: "real-estate", priceUsd: "120.00", priceOmaniRial: "46.200", billingMonths: 12 },
] as const;

/**
 * Provision only the operational records required for marketplace onboarding.
 * This is idempotent DML, not demo seeding or schema migration, and preserves
 * administrator-edited values on every subsequent startup.
 */
export async function ensureMarketplaceDefaults() {
  await db.transaction(async (tx) => {
    await tx.update(subscriptionPlans).set({ isActive: false, updatedAt: new Date() }).where(eq(subscriptionPlans.code, "annual-standard"));
    for (const plan of SUBSCRIPTION_PLAN_DEFINITIONS) {
      await tx.insert(subscriptionPlans).values({
        ...plan,
        isActive: true,
      }).onConflictDoNothing({ target: subscriptionPlans.code });
    }

    await tx.insert(marketplaceSettings).values({
      key: "subscription",
      value: {
        trialMonths: DEFAULT_SETTINGS.trialMonths,
        defaultPriceOmaniRial: DEFAULT_SETTINGS.defaultPriceOmaniRial,
      },
      description: "Subscription lifecycle configuration",
    }).onConflictDoNothing({ target: marketplaceSettings.key });
    await tx.insert(marketplaceSettings).values([
      {
        key: "ranking",
        value: DEFAULT_SETTINGS.rankingWeights,
        description: "Directory ranking weights",
      },
      {
        key: "homepage",
        value: DEFAULT_HOMEPAGE_SETTINGS,
        description: "Public homepage content configuration",
      },
      { key: "appearance", value: DEFAULT_APPEARANCE, description: "Safe semantic theme configuration" },
      { key: "branding", value: DEFAULT_BRANDING, description: "Global bilingual branding and contact content" },
      { key: "advertising", value: DEFAULT_ADVERTISING_SETTINGS, description: "Advertising rate configuration" },
    ]).onConflictDoNothing({ target: marketplaceSettings.key });
  });
}

export function calculateRanking(input: { rating: number; reviews: number; projects: number; profile: number; verified: boolean; activeDays: number; engagement: number }, weights = DEFAULT_SETTINGS.rankingWeights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  return Number(((weights.rating * (input.rating / 5) + weights.reviews * Math.min(input.reviews / 20, 1) + weights.projects * Math.min(input.projects / 20, 1) + weights.profile * Math.min(input.profile / 100, 1) + weights.verification * Number(input.verified) + weights.activity * Math.min(input.activeDays / 30, 1) + weights.engagement * Math.min(input.engagement / 100, 1)) / total * 100).toFixed(2));
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export async function getSettings() {
  const rows = await db.select().from(marketplaceSettings).where(sql`${marketplaceSettings.key} in ('subscription', 'ranking', 'homepage', 'appearance', 'branding', 'advertising')`);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const subscription = values.subscription as Partial<typeof DEFAULT_SETTINGS> | undefined;
  const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
  return {
    trialMonths: Number(subscription?.trialMonths ?? DEFAULT_SETTINGS.trialMonths),
    defaultPriceOmaniRial: Number(subscription?.defaultPriceOmaniRial ?? DEFAULT_SETTINGS.defaultPriceOmaniRial),
    rankingWeights: (values.ranking as RankingWeights | undefined) ?? DEFAULT_SETTINGS.rankingWeights,
    homepage: normalizeHomepageSettings(values.homepage),
    appearance: normalizeAppearance(values.appearance),
    branding: normalizeBranding(values.branding),
    advertising: normalizeAdvertisingSettings(values.advertising),
    plans: plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      category: plan.category,
      billingMonths: plan.billingMonths,
      trialMonths: Number(subscription?.trialMonths ?? DEFAULT_SETTINGS.trialMonths),
      priceUsd: Number(plan.priceUsd),
      priceOmaniRial: Number(plan.priceOmaniRial),
    })),
  };
}

export async function getHomepageSettings() {
  return (await getSettings()).homepage;
}

export async function refreshSubscriptionStatus(subscriptionId: string) {
  const subscription = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, subscriptionId) });
  if (!subscription || ["cancelled", "suspended"].includes(subscription.status)) return subscription;
  const now = new Date();
  let status = subscription.status;
  if (subscription.status === "free_trial" && subscription.trialEndsAt <= now) status = "payment_due";
  if (subscription.status === "active" && subscription.currentPeriodEndsAt && subscription.currentPeriodEndsAt <= now) status = "expired";
  if (status !== subscription.status) {
    const [updated] = await db.update(subscriptions).set({ status, updatedAt: now }).where(eq(subscriptions.id, subscription.id)).returning();
    return updated;
  }
  return subscription;
}

/** Development-only adapter: it only records a requested test outcome and never receives card data. */
export async function recordDevelopmentPayment(subscriptionId: string, outcome: "succeed" | "fail") {
  const subscription = await refreshSubscriptionStatus(subscriptionId);
  if (!subscription) throw new Error("Subscription not found");
  if (subscription.status === "cancelled" || subscription.status === "suspended") throw new Error("Subscription cannot be paid in its current state");
  const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, subscription.planId) });
  if (!plan) throw new Error("Subscription plan not found");
  const now = new Date();
  const [payment] = await db.insert(payments).values({
    subscriptionId,
    amountOmaniRial: plan.priceOmaniRial,
    provider: "development",
    providerReference: `dev_${crypto.randomUUID()}`,
    status: outcome === "succeed" ? "paid" : "failed",
    paidAt: outcome === "succeed" ? now : null,
  }).returning();
  if (outcome === "succeed") {
    await db.update(subscriptions).set({ status: "active", currentPeriodStartsAt: now, currentPeriodEndsAt: addMonths(now, plan.billingMonths), updatedAt: now }).where(eq(subscriptions.id, subscriptionId));
  } else {
    await db.update(subscriptions).set({ status: "payment_due", updatedAt: now }).where(eq(subscriptions.id, subscriptionId));
  }
  return payment;
}

export function isDirectoryEligible(status: string) {
  return status === "free_trial" || status === "active";
}