import assert from "node:assert/strict";
import test from "node:test";
import { canStartContractorOnboarding, hasAdminAccess, hasContractorAccess, resolveMarketplaceRole } from "./authPolicy.ts";

test("Clerk customer metadata revokes a persisted elevated role", () => {
  assert.equal(resolveMarketplaceRole({ role: "customer" }, "admin"), "customer");
  assert.equal(resolveMarketplaceRole({ role: "customer" }, "contractor"), "customer");
  assert.equal(resolveMarketplaceRole({ isAdmin: false }, "admin"), "customer");
});

test("recognized Clerk roles are authoritative", () => {
  assert.equal(resolveMarketplaceRole({ role: "contractor" }, "customer"), "contractor");
  assert.equal(resolveMarketplaceRole({ role: "admin" }, "customer"), "admin");
  assert.equal(resolveMarketplaceRole({ isAdmin: true, role: "customer" }, "customer"), "admin");
});

test("missing metadata preserves an existing manually assigned role", () => {
  assert.equal(resolveMarketplaceRole({}, "admin"), "admin");
  assert.equal(resolveMarketplaceRole({}, "contractor"), "contractor");
  assert.equal(resolveMarketplaceRole({}, "customer"), "customer");
});

test("only the admin role passes the admin policy", () => {
  assert.equal(hasAdminAccess("customer"), false);
  assert.equal(hasAdminAccess("contractor"), false);
  assert.equal(hasAdminAccess(undefined), false);
  assert.equal(hasAdminAccess("admin"), true);
});

test("only the contractor role passes the contractor policy", () => {
  assert.equal(hasContractorAccess("customer"), false);
  assert.equal(hasContractorAccess("admin"), false);
  assert.equal(hasContractorAccess(undefined), false);
  assert.equal(hasContractorAccess("contractor"), true);
});

test("customer onboarding is allowed only before a profile exists", () => {
  assert.equal(canStartContractorOnboarding("customer", false), true);
  assert.equal(canStartContractorOnboarding("customer", true), false);
  assert.equal(canStartContractorOnboarding("contractor", true), true);
  assert.equal(canStartContractorOnboarding("admin", false), false);
});