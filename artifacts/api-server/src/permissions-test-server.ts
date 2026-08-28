import express, { type NextFunction, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { contractorProfiles, db, subscriptionPlans, subscriptions, users, type User } from "@workspace/db";
import { requireAdmin, requireContractor, type AuthenticatedRequest } from "./middlewares/auth";
import { createMarketplaceRouter } from "./routes/marketplace";
import { ensureMarketplaceDefaults } from "./lib/marketplace";

await ensureMarketplaceDefaults();
const tag = crypto.randomUUID();
const fixtureUsers = await db.insert(users).values([
  { clerkUserId: `permission-test-customer-${tag}`, email: `permission-customer-${tag}@example.invalid`, role: "customer" },
  { clerkUserId: `permission-test-contractor-${tag}`, email: `permission-contractor-${tag}@example.invalid`, role: "contractor" },
  { clerkUserId: `permission-test-admin-${tag}`, email: `permission-admin-${tag}@example.invalid`, role: "admin" },
]).returning();
const fixtureByRole = new Map(fixtureUsers.map((user) => [user.role, user] as const));
const contractorUser = fixtureByRole.get("contractor") as User;
const [profile] = await db.insert(contractorProfiles).values({
  userId: contractorUser.id,
  businessName: `Permission Test Contractor ${tag}`,
  city: "Muscat",
}).returning();
const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.isActive, true) });
if (!plan) throw new Error("Permission test requires an active subscription plan");
await db.insert(subscriptions).values({
  contractorId: profile.id,
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
    const user = fixtureByRole.get(role);
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
}));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT);
const server = app.listen(port);
const cleanup = async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.delete(users).where(inArray(users.id, fixtureUsers.map((user) => user.id)));
  process.exit(0);
};
process.once("SIGTERM", () => { void cleanup(); });
process.once("SIGINT", () => { void cleanup(); });