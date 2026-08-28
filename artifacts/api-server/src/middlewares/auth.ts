import type { NextFunction, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@workspace/db";

export type AuthenticatedRequest = Request & { marketplaceUser: User };

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const clerkUser = await clerkClient.users.getUser(userId);
  const metadata = clerkUser.publicMetadata as { role?: unknown; isAdmin?: unknown };
  const metadataRole = metadata.isAdmin === true ? "admin" : metadata.role === "admin" || metadata.role === "contractor" ? metadata.role : undefined;
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username || null;
  let user = await db.query.users.findFirst({ where: eq(users.clerkUserId, userId) });
  if (!user) {
    [user] = await db.insert(users).values({
      clerkUserId: userId,
      email: email ?? `${userId}@clerk.local`,
      displayName,
      role: metadataRole ?? "customer",
    }).returning();
  } else {
    const role = metadataRole ?? user.role; // metadata is authoritative when present; retain a manually assigned DB admin otherwise.
    [user] = await db.update(users).set({ email: email ?? user.email, displayName: displayName ?? user.displayName, role, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
  }
  (req as AuthenticatedRequest).marketplaceUser = user;
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).marketplaceUser;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Administrator role required" });
    return;
  }
  return next();
}