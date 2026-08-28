export type MarketplaceRole = "customer" | "contractor" | "admin";

export function resolveMarketplaceRole(metadata: { role?: unknown; isAdmin?: unknown }, currentRole: MarketplaceRole = "customer"): MarketplaceRole {
  if (metadata.isAdmin === true) return "admin";
  if (metadata.role === "admin" || metadata.role === "contractor" || metadata.role === "customer") return metadata.role;
  if (metadata.isAdmin === false) return "customer";
  return currentRole;
}

export function hasAdminAccess(role: MarketplaceRole | undefined) {
  return role === "admin";
}

export function hasContractorAccess(role: MarketplaceRole | undefined) {
  return role === "contractor";
}

export function canStartContractorOnboarding(role: MarketplaceRole | undefined, hasExistingProfile: boolean) {
  return role === "contractor" || (role === "customer" && !hasExistingProfile);
}