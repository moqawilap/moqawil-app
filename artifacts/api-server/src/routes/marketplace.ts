import { Router, type IRouter, type RequestHandler } from "express";
import { clerkClient } from "@clerk/express";
import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  adCampaignEvents, adCampaigns, auditEvents, contractorProfiles, db, listingEngagement, listingEngagementActions, marketplaceListings, marketplaceRatings, marketplaceSettings, notifications, payments, projects, quotes, rankingWeightsSchema, requestRecipients, reviews,
  serviceRequests, services, subscriptionPlans, subscriptions, users,
  type AdAudience, type AdMediaItem,
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
function parseBudgetQuery(value: unknown) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function validImageUrls(value: unknown) {
  return Array.isArray(value) && value.length <= 5 && value.every((item) => typeof item === "string" && item.length <= 2_000_000);
}
function validAdminImageUrls(value: unknown) {
  return Array.isArray(value) && value.length <= 15
    && value.every((item) => typeof item === "string" && item.length >= 20 && item.length <= 2_000_000);
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
  const [owner, profileServices] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, profile.userId) }),
    db.select({ name: services.name, category: services.category }).from(services).where(and(eq(services.contractorId, profile.id), eq(services.isActive, true))),
  ]);
  const serviceNames = profileServices.map((service) => service.name);
  const isDesigner = profileServices.some((service) => service.category === "consultants");
  const isMaintenance = profileServices.some((service) => service.category === "maintenance");
  return {
    ...publicSummary, businessNameArabic: profile.businessNameArabic, bioArabic: profile.bioArabic,
    wilayat: profile.wilayat, serviceArea: profile.serviceArea, phone: profile.phone,
    evaluationNotes: profile.evaluationNotes, adminRating: profile.adminRating,
    agreedContractAmountOmaniRial: decimal(profile.agreedContractAmountOmaniRial),
    isDesigner, isMaintenance, serviceNames,
    accountLinkStatus: owner?.identitySource === "clerk" ? "linked_clerk" : "managed_unlinked",
  };
}
function validOptionalText(value: unknown, maximum: number) {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maximum);
}
function validServiceNames(value: unknown, allowEmpty = false) {
  return Array.isArray(value) && value.length <= 26 && (allowEmpty || value.length >= 1)
    && new Set(value).size === value.length
    && value.every((item) => typeof item === "string" && item.trim().length >= 2 && item.trim().length <= 160);
}

const adStatuses = ["draft", "active", "paused", "completed"] as const;
const adEditableStatuses = ["draft", "active", "paused"] as const;
const adBillingModels = ["cpm", "cpc", "cpa"] as const;
const adEventTypes = ["impression", "click", "conversion"] as const;
type AdStatus = typeof adStatuses[number];
type AdBillingModel = typeof adBillingModels[number];
type AdEventType = typeof adEventTypes[number];

function validAdAudience(value: unknown): value is AdAudience {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const audience = value as Record<string, unknown>;
  return ["cities", "wilayats", "serviceCategories"].every((key) => audience[key] === undefined || (
    Array.isArray(audience[key]) && (audience[key] as unknown[]).length <= 30
      && (audience[key] as unknown[]).every((item) => typeof item === "string" && item.trim().length >= 2 && item.trim().length <= 100)
  ));
}

function validAdMedia(value: unknown, expectedType?: AdMediaItem["type"]) {
  if (typeof value !== "string" || value.length < 20 || value.length > 2_000_000) return false;
  const dataMatch = value.match(/^data:(image|video)\/[a-z0-9.+-]+;base64,/i);
  if (dataMatch) return expectedType === undefined || dataMatch[1]?.toLowerCase() === expectedType;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const MAX_AD_IMAGES = 15;
const MAX_AD_VIDEOS = 2;
function validAdMediaItems(value: unknown): value is AdMediaItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_AD_IMAGES + MAX_AD_VIDEOS) return false;
  const images = value.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "image").length;
  const videos = value.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "video").length;
  return images <= MAX_AD_IMAGES && videos <= MAX_AD_VIDEOS && images + videos === value.length
    && value.every((item) => item && typeof item === "object"
      && ((item as Record<string, unknown>).type === "image" || (item as Record<string, unknown>).type === "video")
      && validAdMedia((item as Record<string, unknown>).url, (item as Record<string, unknown>).type as AdMediaItem["type"]));
}

function campaignMedia(campaign: typeof adCampaigns.$inferSelect): AdMediaItem[] {
  return validAdMediaItems(campaign.mediaItems) ? campaign.mediaItems : [{ url: campaign.mediaUrl, type: campaign.mediaType }];
}

function validAdUrl(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.length <= 2_000);
}

function validAdCampaignInput(input: Record<string, unknown>, partial = false) {
  const requiredText = ["title", "description", "ctaLabel", "billingModel", "startAt", "endAt"] as const;
  if (!partial && requiredText.some((field) => typeof input[field] !== "string" || String(input[field]).trim().length < 1)) return false;
  const hasStructuredMedia = input.media !== undefined;
  const hasLegacyMedia = input.mediaUrl !== undefined && input.mediaType !== undefined;
  const hasIncompleteLegacyMedia = (input.mediaUrl !== undefined) !== (input.mediaType !== undefined);
  if (!hasStructuredMedia && hasIncompleteLegacyMedia) return false;
  if (!partial && !hasStructuredMedia && !hasLegacyMedia) return false;
  if (hasStructuredMedia && !validAdMediaItems(input.media)) return false;
  if (input.title !== undefined && (typeof input.title !== "string" || input.title.trim().length < 2 || input.title.length > 200)) return false;
  if (input.description !== undefined && (typeof input.description !== "string" || input.description.trim().length < 2 || input.description.length > 5_000)) return false;
  if (input.ctaLabel !== undefined && (typeof input.ctaLabel !== "string" || input.ctaLabel.trim().length < 1 || input.ctaLabel.length > 50)) return false;
  if (input.ctaUrl !== undefined && !validAdUrl(input.ctaUrl)) return false;
  if (input.mediaUrl !== undefined && !validAdMedia(input.mediaUrl)) return false;
  if (input.mediaType !== undefined && input.mediaType !== "image" && input.mediaType !== "video") return false;
  if (input.audience !== undefined && !validAdAudience(input.audience)) return false;
  if (input.frequencyCapPerDay !== undefined && (!Number.isInteger(input.frequencyCapPerDay) || Number(input.frequencyCapPerDay) < 1 || Number(input.frequencyCapPerDay) > 100)) return false;
  for (const field of ["totalBudgetOmaniRial", "dailyBudgetOmaniRial", "unitRateOmaniRial"] as const) {
    if (input[field] !== undefined && (!Number.isFinite(input[field]) || Number(input[field]) <= 0)) return false;
  }
  if (input.totalBudgetOmaniRial !== undefined && input.dailyBudgetOmaniRial !== undefined && Number(input.dailyBudgetOmaniRial) > Number(input.totalBudgetOmaniRial)) return false;
  if (input.billingModel !== undefined && !adBillingModels.includes(input.billingModel as AdBillingModel)) return false;
  if (input.status !== undefined && !adEditableStatuses.includes(input.status as typeof adEditableStatuses[number])) return false;
  for (const field of ["startAt", "endAt"] as const) {
    if (input[field] !== undefined && (typeof input[field] !== "string" || !Number.isFinite(Date.parse(input[field])))) return false;
  }
  if (input.startAt !== undefined && input.endAt !== undefined && Date.parse(input.endAt as string) <= Date.parse(input.startAt as string)) return false;
  return true;
}

function adCostForEvent(campaign: typeof adCampaigns.$inferSelect, eventType: AdEventType) {
  if ((campaign.billingModel === "cpm" && eventType !== "impression")
    || (campaign.billingModel === "cpc" && eventType !== "click")
    || (campaign.billingModel === "cpa" && eventType !== "conversion")) return 0;
  return Number(campaign.unitRateOmaniRial) / (campaign.billingModel === "cpm" ? 1000 : 1);
}

function adResponse(campaign: typeof adCampaigns.$inferSelect, owner?: { businessName: string; businessNameArabic: string | null }, dailySpent = 0) {
  const total = Number(campaign.totalBudgetOmaniRial);
  const spent = Number(campaign.spentOmaniRial);
  return {
    id: campaign.id,
    contractorId: campaign.contractorId,
    advertiserName: owner?.businessName ?? null,
    advertiserNameArabic: owner?.businessNameArabic ?? null,
    title: campaign.title,
    description: campaign.description,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
     media: campaignMedia(campaign),
    mediaUrl: campaign.mediaUrl,
    mediaType: campaign.mediaType,
    audience: campaign.audience,
    frequencyCapPerDay: campaign.frequencyCapPerDay,
    totalBudgetOmaniRial: total,
    dailyBudgetOmaniRial: Number(campaign.dailyBudgetOmaniRial),
    billingModel: campaign.billingModel,
    unitRateOmaniRial: Number(campaign.unitRateOmaniRial),
    startAt: campaign.startAt.toISOString(),
    endAt: campaign.endAt.toISOString(),
    status: campaign.status,
    impressionCount: campaign.impressionCount,
    clickCount: campaign.clickCount,
    conversionCount: campaign.conversionCount,
    spentOmaniRial: Number(spent.toFixed(6)),
    remainingOmaniRial: Number(Math.max(0, total - spent).toFixed(6)),
    dailySpentOmaniRial: Number(dailySpent.toFixed(6)),
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

const listingActions = ["view", "like", "save", "contact"] as const;
type ListingAction = typeof listingActions[number];
function validListingId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
function validActorKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}
async function listingResponse(listing: typeof marketplaceListings.$inferSelect) {
  const [summary] = await db.select({
    rating: sql<number>`coalesce(avg(${marketplaceRatings.rating}), 0)`,
    count: sql<number>`count(*)`,
  }).from(marketplaceRatings).where(and(eq(marketplaceRatings.subjectType, "listing"), eq(marketplaceRatings.subjectId, listing.id)));
  return {
    id: listing.id,
    title: listing.title,
    titleArabic: listing.titleArabic,
    type: listing.type,
    price: listing.price,
    location: listing.location,
    locationArabic: listing.locationArabic,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    area: listing.area,
    imageUrl: listing.imageUrl,
    imageUrls: listing.imageUrls.length ? listing.imageUrls : listing.imageUrl ? [listing.imageUrl] : [],
    contactPhone: listing.contactPhone,
    rating: Number(summary.count) > 0 ? Number(summary.rating) : listing.adminRating ?? 0,
    isPublished: listing.isPublished,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}
function validListingInput(input: Record<string, unknown>, partial = false) {
  const textFields = ["title", "titleArabic", "price", "location", "locationArabic", "area"] as const;
  if (!partial && textFields.some((field) => typeof input[field] !== "string" || String(input[field]).trim().length < 1)) return false;
  if (textFields.some((field) => input[field] !== undefined && (typeof input[field] !== "string" || String(input[field]).trim().length > 200))) return false;
  if (input.type !== undefined && input.type !== "sale" && input.type !== "rent") return false;
  for (const field of ["bedrooms", "bathrooms"] as const) {
    if (input[field] !== undefined && (!Number.isInteger(input[field]) || Number(input[field]) < 0 || Number(input[field]) > 100)) return false;
  }
  if (input.imageUrl !== undefined && input.imageUrl !== null && !validOptionalText(input.imageUrl, 2_000_000)) return false;
  if (input.imageUrls !== undefined && !validAdminImageUrls(input.imageUrls)) return false;
  if (input.contactPhone !== undefined && input.contactPhone !== null && !validOptionalText(input.contactPhone, 32)) return false;
  if (input.isPublished !== undefined && typeof input.isPublished !== "boolean") return false;
  if (input.adminRating !== undefined && input.adminRating !== null && (!Number.isInteger(input.adminRating) || Number(input.adminRating) < 1 || Number(input.adminRating) > 5)) return false;
  return true;
}
function listingActionRow(row: typeof listingEngagement.$inferSelect, actions: Set<string>) {
  return {
    listingId: row.listingId,
    likes: row.likeCount,
    saves: row.saveCount,
    contacts: row.contactCount,
    liked: actions.has("like"),
    saved: actions.has("save"),
  };
}
async function ensureListingEngagement(listingId: string) {
  await db.insert(listingEngagement).values({ listingId }).onConflictDoNothing();
  return (await db.query.listingEngagement.findFirst({ where: eq(listingEngagement.listingId, listingId) }))!;
}
async function getListingEngagement(listingId: string, actorKey?: string) {
  const row = await ensureListingEngagement(listingId);
  const actions = actorKey
    ? await db.select({ action: listingEngagementActions.action }).from(listingEngagementActions).where(and(eq(listingEngagementActions.listingId, listingId), eq(listingEngagementActions.actorKey, actorKey)))
    : [];
  return listingActionRow(row, new Set(actions.map((item) => item.action)));
}

async function contractorSummary(profile: typeof contractorProfiles.$inferSelect, settings?: Awaited<ReturnType<typeof getSettings>>) {
  settings ??= await getSettings();
  const reviewRows = await db.select({ rating: sql<number>`coalesce(avg(${reviews.rating}), 0)`, count: sql<number>`count(*)` }).from(reviews).where(and(eq(reviews.contractorId, profile.id), eq(reviews.isPublished, true)));
  const review = reviewRows[0]!;
  const activeDays = profile.lastActiveAt ? Math.max(0, 30 - Math.floor((Date.now() - profile.lastActiveAt.getTime()) / 86_400_000)) : 0;
  return {
    id: profile.id, businessName: profile.businessName, city: profile.city, wilayat: profile.wilayat, bio: profile.bio,
    avatarUrl: profile.avatarUrl, imageUrls: profile.imageUrls.length ? profile.imageUrls : profile.avatarUrl ? [profile.avatarUrl] : [], isVerified: profile.isVerified, isPublished: profile.isPublished, rating: Number(review.rating),
    reviewCount: Number(review.count),
    rankingScore: calculateRanking({ rating: Number(review.rating), reviews: Number(review.count), projects: profile.completedProjectsCount, profile: profile.profileScore, verified: profile.isVerified, activeDays, engagement: profile.engagementScore }, settings.rankingWeights),
    priceOmaniRial: decimal(profile.agreedContractAmountOmaniRial),
    createdAt: profile.createdAt.toISOString(),
  };
}

router.get("/listings/engagement", async (req, res, next) => {
  try {
    const ids = typeof req.query.ids === "string" ? [...new Set(req.query.ids.split(",").map((id) => id.trim()).filter(Boolean))] : [];
    if (!ids.length || ids.length > 50 || ids.some((id) => !validListingId(id))) {
      res.status(400).json({ error: "ids must contain between 1 and 50 valid listing identifiers" });
      return;
    }
    const actorKey = req.query.clientId;
    if (actorKey !== undefined && !validActorKey(actorKey)) {
      res.status(400).json({ error: "clientId must be between 8 and 128 characters" });
      return;
    }
    const rows = await Promise.all(ids.map((id) => getListingEngagement(id, actorKey as string | undefined)));
    res.json(Object.fromEntries(rows.map((row) => [row.listingId, row])));
  } catch (error) { next(error); }
});

router.get("/listings", async (_req, res, next) => {
  try {
    const rows = await db.select().from(marketplaceListings).where(eq(marketplaceListings.isPublished, true)).orderBy(desc(marketplaceListings.createdAt));
    res.json(await Promise.all(rows.map(listingResponse)));
  } catch (error) { next(error); }
});

router.get("/listings/:listingId", async (req, res, next) => {
  try {
    if (!validListingId(req.params.listingId)) {
      res.status(400).json({ error: "Invalid listing identifier" });
      return;
    }
    const listing = await db.query.marketplaceListings.findFirst({ where: and(eq(marketplaceListings.id, req.params.listingId), eq(marketplaceListings.isPublished, true)) });
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json(await listingResponse(listing));
  } catch (error) { next(error); }
});

router.get("/listings/:listingId/engagement", async (req, res, next) => {
  try {
    if (!validListingId(req.params.listingId)) {
      res.status(400).json({ error: "Invalid listing identifier" });
      return;
    }
    const actorKey = req.query.clientId;
    if (actorKey !== undefined && !validActorKey(actorKey)) {
      res.status(400).json({ error: "clientId must be between 8 and 128 characters" });
      return;
    }
    res.json(await getListingEngagement(req.params.listingId, actorKey as string | undefined));
  } catch (error) { next(error); }
});

router.post("/listings/:listingId/engagement", async (req, res, next) => {
  try {
    const listingId = req.params.listingId;
    const input = req.body ?? {};
    const action = input.action as ListingAction;
    if (!validListingId(listingId) || !listingActions.includes(action) || !validActorKey(input.clientId)) {
      res.status(400).json({ error: "listingId, clientId, and a valid engagement action are required" });
      return;
    }
    if ((action === "like" || action === "save") && typeof input.active !== "boolean") {
      res.status(400).json({ error: "active must be true or false for like and save actions" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(listingEngagement).values({ listingId }).onConflictDoNothing();
      if ((action === "like" || action === "save") && input.active === false) {
        const removed = await tx.delete(listingEngagementActions).where(and(
          eq(listingEngagementActions.listingId, listingId),
          eq(listingEngagementActions.actorKey, input.clientId),
          eq(listingEngagementActions.action, action),
        )).returning({ id: listingEngagementActions.id });
        if (removed.length) {
          const column = action === "like" ? listingEngagement.likeCount : listingEngagement.saveCount;
          await tx.update(listingEngagement).set({ [action === "like" ? "likeCount" : "saveCount"]: sql`${column} - 1`, updatedAt: new Date() }).where(eq(listingEngagement.listingId, listingId));
        }
        return;
      }

      const inserted = await tx.insert(listingEngagementActions).values({ listingId, actorKey: input.clientId, action }).onConflictDoNothing().returning({ id: listingEngagementActions.id });
      if (inserted.length) {
        const field = action === "view" ? "viewCount" : action === "like" ? "likeCount" : action === "save" ? "saveCount" : "contactCount";
        const column = listingEngagement[field];
        await tx.update(listingEngagement).set({ [field]: sql`${column} + 1`, updatedAt: new Date() }).where(eq(listingEngagement.listingId, listingId));
      }
    });
    res.json(await getListingEngagement(listingId, input.clientId));
  } catch (error) { next(error); }
});

router.get("/listings/:listingId/rating", async (req, res, next) => {
  try {
    const listingId = req.params.listingId;
    if (!validListingId(listingId)) { res.status(400).json({ error: "Invalid listing identifier" }); return; }
    const [summary] = await db.select({ rating: sql<number>`coalesce(avg(${marketplaceRatings.rating}), 0)` }).from(marketplaceRatings).where(and(eq(marketplaceRatings.subjectType, "listing"), eq(marketplaceRatings.subjectId, listingId)));
    res.json({ rating: Number(summary.rating) });
  } catch (error) { next(error); }
});

router.post("/listings/:listingId/rating", requireUser, async (req, res, next) => {
  try {
    const listingId = req.params.listingId;
    const rating = Number(req.body?.rating);
    if (!validListingId(listingId) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "A rating from 1 to 5 is required" });
      return;
    }
    const listing = await db.query.marketplaceListings.findFirst({ where: and(eq(marketplaceListings.id, listingId), eq(marketplaceListings.isPublished, true)) });
    const reviewerId = (req as AuthenticatedRequest).marketplaceUser.id;
    await db.insert(marketplaceRatings).values({ subjectType: "listing", subjectId: listingId, reviewerId, rating }).onConflictDoUpdate({
      target: [marketplaceRatings.subjectType, marketplaceRatings.subjectId, marketplaceRatings.reviewerId],
      set: { rating, updatedAt: new Date() },
    });
    const [summary] = await db.select({ rating: sql<number>`coalesce(avg(${marketplaceRatings.rating}), 0)` }).from(marketplaceRatings).where(and(eq(marketplaceRatings.subjectType, "listing"), eq(marketplaceRatings.subjectId, listingId)));
    res.json({ rating: Number(summary.rating) });
  } catch (error) { next(error); }
});

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
    const minBudget = parseBudgetQuery(req.query.minBudget);
    const maxBudget = parseBudgetQuery(req.query.maxBudget);
    if (minBudget === undefined || maxBudget === undefined || (minBudget !== null && maxBudget !== null && minBudget > maxBudget)) {
      res.status(400).json({ error: "Budget limits must be valid non-negative numbers, with minimum no greater than maximum" });
      return;
    }
    if (minBudget !== null) filters.push(sql`${contractorProfiles.agreedContractAmountOmaniRial} is not null and ${contractorProfiles.agreedContractAmountOmaniRial} >= ${minBudget.toFixed(3)}`);
    if (maxBudget !== null) filters.push(sql`${contractorProfiles.agreedContractAmountOmaniRial} is not null and ${contractorProfiles.agreedContractAmountOmaniRial} <= ${maxBudget.toFixed(3)}`);
    const sort = typeof req.query.sort === "string" ? req.query.sort : "relevance";
    if (!["relevance", "rating_desc", "price_asc", "price_desc", "oldest", "newest"].includes(sort)) {
      res.status(400).json({ error: "Unsupported contractor sort" });
      return;
    }
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
        .orderBy(
          sort === "price_asc" ? asc(sql`coalesce(${contractorProfiles.agreedContractAmountOmaniRial}, '999999999')`) :
          sort === "price_desc" ? desc(sql`coalesce(${contractorProfiles.agreedContractAmountOmaniRial}, '0')`) :
          sort === "rating_desc" ? desc(rating) :
          sort === "oldest" ? asc(contractorProfiles.createdAt) :
          sort === "newest" ? desc(contractorProfiles.createdAt) : desc(score),
          asc(contractorProfiles.businessName), asc(contractorProfiles.id),
        ).limit(limit).offset((page - 1) * limit),
      db.select({ count: sql<number>`count(distinct ${contractorProfiles.id})` }).from(contractorProfiles)
        .innerJoin(subscriptions, eq(subscriptions.contractorId, contractorProfiles.id)).where(and(...filters)),
    ]);
    res.json({ items: rows.map((row) => ({ id: row.profile.id, businessName: row.profile.businessName, city: row.profile.city, wilayat: row.profile.wilayat, bio: row.profile.bio, avatarUrl: row.profile.avatarUrl, imageUrls: row.profile.imageUrls.length ? row.profile.imageUrls : row.profile.avatarUrl ? [row.profile.avatarUrl] : [], isVerified: row.profile.isVerified, isPublished: row.profile.isPublished, rating: Number(row.rating), reviewCount: Number(row.reviewCount), rankingScore: Number(row.rankingScore), priceOmaniRial: decimal(row.profile.agreedContractAmountOmaniRial), createdAt: row.profile.createdAt.toISOString() })), page, total: Number(totalRows[0]!.count) });
  } catch (error) { next(error); }
});

router.get("/contractors/:id", async (req, res, next) => {
  try {
    const contractorId = String(req.params.id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractorId)) {
      res.status(404).json({ error: "Contractor not found" });
      return;
    }
    const profile = await db.query.contractorProfiles.findFirst({ where: and(eq(contractorProfiles.id, contractorId), eq(contractorProfiles.isPublished, true), isNull(contractorProfiles.archivedAt)) });
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

router.get("/contractors/:id/rating", async (req, res, next) => {
  try {
    const contractorId = String(req.params.id);
    if (!validListingId(contractorId)) { res.status(400).json({ error: "Invalid contractor identifier" }); return; }
    const [summary] = await db.select({ rating: sql<number>`coalesce(avg(${marketplaceRatings.rating}), 0)` }).from(marketplaceRatings).where(and(eq(marketplaceRatings.subjectType, "contractor"), eq(marketplaceRatings.subjectId, contractorId)));
    res.json({ rating: Number(summary.rating) });
  } catch (error) { next(error); }
});

router.post("/contractors/:id/rating", requireUser, async (req, res, next) => {
  try {
    const contractorId = String(req.params.id);
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "A rating from 1 to 5 is required" });
      return;
    }
    const reviewerId = (req as AuthenticatedRequest).marketplaceUser.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractorId);
    const profile = isUuid ? await db.query.contractorProfiles.findFirst({ where: and(eq(contractorProfiles.id, contractorId), eq(contractorProfiles.isPublished, true), isNull(contractorProfiles.archivedAt)) }) : undefined;
    if (profile) {
      await db.insert(reviews).values({ contractorId, reviewerId, rating, isPublished: true }).onConflictDoUpdate({
        target: [reviews.contractorId, reviews.reviewerId],
        set: { rating, isPublished: true, updatedAt: new Date() },
      });
      const summary = await contractorSummary(profile);
      res.json({ rating: summary.rating });
      return;
    }
    if (!validListingId(contractorId)) {
      res.status(404).json({ error: "Contractor not found" });
      return;
    }
    await db.insert(marketplaceRatings).values({ subjectType: "contractor", subjectId: contractorId, reviewerId, rating }).onConflictDoUpdate({
      target: [marketplaceRatings.subjectType, marketplaceRatings.subjectId, marketplaceRatings.reviewerId],
      set: { rating, updatedAt: new Date() },
    });
    const [summary] = await db.select({ rating: sql<number>`coalesce(avg(${marketplaceRatings.rating}), 0)` }).from(marketplaceRatings).where(and(eq(marketplaceRatings.subjectType, "contractor"), eq(marketplaceRatings.subjectId, contractorId)));
    res.json({ rating: Number(summary.rating) });
  } catch (error) { next(error); }
});

router.get("/me", requireUser, async (req, res) => {
  const user = (req as AuthenticatedRequest).marketplaceUser;
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });
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
      wilayat: profile.wilayat,
      bio: profile.bio,
      serviceArea: profile.serviceArea,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      imageUrls: profile.imageUrls.length ? profile.imageUrls : profile.avatarUrl ? [profile.avatarUrl] : [],
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
    if (typeof input.businessName !== "string" || input.businessName.trim().length < 2 || input.businessName.length > 200 || typeof input.city !== "string" || input.city.trim().length < 2 || input.city.length > 100 || typeof input.wilayat !== "string" || input.wilayat.trim().length < 2 || input.wilayat.length > 100 || !validOptionalText(input.bio, 5000) || !validOptionalText(input.serviceArea, 255) || !validOptionalText(input.phone, 32) || !validOptionalText(input.avatarUrl, 2048)) { res.status(400).json({ error: "Invalid contractor profile fields" }); return; }
    if (user.role === "customer") {
      await promoteCustomerToContractor(user.clerkUserId);
    }
    const settings = await getSettings();
    const result = await db.transaction(async (tx) => {
      const [profile] = await tx.insert(contractorProfiles).values({
        userId: user.id, businessName: input.businessName.trim(), city: input.city.trim(), wilayat: typeof input.wilayat === "string" ? input.wilayat.trim() : null,
        bio: typeof input.bio === "string" ? input.bio : null, serviceArea: typeof input.serviceArea === "string" ? input.serviceArea : null,
        phone: typeof input.phone === "string" ? input.phone : null, avatarUrl: typeof input.avatarUrl === "string" ? input.avatarUrl : null,
        lastActiveAt: new Date(),
      }).onConflictDoUpdate({ target: contractorProfiles.userId, set: {
        businessName: input.businessName.trim(), city: input.city.trim(), wilayat: typeof input.wilayat === "string" ? input.wilayat.trim() : null, bio: typeof input.bio === "string" ? input.bio : null,
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
    await db.update(requestRecipients).set({ status: "viewed", updatedAt: new Date() }).where(and(eq(requestRecipients.contractorId, profile.id), eq(requestRecipients.status, "invited")));
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
    if (!request || !recipient || recipient.status === "quoted" || request.status === "cancelled" || request.status === "awarded") { res.status(404).json({ error: "Request is unavailable" }); return; }
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
    if (!quote || quote.status !== "submitted" || !request || request.status === "cancelled" || request.status === "awarded") { res.status(404).json({ error: "Quote is unavailable" }); return; }
    const contractor = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, quote.contractorId) });
    if (!contractor) { res.status(404).json({ error: "Quote is unavailable" }); return; }
    const accepted = await db.transaction(async (tx) => {
      const [awarded] = await tx.update(serviceRequests).set({ status: "awarded", updatedAt: new Date() }).where(and(
        eq(serviceRequests.id, request.id),
        eq(serviceRequests.customerId, user.id),
        or(eq(serviceRequests.status, "open"), eq(serviceRequests.status, "quoted")),
      )).returning({ id: serviceRequests.id });
      if (!awarded) return false;
      await tx.update(quotes).set({ status: "accepted", updatedAt: new Date() }).where(eq(quotes.id, quote.id));
      await tx.update(quotes).set({ status: "rejected", updatedAt: new Date() }).where(and(eq(quotes.requestId, request.id), sql`${quotes.id} <> ${quote.id}`));
      await tx.insert(notifications).values({ userId: contractor.userId, type: "system", channel: "in_app", deliveryStatus: "delivered", title: "Quote accepted", body: `Your quote for ${request.serviceName} was accepted.`, deliveryMetadata: { requestId: request.id, quoteId: quote.id }, deliveredAt: new Date() });
      return true;
    });
    if (!accepted) { res.status(409).json({ error: "Another quote has already been accepted" }); return; }
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

router.get("/admin/listings", requireUser, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db.select().from(marketplaceListings).orderBy(desc(marketplaceListings.createdAt));
    const metrics = await db.select().from(listingEngagement);
    const byId = new Map(metrics.map((item) => [item.listingId, item]));
    res.json(await Promise.all(rows.map(async (item) => {
      const engagement = byId.get(item.id);
      return { ...(await listingResponse(item)), views: engagement?.viewCount ?? 0, likes: engagement?.likeCount ?? 0, saves: engagement?.saveCount ?? 0, contacts: engagement?.contactCount ?? 0 };
    })));
  } catch (error) { next(error); }
});
router.post("/admin/listings", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const input = req.body as Record<string, unknown>;
    if (!validListingInput(input)) {
      res.status(400).json({ error: "Invalid listing fields" });
      return;
    }
    const baseId = String(input.title).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "listing";
    const id = `${baseId}-${Date.now().toString(36)}`;
    const [created] = await db.insert(marketplaceListings).values({
      id,
      title: String(input.title).trim(),
      titleArabic: String(input.titleArabic).trim(),
      type: input.type === "rent" ? "rent" : "sale",
      price: String(input.price).trim(),
      location: String(input.location).trim(),
      locationArabic: String(input.locationArabic).trim(),
      bedrooms: Number(input.bedrooms ?? 0),
      bathrooms: Number(input.bathrooms ?? 0),
      area: String(input.area).trim(),
      imageUrl: input.imageUrl ? String(input.imageUrl).trim() : null,
      imageUrls: validAdminImageUrls(input.imageUrls) ? input.imageUrls as string[] : input.imageUrl ? [String(input.imageUrl).trim()] : [],
      contactPhone: input.contactPhone ? String(input.contactPhone).trim() : null,
      adminRating: input.adminRating === null || input.adminRating === undefined ? null : Number(input.adminRating),
      isPublished: input.isPublished === true,
    }).returning();
    res.status(201).json(await listingResponse(created));
  } catch (error) { next(error); }
});
router.patch("/admin/listings/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    if (!validListingId(req.params.id) || !validListingInput(req.body as Record<string, unknown>, true) || !Object.keys(req.body ?? {}).length) {
      res.status(400).json({ error: "Invalid listing update" });
      return;
    }
    const input = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const field of ["title", "titleArabic", "price", "location", "locationArabic", "area", "imageUrl", "imageUrls", "contactPhone", "adminRating", "isPublished", "bedrooms", "bathrooms", "type"]) {
      if (input[field] !== undefined) updates[field === "titleArabic" ? "titleArabic" : field] = typeof input[field] === "string" ? String(input[field]).trim() : input[field];
    }
    if (input.imageUrls !== undefined) updates.imageUrl = (input.imageUrls as string[])[0] ?? null;
    if (input.type !== undefined) updates.type = input.type;
    updates.updatedAt = new Date();
    const [updated] = await db.update(marketplaceListings).set(updates as Partial<typeof marketplaceListings.$inferInsert>).where(eq(marketplaceListings.id, req.params.id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json(await listingResponse(updated));
  } catch (error) { next(error); }
});
router.delete("/admin/listings/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    if (!validListingId(req.params.id || "")) {
      res.status(400).json({ error: "Invalid listing identifier" });
      return;
    }
    const [deleted] = await db.transaction(async (tx) => {
      const listingId = String(req.params.id);
      await tx.delete(listingEngagementActions).where(eq(listingEngagementActions.listingId, listingId));
      await tx.delete(listingEngagement).where(eq(listingEngagement.listingId, listingId));
      return tx.delete(marketplaceListings).where(eq(marketplaceListings.id, listingId)).returning({ id: marketplaceListings.id });
    });
    if (!deleted) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.status(204).send();
  } catch (error) { next(error); }
});
router.post("/admin/contractors", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const input = req.body ?? {};
    if (typeof input.businessName !== "string" || input.businessName.trim().length < 2 || input.businessName.length > 200 || typeof input.city !== "string" || input.city.trim().length < 2 || input.city.length > 100 || !validOptionalText(input.businessNameArabic, 200) || !validOptionalText(input.bio, 5000) || !validOptionalText(input.bioArabic, 5000) || !validOptionalText(input.wilayat, 100) || !validOptionalText(input.serviceArea, 255) || !validOptionalText(input.phone, 32) || !validOptionalText(input.avatarUrl, 2000000) || (input.imageUrls !== undefined && !validAdminImageUrls(input.imageUrls)) || !validOptionalText(input.evaluationNotes, 5000) || (input.adminRating !== undefined && input.adminRating !== null && (!Number.isInteger(input.adminRating) || input.adminRating < 1 || input.adminRating > 5)) || (input.agreedContractAmountOmaniRial !== undefined && input.agreedContractAmountOmaniRial !== null && (!Number.isFinite(input.agreedContractAmountOmaniRial) || input.agreedContractAmountOmaniRial < 0)) || (input.isVerified !== undefined && typeof input.isVerified !== "boolean") || (input.isPublished !== undefined && typeof input.isPublished !== "boolean") || (input.isWorkshop !== undefined && typeof input.isWorkshop !== "boolean") || (input.isDesigner !== undefined && typeof input.isDesigner !== "boolean") || (input.isMaintenance !== undefined && typeof input.isMaintenance !== "boolean") || (input.serviceNames !== undefined && !validServiceNames(input.serviceNames)) || (input.isDesigner === true && !validServiceNames(input.serviceNames)) || (input.isMaintenance === true && !validServiceNames(input.serviceNames))) { res.status(400).json({ error: "Invalid managed contractor fields" }); return; }
    const managedServiceNames = input.isDesigner === true || input.isMaintenance === true ? (input.serviceNames as string[]).map((name) => name.trim()) : [];
    const managedServiceCategory = input.isDesigner === true ? "consultants" : input.isMaintenance === true ? "maintenance" : null;
    const settings = await getSettings();
    const profile = await db.transaction(async (tx) => {
      const [managedUser] = await tx.insert(users).values({ clerkUserId: `managed:${crypto.randomUUID()}`, email: `managed-${crypto.randomUUID()}@listing.invalid`, displayName: input.businessName.trim(), role: "contractor", identitySource: "managed_listing" }).returning();
      const [created] = await tx.insert(contractorProfiles).values({ userId: managedUser.id, businessName: input.businessName.trim(), businessNameArabic: input.businessNameArabic ?? null, city: input.city.trim(), wilayat: input.wilayat ?? null, bio: input.bio ?? null, bioArabic: input.bioArabic ?? null, serviceArea: input.serviceArea ?? null, phone: input.phone ?? null, avatarUrl: input.avatarUrl ?? null, imageUrls: input.imageUrls ?? (input.avatarUrl ? [input.avatarUrl] : []), evaluationNotes: input.evaluationNotes ?? null, adminRating: input.adminRating ?? null, agreedContractAmountOmaniRial: input.agreedContractAmountOmaniRial?.toFixed(3) ?? null, isVerified: input.isVerified ?? false, isPublished: input.isPublished ?? false }).returning();
      const plan = await tx.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.isActive, true) });
      if (!plan) throw new Error("No active subscription plan is configured");
      const now = new Date();
      await tx.insert(subscriptions).values({ contractorId: created.id, planId: plan.id, status: "free_trial", trialStartedAt: now, trialEndsAt: addMonths(now, settings.trialMonths) });
      if (input.isWorkshop === true) {
        await tx.insert(services).values({
          contractorId: created.id,
          name: (typeof input.bio === "string" && input.bio.trim() ? input.bio.trim() : "Building workshop").slice(0, 160),
          category: "building",
          description: typeof input.bioArabic === "string" ? input.bioArabic : null,
        });
      }
      if (managedServiceNames.length && managedServiceCategory) {
        await tx.insert(services).values(managedServiceNames.map((name) => ({
          contractorId: created.id,
          name,
          category: managedServiceCategory,
          description: typeof input.bioArabic === "string" ? input.bioArabic : null,
        })));
      }
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
    const allowed = ["businessName", "businessNameArabic", "city", "wilayat", "bio", "bioArabic", "serviceArea", "phone", "avatarUrl", "imageUrls", "evaluationNotes", "adminRating", "agreedContractAmountOmaniRial", "isVerified", "isPublished", "isDesigner", "isMaintenance", "serviceNames"];
    if (!Object.keys(input).some((key) => allowed.includes(key)) || (input.businessName !== undefined && (typeof input.businessName !== "string" || input.businessName.trim().length < 2 || input.businessName.length > 200)) || (input.city !== undefined && (typeof input.city !== "string" || input.city.trim().length < 2 || input.city.length > 100)) || !validOptionalText(input.businessNameArabic, 200) || !validOptionalText(input.bio, 5000) || !validOptionalText(input.bioArabic, 5000) || !validOptionalText(input.wilayat, 100) || !validOptionalText(input.serviceArea, 255) || !validOptionalText(input.phone, 32) || !validOptionalText(input.avatarUrl, 2000000) || (input.imageUrls !== undefined && !validAdminImageUrls(input.imageUrls)) || !validOptionalText(input.evaluationNotes, 5000) || (input.adminRating !== undefined && input.adminRating !== null && (!Number.isInteger(input.adminRating) || input.adminRating < 1 || input.adminRating > 5)) || (input.agreedContractAmountOmaniRial !== undefined && input.agreedContractAmountOmaniRial !== null && (!Number.isFinite(input.agreedContractAmountOmaniRial) || input.agreedContractAmountOmaniRial < 0)) || (input.isVerified !== undefined && typeof input.isVerified !== "boolean") || (input.isPublished !== undefined && typeof input.isPublished !== "boolean") || (input.isDesigner !== undefined && typeof input.isDesigner !== "boolean") || (input.isMaintenance !== undefined && typeof input.isMaintenance !== "boolean") || (input.serviceNames !== undefined && !validServiceNames(input.serviceNames, true)) || (input.isDesigner === true && !validServiceNames(input.serviceNames)) || (input.isMaintenance === true && !validServiceNames(input.serviceNames))) { res.status(400).json({ error: "Invalid contractor update" }); return; }
    const changes: Partial<typeof contractorProfiles.$inferInsert> = { updatedAt: new Date() };
    const profileFields = allowed.filter((key) => key !== "isDesigner" && key !== "isMaintenance" && key !== "serviceNames");
    for (const key of profileFields) if (input[key] !== undefined) (changes as Record<string, unknown>)[key] = key === "businessName" || key === "city" ? input[key].trim() : key === "agreedContractAmountOmaniRial" && input[key] !== null ? input[key].toFixed(3) : input[key];
    if (input.imageUrls !== undefined) changes.avatarUrl = input.imageUrls[0] ?? null;
    const [profile] = await db.update(contractorProfiles).set(changes).where(eq(contractorProfiles.id, String(req.params.id))).returning();
    if (!profile) { res.status(404).json({ error: "Contractor not found" }); return; }
    if (input.isDesigner !== undefined || input.isMaintenance !== undefined || input.serviceNames !== undefined) {
      const serviceCategory = input.isDesigner !== undefined ? "consultants" : input.isMaintenance !== undefined ? "maintenance" : null;
      const serviceNames = input.isDesigner === false || input.isMaintenance === false ? [] : (input.serviceNames as string[] | undefined)?.map((name) => name.trim()) ?? [];
      if (serviceCategory) await db.delete(services).where(and(eq(services.contractorId, profile.id), eq(services.category, serviceCategory)));
      if (serviceNames.length && serviceCategory) {
        await db.insert(services).values(serviceNames.map((name) => ({
          contractorId: profile.id,
          name,
          category: serviceCategory,
          description: profile.bioArabic,
        })));
      }
    }
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
router.get("/ads", async (req, res, next) => {
  try {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const wilayat = typeof req.query.wilayat === "string" ? req.query.wilayat.trim() : "";
    const service = typeof req.query.service === "string" ? req.query.service.trim() : "";
    const requestedLimit = Number(req.query.limit);
    const limit = Math.min(5, Math.max(1, Number.isInteger(requestedLimit) ? requestedLimit : 2));
    const rows = await db.select({ campaign: adCampaigns, owner: contractorProfiles })
      .from(adCampaigns)
      .innerJoin(contractorProfiles, eq(contractorProfiles.id, adCampaigns.contractorId))
      .where(and(eq(adCampaigns.status, "active"), lte(adCampaigns.startAt, now), gt(adCampaigns.endAt, now)))
      .orderBy(desc(adCampaigns.createdAt));
    const dailyRows = await db.select({
      campaignId: adCampaignEvents.campaignId,
      spent: sql<string>`coalesce(sum(${adCampaignEvents.costOmaniRial}), 0)`,
    }).from(adCampaignEvents).where(gte(adCampaignEvents.createdAt, dayStart)).groupBy(adCampaignEvents.campaignId);
    const dailyByCampaign = new Map(dailyRows.map((row) => [row.campaignId, Number(row.spent)]));
    const eligible = rows.filter(({ campaign }) => {
      const audience = campaign.audience ?? {};
      const matches = (values: string[] | undefined, selected: string) => !values?.length || (selected && values.includes(selected));
      return matches(audience.cities, city)
        && matches(audience.wilayats, wilayat)
        && matches(audience.serviceCategories, service)
        && Number(campaign.spentOmaniRial) < Number(campaign.totalBudgetOmaniRial)
        && (dailyByCampaign.get(campaign.id) ?? 0) < Number(campaign.dailyBudgetOmaniRial);
    }).slice(0, limit);
    await Promise.all(rows.filter(({ campaign }) => campaign.endAt <= now || Number(campaign.spentOmaniRial) >= Number(campaign.totalBudgetOmaniRial))
      .map(({ campaign }) => db.update(adCampaigns).set({ status: "completed", updatedAt: now }).where(eq(adCampaigns.id, campaign.id))));
    res.json(eligible.map(({ campaign, owner }) => adResponse(campaign, owner, dailyByCampaign.get(campaign.id) ?? 0)));
  } catch (error) { next(error); }
});
router.post("/ads/:id/event", async (req, res, next) => {
  try {
    const eventType = req.body?.eventType as AdEventType;
    const eventKey = req.body?.eventKey;
    const actorKey = req.body?.actorKey;
    if (!adEventTypes.includes(eventType) || typeof eventKey !== "string" || eventKey.length < 8 || eventKey.length > 128 || typeof actorKey !== "string" || actorKey.length < 8 || actorKey.length > 128) {
      res.status(400).json({ error: "eventType, eventKey, and actorKey are required" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const campaign = await tx.query.adCampaigns.findFirst({ where: eq(adCampaigns.id, String(req.params.id)) });
      if (!campaign) return { accepted: false, reason: "not_found" as const };
      const existing = await tx.query.adCampaignEvents.findFirst({
        where: and(eq(adCampaignEvents.campaignId, campaign.id), eq(adCampaignEvents.eventType, eventType), eq(adCampaignEvents.eventKey, eventKey)),
      });
      if (existing) return { accepted: false, reason: "duplicate" as const, campaign: adResponse(campaign) };
      const now = new Date();
      if (campaign.status !== "active" || campaign.startAt > now || campaign.endAt <= now) {
        return { accepted: false, reason: "campaign_unavailable" as const, campaign: adResponse(campaign) };
      }
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const [daily] = await tx.select({ spent: sql<string>`coalesce(sum(${adCampaignEvents.costOmaniRial}), 0)` })
        .from(adCampaignEvents).where(and(eq(adCampaignEvents.campaignId, campaign.id), gte(adCampaignEvents.createdAt, dayStart)));
      if (eventType === "impression") {
        const [frequency] = await tx.select({ count: sql<number>`count(*)` }).from(adCampaignEvents)
          .where(and(eq(adCampaignEvents.campaignId, campaign.id), eq(adCampaignEvents.eventType, "impression"), eq(adCampaignEvents.actorKey, actorKey), gte(adCampaignEvents.createdAt, dayStart)));
        if (Number(frequency?.count ?? 0) >= campaign.frequencyCapPerDay) {
          return { accepted: false, reason: "frequency_cap_reached" as const, campaign: adResponse(campaign, undefined, Number(daily?.spent ?? 0)) };
        }
      }
      const cost = adCostForEvent(campaign, eventType);
      const totalSpent = Number(campaign.spentOmaniRial);
      const dailySpent = Number(daily?.spent ?? 0);
      if (totalSpent + cost > Number(campaign.totalBudgetOmaniRial)) {
        await tx.update(adCampaigns).set({ status: "completed", updatedAt: now }).where(eq(adCampaigns.id, campaign.id));
        return { accepted: false, reason: "total_budget_reached" as const, campaign: adResponse({ ...campaign, status: "completed" }) };
      }
      if (dailySpent + cost > Number(campaign.dailyBudgetOmaniRial)) {
        return { accepted: false, reason: "daily_budget_reached" as const, campaign: adResponse(campaign, undefined, dailySpent) };
      }
      const [event] = await tx.insert(adCampaignEvents).values({
        campaignId: campaign.id,
        eventType,
        eventKey,
        actorKey,
        costOmaniRial: cost.toFixed(6),
      }).returning();
      if (!event) return { accepted: false, reason: "event_not_recorded" as const, campaign: adResponse(campaign) };
      const nextSpent = totalSpent + cost;
      const updates: Record<string, unknown> = {
        spentOmaniRial: nextSpent.toFixed(6),
        updatedAt: now,
      };
      if (eventType === "impression") updates.impressionCount = sql`${adCampaigns.impressionCount} + 1`;
      if (eventType === "click") updates.clickCount = sql`${adCampaigns.clickCount} + 1`;
      if (eventType === "conversion") updates.conversionCount = sql`${adCampaigns.conversionCount} + 1`;
      if (nextSpent >= Number(campaign.totalBudgetOmaniRial)) updates.status = "completed";
      await tx.update(adCampaigns).set(updates as Partial<typeof adCampaigns.$inferInsert>).where(eq(adCampaigns.id, campaign.id));
      return {
        accepted: true,
        eventType,
        costOmaniRial: Number(cost.toFixed(6)),
        campaign: adResponse({ ...campaign, spentOmaniRial: nextSpent.toFixed(6), impressionCount: campaign.impressionCount + (eventType === "impression" ? 1 : 0), clickCount: campaign.clickCount + (eventType === "click" ? 1 : 0), conversionCount: campaign.conversionCount + (eventType === "conversion" ? 1 : 0), status: nextSpent >= Number(campaign.totalBudgetOmaniRial) ? "completed" : campaign.status }, undefined, dailySpent + cost),
      };
    });
    if (result.reason === "not_found") {
      res.status(404).json({ error: "Ad campaign not found" });
      return;
    }
    res.json(result);
  } catch (error) { next(error); }
});
router.get("/admin/ad-campaigns", requireUser, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db.select({ campaign: adCampaigns, owner: contractorProfiles })
      .from(adCampaigns).innerJoin(contractorProfiles, eq(contractorProfiles.id, adCampaigns.contractorId))
      .orderBy(desc(adCampaigns.createdAt));
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dailyRows = await db.select({
      campaignId: adCampaignEvents.campaignId,
      spent: sql<string>`coalesce(sum(${adCampaignEvents.costOmaniRial}), 0)`,
    }).from(adCampaignEvents).where(gte(adCampaignEvents.createdAt, dayStart)).groupBy(adCampaignEvents.campaignId);
    const dailyByCampaign = new Map(dailyRows.map((row) => [row.campaignId, Number(row.spent)]));
    res.json(rows.map(({ campaign, owner }) => adResponse(campaign, owner, dailyByCampaign.get(campaign.id) ?? 0)));
  } catch (error) { next(error); }
});
router.post("/admin/ad-campaigns", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const input = req.body as Record<string, unknown>;
    const contractorId = input.contractorId;
    if (typeof contractorId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractorId) || !validAdCampaignInput(input)) {
      res.status(400).json({ error: "Invalid ad campaign fields" });
      return;
    }
    const owner = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, contractorId) });
    if (!owner) { res.status(404).json({ error: "Advertiser profile not found" }); return; }
    const media = validAdMediaItems(input.media)
      ? input.media
      : [{ url: String(input.mediaUrl), type: input.mediaType as "image" | "video" }];
    const [created] = await db.insert(adCampaigns).values({
      contractorId,
      title: String(input.title).trim(),
      description: String(input.description).trim(),
      ctaLabel: String(input.ctaLabel).trim(),
      ctaUrl: input.ctaUrl ? String(input.ctaUrl).trim() : null,
      mediaUrl: media[0].url,
      mediaType: media[0].type,
      mediaItems: media,
      audience: input.audience as AdAudience,
      frequencyCapPerDay: Number(input.frequencyCapPerDay),
      totalBudgetOmaniRial: Number(input.totalBudgetOmaniRial).toFixed(6),
      dailyBudgetOmaniRial: Number(input.dailyBudgetOmaniRial).toFixed(6),
      billingModel: input.billingModel as AdBillingModel,
      unitRateOmaniRial: Number(input.unitRateOmaniRial).toFixed(6),
      startAt: new Date(String(input.startAt)),
      endAt: new Date(String(input.endAt)),
      status: (input.status as AdStatus | undefined) ?? "draft",
    }).returning();
    res.status(201).json(adResponse(created, owner));
  } catch (error) { next(error); }
});
router.patch("/admin/ad-campaigns/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const existing = await db.query.adCampaigns.findFirst({ where: eq(adCampaigns.id, String(req.params.id)) });
    if (!existing) { res.status(404).json({ error: "Ad campaign not found" }); return; }
    const input = req.body as Record<string, unknown>;
    const nextMedia = input.media !== undefined
      ? input.media
      : input.mediaUrl !== undefined || input.mediaType !== undefined
        ? [{ url: input.mediaUrl ?? existing.mediaUrl, type: input.mediaType ?? existing.mediaType }]
        : campaignMedia(existing);
    const merged: Record<string, unknown> = {
      contractorId: existing.contractorId,
      title: existing.title,
      description: existing.description,
      ctaLabel: existing.ctaLabel,
      ctaUrl: existing.ctaUrl,
      media: nextMedia,
      mediaUrl: existing.mediaUrl,
      mediaType: existing.mediaType,
      audience: existing.audience,
      frequencyCapPerDay: existing.frequencyCapPerDay,
      totalBudgetOmaniRial: Number(existing.totalBudgetOmaniRial),
      dailyBudgetOmaniRial: Number(existing.dailyBudgetOmaniRial),
      billingModel: existing.billingModel,
      unitRateOmaniRial: Number(existing.unitRateOmaniRial),
      startAt: existing.startAt.toISOString(),
      endAt: existing.endAt.toISOString(),
      status: existing.status,
      ...input,
    };
    if (!Object.keys(input).length || !validAdCampaignInput(merged, true)) {
      res.status(400).json({ error: "Invalid ad campaign update" });
      return;
    }
    const contractorId = merged.contractorId;
    if (typeof contractorId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractorId)) {
      res.status(400).json({ error: "Invalid advertiser profile" });
      return;
    }
    const owner = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, contractorId) });
    if (!owner) { res.status(404).json({ error: "Advertiser profile not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of ["contractorId", "title", "description", "ctaLabel", "ctaUrl", "mediaUrl", "mediaType", "audience", "billingModel", "status", "frequencyCapPerDay"] as const) {
      if (input[field] !== undefined) updates[field] = field === "title" || field === "description" || field === "ctaLabel" ? String(input[field]).trim() : input[field];
    }
    if (input.media !== undefined || input.mediaUrl !== undefined || input.mediaType !== undefined) {
      const media = nextMedia as AdMediaItem[];
      updates.mediaItems = media;
      updates.mediaUrl = media[0].url;
      updates.mediaType = media[0].type;
    }
    for (const field of ["totalBudgetOmaniRial", "dailyBudgetOmaniRial", "unitRateOmaniRial"] as const) {
      if (input[field] !== undefined) updates[field] = Number(input[field]).toFixed(6);
    }
    for (const field of ["startAt", "endAt"] as const) {
      if (input[field] !== undefined) updates[field] = new Date(String(input[field]));
    }
    const [updated] = await db.update(adCampaigns).set(updates as Partial<typeof adCampaigns.$inferInsert>).where(eq(adCampaigns.id, existing.id)).returning();
    res.json(adResponse(updated, owner));
  } catch (error) { next(error); }
});
router.get("/admin/ad-campaigns/:id/report", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const campaign = await db.query.adCampaigns.findFirst({ where: eq(adCampaigns.id, String(req.params.id)) });
    if (!campaign) { res.status(404).json({ error: "Ad campaign not found" }); return; }
    const owner = await db.query.contractorProfiles.findFirst({ where: eq(contractorProfiles.id, campaign.contractorId) });
    const events = await db.select().from(adCampaignEvents).where(eq(adCampaignEvents.campaignId, campaign.id)).orderBy(desc(adCampaignEvents.createdAt));
    const days = new Map<string, { date: string; impressions: number; clicks: number; conversions: number; spentOmaniRial: number }>();
    for (const event of events) {
      const date = event.createdAt.toISOString().slice(0, 10);
      const current = days.get(date) ?? { date, impressions: 0, clicks: 0, conversions: 0, spentOmaniRial: 0 };
      if (event.eventType === "impression") current.impressions += 1;
      if (event.eventType === "click") current.clicks += 1;
      if (event.eventType === "conversion") current.conversions += 1;
      current.spentOmaniRial += Number(event.costOmaniRial);
      days.set(date, current);
    }
    res.json({ campaign: adResponse(campaign, owner ?? undefined), days: [...days.values()].map((day) => ({ ...day, spentOmaniRial: Number(day.spentOmaniRial.toFixed(6)) })) });
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