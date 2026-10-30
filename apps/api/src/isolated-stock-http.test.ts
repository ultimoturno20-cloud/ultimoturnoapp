import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, addInventoryStock, createReseller, type IsolatedStockUserInput } from "@ultimoturno/db";

test("isolated stock HTTP: independent account, private reads and tenant-safe intake", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-isolated-http-"));
  for (const key of ["DATABASE_URL", "ULTIMOTURNO_DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRICECHARTING_TOKEN", "OPENAI_API_KEY"]) process.env[key] = "";
  Object.assign(process.env, { ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir, ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false", TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false", ULTIMOTURNO_ACCESS_KEY: "isolated-http-test-only", ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1500" });
  const password = "isolated-http-password-only";
  const card = { name: "Shared card isolated QA", expansion: "Private QA", number: "25", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 3, priceArs: 1000 };
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  let centralId = "", productId = "", variantId = "", adminId = "", businessId = "", resellerId = "";
  try {
    const admin = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    businessId = admin.businessId;
    const user = await createManagedUser(db, { displayName: "Primary admin QA", email: "primary@isolated.test", password, role: "admin" }, admin);
    adminId = user.id;
    await createManagedUser(db, { displayName: "Other stock owner QA", email: "other@isolated.test", password, role: "stock_owner" }, admin);
    const central = await addInventoryStock(db, card, admin);
    centralId = central.id; productId = central.product.id; variantId = central.variant.id;
    resellerId = (await createReseller(db, { displayName: "Private reseller QA", email: "reseller@isolated.test", password, commissionPercent: 20 }, admin)).reseller.userId;
  } finally { await db.close(); }
  const { handleRequest } = await import("./server.js");
  const server = createServer((request, response) => { void handleRequest(request, response); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const login = async (email: string, suppliedPassword = password) => {
    const response = await fetch(origin + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: suppliedPassword }) });
    assert.equal(response.status, 200);
    return { Authorization: `Bearer ${(await response.json() as { token: string }).token}`, "Content-Type": "application/json" };
  };
  const adminHeaders = await login("primary@isolated.test");
  const data: IsolatedStockUserInput = { requestId: crypto.randomUUID(), businessName: "Independent space QA", displayName: "Independent owner QA", email: "independent@isolated.test", password };
  const create = (body: unknown, headers = adminHeaders, dispatch = false) => fetch(origin + (dispatch ? "/dispatch?path=%2Fusers%2Fisolated-stock" : "/users/isolated-stock"), { method: "POST", headers, body: JSON.stringify(body) });
  await t.test("only primary administrators can provision and retries return the same account", async () => {
    assert.equal((await create(data, { "Content-Type": "application/json" } as typeof adminHeaders)).status, 401);
    assert.equal((await create(data, await login("other@isolated.test"))).status, 403);
    assert.equal((await create(data, await login("reseller@isolated.test"))).status, 403);
    assert.equal((await create(null)).status, 400);
    const first = await create({ ...data, role: "admin", businessId });
    assert.equal(first.status, 201);
    const body = await first.json() as { created: boolean; business: { id: string }; user: { id: string; roles: string[] } };
    assert.equal(body.business.id, data.requestId);
    assert.notEqual(body.business.id, businessId);
    assert.deepEqual(body.user.roles, ["stock_owner"]);
    assert.equal(JSON.stringify(body).includes(password), false);
    const again = await create({ ...data, password: "changed-http-test-password" }, adminHeaders, true);
    assert.equal(again.status, 200);
    assert.equal((await again.json() as typeof body).user.id, body.user.id);
    assert.equal((await create({ ...data, displayName: "Conflicting name" })).status, 409);
  });
  const owner = await login(data.email);
  const get = async (route: string, headers = owner) => {
    const response = await fetch(origin + route, { headers });
    assert.equal(response.status, 200, route);
    return response.json();
  };
  const primaryBefore = await get("/stock", adminHeaders);
  await t.test("new owner cannot read primary stock, private users, claims, orders or cash", async () => {
    assert.equal((await get("/auth/me")).user.businessId, data.requestId);
    assert.equal((await get("/stock")).items.length, 0);
    assert.equal((await get("/inventory/view")).items.length, 0);
    assert.equal((await get("/resellers")).resellers.length, 0);
    assert.equal((await get("/inventory/intake-search?query=Shared%20card")).entries.length, 0);
    const ids = await fetch(origin + "/inventory/items?ids=" + centralId, { headers: owner });
    assert.equal(ids.status, 404);
    for (const route of ["/users", "/sales", "/claims", "/purchases", "/audit", "/movements", "/order-boards", "/store-settings", `/resellers/${resellerId}`]) assert.equal((await fetch(origin + route, { headers: owner })).status, 403, route);
  });
  await t.test("same identity and malicious ownership hints cannot cross the business boundary", async () => {
    const response = await fetch(origin + "/inventory/intake", { method: "POST", headers: owner, body: JSON.stringify({ ...card, id: centralId, inventoryItemId: centralId, productId, variantId, ownerUserId: adminId, businessId, priceArs: 8000, quantityOnHand: 2 }) });
    assert.equal(response.status, 200);
    const own = (await response.json() as { item: { id: string; businessId: string; ownerUserId: string; quantityOnHand: number; priceArs: number } }).item;
    assert.notEqual(own.id, centralId);
    assert.equal(own.businessId, data.requestId);
    assert.equal(own.quantityOnHand, 2);
    assert.equal(own.priceArs, 8000);
    assert.equal((await get("/stock")).items[0].id, own.id);
    const view = await get("/inventory/view");
    assert.equal(view.items.length, 1);
    assert.equal(view.items[0].id, own.id);
    const search = await get("/inventory/intake-search?query=Shared%20card");
    assert.equal(search.entries.length, 1);
    assert.equal(search.entries[0].productName, card.name);
    assert.deepEqual(await get("/stock", adminHeaders), primaryBefore);
    assert.equal((await fetch(origin + "/inventory/items?ids=" + own.id, { headers: adminHeaders })).status, 404);
    assert.equal((await create({ ...data, requestId: crypto.randomUUID() }, owner)).status, 403);
    assert.equal((await create({ ...data, requestId: crypto.randomUUID() }, { ...owner, "x-ultimoturno-access-key": "isolated-http-test-only" } as typeof owner, true)).status, 403);
    for (const route of ["/users", "/sales", `/inventory/${centralId}/price`, "/store-settings"]) assert.equal((await fetch(origin + route, { method: "POST", headers: owner, body: "{}" })).status, 403, route);
    const logout = await fetch(origin + "/auth/logout", { method: "POST", headers: owner });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(origin + "/stock", { headers: owner })).status, 401);
  });
});
