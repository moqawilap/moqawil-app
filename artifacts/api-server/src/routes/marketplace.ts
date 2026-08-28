import { Router, type IRouter, type RequestHandler } from "express";
import { clerkClient } from "@clerk/express";
import { and, asc, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
  auditEvents, contractorProfiles, db, marketplaceSettings, notifications, payments, projects, quotes, rankingWeightsSchema, requestRecipients, reviews,
  serviceRequests, services, subscriptionPlans, subscriptions, users,
} from "@workspace/db";
import { canStartContractorOnboarding } from "../middlewares/authPolicy";
import { requireAdmin as productionRequireAdmin, requireContractor as productionRequireContractor, requireUser as productionRequireUser, type AuthenticatedRequest } from "../middlewares/auth";
import { addMonths, calculateRanking, DEFAULT_SETTINGS, getSettings, isDirectoryEligible, recordDevelopmentPayment, refreshSubscriptionStatus } from "../lib/marketplace";

type MarketplaceAuthHandlers = {
  requireUser: RequestHandler;
  requireAdmin: RequestHandler;
  requireContractor: RequestHandler;
  promoteCustomerToContractor?: (clerkUserId: string) => Promise<void>;
};

export function createMarketplaceRouter(auth: MarketplaceAuthHandlers = {
  requireUser: productionRequireUser,
  requireAdmin: productionRequireAdmin,
  requireContractor: productionRequireContractor,
}): IRouter {
const { requireUser, requireAdmin, requireContractor } = auth;
const promoteCustomerToContractor = auth.promoteCustomerToContractor ?? (async (clerkUserId: string) => {
  await clerkClient.users.updateUserMetadata(clerkUserId, { publicMetadata: { role: "contractor", isAdmin: false } });
});
const router: IRouter = Router();
const decimal = (value: string | null) => value === null ? null : Number(value);
async function logAudit(actorUserId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditEvents).values({ actorUserId, action, entityType, entityId, metadata });
}
async function createInAppNotification(userId: string, title: string, body: string, metadata: Record<string, unknown> = {}) {
  await db.insert(notifications).values({ userId, type: "system", channel: "in_app", deliveryStatus: "delivered", title, body, deliveryMetadata: metadata, deliveredAt: new Date() });
}
function validImageUrls(value: unknown) {
  return Array.isArray(value) && value.length <= 5 && value.every((item) => typeof item === "string" && item.length <= 2_000_000);
}
async function subscriptionResponse(item: typeof subscriptions.$inferSelect) {
  const [plan, profile, settings] = await Promise.all([
    db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, item.planId) }),
    db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, item.contractorId) }),
    getSettings(),
  ]);
  return { ...(await refreshSubscriptionStatus(item.id))!, contractorId: item.contractorId, contractorName: profile?.businessName ?? null, planName: plan?.name ?? "Unavailable plan", billingMonths: plan?.billingMonths ?? 0, trialMonths: settings.trialMonths, priceOmaniRial: Number(plan?.priceOmaniRial ?? settings.defaultPriceOmaniRial) };
}
async function paymentResponse(item: typeof payments.$inferSelect) {
  const subscription = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, item.subscriptionId) });
  const profile = subscription && await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, subscription.contractorId) });
  return { ...item, amountOmaniRial: Number(item.amountOmaniRial), contractorId: subscription?.contractorId ?? null, contractorName: profile?.businessName ?? null };
}
async function adminContractorResponse(profile: typeof contractorProfiles.$inferSelect) {
  const publicSummary = await contractorSummary(profile);
  const owner = await db.query.users.findFirst({ where: eq(users.id, profile.userId) });
  return {
    ...publicSummary, businessNameArabic: profile.businessNameArabic, bioArabic: profile.bioArabic,
    wilayat: profile.wilayat, serviceArea: profile.serviceArea, phone: profile.phone,
    evaluationNotes: profile.evaluationNotes, adminRating: profile.adminRating,
    agreedContractAmountOmaniRial: decimal(profile.agreedContractAmountOmaniRial),
    accountLinkStatus: owner?.identitySource === "clerk" ? "linked_clerk" : "managed_unlinked",
  };
}
function validOptionalText(value: unknown, maximum: number) {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maximum);
}

async function contractorSummary(profile: typeof contractorProfiles.$inferSelect, settings?: Awaited<ReturnType<typeof getSettings>>) {
  settings ??= await getSettings();
  const reviewRows = await db.select({ rating: sql<number>`coalesce(avg(${reviews.rating}), 0)`, count: sql<number>`count(*)` }).from(reviews).where(and(eq(reviews.contractorId, profile.id), eq(reviews.isPublished, true)));
  const review = reviewRows[0]!;
  const activeDays = profile.lastActiveAt ? Math.max(0, 30 - Math.floor((Date.now() - profile.lastActiveAt.getTime()) / 86_400_000)) : 0;
  return {
    id: profile.id, businessName: profile.businessName, city: profile.city, bio: profile.bio,
    avatarUrl: profile.avatarUrl, isVerified: profile.isVerified, isPublished: profile.isPublished, rating: Number(review.rating),
    reviewCount: Number(review.count),
    rankingScore: calculateRanking({ rating: Number(review.rating), reviews: Number(review.count), projects: profile.completedProjectsCount, profile: profile.profileScore, verified: profile.isVerified, activeDays, engagement: profile.engagementScore }, settings.rankingWeights),
  };
}

router.get("/contractors", async (req, res, next) => {
  try {
    const now = new Date();
    const filters = [eq(contractorProfiles.isPublished, true), isNull(contractorProfiles.archivedAt), or(
      and(eq(subscriptions.status, "free_trial"), gt(subscriptions.trialEndsAt, now)),
      and(eq(subscriptions.status, "active"), gt(subscriptions.currentPeriodEndsAt, now)),
    )];
    if (typeof req.query.city === "string") filters.push(eq(contractorProfiles.city, req.query.city));
    if (typeof req.query.wilayat === "string") filters.push(eq(contractorProfiles.wilayat, req.query.wilayat));
    if (req.query.verified === "true") filters.push(eq(contractorProfiles.isVerified, true));
    if (typeof req.query.search === "string" && req.query.search.length <= 100) filters.push(ilike(contractorProfiles.businessName, `%${req.query.search}%`));
    if (typeof req.query.category === "string") filters.push(sql`exists (select 1 from ${services} where ${services.contractorId} = ${contractorProfiles.id} and ${services.category} = ${req.query.category} and ${services.isActive})`);
    if (typeof req.query.service === "string" && req.query.service.length <= 160) filters.push(sql`exists (select 1 from ${services} where ${services.contractorId} = ${contractorProfiles.id} and ${services.name} = ${req.query.service} and ${services.isActive})`);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const settings = await getSettings();
    const weights = settings.rankingWeights;
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 1;
    const rating = sql<number>`coalesce(avg(${reviews.rating}), 0)`;
    const reviewCount = sql<number>`count(${reviews.id})`;
    const projectCount = sql<number>`(select count(*) from ${projects} where ${projects.contractorId} = ${contractorProfiles.id} and ${projects.isPublished})`;
    const activeDays = sql<number>`greatest(0, 30 - extract(day from now() - coalesce(${contractorProfiles.lastActiveAt}, now() - interval '30 days')))`; 
    const score = sql<number>`(
      (${weights.rating} * (${rating} / 5.0)) +
      (${weights.reviews} * least(${reviewCount} / 20.0, 1)) +
      (${weights.projects} * least(${projectCount} / 20.0, 1)) +
      (${weights.profile} * least(${contractorProfiles.profileScore} / 100.0, 1)) +
      (${weights.verification} * case when ${contractorProfiles.isVerified} then 1 else 0 end) +
      (${weights.activity} * least(${activeDays} / 30.0, 1)) +
      (${weights.engagement} * least(${contractorProfiles.engagementScore} / 100.0, 1))
    ) / ${totalWeight} * 100`;
    const [rows, totalRows] = await Promise.all([
      db.select({ profile: contractorProfiles, rating, reviewCount, rankingScore: score }).from(contractorProfiles)
        .innerJoin(subscriptions, eq(subscriptions.contractorId, contractorProfiles.id))
        .leftJoin(reviews, and(eq(reviews.contractorId, contractorProfiles.id), eq(reviews.isPublished, true)))
        .where(and(...filters)).groupBy(contractorProfiles.id)
        .orderBy(desc(score), asc(contractorProfiles.businessName), asc(contractorProfiles.id)).limit(limit).offset((page - 1) * limit),
      db.select({ count: sql<number>`count(distinct ${contractorProfiles.id})` }).from(contractorProfiles)
        .innerJoin(subscriptions, eq(subscriptions.contractorId, contractorProfiles.id)).where(and(...filters)),
    ]);
    res.json({ items: rows.map((row) => ({ id: row.profile.id, businessName: row.profile.businessName, city: row.profile.city, wilayat: row.profile.wilayat, bio: row.profile.bio, avatarUrl: row.profile.avatarUrl, isVerified: row.profile.isVerified, isPublished: row.profile.isPublished, rating: Number(row.rating), reviewCount: Number(row.reviewCount), rankingScore: Number(row.rankingScore) })), page, total: Number(totalRows[0]!.count) });
  } catch (error) { next(error); }
});

router.get("/contractors/:id", async (req, res, next) => {
  try {
    const profile = await db.query.contractorProfiles.findFirst({ where: and(eq(contractorProfiles.id, req.params.id), eq(contractorProfiles.isPublished, true), isNull(contractorProfiles.archivedAt)) });
    if (!profile) {
      res.status(404).json({ error: "Contractor not found" });
      return;
    }
    const subscription = await db.query.subscriptions.findFirst({ where: eq(subscriptions.contractorId, profile.id) });
    const current = subscription && await refreshSubscriptionStatus(subscription.id);
    if (!current || !isDirectoryEligible(current.status)) { res.status(404).json({ error: "Contractor not found" }); return; }
    const [summary, profileServices, profileProjects, profileReviews] = await Promise.all([
      contractorSummary(profile), db.select().from(services).where(and(eq(services.contractorId, profile.id), eq(services.isActive, true))),
      db.select().from(projects).where(and(eq(projects.contractorId, profile.id), eq(projects.isPublished, true))).orderBy(desc(projects.completedAt)),
      db.select().from(reviews).where(and(eq(reviews.contractorId, profile.id), eq(reviews.isPublished, true))).orderBy(desc(reviews.createdAt)),
    ]);
    res.json({
      ...summary,
      phone: profile.phone,
      services: profileServices.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        priceFromOmaniRial: decimal(item.priceFromOmaniRial),
      })),
      projects: profileProjects.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        imageUrls: item.imageUrls,
      })),
      reviews: profileReviews.map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) { next(error); }
});

router.get("/me/subscription", requireUser, requireContractor, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const profile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    if (!profile) {
      res.status(404).json({ error: "A contractor profile is required" });
      return;
    }
    const subscription = await db.query.subscriptions.findFirst({ where: eq(subscriptions.contractorId, profile.id) });
    if (!subscription) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }
    const current = await refreshSubscriptionStatus(subscription.id);
    const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, subscription.planId) });
    res.json(await subscriptionResponse(current!));
  } catch (error) { next(error); }
});

router.get("/me/contractor-profile", requireUser, requireContractor, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const profile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    if (!profile) {
      res.status(404).json({ error: "A contractor profile is required" });
      return;
    }
    res.json({
      businessName: profile.businessName,
      city: profile.city,
      bio: profile.bio,
      serviceArea: profile.serviceArea,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
    });
  } catch (error) { next(error); }
});

router.post("/me/subscription", requireUser, requireContractor, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const outcome = req.body?.outcome;
    if (outcome !== "succeed" && outcome !== "fail") {
      res.status(400).json({ error: "outcome must be succeed or fail" });
      return;
    }
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({ error: "Development payment flow is unavailable in production" });
      return;
    }
    const profile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    const subscription = profile && await db.query.subscriptions.findFirst({ where: eq(subscriptions.contractorId, profile.id) });
    if (!subscription) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }
    await recordDevelopmentPayment(subscription.id, outcome);
    const current = await refreshSubscriptionStatus(subscription.id);
    const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, subscription.planId) });
    await logAudit(user.id, "development_payment_recorded", "payment", subscription.id, { outcome });
    res.json(await subscriptionResponse(current!));
  } catch (error) { next(error); }
});
router.delete("/me/subscription", requireUser, requireContractor, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const profile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    const subscription = profile && await db.query.subscriptions.findFirst({ where: eq(subscriptions.contractorId, profile.id) });
    if (!subscription) { res.status(404).json({ error: "Subscription not found" }); return; }
    const [cancelled] = await db.update(subscriptions).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(subscriptions.id, subscription.id)).returning();
    await logAudit(user.id, "subscription_cancelled", "subscription", subscription.id);
    res.json(await subscriptionResponse(cancelled));
  } catch (error) { next(error); }
});
router.get("/me/payments", requireUser, requireContractor, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const profile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    if (!profile) { res.status(404).json({ error: "A contractor profile is required" }); return; }
    const subscription = await db.query.subscriptions.findFirst({ where: eq(subscriptions.contractorId, profile.id) });
    res.json(subscription ? await Promise.all((await db.select().from(payments).where(eq(payments.subscriptionId, subscription.id)).orderBy(desc(payments.createdAt))).map(paymentResponse)) : []);
  } catch (error) { next(error); }
});
router.put("/me/contractor-profile", requireUser, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const existingProfile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    if (!canStartContractorOnboarding(user.role, Boolean(existingProfile))) {
      res.status(403).json({ error: "Contractor role required" });
      return;
    }
    const input = req.body ?? {};
    if (typeof input.businessName !== "string" || input.businessName.trim().length < 2 || input.businessName.length > 200 || typeof input.city !== "string" || input.city.trim().length < 2 || input.city.length > 100 || !validOptionalText(input.bio, 5000) || !validOptionalText(input.serviceArea, 255) || !validOptionalText(input.phone, 32) || !validOptionalText(input.avatarUrl, 2048)) { res.status(400).json({ error: "Invalid contractor profile fields" }); return; }
    if (user.role === "customer") {
      await promoteCustomerToContractor(user.clerkUserId);
    }
    const settings = await getSettings();
    const result = await db.transaction(async (tx) => {
      const [profile] = await tx.insert(contractorProfiles).values({
        userId: user.id, businessName: input.businessName.trim(), city: input.city.trim(),
        bio: typeof input.bio === "string" ? input.bio : null, serviceArea: typeof input.serviceArea === "string" ? input.serviceArea : null,
        phone: typeof input.phone === "string" ? input.phone : null, avatarUrl: typeof input.avatarUrl === "string" ? input.avatarUrl : null,
        lastActiveAt: new Date(),
      }).onConflictDoUpdate({ target: contractorProfiles.userId, set: {
        businessName: input.businessName.trim(), city: input.city.trim(), bio: typeof input.bio === "string" ? input.bio : null,
        serviceArea: typeof input.serviceArea === "string" ? input.serviceArea : null, phone: typeof input.phone === "string" ? input.phone : null,
        avatarUrl: typeof input.avatarUrl === "string" ? input.avatarUrl : null, lastActiveAt: new Date(), updatedAt: new Date(),
      } }).returning();
      await tx.update(users).set({ role: "contractor", updatedAt: new Date() }).where(eq(users.id, user.id));
      let subscription = await tx.query.subscriptions.findFirst({ where: eq(subscriptions.contractorId, profile.id) });
      if (!subscription) {
        const plan = await tx.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.isActive, true) });
        if (!plan) throw new Error("No active subscription plan is configured");
        const now = new Date();
        [subscription] = await tx.insert(subscriptions).values({ contractorId: profile.id, planId: plan.id, status: "free_trial", trialStartedAt: now, trialEndsAt: addMonths(now, settings.trialMonths) }).returning();
      }
      return { profile, subscription };
    });
    const persistedProfile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, result.profile.id) });
    res.json({ contractor: await contractorSummary(persistedProfile!), subscription: await subscriptionResponse(result.subscription) });
  } catch (error) { next(error); }
});

router.post("/service-requests", requireUser, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const input = req.body ?? {};
    if (typeof input.serviceCategory !== "string" || input.serviceCategory.length < 2 || input.serviceCategory.length > 100 || typeof input.serviceName !== "string" || input.serviceName.length < 2 || input.serviceName.length > 160 || typeof input.governorate !== "string" || input.governorate.length < 2 || input.governorate.length > 100 || typeof input.wilayat !== "string" || input.wilayat.length < 2 || input.wilayat.length > 100 || typeof input.requirements !== "string" || input.requirements.trim().length < 8 || input.requirements.length > 5000 || (input.budgetOmaniRial !== undefined && input.budgetOmaniRial !== null && (!Number.isFinite(input.budgetOmaniRial) || input.budgetOmaniRial < 0)) || !validImageUrls(input.imageUrls ?? [])) {
      res.status(400).json({ error: "Invalid service request fields" });
      return;
    }
    const request = await db.transaction(async (tx) => {
      const [created] = await tx.insert(serviceRequests).values({
        customerId: user.id, serviceCategory: input.serviceCategory.trim(), serviceName: input.serviceName.trim(),
        governorate: input.governorate.trim(), wilayat: input.wilayat.trim(), requirements: input.requirements.trim(),
        budgetOmaniRial: input.budgetOmaniRial == null ? null : Number(input.budgetOmaniRial).toFixed(3), imageUrls: input.imageUrls ?? [],
      }).returning();
      const now = new Date();
      const candidates = await tx.select({ id: contractorProfiles.id, userId: contractorProfiles.userId }).from(contractorProfiles)
        .innerJoin(subscriptions, eq(subscriptions.contractorId, contractorProfiles.id))
        .where(and(eq(contractorProfiles.city, input.governorate.trim()), eq(contractorProfiles.wilayat, input.wilayat.trim()), eq(contractorProfiles.isPublished, true), isNull(contractorProfiles.archivedAt), or(
          and(eq(subscriptions.status, "free_trial"), gt(subscriptions.trialEndsAt, now)),
          and(eq(subscriptions.status, "active"), gt(subscriptions.currentPeriodEndsAt, now)),
        )));
      if (candidates.length) {
        await tx.insert(requestRecipients).values(candidates.map((candidate) => ({ requestId: created.id, contractorId: candidate.id })));
        await tx.insert(notifications).values(candidates.map((candidate) => ({
          userId: candidate.userId, type: "system" as const, channel: "in_app" as const, deliveryStatus: "delivered" as const,
          title: "New service request", body: `${input.serviceName} requested in ${input.wilayat}.`, deliveryMetadata: { requestId: created.id }, deliveredAt: now,
        })));
      }
      return { created, recipientCount: candidates.length };
    });
    await createInAppNotification(user.id, "Request sent", request.recipientCount ? `Your request was sent to ${request.recipientCount} matching workshop${request.recipientCount === 1 ? "" : "s"}.` : "Your request is saved. Matching workshops will appear when available.", { requestId: request.created.id });
    res.status(201).json({ ...request.created, budgetOmaniRial: decimal(request.created.budgetOmaniRial), recipientCount: request.recipientCount, quoteCount: 0 });
  } catch (error) { next(error); }
});

router.get("/me/service-requests", requireUser, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const rows = await db.select({ request: serviceRequests, quoteCount: sql<number>`count(distinct ${quotes.id})`, recipientCount: sql<number>`count(distinct ${requestRecipients.id})` })
      .from(serviceRequests).leftJoin(requestRecipients, eq(requestRecipients.requestId, serviceRequests.id)).leftJoin(quotes, eq(quotes.requestId, serviceRequests.id))
      .where(eq(serviceRequests.customerId, user.id)).groupBy(serviceRequests.id).orderBy(desc(serviceRequests.createdAt));
    res.json(rows.map((row) => ({ ...row.request, budgetOmaniRial: decimal(row.request.budgetOmaniRial), imageUrls: row.request.imageUrls, quoteCount: Number(row.quoteCount), recipientCount: Number(row.recipientCount) })));
  } catch (error) { next(error); }
});

router.get("/me/service-requests/:id/quotes", requireUser, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const request = await db.query.serviceRequests.findFirst({ where: and(eq(serviceRequests.id, String(req.params.id)), eq(serviceRequests.customerId, user.id)) });
    if (!request) { res.status(404).json({ error: "Service request not found" }); return; }
    const rows = await db.select({ quote: quotes, businessName: contractorProfiles.businessName, businessNameArabic: contractorProfiles.businessNameArabic, city: contractorProfiles.city, wilayat: contractorProfiles.wilayat, isVerified: contractorProfiles.isVerified })
      .from(quotes).innerJoin(contractorProfiles, eq(contractorProfiles.id, quotes.contractorId)).where(eq(quotes.requestId, request.id)).orderBy(asc(quotes.amountOmaniRial), desc(quotes.createdAt));
    res.json(rows.map((row) => ({ ...row.quote, amountOmaniRial: decimal(row.quote.amountOmaniRial), businessName: row.businessName, businessNameArabic: row.businessNameArabic, city: row.city, wilayat: row.wilayat, isVerified: row.isVerified })));
  } catch (error) { next(error); }
});

router.get("/me/workshop-requests", requireUser, requireContractor, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const profile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    if (!profile) { res.status(404).json({ error: "A workshop profile is required" }); return; }
    const rows = await db.select({ request: serviceRequests, recipientId: requestRecipients.id, recipientStatus: requestRecipients.status })
      .from(requestRecipients).innerJoin(serviceRequests, eq(serviceRequests.id, requestRecipients.requestId))
      .where(eq(requestRecipients.contractorId, profile.id)).orderBy(desc(serviceRequests.createdAt));
    res.json(rows.map((row) => ({ ...row.request, budgetOmaniRial: decimal(row.request.budgetOmaniRial), recipientId: row.recipientId, recipientStatus: row.recipientStatus })));
  } catch (error) { next(error); }
});

router.post("/me/workshop-requests/:id/quote", requireUser, requireContractor, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const profile = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.userId, user.id) });
    const input = req.body ?? {};
    if (!profile || !Number.isFinite(input.amountOmaniRial) || input.amountOmaniRial < 0 || !Number.isInteger(input.estimatedDays) || input.estimatedDays < 1 || input.estimatedDays > 365 || typeof input.details !== "string" || input.details.trim().length < 4 || input.details.length > 3000) { res.status(400).json({ error: "Invalid quote fields" }); return; }
    const request = await db.query.serviceRequests.findFirst({ where: eq(serviceRequests.id, String(req.params.id)) });
    const recipient = request && await db.query.requestRecipients.findFirst({ where: and(eq(requestRecipients.requestId, request.id), eq(requestRecipients.contractorId, profile.id)) });
    if (!request || !recipient || request.status === "cancelled" || request.status === "awarded") { res.status(404).json({ error: "Request is unavailable" }); return; }
    const [quote] = await db.transaction(async (tx) => {
      const created = await tx.insert(quotes).values({ requestId: request.id, contractorId: profile.id, amountOmaniRial: Number(input.amountOmaniRial).toFixed(3), estimatedDays: input.estimatedDays, details: input.details.trim() }).returning();
      await tx.update(requestRecipients).set({ status: "quoted", updatedAt: new Date() }).where(eq(requestRecipients.id, recipient.id));
      await tx.update(serviceRequests).set({ status: "quoted", updatedAt: new Date() }).where(eq(serviceRequests.id, request.id));
      await tx.insert(notifications).values({ userId: request.customerId, type: "system", channel: "in_app", deliveryStatus: "delivered", title: "New quote received", body: `${profile.businessName} sent a quote for ${request.serviceName}.`, deliveryMetadata: { requestId: request.id, quoteId: created[0]!.id }, deliveredAt: new Date() });
      return created;
    });
    res.status(201).json({ ...quote, amountOmaniRial: decimal(quote!.amountOmaniRial) });
  } catch (error) { next(error); }
});

router.post("/me/quotes/:id/accept", requireUser, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).marketplaceUser;
    const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, String(req.params.id)) });
    const request = quote && await db.query.serviceRequests.findFirst({ where: and(eq(serviceRequests.id, quote.requestId), eq(serviceRequests.customerId, user.id)) });
    if (!quote || !request || request.status === "cancelled" || request.status === "awarded") { res.status(404).json({ error: "Quote is unavailable" }); return; }
    const contractor = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, quote.contractorId) });
    await db.transaction(async (tx) => {
      await tx.update(quotes).set({ status: "accepted", updatedAt: new Date() }).where(eq(quotes.id, quote.id));
      await tx.update(quotes).set({ status: "rejected", updatedAt: new Date() }).where(and(eq(quotes.requestId, request.id), sql`${quotes.id} <> ${quote.id}`));
      await tx.update(serviceRequests).set({ status: "awarded", updatedAt: new Date() }).where(eq(serviceRequests.id, request.id));
      await tx.insert(notifications).values({ userId: contractor!.userId, type: "system", channel: "in_app", deliveryStatus: "delivered", title: "Quote accepted", body: `Your quote for ${request.serviceName} was accepted.`, deliveryMetadata: { requestId: request.id, quoteId: quote.id }, deliveredAt: new Date() });
    });
    res.json({ ...quote, amountOmaniRial: decimal(quote.amountOmaniRial), status: "accepted" });
  } catch (error) { next(error); }
});

router.get("/me/notifications", requireUser, async (req, res, next) => {
  try { const user = (req as AuthenticatedRequest).marketplaceUser; res.json(await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt))); } catch (error) { next(error); }
});
router.post("/me/notifications/:id/read", requireUser, async (req, res, next) => {
  try { const user = (req as AuthenticatedRequest).marketplaceUser; const notificationId = String(req.params.id); await db.update(notifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id))); res.status(204).end(); } catch (error) { next(error); }
});

router.get("/admin/overview", requireUser, requireAdmin, async (_req, res, next) => {
  try {
    const [contractorCount, activeCount, dueCount, paymentCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(contractorProfiles), db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, "active")),
      db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, "payment_due")), db.select({ count: sql<number>`count(*)` }).from(payments),
    ]);
    res.json({ contractors: Number(contractorCount[0]!.count), activeSubscriptions: Number(activeCount[0]!.count), paymentDueSubscriptions: Number(dueCount[0]!.count), paymentsRecorded: Number(paymentCount[0]!.count) });
  } catch (error) { next(error); }
});
router.get("/admin/contractors", requireUser, requireAdmin, async (_req, res, next) => {
  try { res.json(await Promise.all((await db.select().from(contractorProfiles).orderBy(asc(contractorProfiles.businessName))).map(adminContractorResponse))); } catch (error) { next(error); }
});
router.post("/admin/contractors", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const input = req.body ?? {};
    if (typeof input.businessName !== "string" || input.businessName.trim().length < 2 || input.businessName.length > 200 || typeof input.city !== "string" || input.city.trim().length < 2 || input.city.length > 100 || !validOptionalText(input.businessNameArabic, 200) || !validOptionalText(input.bio, 5000) || !validOptionalText(input.bioArabic, 5000) || !validOptionalText(input.wilayat, 100) || !validOptionalText(input.serviceArea, 255) || !validOptionalText(input.phone, 32) || !validOptionalText(input.avatarUrl, 2048) || !validOptionalText(input.evaluationNotes, 5000) || (input.adminRating !== undefined && input.adminRating !== null && (!Number.isInteger(input.adminRating) || input.adminRating < 1 || input.adminRating > 5)) || (input.agreedContractAmountOmaniRial !== undefined && input.agreedContractAmountOmaniRial !== null && (!Number.isFinite(input.agreedContractAmountOmaniRial) || input.agreedContractAmountOmaniRial < 0)) || (input.isVerified !== undefined && typeof input.isVerified !== "boolean") || (input.isPublished !== undefined && typeof input.isPublished !== "boolean")) { res.status(400).json({ error: "Invalid managed contractor fields" }); return; }
    const settings = await getSettings();
    const profile = await db.transaction(async (tx) => {
      const [managedUser] = await tx.insert(users).values({ clerkUserId: `managed:${crypto.randomUUID()}`, email: `managed-${crypto.randomUUID()}@listing.invalid`, displayName: input.businessName.trim(), role: "contractor", identitySource: "managed_listing" }).returning();
      const [created] = await tx.insert(contractorProfiles).values({ userId: managedUser.id, businessName: input.businessName.trim(), businessNameArabic: input.businessNameArabic ?? null, city: input.city.trim(), wilayat: input.wilayat ?? null, bio: input.bio ?? null, bioArabic: input.bioArabic ?? null, serviceArea: input.serviceArea ?? null, phone: input.phone ?? null, avatarUrl: input.avatarUrl ?? null, evaluationNotes: input.evaluationNotes ?? null, adminRating: input.adminRating ?? null, agreedContractAmountOmaniRial: input.agreedContractAmountOmaniRial?.toFixed(3) ?? null, isVerified: input.isVerified ?? false, isPublished: input.isPublished ?? false }).returning();
      const plan = await tx.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.isActive, true) });
      if (!plan) throw new Error("No active subscription plan is configured");
      const now = new Date();
      await tx.insert(subscriptions).values({ contractorId: created.id, planId: plan.id, status: "free_trial", trialStartedAt: now, trialEndsAt: addMonths(now, settings.trialMonths) });
      await tx.insert(auditEvents).values({ actorUserId: (req as AuthenticatedRequest).marketplaceUser.id, action: "managed_contractor_created", entityType: "contractor", entityId: created.id, metadata: { accountLinkStatus: "managed_unlinked" } });
      return created;
    });
    res.status(201).json(await adminContractorResponse(profile));
  } catch (error) { next(error); }
});
router.get("/admin/subscriptions", requireUser, requireAdmin, async (_req, res, next) => {
  try { const list = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)); res.json(await Promise.all(list.map(subscriptionResponse))); } catch (error) { next(error); }
});
router.get("/admin/payments", requireUser, requireAdmin, async (_req, res, next) => {
  try { res.json(await Promise.all((await db.select().from(payments).orderBy(desc(payments.createdAt))).map(paymentResponse))); } catch (error) { next(error); }
});
router.patch("/admin/contractors/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const input = req.body ?? {};
    const allowed = ["businessName", "businessNameArabic", "city", "wilayat", "bio", "bioArabic", "serviceArea", "phone", "avatarUrl", "evaluationNotes", "adminRating", "agreedContractAmountOmaniRial", "isVerified", "isPublished"];
    if (!Object.keys(input).some((key) => allowed.includes(key)) || (input.businessName !== undefined && (typeof input.businessName !== "string" || input.businessName.trim().length < 2 || input.businessName.length > 200)) || (input.city !== undefined && (typeof input.city !== "string" || input.city.trim().length < 2 || input.city.length > 100)) || !validOptionalText(input.businessNameArabic, 200) || !validOptionalText(input.bio, 5000) || !validOptionalText(input.bioArabic, 5000) || !validOptionalText(input.wilayat, 100) || !validOptionalText(input.serviceArea, 255) || !validOptionalText(input.phone, 32) || !validOptionalText(input.avatarUrl, 2048) || !validOptionalText(input.evaluationNotes, 5000) || (input.adminRating !== undefined && input.adminRating !== null && (!Number.isInteger(input.adminRating) || input.adminRating < 1 || input.adminRating > 5)) || (input.agreedContractAmountOmaniRial !== undefined && input.agreedContractAmountOmaniRial !== null && (!Number.isFinite(input.agreedContractAmountOmaniRial) || input.agreedContractAmountOmaniRial < 0)) || (input.isVerified !== undefined && typeof input.isVerified !== "boolean") || (input.isPublished !== undefined && typeof input.isPublished !== "boolean")) { res.status(400).json({ error: "Invalid contractor update" }); return; }
    const changes: Partial<typeof contractorProfiles.$inferInsert> = { updatedAt: new Date() };
    for (const key of allowed) if (input[key] !== undefined) (changes as Record<string, unknown>)[key] = key === "businessName" || key === "city" ? input[key].trim() : key === "agreedContractAmountOmaniRial" && input[key] !== null ? input[key].toFixed(3) : input[key];
    const [profile] = await db.update(contractorProfiles).set(changes).where(eq(contractorProfiles.id, String(req.params.id))).returning();
    if (!profile) { res.status(404).json({ error: "Contractor not found" }); return; }
    await logAudit((req as AuthenticatedRequest).marketplaceUser.id, "contractor_updated", "contractor", profile.id, { fields: Object.keys(input).filter((key) => allowed.includes(key)) });
    res.json(await adminContractorResponse(profile));
  } catch (error) { next(error); }
});
router.delete("/admin/contractors/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    if (req.query.confirm !== "true") { res.status(400).json({ error: "Deletion requires confirm=true; the listing will be archived to preserve records" }); return; }
    const [profile] = await db.update(contractorProfiles).set({ isPublished: false, archivedAt: new Date(), updatedAt: new Date() }).where(eq(contractorProfiles.id, String(req.params.id))).returning();
    if (!profile) { res.status(404).json({ error: "Contractor not found" }); return; }
    await logAudit((req as AuthenticatedRequest).marketplaceUser.id, "contractor_listing_archived", "contractor", profile.id, { confirmation: true });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.patch("/admin/subscriptions/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const allowed = ["free_trial", "active", "payment_due", "expired", "cancelled", "suspended"] as const;
    const requestedStatus = req.body?.status;
    const extension = req.body?.extendTrialMonths;
    if ((requestedStatus !== undefined && !allowed.includes(requestedStatus)) || (extension !== undefined && (!Number.isInteger(extension) || extension < 1 || extension > 24))) { res.status(400).json({ error: "Invalid subscription update" }); return; }
    const existing = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, String(req.params.id)) });
    if (!existing) { res.status(404).json({ error: "Subscription not found" }); return; }
    const changes: Partial<typeof subscriptions.$inferInsert> = { updatedAt: new Date() };
    if (requestedStatus) {
      changes.status = requestedStatus;
      if (requestedStatus === "cancelled") changes.cancelledAt = new Date();
      if (requestedStatus === "active") {
        const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, existing.planId) });
        if (!plan) { res.status(409).json({ error: "Subscription plan not found" }); return; }
        const now = new Date();
        changes.currentPeriodStartsAt = now;
        changes.currentPeriodEndsAt = addMonths(now, plan.billingMonths);
        changes.cancelledAt = null;
      }
    }
    if (extension) changes.trialEndsAt = addMonths(existing.trialEndsAt, extension);
    const [updated] = await db.update(subscriptions).set(changes).where(eq(subscriptions.id, existing.id)).returning();
    await logAudit((req as AuthenticatedRequest).marketplaceUser.id, "subscription_updated", "subscription", updated.id, { status: requestedStatus, extendTrialMonths: extension });
    res.json(await subscriptionResponse(updated));
  } catch (error) { next(error); }
});
router.post("/admin/payments", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const { subscriptionId, amountOmaniRial, status, provider, providerReference } = req.body ?? {};
    const statuses = ["pending", "paid", "failed", "refunded", "void"];
    if (typeof subscriptionId !== "string" || !Number.isFinite(amountOmaniRial) || amountOmaniRial < 0 || !statuses.includes(status) || typeof provider !== "string" || provider.length > 50 || (providerReference !== undefined && typeof providerReference !== "string")) { res.status(400).json({ error: "Invalid payment record" }); return; }
    const actorUserId = (req as AuthenticatedRequest).marketplaceUser.id;
    const payment = await db.transaction(async (tx) => {
      const subscription = await tx.query.subscriptions.findFirst({ where: eq(subscriptions.id, subscriptionId) });
      if (!subscription) throw new Error("Subscription not found");
      const [created] = await tx.insert(payments).values({ subscriptionId, amountOmaniRial: amountOmaniRial.toFixed(3), status, provider, providerReference: providerReference ?? null, paidAt: status === "paid" ? new Date() : null }).returning();
      if (status === "paid") {
        const plan = await tx.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, subscription.planId) });
        if (!plan) throw new Error("Subscription plan not found");
        const now = new Date();
        await tx.update(subscriptions).set({ status: "active", currentPeriodStartsAt: now, currentPeriodEndsAt: addMonths(now, plan.billingMonths), cancelledAt: null, updatedAt: now }).where(eq(subscriptions.id, subscriptionId));
      }
      await tx.insert(auditEvents).values({ actorUserId, action: "payment_recorded", entityType: "payment", entityId: created.id, metadata: { subscriptionId, status, provider } });
      return created;
    });
    res.status(201).json(await paymentResponse(payment));
  } catch (error) { next(error); }
});
router.get("/admin/settings", requireUser, requireAdmin, async (_req, res, next) => { try { res.json(await getSettings()); } catch (error) { next(error); } });
router.put("/admin/settings", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const settings = req.body;
    if (!Number.isInteger(settings?.trialMonths) || settings.trialMonths < 1 || !Number.isFinite(settings?.defaultPriceOmaniRial) || settings.defaultPriceOmaniRial < 0 || !rankingWeightsSchema.safeParse(settings?.rankingWeights).success) {
      res.status(400).json({ error: "Invalid marketplace settings" });
      return;
    }
    await db.insert(marketplaceSettings).values([{ key: "subscription", value: { trialMonths: settings.trialMonths, defaultPriceOmaniRial: settings.defaultPriceOmaniRial }, description: "Subscription lifecycle configuration" }, { key: "ranking", value: settings.rankingWeights, description: "Directory ranking weights" }]).onConflictDoUpdate({ target: marketplaceSettings.key, set: { value: sql`excluded.value`, updatedAt: new Date() } });
    await logAudit((req as AuthenticatedRequest).marketplaceUser.id, "marketplace_settings_updated", "marketplace_settings", "global");
    res.json(await getSettings());
  } catch (error) { next(error); }
});
return router;
}

export default createMarketplaceRouter();