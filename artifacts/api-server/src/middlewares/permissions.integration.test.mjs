import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";

const port = 18991;
const baseUrl = `http://127.0.0.1:${port}/api`;
let server;

before(async () => {
  server = spawn(process.execPath, ["--enable-source-maps", "./dist/permissions-test-server.mjs"], {
    cwd: new URL("../..", import.meta.url),
    env: { ...process.env, NODE_ENV: "test", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Permission test API did not start");
});

after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
});

async function request(role, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(role ? { "x-moqawil-test-role": role } : {}),
      "content-type": "application/json",
    },
  });
  return { response, body: await response.json().catch(() => null) };
}

test("signed-out requests never reach protected handlers", async () => {
  for (const path of ["/me/subscription", "/admin/overview"]) {
    const result = await request(undefined, path);
    assert.equal(result.response.status, 401);
    assert.deepEqual(result.body, { error: "Authentication required" });
  }
  for (const path of ["/contractors/not-a-real-id/rating", "/listings/not-a-real-id/rating"]) {
    const result = await request(undefined, path, { method: "POST", body: JSON.stringify({ rating: 5 }) });
    assert.equal(result.response.status, 401);
    assert.deepEqual(result.body, { error: "Authentication required" });
  }
});

test("customers can rate providers and properties from one to five stars", async () => {
  const directory = await request("customer", "/contractors?limit=50");
  const contractor = directory.body.items.find((item) => /^Permission Test Contractor /.test(item.businessName));
  assert.ok(contractor);
  const providerRating = await request("customer", `/contractors/${contractor.id}/rating`, { method: "POST", body: JSON.stringify({ rating: 5 }) });
  assert.equal(providerRating.response.status, 200);
  assert.equal(providerRating.body.rating, 5);

  const listings = await request("customer", "/listings");
  const listing = listings.body.find((item) => /^Permission Test Listing /.test(item.title));
  assert.ok(listing);
  const propertyRating = await request("customer", `/listings/${listing.id}/rating`, { method: "POST", body: JSON.stringify({ rating: 4 }) });
  assert.equal(propertyRating.response.status, 200);
  assert.equal(propertyRating.body.rating, 4);

  const invalid = await request("customer", `/listings/${listing.id}/rating`, { method: "POST", body: JSON.stringify({ rating: 6 }) });
  assert.equal(invalid.response.status, 400);
});

test("customer cannot access contractor lifecycle data", async () => {
  for (const [method, path] of [["GET", "/me/contractor-profile"], ["GET", "/me/subscription"], ["GET", "/me/payments"], ["DELETE", "/me/subscription"], ["GET", "/me/workshop-requests"]]) {
    const result = await request("customer", path, { method });
    assert.equal(result.response.status, 403);
    assert.deepEqual(result.body, { error: "Contractor role required" });
  }
});

test("admin cannot access contractor lifecycle data", async () => {
  const result = await request("admin", "/me/payments");
  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: "Contractor role required" });
});

test("contractor can read only its own lifecycle endpoints", async () => {
  for (const path of ["/me/contractor-profile", "/me/subscription", "/me/payments"]) {
    const result = await request("contractor", path);
    assert.equal(result.response.status, 200);
  }
});

test("workshop receives only assigned requests and can quote once", async () => {
  const inbox = await request("contractor", "/me/workshop-requests");
  assert.equal(inbox.response.status, 200);
  assert.equal(inbox.body.length, 2);
  const assignedRequest = inbox.body.find((item) => /^Assigned workshop request /.test(item.serviceName));
  assert.equal(assignedRequest.recipientStatus, "viewed");

  const quoteBody = JSON.stringify({ amountOmaniRial: 110, estimatedDays: 4, details: "Materials and installation included." });
  const quote = await request("contractor", `/me/workshop-requests/${assignedRequest.id}/quote`, { method: "POST", body: quoteBody });
  assert.equal(quote.response.status, 201);
  assert.equal(quote.body.amountOmaniRial, 110);

  const duplicate = await request("contractor", `/me/workshop-requests/${assignedRequest.id}/quote`, { method: "POST", body: quoteBody });
  assert.equal(duplicate.response.status, 404);

  const customerRequests = await request("customer", "/me/service-requests");
  assert.equal(customerRequests.response.status, 200);
  const assigned = customerRequests.body.find((item) => item.id === assignedRequest.id);
  assert.equal(assigned.quoteCount, 1);
  assert.equal(assigned.status, "quoted");

  const quotes = await request("customer", `/me/service-requests/${assignedRequest.id}/quotes`);
  assert.equal(quotes.response.status, 200);
  assert.equal(quotes.body.length, 1);

  const accepted = await request("customer", `/me/quotes/${quotes.body[0].id}/accept`, { method: "POST" });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.status, "accepted");

  const repeatedAcceptance = await request("customer", `/me/quotes/${quotes.body[0].id}/accept`, { method: "POST" });
  assert.equal(repeatedAcceptance.response.status, 404);
});

test("simultaneous accept attempts award exactly one workshop", async () => {
  const firstInbox = await request("contractor", "/me/workshop-requests");
  const secondInbox = await request("contractor", "/me/workshop-requests", { headers: { "x-moqawil-test-contractor": "second" } });
  const firstRequest = firstInbox.body.find((item) => /^Concurrent acceptance request /.test(item.serviceName));
  const secondRequest = secondInbox.body.find((item) => item.id === firstRequest.id);
  assert.ok(firstRequest);
  assert.ok(secondRequest);

  const firstQuote = await request("contractor", `/me/workshop-requests/${firstRequest.id}/quote`, { method: "POST", body: JSON.stringify({ amountOmaniRial: 90, estimatedDays: 3, details: "First concurrent quote." }) });
  const secondQuote = await request("contractor", `/me/workshop-requests/${firstRequest.id}/quote`, { method: "POST", headers: { "x-moqawil-test-contractor": "second" }, body: JSON.stringify({ amountOmaniRial: 95, estimatedDays: 2, details: "Second concurrent quote." }) });
  assert.equal(firstQuote.response.status, 201);
  assert.equal(secondQuote.response.status, 201);

  const firstBefore = await request("contractor", "/me/notifications");
  const secondBefore = await request("contractor", "/me/notifications", { headers: { "x-moqawil-test-contractor": "second" } });
  const acceptedBefore = [...firstBefore.body, ...secondBefore.body].filter((item) => item.title === "Quote accepted").length;

  const results = await Promise.all([
    request("customer", `/me/quotes/${firstQuote.body.id}/accept`, { method: "POST" }),
    request("customer", `/me/quotes/${secondQuote.body.id}/accept`, { method: "POST" }),
  ]);
  assert.deepEqual(results.map((result) => result.response.status).sort(), [200, 409]);

  const finalQuotes = await request("customer", `/me/service-requests/${firstRequest.id}/quotes`);
  assert.equal(finalQuotes.body.filter((item) => item.status === "accepted").length, 1);
  assert.equal(finalQuotes.body.filter((item) => item.status === "rejected").length, 1);

  const firstAfter = await request("contractor", "/me/notifications");
  const secondAfter = await request("contractor", "/me/notifications", { headers: { "x-moqawil-test-contractor": "second" } });
  const acceptedAfter = [...firstAfter.body, ...secondAfter.body].filter((item) => item.title === "Quote accepted").length;
  assert.equal(acceptedAfter - acceptedBefore, 1);
});

test("customer cannot access admin data", async () => {
  const result = await request("customer", "/admin/overview");
  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: "Administrator role required" });
});

test("admin can access admin data", async () => {
  const result = await request("admin", "/admin/overview");
  assert.equal(result.response.status, 200);
  assert.equal(typeof result.body.contractors, "number");
});

test("customer can create only its first contractor profile", async () => {
  const body = JSON.stringify({ businessName: "Permission Test Onboarding", city: "Muscat", wilayat: "Muscat" });
  const first = await request("customer", "/me/contractor-profile", { method: "PUT", body });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.contractor.businessName, "Permission Test Onboarding");
  assert.equal(first.body.subscription.status, "free_trial");

  const repeated = await request("customer", "/me/contractor-profile", { method: "PUT", body });
  assert.equal(repeated.response.status, 403);
  assert.deepEqual(repeated.body, { error: "Contractor role required" });
});