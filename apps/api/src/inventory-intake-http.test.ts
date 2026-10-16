import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, addInventoryStock, replacePriceChartingCache } from "@ultimoturno/db";
import type { IntakeSearchResult } from "@ultimoturno/domain";

test("intake HTTP: private catalog/local search, owner isolation, freshness and unchanged writes", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-intake-http-"));
  for (const key of ["DATABASE_URL", "ULTIMOTURNO_DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRICECHARTING_TOKEN", "OPENAI_API_KEY"]) process.env[key] = "";
  Object.assign(process.env, { ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir, ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false", TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false", ULTIMOTURNO_ACCESS_KEY: "intake-isolated-only", ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1540" });
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  let ownerId: string, centralId: string;
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    await createManagedUser(db, { displayName: "Intake admin", email: "intake-admin@qa.test", password: "intake-qa-isolated-only", role: "admin" }, actor);
    ownerId = (await createManagedUser(db, { displayName: "Intake owner", email: "intake-owner@qa.test", password: "intake-qa-isolated-only", role: "stock_owner" }, actor)).id;
    centralId = (await addInventoryStock(db, { sku: "CENTRAL-INTAKE-QA", name: "Local Intake Central", expansion: "QA", number: "10", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 3, priceArs: 3000, priceUsd: 2 }, actor)).id;
    await addInventoryStock(db, { sku: "OWNER-INTAKE-QA", ownerUserId: ownerId, name: "Local Intake Owner", expansion: "QA", number: "11", language: "JA", condition: "NM", finish: "normal", quantityOnHand: 2, priceArs: 2000 }, actor);
    await replacePriceChartingCache(db, { category: "pokemon-cards", sourceHash: "intake-http-qa", rowsReceived: 1, rowsSkipped: 0, rows: [{ priceChartingId: "intake-pc-qa", canonicalUrl: "", sourceUrl: "", productName: "Catalog Intake QA", normalizedName: "catalog intake qa", expansionName: "QA", normalizedExpansion: "qa", cardNumber: "12", loosePriceUsd: 1, imageUrl: "", searchKey: "catalog intake qa" }] });
  } finally { await db.close(); }
  const { handleRequest } = await import("./server.js");
  const server = createServer((req, res) => { void handleRequest(req, res); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const login = async (email: string) => {
    const response = await fetch(origin + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "intake-qa-isolated-only" }) });
    assert.equal(response.status, 200); return (await response.json() as { token: string }).token;
  };
  const headers = { Authorization: `Bearer ${await login("intake-admin@qa.test")}`, "Content-Type": "application/json" };
  const ownerHeaders = { Authorization: `Bearer ${await login("intake-owner@qa.test")}` };
  const search = async (query: string, extra = "", auth = headers) => {
    const response = await fetch(origin + "/inventory/intake-search?query=" + encodeURIComponent(query) + extra, { headers: auth });
    assert.equal(response.status, 200); return response.json() as Promise<IntakeSearchResult>;
  };
  assert.equal((await fetch(origin + "/inventory/intake-search?query=intake")).status, 401);
  assert.equal((await fetch(origin + "/inventory/intake-search?query=a", { headers })).status, 400);
  const admin = await search("intake");
  assert.deepEqual(new Set(admin.entries.map(e => e.productName)), new Set(["Catalog Intake QA", "Local Intake Central", "Local Intake Owner"]));
  const own = await search("intake", "", { ...ownerHeaders, "Content-Type": "application/json" });
  assert.equal(own.entries.some(e => e.productName === "Local Intake Central"), false);
  assert.equal(own.entries.some(e => e.productName === "Local Intake Owner"), true);
  assert.equal((await search("Local Intake", "&languageGroup=japanese")).entries.every(e => e.languageGroup === "japanese"), true);
  const write = await fetch(origin + "/inventory/intake", { method: "POST", headers, body: JSON.stringify({ sku: "CENTRAL-INTAKE-QA", name: "Local Intake Central", expansion: "QA", number: "10", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 2, priceArs: 5000, priceUsd: 3.25 }) });
  assert.equal(write.status, 200);
  const saved = await write.json() as { item: { id: string; quantityOnHand: number } };
  assert.equal(saved.item.id, centralId); assert.equal(saved.item.quantityOnHand, 5);
  assert.equal((await search("Local Intake Central")).entries[0].loosePriceUsd, 3.25);
  const leaked = await search("CENTRAL-INTAKE-QA", "", { ...ownerHeaders, "Content-Type": "application/json" });
  assert.equal(leaked.entries.some(e => e.priceChartingId === "CENTRAL-INTAKE-QA"), false);
});
