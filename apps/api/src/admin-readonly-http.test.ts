import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, addInventoryStock, createClaimSession, setStorefrontPublication, saveStoreSettings, createStoreOrder } from "@ultimoturno/db";

test("observer HTTP reads never mutate business data, and writes fail before handlers", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-observer-api-"));
  for (const key of Object.keys(process.env)) if (/^(DATABASE_URL|ULTIMOTURNO_.*|POSTGRES_.*|SUPABASE_.*|PRICECHARTING_.*|OPENAI_API_KEY|TCG.*|COOLSTUFF_.*)$/.test(key)) delete process.env[key];
  Object.assign(process.env, {
    ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir,
    ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false",
    TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false", ULTIMOTURNO_ACCESS_KEY: "observer-qa-only",
    ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1540"
  });
  const seed = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  let itemId: string, viewerId: string, businessId: string;
  try {
    const actor = { ...await getDefaultOperationalUser(seed), roles: ["admin"] };
    businessId = actor.businessId;
    await createManagedUser(seed, { displayName: "Admin QA", email: "admin@observer.test", password: "observer-local-test-only", role: "admin" }, actor);
    const viewer = await createManagedUser(seed, { displayName: "Observador QA", email: "viewer@observer.test", password: "observer-local-test-only", role: "admin_readonly" }, actor);
    viewerId = viewer.id;
    assert.deepEqual(viewer.roles, ["admin_readonly"]);
    await assert.rejects(createManagedUser(seed, { displayName: "No crear", email: "no@observer.test", password: "observer-local-test-only", role: "admin" }, { ...actor, roles: ["admin_readonly"] }), { statusCode: 403 });
    const otherBusiness = crypto.randomUUID();
    await seed.query("insert into businesses(id,name,slug) values($1,'Otro negocio QA',$2)", [otherBusiness, "qa-" + otherBusiness]);
    await createManagedUser(seed, { displayName: "Otro observador", email: "other@observer.test", password: "observer-local-test-only", role: "admin_readonly" }, { ...actor, businessId: otherBusiness });
    const item = await addInventoryStock(seed, { name: "Carta privada QA", expansion: "Set QA", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 5, priceArs: 2500 }, actor);
    itemId = item.id;
    await setStorefrontPublication(seed, { inventoryItemIds: [itemId], published: true }, actor);
    await saveStoreSettings(seed, { enabled: true, reservationMinutes: 30, pickup: true, shipping: false, paymentInstructions: "Pago ficticio QA", contactInstructions: "Contacto ficticio QA" }, actor);
    const key = crypto.randomUUID();
    await createStoreOrder(seed, { idempotencyKey: key, customerName: "Comprador ficticio QA", email: "buyer@observer.test", phone: "1112345678", fulfillment: "pickup", address: "", lines: [{ inventoryItemId: itemId, quantity: 1, expectedPriceArs: 2500 }] }, "qa-local");
    await seed.query("update store_orders set expires_at=now()-interval '1 hour' where idempotency_key=$1", [key]);
    const claim = await createClaimSession(seed, { name: "Claim QA observador" }, actor);
    await seed.query("insert into claim_cards(id,business_id,claim_id,pricecharting_id,product_name,buyer,final_price_ars) values($1,$2,$3,'observer-claim-qa','Carta claim QA','Comprador claim QA',2500)", [crypto.randomUUID(), actor.businessId, claim.activeClaim!.id]);
  } finally { await seed.close(); }

  // Capture this isolated server's database for complete before/after fingerprints.
  const query = PGlite.prototype.query;
  let runtime: PGlite | undefined;
  PGlite.prototype.query = function (this: PGlite, ...args: Parameters<typeof query>) {
    runtime = this;
    return query.apply(this, args);
  } as typeof query;
  t.after(() => { PGlite.prototype.query = query; });
  const { handleRequest } = await import("./server.js");
  const server = createServer((request, response) => { void handleRequest(request, response); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await runtime?.close(); });
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const login = async (email: string) => {
    const response = await fetch(origin + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "observer-local-test-only" }) });
    assert.equal(response.status, 200); return (await response.json() as { token: string }).token;
  };
  const adminToken = await login("admin@observer.test"), otherToken = await login("other@observer.test"), token = await login("viewer@observer.test");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  assert.ok(runtime);
  const snapshot = async () => {
    const tables = await runtime!.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name");
    const result: Record<string, string> = {};
    for (const { table_name: name } of tables.rows) {
      const rows = await runtime!.query<{ hash: string }>(`select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) as hash from "${name.replace(/"/g, '""')}" t`);
      result[name] = rows.rows[0].hash;
    }
    return result;
  };
  const before = await snapshot();
  await t.test("all panel views are readable without repairing cache, orders or boards", async () => {
    for (const route of ["/auth/me", "/exchange-rate/blue", "/stock", "/stock?fresh=1", "/inventory/view?offset=0&limit=24", "/inventory/items?ids=" + itemId,
      "/inventory/intake-search?query=Carta", "/sales", "/order-boards", "/claims", "/claims/orders/preview", "/claim-plans", "/purchases", "/resellers", "/users", "/store-settings",
      "/mobile-intake/view", "/mobile-intake/pending", "/operational-history", "/audit", "/movements", "/tournaments", "/store/catalog", "/store/settings",
      "/pricecharting-cache?limit=1", "/pricecharting-cache/status", "/card-index/status", "/tcgplayer-prices/status", "/pricecharting-images/status", "/database-quality/images", "/imports"]) {
      const response = await fetch(origin + route, { headers });
      assert.equal(response.status, 200, route + ": " + await response.text());
    }
    const image = await fetch(origin + "/pricecharting-images/files/absent-qa.jpg", { headers });
    assert.equal(image.status, 404);
    const me = await (await fetch(origin + "/auth/me", { headers })).json() as { roles: string[]; environment: { allowExamples: boolean } };
    assert.deepEqual(me.roles, ["admin_readonly"]); assert.equal(me.environment.allowExamples, false);
    assert.deepEqual(await snapshot(), before);
    const sale = await runtime!.query<{ status: string }>("select s.status from store_orders w join sales s on s.id=w.sale_id where w.business_id=$1", [businessId]);
    assert.equal(sale.rows[0].status, "pending", "observer must not expire an unpaid real order");
  });
  await t.test("business writes, GET jobs, dispatcher and shared key cannot bypass read-only", async () => {
    for (const [method, route] of [["POST", "/sales"], ["PUT", `/inventory/${itemId}`], ["POST", "/claims/close"], ["POST", "/users"], ["POST", "/order-boards"], ["DELETE", "/inventory/" + itemId], ["PUT", "/store-settings"], ["POST", "/store/orders"], ["POST", "/resellers"], ["POST", "/examples/inventory"], ["PUT", `/store-admin/items/${itemId}/price`], ["GET", "/cron/price-history-snapshot"], ["GET", "/cron/pricecharting-refresh"], ["GET", "/new/unreviewed/route"], ["POST", "/dispatch?path=%2Fclaims%2Fclose"]]) {
      const response = await fetch(origin + route, { method, headers: { ...headers, "x-ultimoturno-access-key": "observer-qa-only" }, ...(method === "GET" ? {} : { body: "{}" }) });
      assert.equal(response.status, 403, method + " " + route);
    }
    assert.deepEqual(await snapshot(), before);
  });
  await t.test("read access remains isolated by business and active session", async () => {
    const foreign = { Authorization: `Bearer ${otherToken}` };
    const stock = await (await fetch(origin + "/stock", { headers: foreign })).json() as { items: unknown[] };
    assert.deepEqual(stock.items, []);
    assert.equal((await fetch(origin + "/inventory/items?ids=" + itemId, { headers: foreign })).status, 404);
    assert.equal((await fetch(origin + "/stock")).status, 401);
    assert.deepEqual(await snapshot(), before);
  });
  await t.test("normal admin writes remain available; logout and revocation still work", async () => {
    const response = await fetch(origin + "/users", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ displayName: "Observador creado por admin QA", email: "new@observer.test", password: "observer-local-test-only", role: "admin_readonly" }) });
    assert.equal(response.status, 201);
    const created = await response.json() as { user: { roles: string[] } }; assert.deepEqual(created.user.roles, ["admin_readonly"]);
    assert.equal((await fetch(origin + "/auth/logout", { method: "POST", headers })).status, 200);
    assert.equal((await fetch(origin + "/stock", { headers })).status, 401);
    const again = await login("viewer@observer.test");
    await runtime!.query("update app_users set active=false where id=$1", [viewerId]);
    assert.equal((await fetch(origin + "/stock", { headers: { Authorization: `Bearer ${again}` } })).status, 401);
  });
});
