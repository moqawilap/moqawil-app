import { eq } from "drizzle-orm";
import { db } from "./index";
import { contractorProfiles, marketplaceSettings, services, subscriptionPlans, subscriptions, users } from "./schema";

/** Explicit, idempotent development seed. It is never invoked on server startup. */
export async function seedMarketplace() {
  const [plan] = await db.insert(subscriptionPlans).values({
    code: "annual-standard", name: "Standard Annual", priceOmaniRial: "100.000", billingMonths: 12,
  }).onConflictDoUpdate({ target: subscriptionPlans.code, set: { name: "Standard Annual", priceOmaniRial: "100.000", updatedAt: new Date() } }).returning();
  await db.insert(marketplaceSettings).values([
    { key: "subscription", value: { trialMonths: 4, defaultPriceOmaniRial: 100 }, description: "Subscription lifecycle configuration" },
    { key: "ranking", value: { rating: 35, reviews: 15, projects: 15, profile: 10, verification: 10, activity: 10, engagement: 5 }, description: "Directory ranking weights" },
  ]).onConflictDoNothing();
  const samples = [
    { clerk: "seed_contractor_muscat", email: "seed.muscat@example.invalid", name: "Muscat Build Co.", city: "Muscat", verified: true },
    { clerk: "seed_contractor_salalah", email: "seed.salalah@example.invalid", name: "Dhofar Electrical", city: "Salalah", verified: false },
  ];
  for (const sample of samples) {
    const [user] = await db.insert(users).values({ clerkUserId: sample.clerk, email: sample.email, displayName: sample.name, role: "contractor" }).onConflictDoUpdate({ target: users.clerkUserId, set: { displayName: sample.name, updatedAt: new Date() } }).returning();
    const [profile] = await db.insert(contractorProfiles).values({ userId: user.id, businessName: sample.name, city: sample.city, bio: "Representative development marketplace profile.", isVerified: sample.verified, isPublished: true, completedProjectsCount: 3, profileScore: 85, lastActiveAt: new Date() }).onConflictDoUpdate({ target: contractorProfiles.userId, set: { isPublished: true, updatedAt: new Date() } }).returning();
    await db.insert(services).values({ contractorId: profile.id, name: "General contracting", category: "Construction", description: "Representative development service", isActive: true }).onConflictDoNothing();
    const trialEnd = new Date(); trialEnd.setUTCMonth(trialEnd.getUTCMonth() + 4);
    await db.insert(subscriptions).values({ contractorId: profile.id, planId: plan.id, status: "free_trial", trialEndsAt: trialEnd }).onConflictDoNothing();
  }
}