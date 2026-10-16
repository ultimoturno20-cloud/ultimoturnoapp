import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, addInventoryStock } from "@ultimoturno/db";
import type { MobileIntakePage, MobileInventoryEntry } from "@ultimoturno/domain";

test("mobile HTTP: pages, private scopes, explicit bulk apply and replay safety", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-mobile-api-"));
  for (const key of ["DATABASE_URL", "ULTIMOTURNO_DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRICECHARTING_TOKEN", "OPENAI_API_KEY"]) process.env[key] = "";
  Object.assign(process.env, { ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir, ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false", TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false", ULTIMOTURNO_ACCESS_KEY: "mobile-isolated-only", ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1540" });
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  let itemId: string;
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    await createManagedUser(db, { displayName: "Mobile QA", email: "mobile-admin@qa.test", password: "mobile-isolated-qa-only", role: "admin" }, actor);
    await createManagedUser(db, { displayName: "Owner QA", email: "mobile-owner@qa.test", password: "mobile-isolated-qa-only", role: "stock_owner" }, actor);
    itemId = (await addInventoryStock(db, { name: "Mobile stock QA", expansion: "QA", number: "1", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 5, priceArs: 3000 }, actor)).id;
    await db.query(`insert into mobile_inventory_entries(id,business_id,inventory_item_id,match_type,name,quantity_on_hand,price_ars,language,condition,finish,created_at)
      select md5('http-mobile-'||g)::uuid,$1,$2,'inventory','Mobile stock QA',2,1000,'EN','NM','normal',now()-g*interval '1 second'
      from generate_series(1,120) g`, [actor.businessId, itemId]);
  } finally { await db.close(); }
  const { handleRequest } = await import("./server.js");
  const server = createServer((req, res) => { void handleRequest(req, res); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const login = async (email: string) => {
    const response = await fetch(origin + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "mobile-isolated-qa-only" }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${await login("mobile-admin@qa.test")}` };
  const ownerHeaders = { Authorization: `Bearer ${await login("mobile-owner@qa.test")}` };
  const read = async <T,>(url: string) => { const response = await fetch(origin + url, { headers }); assert.equal(response.status, 200); return response.json() as Promise<T>; };
  const apply = async (body: unknown) => {
    const response = await fetch(origin + "/mobile-intake/apply", { method: "POST", headers, body: JSON.stringify(body) });
    assert.equal(response.status, 200); return (await response.json() as { result: { appliedEntries: number; unitsApplied: number; skippedEntries: number } }).result;
  };
  for (const url of ["/mobile-intake/view", "/mobile-intake/pending", "/mobile-intake/pending-match?key=anything"]) {
    assert.equal((await fetch(origin + url)).status, 401);
    assert.equal((await fetch(origin + url, { headers: ownerHeaders })).status, 403);
  }
  assert.equal((await fetch(origin + "/mobile-intake/view?limit=20000", { headers })).status, 400);
  const page = await read<MobileIntakePage>("/mobile-intake/view");
  assert.equal(page.entries.length, 25); assert.equal(page.summary.pending, 120);
  const pending = await read<{ entries: MobileInventoryEntry[] }>("/mobile-intake/pending");
  assert.equal(pending.entries.length, 120);
  assert.deepEqual(await read("/mobile-intake/pending-match?key=" + encodeURIComponent("stock:" + itemId)), { count: 120, units: 240 });
  const stock = () => read<{ items: Array<{ id: string; quantityOnHand: number; priceArs: number }> }>("/stock");
  assert.equal((await stock()).items[0].quantityOnHand, 5);
  for (const body of ["{", "null", "[]", '{"ids":"bad"}', '{"ids":["bad"]}']) {
    assert.equal((await fetch(origin + "/mobile-intake/apply", { method: "POST", headers, body })).status, 400);
  }
  assert.equal((await apply({ ids: [] })).appliedEntries, 0);
  assert.equal((await stock()).items[0].quantityOnHand, 5);
  const offPage = pending.entries.at(-1)!;
  assert.equal(page.entries.some(e => e.id === offPage.id), false);
  assert.equal((await apply({ ids: [offPage.id] })).unitsApplied, 2);
  assert.equal((await apply({ ids: [offPage.id] })).skippedEntries, 1);
  assert.equal((await read<{ entries: MobileInventoryEntry[] }>("/mobile-intake/pending")).entries.length, 119);
  assert.equal((await apply({})).appliedEntries, 119);
  assert.equal((await apply({})).appliedEntries, 0);
  const after = await stock();
  assert.equal(after.items[0].quantityOnHand, 245); assert.equal(after.items[0].priceArs, 3000);
  const completed = await read<MobileIntakePage>("/mobile-intake/view?status=pending");
  assert.equal(completed.matchedTotal, 0); assert.equal(completed.total, 120);
  assert.equal(completed.summary.reviewed, 120); assert.equal(completed.summary.pending, 0);
});
