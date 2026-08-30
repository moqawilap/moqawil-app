import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db, marketplaceSettings, payments, subscriptionPlans, subscriptions, type RankingWeights } from "@workspace/db";
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageSettings } from "./homepageSettings";
export { DEFAULT_HOMEPAGE_SETTINGS, HOMEPAGE_SECTION_IDS, isHomepageSettings, normalizeHomepageSettings } from "./homepageSettings";

export const DEFAULT_SETTINGS = {
  trialMonths: 4,
  defaultPriceOmaniRial: 100,
  rankingWeights: { rating: 35, reviews: 15, projects: 15, profile: 10, verification: 10, activity: 10, engagement: 5 } satisfies RankingWeights,
};

/**
 * Provision only the operational records required for marketplace onboarding.
 * This is idempotent DML, not demo seeding or schema migration, and preserves
 * administrator-edited values on every subsequent startup.
 */
export async function ensureMarketplaceDefaults() {
  await db.transaction(async (tx) => {
    await tx.insert(subscriptionPlans).values({
      code: "annual-standard",
      name: "Standard Annual",
      priceOmaniRial: DEFAULT_SETTINGS.defaultPriceOmaniRial.toFixed(3),
      billingMonths: 12,
      isActive: true,
    }).onConflictDoNothing({ target: subscriptionPlans.code });

    await tx.insert(marketplaceSettings).values([
      {
        key: "subscription",
        value: {
          trialMonths: DEFAULT_SETTINGS.trialMonths,
          defaultPriceOmaniRial: DEFAULT_SETTINGS.defaultPriceOmaniRial,
        },
        description: "Subscription lifecycle configuration",
      },
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
  const rows = await db.select().from(marketplaceSettings).where(sql`${marketplaceSettings.key} in ('subscription', 'ranking', 'homepage')`);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const subscription = values.subscription as Partial<typeof DEFAULT_SETTINGS> | undefined;
  return {
    trialMonths: Number(subscription?.trialMonths ?? DEFAULT_SETTINGS.trialMonths),
    defaultPriceOmaniRial: Number(subscription?.defaultPriceOmaniRial ?? DEFAULT_SETTINGS.defaultPriceOmaniRial),
    rankingWeights: (values.ranking as RankingWeights | undefined) ?? DEFAULT_SETTINGS.rankingWeights,
    homepage: normalizeHomepageSettings(values.homepage),
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