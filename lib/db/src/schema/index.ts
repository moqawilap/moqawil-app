import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const userRoleEnum = pgEnum("user_role", ["customer", "contractor", "admin"]);
export const identitySourceEnum = pgEnum("identity_source", ["clerk", "managed_listing"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["free_trial", "active", "payment_due", "expired", "cancelled", "suspended"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded", "void"]);
export const notificationTypeEnum = pgEnum("notification_type", ["subscription", "payment", "system", "review"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email", "push"]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", ["pending", "sent", "delivered", "failed"]);
export const pushBroadcastStatusEnum = pgEnum("push_broadcast_status", ["sending", "sent", "partial", "failed"]);
export const pushDeliveryStatusEnum = pgEnum("push_delivery_status", ["pending", "sent", "failed"]);
export const serviceRequestStatusEnum = pgEnum("service_request_status", ["open", "quoted", "awarded", "closed", "cancelled"]);
export const requestRecipientStatusEnum = pgEnum("request_recipient_status", ["invited", "viewed", "quoted", "declined"]);
export const quoteStatusEnum = pgEnum("quote_status", ["submitted", "accepted", "rejected", "withdrawn"]);
export const serviceRegistrationStatusEnum = pgEnum("service_registration_status", ["pending_review", "approved", "changes_requested", "rejected"]);
export const listingEngagementActionEnum = pgEnum("listing_engagement_action", ["view", "like", "save", "contact"]);
export const marketplaceListingTypeEnum = pgEnum("marketplace_listing_type", ["sale", "rent"]);
export const adCampaignStatusEnum = pgEnum("ad_campaign_status", ["draft", "active", "paused", "completed"]);
export const adBillingModelEnum = pgEnum("ad_billing_model", ["cpm", "cpc", "cpa"]);
export const adMediaTypeEnum = pgEnum("ad_media_type", ["image", "video"]);
export const adEventTypeEnum = pgEnum("ad_event_type", ["impression", "click", "conversion"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  displayName: varchar("display_name", { length: 160 }),
  role: userRoleEnum("role").notNull().default("customer"),
  identitySource: identitySourceEnum("identity_source").notNull().default("clerk"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_idx").on(table.email), index("users_role_idx").on(table.role)]);

export const contractorProfiles = pgTable("contractor_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  businessName: varchar("business_name", { length: 200 }).notNull(),
  businessNameArabic: varchar("business_name_arabic", { length: 200 }),
  bio: text("bio"),
  bioArabic: text("bio_arabic"),
  city: varchar("city", { length: 100 }).notNull(),
  wilayat: varchar("wilayat", { length: 100 }),
  serviceArea: varchar("service_area", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  avatarUrl: text("avatar_url"),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  isVerified: boolean("is_verified").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  completedProjectsCount: integer("completed_projects_count").notNull().default(0),
  profileScore: integer("profile_score").notNull().default(0),
  engagementScore: integer("engagement_score").notNull().default(0),
  evaluationNotes: text("evaluation_notes"),
  adminRating: integer("admin_rating"),
  agreedContractAmountOmaniRial: numeric("agreed_contract_amount_omani_rial", { precision: 12, scale: 3 }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("contractor_directory_idx").on(table.isPublished, table.city), index("contractor_verified_idx").on(table.isVerified)]);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  priceFromOmaniRial: numeric("price_from_omani_rial", { precision: 10, scale: 3 }),
  serviceWilayats: jsonb("service_wilayats").$type<string[]>().notNull().default([]),
  servesAllGovernorates: boolean("serves_all_governorates").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}, (table) => [index("services_category_idx").on(table.category), index("services_contractor_idx").on(table.contractorId)]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  city: varchar("city", { length: 100 }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  isPublished: boolean("is_published").notNull().default(true),
  reviewStatus: serviceRegistrationStatusEnum("review_status").notNull().default("approved"),
  reviewNote: text("review_note"),
  ...timestamps,
}, (table) => [index("projects_contractor_idx").on(table.contractorId), index("projects_published_idx").on(table.isPublished, table.category)]);

export const serviceRegistrations = pgTable("service_registrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  specialty: varchar("specialty", { length: 200 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  serviceWilayats: jsonb("service_wilayats").$type<string[]>().notNull().default([]),
  servesAllGovernorates: boolean("serves_all_governorates").notNull().default(false),
  deliveryAvailable: boolean("delivery_available").notNull().default(false),
  propertyDetails: jsonb("property_details").$type<{
    governorate: string;
    wilayat: string;
    area: string;
    listingType: "sale" | "rent";
    propertyType: string;
    sizeSquareMeters: number;
    bedrooms: number;
    livingRooms: number;
    majlis: number;
    kitchens: number;
    bathrooms: number;
  } | null>(),
  description: text("description").notNull(),
  mediaUrls: jsonb("media_urls").$type<string[]>().notNull().default([]),
  status: serviceRegistrationStatusEnum("status").notNull().default("pending_review"),
  reviewNote: text("review_note"),
  ...timestamps,
}, (table) => [
  index("service_registrations_user_idx").on(table.userId, table.createdAt),
  index("service_registrations_review_idx").on(table.status, table.category),
]);

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isPublished: boolean("is_published").notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("reviews_contractor_reviewer_unique_idx").on(table.contractorId, table.reviewerId),
  index("reviews_contractor_idx").on(table.contractorId, table.isPublished),
  index("reviews_rating_idx").on(table.rating),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  priceOmaniRial: numeric("price_omani_rial", { precision: 10, scale: 3 }).notNull().default("100.000"),
  billingMonths: integer("billing_months").notNull().default(12),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("free_trial"),
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }).notNull().defaultNow(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
  currentPeriodStartsAt: timestamp("current_period_starts_at", { withTimezone: true }),
  currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("subscriptions_contractor_idx").on(table.contractorId),
  index("subscriptions_status_idx").on(table.status, table.trialEndsAt),
  check("subscriptions_active_period_check", sql`${table.status} <> 'active' OR ${table.currentPeriodEndsAt} IS NOT NULL`),
]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  amountOmaniRial: numeric("amount_omani_rial", { precision: 10, scale: 3 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("OMR"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  provider: varchar("provider", { length: 50 }).notNull().default("development"),
  providerReference: varchar("provider_reference", { length: 255 }).unique(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("payments_subscription_idx").on(table.subscriptionId, table.status), index("payments_created_idx").on(table.createdAt)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull().default("in_app"),
  deliveryStatus: notificationDeliveryStatusEnum("delivery_status").notNull().default("delivered"),
  deliveryMetadata: jsonb("delivery_metadata").notNull().default({}),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("notifications_user_idx").on(table.userId, table.readAt, table.createdAt)]);

export const pushDevices = pgTable("push_devices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expoPushToken: varchar("expo_push_token", { length: 255 }).notNull().unique(),
  platform: varchar("platform", { length: 20 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [index("push_devices_user_idx").on(table.userId, table.isActive), index("push_devices_last_seen_idx").on(table.isActive, table.lastSeenAt)]);

export const pushBroadcasts = pgTable("push_broadcasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }).notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  targetUrl: text("target_url"),
  status: pushBroadcastStatusEnum("status").notNull().default("sending"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("push_broadcasts_created_idx").on(table.createdAt)]);

export const pushBroadcastDeliveries = pgTable("push_broadcast_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  broadcastId: uuid("broadcast_id").notNull().references(() => pushBroadcasts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expoPushToken: varchar("expo_push_token", { length: 255 }).notNull(),
  status: pushDeliveryStatusEnum("status").notNull().default("pending"),
  expoTicketId: varchar("expo_ticket_id", { length: 255 }),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("push_broadcast_deliveries_recipient_idx").on(table.broadcastId, table.userId),
  index("push_broadcast_deliveries_broadcast_idx").on(table.broadcastId, table.status),
]);

export const serviceRequests = pgTable("service_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceCategory: varchar("service_category", { length: 100 }).notNull(),
  serviceName: varchar("service_name", { length: 160 }).notNull(),
  governorate: varchar("governorate", { length: 100 }).notNull(),
  wilayat: varchar("wilayat", { length: 100 }).notNull(),
  requirements: text("requirements").notNull(),
  budgetOmaniRial: numeric("budget_omani_rial", { precision: 10, scale: 3 }),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  status: serviceRequestStatusEnum("status").notNull().default("open"),
  ...timestamps,
}, (table) => [
  index("service_requests_customer_idx").on(table.customerId, table.createdAt),
  index("service_requests_location_idx").on(table.governorate, table.wilayat, table.status),
]);

export const requestRecipients = pgTable("request_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  status: requestRecipientStatusEnum("status").notNull().default("invited"),
  ...timestamps,
}, (table) => [
  uniqueIndex("request_recipients_unique_idx").on(table.requestId, table.contractorId),
  index("request_recipients_contractor_idx").on(table.contractorId, table.status),
]);

export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  amountOmaniRial: numeric("amount_omani_rial", { precision: 10, scale: 3 }).notNull(),
  estimatedDays: integer("estimated_days").notNull(),
  details: text("details").notNull(),
  status: quoteStatusEnum("status").notNull().default("submitted"),
  ...timestamps,
}, (table) => [
  uniqueIndex("quotes_request_contractor_unique_idx").on(table.requestId, table.contractorId),
  index("quotes_request_idx").on(table.requestId, table.status),
  index("quotes_contractor_idx").on(table.contractorId, table.createdAt),
]);

export const listingEngagement = pgTable("listing_engagement", {
  listingId: varchar("listing_id", { length: 255 }).primaryKey(),
  viewCount: integer("view_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  saveCount: integer("save_count").notNull().default(0),
  contactCount: integer("contact_count").notNull().default(0),
  ...timestamps,
});

export const listingEngagementActions = pgTable("listing_engagement_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: varchar("listing_id", { length: 255 }).notNull().references(() => listingEngagement.listingId, { onDelete: "cascade" }),
  actorKey: varchar("actor_key", { length: 128 }).notNull(),
  action: listingEngagementActionEnum("action").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("listing_engagement_actions_unique_idx").on(table.listingId, table.actorKey, table.action),
  index("listing_engagement_actions_listing_idx").on(table.listingId, table.action),
]);

export const marketplaceListings = pgTable("marketplace_listings", {
  id: varchar("id", { length: 100 }).primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  titleArabic: varchar("title_arabic", { length: 200 }).notNull(),
  type: marketplaceListingTypeEnum("type").notNull().default("sale"),
  price: varchar("price", { length: 100 }).notNull(),
  location: varchar("location", { length: 200 }).notNull(),
  locationArabic: varchar("location_arabic", { length: 200 }).notNull(),
  bedrooms: integer("bedrooms").notNull().default(0),
  bathrooms: integer("bathrooms").notNull().default(0),
  area: varchar("area", { length: 50 }).notNull(),
  imageUrl: text("image_url"),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  contactPhone: varchar("contact_phone", { length: 32 }),
  adminRating: integer("admin_rating"),
  isPublished: boolean("is_published").notNull().default(false),
  ...timestamps,
}, (table) => [
  index("marketplace_listings_published_idx").on(table.isPublished, table.createdAt),
]);

export const marketplaceRatings = pgTable("marketplace_ratings", {
  id: uuid("id").defaultRandom().primaryKey(),
  subjectType: varchar("subject_type", { length: 20 }).notNull(),
  subjectId: varchar("subject_id", { length: 100 }).notNull(),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("marketplace_ratings_subject_reviewer_unique_idx").on(table.subjectType, table.subjectId, table.reviewerId),
  index("marketplace_ratings_subject_idx").on(table.subjectType, table.subjectId),
]);

export type AdAudience = {
  cities?: string[];
  wilayats?: string[];
  serviceCategories?: string[];
};

export type AdMediaItem = {
  url: string;
  type: "image" | "video";
};

export const adCampaigns = pgTable("ad_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  ctaLabel: varchar("cta_label", { length: 50 }).notNull(),
  ctaUrl: text("cta_url"),
  mediaUrl: text("media_url").notNull(),
  mediaType: adMediaTypeEnum("media_type").notNull().default("image"),
  mediaItems: jsonb("media_items").$type<AdMediaItem[]>().notNull().default([]),
  audience: jsonb("audience").$type<AdAudience>().notNull().default({}),
  frequencyCapPerDay: integer("frequency_cap_per_day").notNull().default(3),
  totalBudgetOmaniRial: numeric("total_budget_omani_rial", { precision: 14, scale: 6 }).notNull(),
  dailyBudgetOmaniRial: numeric("daily_budget_omani_rial", { precision: 14, scale: 6 }).notNull(),
  billingModel: adBillingModelEnum("billing_model").notNull(),
  unitRateOmaniRial: numeric("unit_rate_omani_rial", { precision: 14, scale: 6 }).notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  status: adCampaignStatusEnum("status").notNull().default("draft"),
  impressionCount: integer("impression_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  conversionCount: integer("conversion_count").notNull().default(0),
  spentOmaniRial: numeric("spent_omani_rial", { precision: 14, scale: 6 }).notNull().default("0.000000"),
  ...timestamps,
}, (table) => [
  index("ad_campaigns_contractor_idx").on(table.contractorId, table.createdAt),
  index("ad_campaigns_delivery_idx").on(table.status, table.startAt, table.endAt),
  check("ad_campaigns_total_budget_check", sql`${table.totalBudgetOmaniRial} > 0`),
  check("ad_campaigns_daily_budget_check", sql`${table.dailyBudgetOmaniRial} > 0 and ${table.dailyBudgetOmaniRial} <= ${table.totalBudgetOmaniRial}`),
  check("ad_campaigns_rate_check", sql`${table.unitRateOmaniRial} > 0`),
  check("ad_campaigns_frequency_cap_check", sql`${table.frequencyCapPerDay} >= 1 and ${table.frequencyCapPerDay} <= 100`),
  check("ad_campaigns_date_check", sql`${table.endAt} > ${table.startAt}`),
]);

export const adCampaignEvents = pgTable("ad_campaign_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
  eventType: adEventTypeEnum("event_type").notNull(),
  eventKey: varchar("event_key", { length: 128 }).notNull(),
  actorKey: varchar("actor_key", { length: 128 }).notNull(),
  costOmaniRial: numeric("cost_omani_rial", { precision: 14, scale: 6 }).notNull().default("0.000000"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ad_campaign_events_unique_idx").on(table.campaignId, table.eventType, table.eventKey),
  index("ad_campaign_events_campaign_idx").on(table.campaignId, table.createdAt),
  index("ad_campaign_events_type_idx").on(table.eventType, table.createdAt),
]);

// Kept for schema compatibility with installations that already created this table.
export const listingReviews = pgTable("listing_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: varchar("listing_id", { length: 100 }).notNull().references(() => marketplaceListings.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("listing_reviews_listing_reviewer_unique_idx").on(table.listingId, table.reviewerId),
  index("listing_reviews_listing_idx").on(table.listingId),
]);

export const marketplaceSettings = pgTable("marketplace_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  ...timestamps,
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId), index("audit_actor_idx").on(table.actorUserId, table.createdAt)]);

export const contractorRelations = relations(contractorProfiles, ({ one, many }) => ({
  user: one(users, { fields: [contractorProfiles.userId], references: [users.id] }),
  services: many(services), projects: many(projects), reviews: many(reviews), subscription: one(subscriptions),
  requestRecipients: many(requestRecipients), quotes: many(quotes), adCampaigns: many(adCampaigns),
}));

export const insertContractorProfileSchema = createInsertSchema(contractorProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type ContractorProfile = typeof contractorProfiles.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type User = typeof users.$inferSelect;
export type ListingEngagement = typeof listingEngagement.$inferSelect;
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type AdCampaignEvent = typeof adCampaignEvents.$inferSelect;
export type RankingWeights = { rating: number; reviews: number; projects: number; profile: number; verification: number; activity: number; engagement: number };
export const rankingWeightsSchema = z.object({ rating: z.number().min(0), reviews: z.number().min(0), projects: z.number().min(0), profile: z.number().min(0), verification: z.number().min(0), activity: z.number().min(0), engagement: z.number().min(0) });