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

test("request, quote, and notification routes reject malformed UUIDs before querying", async () => {
  const quoteBody = JSON.stringify({ amountOmaniRial: 50, estimatedDays: 2, details: "Valid quote body." });
  for (const [role, method, path, body] of [
    ["customer", "GET", "/me/service-requests/not-a-uuid/quotes"],
    ["customer", "POST", "/me/service-requests/not-a-uuid/cancel"],
    ["contractor", "POST", "/me/workshop-requests/not-a-uuid/quote", quoteBody],
    ["customer", "POST", "/me/quotes/not-a-uuid/accept"],
  ]) {
    const result = await request(role, path, { method, ...(body ? { body } : {}) });
    assert.equal(result.response.status, 400);
  }
  for (const role of ["customer", "contractor", "admin"]) {
    const result = await request(role, "/me/notifications/not-a-uuid/read", { method: "POST" });
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, { error: "Invalid notification identifier" });
  }
});

test("notification reads are owner-only, return 404 when absent, and remain idempotent", async () => {
  const byRole = {};
  for (const role of ["customer", "contractor", "admin"]) {
    const inbox = await request(role, "/me/notifications");
    const owned = inbox.body.find((item) => item.title.startsWith(`Permission Test ${role[0].toUpperCase()}${role.slice(1)} Notification`));
    assert.ok(owned);
    byRole[role] = owned.id;
  }

  const nonOwner = await request("customer", `/me/notifications/${byRole.contractor}/read`, { method: "POST" });
  assert.equal(nonOwner.response.status, 404);
  assert.deepEqual(nonOwner.body, { error: "Notification not found" });
  for (const role of ["customer", "contractor", "admin"]) {
    const missing = await request(role, `/me/notifications/${crypto.randomUUID()}/read`, { method: "POST" });
    assert.equal(missing.response.status, 404);
    const first = await request(role, `/me/notifications/${byRole[role]}/read`, { method: "POST" });
    const repeated = await request(role, `/me/notifications/${byRole[role]}/read`, { method: "POST" });
    assert.equal(first.response.status, 204);
    assert.equal(repeated.response.status, 204);
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

test("new property and provider activations notify their exact owners but views and repeats do not", async () => {
  const listings = await request(undefined, "/listings");
  const listing = listings.body.find((item) => /^Permission Test Listing /.test(item.title));
  const directory = await request(undefined, "/contractors?limit=50");
  const provider = directory.body.items.find((item) => /^Permission Test Contractor /.test(item.businessName));
  assert.ok(listing);
  assert.ok(provider);

  const before = await request("contractor", "/me/notifications");
  const clientId = `permission-engagement-${Date.now()}`;
  const likeBody = JSON.stringify({ action: "like", active: true, clientId, subjectKind: "property" });
  assert.equal((await request("customer", `/listings/${listing.id}/engagement`, { method: "POST", body: likeBody })).response.status, 200);
  assert.equal((await request("customer", `/listings/${listing.id}/engagement`, { method: "POST", body: likeBody })).response.status, 200);
  assert.equal((await request(undefined, `/listings/${listing.id}/engagement`, {
    method: "POST",
    body: JSON.stringify({ action: "view", clientId: `${clientId}-view`, subjectKind: "property" }),
  })).response.status, 200);
  assert.equal((await request("customer", `/listings/${provider.id}/engagement`, {
    method: "POST",
    body: JSON.stringify({ action: "save", active: true, clientId, subjectKind: "provider" }),
  })).response.status, 200);

  const after = await request("contractor", "/me/notifications");
  const added = after.body.slice(0, after.body.length - before.body.length)
    .filter((item) => item.deliveryMetadata?.eventType === "ad_engagement");
  assert.equal(added.filter((item) => item.deliveryMetadata.action === "like" && item.deliveryMetadata.subjectId === listing.id).length, 1);
  assert.equal(added.filter((item) => item.deliveryMetadata.action === "save" && item.deliveryMetadata.subjectId === provider.id).length, 1);
  assert.equal(added.some((item) => item.deliveryMetadata.action === "view"), false);
});

test("engagement GETs use the same signed-in actor as POST and isolate account state", async () => {
  const listings = await request(undefined, "/listings");
  const listing = listings.body.find((item) => /^Permission Test Listing /.test(item.title));
  assert.ok(listing);
  const clientId = `account-state-${Date.now()}`;
  const activate = await request("customer", `/listings/${listing.id}/engagement`, {
    method: "POST",
    body: JSON.stringify({ action: "like", active: true, clientId, subjectKind: "property" }),
  });
  assert.equal(activate.response.status, 200);
  assert.equal(activate.body.liked, true);

  const single = await request("customer", `/listings/${listing.id}/engagement?clientId=${clientId}`);
  assert.equal(single.response.status, 200);
  assert.equal(single.body.liked, true);
  const bulk = await request("customer", `/listings/engagement?ids=${listing.id}&clientId=${clientId}`);
  assert.equal(bulk.response.status, 200);
  assert.equal(bulk.body[listing.id].liked, true);

  const signedOut = await request(undefined, `/listings/${listing.id}/engagement?clientId=${clientId}`);
  assert.equal(signedOut.body.liked, false);
  const otherAccount = await request("contractor", `/listings/${listing.id}/engagement?clientId=${clientId}`, {
    headers: { "x-moqawil-test-contractor": "second" },
  });
  assert.equal(otherAccount.body.liked, false);

  const deactivate = await request("customer", `/listings/${listing.id}/engagement`, {
    method: "POST",
    body: JSON.stringify({ action: "like", active: false, clientId, subjectKind: "property" }),
  });
  assert.equal(deactivate.body.liked, false);
  const refetched = await request("customer", `/listings/${listing.id}/engagement?clientId=${clientId}`);
  assert.equal(refetched.body.liked, false);
});

test("call and WhatsApp events derive the live subject and retry idempotently without emailing", async () => {
  const listings = await request(undefined, "/listings");
  const listing = listings.body.find((item) => /^Permission Test Listing /.test(item.title));
  const directory = await request(undefined, "/contractors?limit=50");
  const provider = directory.body.items.find((item) => /^Permission Test Contractor /.test(item.businessName));
  assert.ok(provider);
  const providerDetail = await request(undefined, `/contractors/${provider.id}`);
  const project = providerDetail.body.projects.find((item) => /^Permission Test Project /.test(item.title));
  assert.ok(listing);
  assert.ok(project);
  const before = await request("contractor", "/me/notifications");
  const eventId = `permission-contact-${Date.now()}`;
  const body = JSON.stringify({
    eventId,
    subjectId: listing.id,
    subjectKind: "property",
    category: "property",
    channel: "whatsapp",
    subjectName: "untrusted client title",
  });
  assert.equal((await request("customer", "/contact-events", { method: "POST", body })).response.status, 204);
  assert.equal((await request("customer", "/contact-events", { method: "POST", body })).response.status, 204);
  assert.equal((await request("customer", "/contact-events", {
    method: "POST",
    body: JSON.stringify({
      eventId: `${eventId}-call`,
      subjectId: project.id,
      subjectKind: "project",
      category: "contractor",
      channel: "call",
      subjectName: "another untrusted client title",
    }),
  })).response.status, 204);

  const after = await request("contractor", "/me/notifications");
  const added = after.body.slice(0, after.body.length - before.body.length)
    .filter((item) => item.deliveryMetadata?.eventType === "ad_engagement");
  assert.equal(added.length, 2);
  assert.deepEqual(added.find((item) => item.deliveryMetadata.action === "whatsapp").deliveryMetadata, {
    eventType: "ad_engagement",
    action: "whatsapp",
    subjectId: listing.id,
    subjectKind: "property",
    subjectName: listing.title,
  });
  assert.deepEqual(added.find((item) => item.deliveryMetadata.action === "call").deliveryMetadata, {
    eventType: "ad_engagement",
    action: "call",
    subjectId: project.id,
    subjectKind: "project",
    subjectName: project.title,
  });
});

test("signed-in owners do not notify themselves for their own ad engagement", async () => {
  const listings = await request(undefined, "/listings");
  const listing = listings.body.find((item) => /^Permission Test Listing /.test(item.title));
  const before = await request("contractor", "/me/notifications");
  const result = await request("contractor", `/listings/${listing.id}/engagement`, {
    method: "POST",
    body: JSON.stringify({ action: "like", active: true, clientId: `owner-client-${Date.now()}`, subjectKind: "property" }),
  });
  assert.equal(result.response.status, 200);
  const after = await request("contractor", "/me/notifications");
  assert.equal(after.body.length, before.body.length);
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
  assert.equal(inbox.body.length, 3);
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

  const cancelAwarded = await request("customer", `/me/service-requests/${assignedRequest.id}/cancel`, { method: "POST" });
  assert.equal(cancelAwarded.response.status, 409);
  assert.deepEqual(cancelAwarded.body, { error: "Awarded requests cannot be cancelled" });
});

test("customer cancellation is owner-only and makes workshop quotes unavailable", async () => {
  const inboxBefore = await request("contractor", "/me/workshop-requests");
  const cancellableRequest = inboxBefore.body.find((item) => /^Cancellable workshop request /.test(item.serviceName));
  assert.ok(cancellableRequest);

  const quoteBody = JSON.stringify({ amountOmaniRial: 75, estimatedDays: 2, details: "Inspection and repair included." });
  const submitted = await request("contractor", `/me/workshop-requests/${cancellableRequest.id}/quote`, { method: "POST", body: quoteBody });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.status, "submitted");

  const nonOwner = await request("contractor", `/me/service-requests/${cancellableRequest.id}/cancel`, { method: "POST" });
  assert.equal(nonOwner.response.status, 404);
  assert.deepEqual(nonOwner.body, { error: "Service request not found" });

  const cancelled = await request("customer", `/me/service-requests/${cancellableRequest.id}/cancel`, { method: "POST" });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.status, "cancelled");

  const customerQuotes = await request("customer", `/me/service-requests/${cancellableRequest.id}/quotes`);
  assert.equal(customerQuotes.response.status, 200);
  assert.equal(customerQuotes.body.length, 1);
  assert.equal(customerQuotes.body[0].status, "rejected");

  const inboxAfter = await request("contractor", "/me/workshop-requests");
  assert.equal(inboxAfter.response.status, 200);
  assert.equal(inboxAfter.body.some((item) => item.id === cancellableRequest.id), false);

  const quoteAfterCancellation = await request("contractor", `/me/workshop-requests/${cancellableRequest.id}/quote`, { method: "POST", body: quoteBody });
  assert.equal(quoteAfterCancellation.response.status, 404);

  const repeatedCancellation = await request("customer", `/me/service-requests/${cancellableRequest.id}/cancel`, { method: "POST" });
  assert.equal(repeatedCancellation.response.status, 409);
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

test("admin contractor workshop discriminator comes only from building services and survives edits", async () => {
  const initial = await request("admin", "/admin/contractors");
  const workshop = initial.body.find((item) => /^Permission Test Contractor /.test(item.businessName));
  assert.ok(workshop);
  assert.equal(workshop.isWorkshop, true);

  const edited = await request("admin", `/admin/contractors/${workshop.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      businessName: workshop.businessName,
      bio: "Updated workshop specialty",
      bioArabic: "تخصص ورشة محدث",
      isWorkshop: true,
    }),
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.body.isWorkshop, true);
  assert.equal(edited.body.serviceNames.includes("Updated workshop specialty"), true);
  const publicDetail = await request(undefined, `/contractors/${workshop.id}`);
  const updatedService = publicDetail.body.services.find((item) => item.category === "building");
  assert.equal(updatedService.name, "Updated workshop specialty");
  assert.equal(updatedService.description, "تخصص ورشة محدث");

  const removed = await request("admin", `/admin/contractors/${workshop.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isWorkshop: false }),
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.isWorkshop, false);

  const restored = await request("admin", `/admin/contractors/${workshop.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isWorkshop: true }),
  });
  assert.equal(restored.response.status, 200);
  assert.equal(restored.body.isWorkshop, true);
});

test("customer can create only its first contractor profile", async () => {
  const plans = await request(undefined, "/subscription-plans");
  const servicePlan = plans.body.find((item) => item.category === "service");
  assert.ok(servicePlan);
  const body = JSON.stringify({ businessName: "Permission Test Onboarding", city: "Muscat", wilayat: "Muscat", subscriptionPlanCode: servicePlan.code });
  const first = await request("customer", "/me/contractor-profile", { method: "PUT", body });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.contractor.businessName, "Permission Test Onboarding");
  assert.equal(first.body.subscription.status, "free_trial");

  const repeated = await request("customer", "/me/contractor-profile", { method: "PUT", body });
  assert.equal(repeated.response.status, 403);
  assert.deepEqual(repeated.body, { error: "Contractor role required" });
});

test("approved services appear in every selected wilayat and nowhere else", async () => {
  const plans = await request(undefined, "/subscription-plans");
  const servicePlan = plans.body.find((item) => item.category === "service");
  assert.ok(servicePlan);
  const submitted = await request("customer", "/me/service-registrations", {
    method: "POST",
    body: JSON.stringify({
      category: "building",
      title: "Permission Test Multi-Wilayat Workshop",
      specialty: "Multi-Wilayat Construction",
      city: "Ad Dakhiliyah",
      phone: "+96891234567",
      serviceWilayats: ["Bahla", "Nizwa", "Muscat"],
      servesAllGovernorates: false,
      deliveryAvailable: true,
      description: "Provides construction services across three selected Oman wilayats.",
      mediaUrls: ["https://example.invalid/permission-test-workshop.jpg"],
      subscriptionPlanCode: servicePlan.code,
      commercialRegistrationPdf: "data:application/pdf;base64,dGVzdA==",
      termsAccepted: true,
    }),
  });
  assert.equal(submitted.response.status, 201);

  const approved = await request("admin", `/admin/reviews/registration/${submitted.body.id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "approve" }),
  });
  assert.equal(approved.response.status, 200);
  assert.deepEqual(approved.body.serviceWilayats, ["Bahla", "Nizwa", "Muscat"]);

  for (const wilayat of ["Bahla", "Nizwa", "Muscat"]) {
    const directory = await request(undefined, `/contractors?category=building&wilayat=${encodeURIComponent(wilayat)}&limit=50`);
    assert.equal(directory.response.status, 200);
    assert.equal(directory.body.items.some((item) => item.businessName === "Permission Test Onboarding"), true);
  }

  const outsideCoverage = await request(undefined, "/contractors?category=building&wilayat=Salalah&limit=50");
  assert.equal(outsideCoverage.response.status, 200);
  assert.equal(outsideCoverage.body.items.some((item) => item.businessName === "Permission Test Onboarding"), false);
});