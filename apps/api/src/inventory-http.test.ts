import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, createReseller, addInventoryStock } from "@ultimoturno/db";
import type { DbStockRow } from "@ultimoturno/db";
import type { InventoryPage } from "@ultimoturno/domain";

test("inventory HTTP pages preserve complete stock, scoped IDs, owners and fresh writes", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-inventory-http-"));
  for (const key of ["DATABASE_URL", "ULTIMOTURNO_DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRICECHARTING_TOKEN", "OPENAI_API_KEY"]) process.env[key] = "";
  Object.assign(process.env, {
    ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir,
    ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false", TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false",
    ULTIMOTURNO_ACCESS_KEY: "isolated-inventory-http-only", ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1540"
  });
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  let ownedId = "";
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    await createManagedUser(db, { displayName: "Inventory QA", email: "inventory@qa.test", password: "inventory-isolated-password", role: "admin" }, actor);
    const owner = await createManagedUser(db, { displayName: "Inventory owner", email: "owner@qa.test", password: "inventory-isolated-password", role: "stock_owner" }, actor);
    await createReseller(db, { displayName: "Only name", email: "reseller@qa.test", password: "inventory-isolated-password", commissionPercent: 10 }, actor);
    const rows = Array.from({ length: 130 }, (_, index) => ({ id: crypto.randomUUID(), product: crypto.randomUUID(), variant: crypto.randomUUID(), index }));
    const json = JSON.stringify(rows);
    await db.query("insert into card_products(id,business_id,name,expansion,card_number) select product,$2,'Inventory QA '||index,'QA',index::text from jsonb_to_recordset($1::jsonb) as x(product uuid,index integer)", [json, actor.businessId]);
    await db.query("insert into card_variants(id,business_id,product_id,language,condition,finish) select variant,$2,product,'EN','NM','normal' from jsonb_to_recordset($1::jsonb) as x(variant uuid,product uuid)", [json, actor.businessId]);
    await db.query("insert into inventory_items(id,business_id,sku,product_id,variant_id,quantity_on_hand) select id,$2,'PAGE-'||index,product,variant,3 from jsonb_to_recordset($1::jsonb) as x(id uuid,product uuid,variant uuid,index integer)", [json, actor.businessId]);
    ownedId = (await addInventoryStock(db, { name: "Owned", expansion: "Other", language: "JA", condition: "LP", finish: "normal", quantityOnHand: 1, priceArs: 5000, ownerUserId: owner.id }, actor)).id;
  } finally { await db.close(); }
  const { handleRequest } = await import("./server.js");
  const server = createServer((request, response) => { void handleRequest(request, response); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const login = async (email: string) => {
    const response = await fetch(origin + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "inventory-isolated-password" }) });
    assert.equal(response.status, 200);
    return { Authorization: "Bearer " + ((await response.json()) as { token: string }).token, "Content-Type": "application/json" };
  };
  const headers = await login("inventory@qa.test");
  const read = async <T,>(route: string, auth = headers) => {
    const response = await fetch(origin + route, { headers: auth }); assert.equal(response.status, 200, route);
    return response.json() as Promise<T>;
  };
  const legacy = await read<{ items: DbStockRow[]; summary: InventoryPage<DbStockRow>["summary"] }>("/stock");
  assert.equal(legacy.items.length, 131);
  const first = await read<InventoryPage<DbStockRow>>("/inventory/view?limit=24");
  assert.equal(first.items.length, 24); assert.deepEqual(first.summary, legacy.summary);
  assert.equal(first.total, 131); assert.equal(first.metadata.availability.all, 131);
  assert.deepEqual(first.metadata.options.expansions, ["Other", "QA"]);
  assert.equal(first.resellers.length, 1); assert.deepEqual(Object.keys(first.resellers[0]).sort(), ["displayName", "userId"]);
  const second = await read<InventoryPage<DbStockRow>>("/inventory/view?limit=24&offset=24");
  assert.ok(second.items.every(i => !first.items.some(a => a.id === i.id)));
  const all = await read<{ items: DbStockRow[] }>("/inventory/view?scope=all");
  const ids = await read<{ ids: string[] }>("/inventory/view?scope=ids");
  assert.equal(all.items.length, 131); assert.deepEqual(ids.ids, all.items.map(i => i.id));
  assert.deepEqual([...all.items].sort((a,b) => a.id.localeCompare(b.id)), [...legacy.items].sort((a,b) => a.id.localeCompare(b.id)));
  const chosen = [second.items[0].id, first.items[0].id];
  assert.deepEqual((await read<{ items: DbStockRow[] }>("/inventory/items?ids=" + chosen.join(","))).items.map(i => i.id), chosen);
  const update = await fetch(origin + "/inventory/" + chosen[0] + "/tags", { method: "PUT", headers, body: '{"tags":"updated-qa"}' });
  assert.equal(update.status, 200);
  assert.equal((await read<{ items: DbStockRow[] }>("/inventory/items?ids=" + chosen[0])).items[0].tags, "updated-qa");
  const refreshed = await read<InventoryPage<DbStockRow>>("/inventory/view?fresh=1&tag=updated-qa");
  assert.equal(refreshed.matchedTotal, 1); assert.equal(refreshed.items[0].id, chosen[0]);
  assert.notEqual(refreshed.revision, first.revision);
  const owner = await login("owner@qa.test");
  const own = await read<InventoryPage<DbStockRow>>("/inventory/view", owner);
  assert.equal(own.total, 1); assert.equal(own.items[0].id, ownedId);
  assert.equal((await read<{ items: DbStockRow[] }>("/inventory/items?ids=" + ownedId, owner)).items[0].id, ownedId);
  assert.equal((await fetch(origin + "/inventory/items?ids=" + chosen[0], { headers: owner })).status, 404);
  const reseller = await login("reseller@qa.test");
  for (const route of ["/inventory/view", "/inventory/items?ids=" + chosen[0]]) {
    assert.equal((await fetch(origin + route)).status, 401);
    assert.equal((await fetch(origin + route, { headers: reseller })).status, 403);
  }
  for (const route of ["/inventory/view?limit=101", "/inventory/view?scope=bad", "/inventory/items?ids=bad"]) assert.equal((await fetch(origin + route, { headers })).status, 400);
});
