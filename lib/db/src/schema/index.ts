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
export const serviceRequestStatusEnum = pgEnum("service_request_status", ["open", "quoted", "awarded", "closed", "cancelled"]);
export const requestRecipientStatusEnum = pgEnum("request_recipient_status", ["invited", "viewed", "quoted", "declined"]);
export const quoteStatusEnum = pgEnum("quote_status", ["submitted", "accepted", "rejected", "withdrawn"]);
export const listingEngagementActionEnum = pgEnum("listing_engagement_action", ["view", "like", "save", "contact"]);
export const marketplaceListingTypeEnum = pgEnum("marketplace_listing_type", ["sale", "rent"]);

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
  ...timestamps,
}, (table) => [index("projects_contractor_idx").on(table.contractorId), index("projects_published_idx").on(table.isPublished, table.category)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id").notNull().references(() => contractorProfiles.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isPublished: boolean("is_published").notNull().default(true),
  ...timestamps,
}, (table) => [index("reviews_contractor_idx").on(table.contractorId, table.isPublished), index("reviews_rating_idx").on(table.rating)]);

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
  imageUrl: varchar("image_url", { length: 2048 }),
  contactPhone: varchar("contact_phone", { length: 32 }),
  adminRating: integer("admin_rating"),
  isPublished: boolean("is_published").notNull().default(false),
  ...timestamps,
}, (table) => [
  index("marketplace_listings_published_idx").on(table.isPublished, table.createdAt),
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
  requestRecipients: many(requestRecipients), quotes: many(quotes),
}));

export const insertContractorProfileSchema = createInsertSchema(contractorProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type ContractorProfile = typeof contractorProfiles.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type User = typeof users.$inferSelect;
export type ListingEngagement = typeof listingEngagement.$inferSelect;
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type RankingWeights = { rating: number; reviews: number; projects: number; profile: number; verification: number; activity: number; engagement: number };
export const rankingWeightsSchema = z.object({ rating: z.number().min(0), reviews: z.number().min(0), projects: z.number().min(0), profile: z.number().min(0), verification: z.number().min(0), activity: z.number().min(0), engagement: z.number().min(0) });