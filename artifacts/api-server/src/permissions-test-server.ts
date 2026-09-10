import express, { type NextFunction, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { contractorProfiles, db, marketplaceListings, notifications, projects, requestRecipients, serviceRequests, services, subscriptionPlans, subscriptions, users, type User } from "@workspace/db";
import { requireAdmin, requireContractor, type AuthenticatedRequest } from "./middlewares/auth";
import { createMarketplaceRouter } from "./routes/marketplace";
import { ensureMarketplaceDefaults } from "./lib/marketplace";

await ensureMarketplaceDefaults();
const tag = crypto.randomUUID();
const fixtureUsers = await db.insert(users).values([
  { clerkUserId: `permission-test-customer-${tag}`, email: `permission-customer-${tag}@example.invalid`, role: "customer" },
  { clerkUserId: `permission-test-contractor-${tag}`, email: `permission-contractor-${tag}@example.invalid`, role: "contractor" },
  { clerkUserId: `permission-test-admin-${tag}`, email: `permission-admin-${tag}@example.invalid`, role: "admin" },
  { clerkUserId: `permission-test-contractor-two-${tag}`, email: `permission-contractor-two-${tag}@example.invalid`, role: "contractor" },
]).returning();
const secondContractorUser = fixtureUsers.find((user) => user.clerkUserId.includes("contractor-two")) as User;
const fixtureByRole = new Map(fixtureUsers.filter((user) => user.id !== secondContractorUser.id).map((user) => [user.role, user] as const));
const contractorUser = fixtureByRole.get("contractor") as User;
const customerUser = fixtureByRole.get("customer") as User;
const adminUser = fixtureByRole.get("admin") as User;
await db.insert(notifications).values([
  { userId: customerUser.id, type: "system", title: `Permission Test Customer Notification ${tag}`, body: "Customer-owned notification fixture." },
  { userId: contractorUser.id, type: "system", title: `Permission Test Contractor Notification ${tag}`, body: "Contractor-owned notification fixture." },
  { userId: adminUser.id, type: "system", title: `Permission Test Admin Notification ${tag}`, body: "Admin-owned notification fixture." },
]);
const [profile] = await db.insert(contractorProfiles).values({
  userId: contractorUser.id,
  businessName: `Permission Test Contractor ${tag}`,
  city: "Muscat",
  wilayat: "Bawshar",
  isPublished: true,
}).returning();
const [secondProfile] = await db.insert(contractorProfiles).values({
  userId: secondContractorUser.id,
  businessName: `Permission Test Contractor Two ${tag}`,
  city: "Muscat",
  wilayat: "Bawshar",
  isPublished: true,
}).returning();
await db.insert(services).values({
  contractorId: profile.id,
  name: `Permission Test Workshop Service ${tag}`,
  category: "building",
});
const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.isActive, true) });

const [assignedRequest, unassignedRequest, concurrentRequest, cancellableRequest] = await db.insert(serviceRequests).values([
  {
    customerId: customerUser.id,
    serviceCategory: "building",
    serviceName: `Assigned workshop request ${tag}`,
    governorate: "Muscat",
    wilayat: "Bawshar",
    requirements: "Install workshop fixtures for the permission test.",
    budgetOmaniRial: "125.000",
  },
  {
    customerId: customerUser.id,
    serviceCategory: "building",
    serviceName: `Private unassigned request ${tag}`,
    governorate: "Dhofar",
    wilayat: "Salalah",
    requirements: "This request must not appear in another workshop inbox.",
  },
  {
    customerId: customerUser.id,
    serviceCategory: "building",
    serviceName: `Concurrent acceptance request ${tag}`,
    governorate: "Muscat",
    wilayat: "Bawshar",
    requirements: "Two workshops will quote this request for an atomic acceptance test.",
  },
  {
    customerId: customerUser.id,
    serviceCategory: "maintenance",
    serviceName: `Cancellable workshop request ${tag}`,
    governorate: "Muscat",
    wilayat: "Bawshar",
    requirements: "This request will be cancelled after a workshop submits a quote.",
  },
]).returning();
if (!plan) throw new Error("Permission test requires an active subscription plan");
await db.insert(requestRecipients).values([
  { requestId: assignedRequest.id, contractorId: profile.id },
  { requestId: concurrentRequest.id, contractorId: profile.id },
  { requestId: concurrentRequest.id, contractorId: secondProfile.id },
  { requestId: cancellableRequest.id, contractorId: profile.id },
]);
await db.insert(subscriptions).values({
  contractorId: profile.id,
  planId: plan.id,
  trialEndsAt: new Date(Date.now() + 30 * 86400000),
});
const [fixtureListing] = await db.insert(marketplaceListings).values({
  id: `permission-listing-${tag}`,
  ownerUserId: contractorUser.id,
  title: `Permission Test Listing ${tag}`,
  titleArabic: `عقار اختبار ${tag}`,
  price: "100000 OMR",
  location: "Bawshar, Muscat",
  locationArabic: "بوشر، مسقط",
  area: "200 m²",
  isPublished: true,
}).returning();
await db.insert(projects).values({
  contractorId: profile.id,
  title: `Permission Test Project ${tag}`,
  description: "A published project fixture for ad engagement ownership tests.",
  isPublished: true,
  reviewStatus: "approved",
});
await db.insert(subscriptions).values({
  contractorId: secondProfile.id,
  planId: plan.id,
  trialEndsAt: new Date(Date.now() + 30 * 86400000),
});
const app = express();
app.use(express.json());
app.use("/api", createMarketplaceRouter({
  requireUser: async (req: Request, res: Response, next: NextFunction) => {
    const role = req.header("x-moqawil-test-role");
    if (role !== "customer" && role !== "contractor" && role !== "admin") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = role === "contractor" && req.header("x-moqawil-test-contractor") === "second" ? secondContractorUser : fixtureByRole.get(role);
    if (!user) {
      res.status(503).json({ error: `Missing ${role} permission test fixture` });
      return;
    }
    (req as AuthenticatedRequest).marketplaceUser = user;
    next();
  },
  requireAdmin,
  requireContractor,
  promoteCustomerToContractor: async () => {},
  resolveOptionalUser: async (req) => {
    const role = req.header("x-moqawil-test-role");
    return role === "contractor" && req.header("x-moqawil-test-contractor") === "second"
      ? secondContractorUser
      : fixtureByRole.get(role as User["role"]);
  },
  sendAdminContactEmail: async () => {},
}));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT);
const server = app.listen(port);
const cleanup = async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.delete(marketplaceListings).where(eq(marketplaceListings.id, fixtureListing.id));
  await db.delete(users).where(inArray(users.id, fixtureUsers.map((user) => user.id)));
  process.exit(0);
};
process.once("SIGTERM", () => { void cleanup(); });
process.once("SIGINT", () => { void cleanup(); });
