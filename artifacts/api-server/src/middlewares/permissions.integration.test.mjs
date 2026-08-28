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
});

test("customer cannot access contractor lifecycle data", async () => {
  for (const [method, path] of [["GET", "/me/contractor-profile"], ["GET", "/me/subscription"], ["GET", "/me/payments"], ["DELETE", "/me/subscription"]]) {
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
  const body = JSON.stringify({ businessName: "Permission Test Onboarding", city: "Muscat" });
  const first = await request("customer", "/me/contractor-profile", { method: "PUT", body });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.contractor.businessName, "Permission Test Onboarding");
  assert.equal(first.body.subscription.status, "free_trial");

  const repeated = await request("customer", "/me/contractor-profile", { method: "PUT", body });
  assert.equal(repeated.response.status, 403);
  assert.deepEqual(repeated.body, { error: "Contractor role required" });
});