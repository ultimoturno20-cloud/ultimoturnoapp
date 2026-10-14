import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import {
  createOperationalDatabase, getDefaultOperationalUser, getInventoryItem, listStockForBusiness, listStock,
  addInventoryStock, createReseller, assignResellerStock, createSale, replacePriceChartingCache, saveInventoryFolderEntry,
  getInventoryItemsForActor, createManagedUser
} from "./index.js";

async function fixture() {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-inventory-reads-")) });
  return { db, actor: await getDefaultOperationalUser(db) };
}

function instrument(db: PGlite) {
  const queries: Array<{ sql: string; params?: unknown[]; rows: number; bytes: number }> = [];
  const measured = { query: async (sql: string, params?: unknown[]) => {
    const result = await db.query(sql, params);
    queries.push({ sql, params, rows: result.rows.length, bytes: Buffer.byteLength(JSON.stringify(result.rows)) });
    return result;
  } } as unknown as PGlite;
  return { measured, queries, totals: () => queries.reduce((sum, query) => ({ rows: sum.rows + query.rows, bytes: sum.bytes + query.bytes }), { rows: 0, bytes: 0 }) };
}

test("selected-ID reads are fresh, bounded, ordered and isolated by actor", async () => {
  const { db, actor: base } = await fixture();
  const actor = { ...base, roles: ["admin"] };
  try {
    const owner = await createManagedUser(db, { displayName: "Owner QA", email: "owner@ids.qa", password: "isolated-owner-qa-password", role: "stock_owner" }, actor);
    const first = await addInventoryStock(db, { name: "First", expansion: "QA", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 3, priceArs: 2000, ownerUserId: owner.id }, actor);
    const second = await addInventoryStock(db, { name: "Second", expansion: "QA", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 2, priceArs: 3000 }, actor);
    const measured = instrument(db);
    const selected = await getInventoryItemsForActor(measured.measured, [second.id, first.id, second.id.toUpperCase()], actor);
    assert.deepEqual(selected.map(i => i.id), [second.id, first.id]);
    assert.ok(measured.queries[0].sql.includes("ii.id = any($2::uuid[])"));
    assert.equal(measured.queries[0].rows, 2);
    await db.query("update current_prices set price_ars=4500 where inventory_item_id=$1", [first.id]);
    assert.equal((await getInventoryItemsForActor(db, [first.id], actor))[0].priceArs, 4500);
    const ownedActor = { ...actor, id: owner.id, roles: ["stock_owner"] };
    assert.equal((await getInventoryItemsForActor(db, [first.id], ownedActor))[0].id, first.id);
    await assert.rejects(getInventoryItemsForActor(db, [first.id, second.id], ownedActor), { statusCode: 404 });
    await assert.rejects(getInventoryItemsForActor(db, [first.id], { ...actor, businessId: crypto.randomUUID() }), { statusCode: 404 });
    await assert.rejects(getInventoryItemsForActor(db, [crypto.randomUUID()], actor), { statusCode: 404 });
    await assert.rejects(getInventoryItemsForActor(db, [first.id], { ...actor, roles: ["reseller"] }), { statusCode: 403 });
    for (const ids of [[], ["bad"], Array.from({ length: 65 }, () => first.id)]) await assert.rejects(getInventoryItemsForActor(db, ids, actor), { statusCode: 400 });
  } finally { await db.close(); }
});

test("point lookup preserves full stock DTO, grading, prices, assignments and business isolation", async () => {
  const { db, actor } = await fixture();
  try {
    const item = await addInventoryStock(db, {
      name: "Scoped graded fixture", expansion: "QA", number: "025", language: "JA", condition: "NM", finish: "normal",
      gradingCompany: "PSA", grade: "10", gradingCert: "QA-CERT", quantityOnHand: 7, priceArs: 19000,
      purchaseCost: 2000, purchaseCurrency: "ARS", cardTypeOverride: "pokemon"
    }, actor);
    const reseller = await createReseller(db, { displayName: "Scoped reseller", email: "scoped@qa.test", password: "isolated-qa-password", commissionPercent: 15 }, actor);
    await assignResellerStock(db, reseller.reseller.userId, item.id, 2, actor);
    await createSale(db, { customerName: "Scoped reservation", saleType: "reservation", channel: "manual", lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 19000 }] }, actor);
    const full = await listStockForBusiness(db, actor.businessId);
    const read = instrument(db);
    assert.deepEqual(await getInventoryItem(read.measured, item.id, actor.businessId), full.items.find(row => row.id === item.id));
    assert.ok(read.queries.every(query => /^\s*select\b/i.test(query.sql)), "Read must not write");
    assert.ok(!read.queries.some(query => /inventory_folder_entries/.test(query.sql)), "A single card must not value unrelated folders");
    assert.ok(read.queries[0].sql.includes("ii.id = any($2::uuid[])"));
    assert.deepEqual(read.queries[0].params, [actor.businessId, [item.id]]);
    assert.equal(read.queries[0].rows, 1);
    assert.equal(await getInventoryItem(db, item.id, crypto.randomUUID()), null);
    assert.equal(await getInventoryItem(db, crypto.randomUUID(), actor.businessId), null);
    const invalid = instrument(db);
    assert.equal(await getInventoryItem(invalid.measured, "bad-id", actor.businessId), null);
    assert.equal(invalid.queries.length, 0);
    await db.query("update current_prices set price_ars=19500 where inventory_item_id=$1", [item.id]);
    await db.query("update inventory_items set quantity_on_hand=9 where id=$1", [item.id]);
    const fresh = await getInventoryItem(db, item.id, actor.businessId);
    assert.equal(fresh!.priceArs, 19500);
    assert.equal(fresh!.quantityOnHand, 9);
    assert.equal(fresh!.quantityReserved, 1);
    assert.equal(fresh!.quantityAssigned, 2);
    assert.equal(fresh!.freeQuantity, 6);
  } finally { await db.close(); }
});

test("folder lookup values only the requested folder and remains identical to complete stock", async () => {
  const { db, actor } = await fixture();
  try {
    const input = { itemKind: "folder" as const, name: "Scoped folder", expansion: "QA", language: "EN", condition: "NM", finish: "carpeta", quantityOnHand: 1, priceArs: 9000, inventoryStatus: "not_for_sale" };
    const first = await addInventoryStock(db, input, actor);
    const second = await addInventoryStock(db, input, actor);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards", sourceHash: "scoped-folder", rowsReceived: 2, rowsSkipped: 0,
      rows: [0,1].map(index => ({ priceChartingId: "scoped-folder-" + index, productName: "Scoped card " + index, normalizedName: "scoped", canonicalUrl: "", sourceUrl: "", expansionName: "QA", normalizedExpansion: "qa", cardNumber: String(index + 1), loosePriceUsd: index === 0 ? 12.34 : null, imageUrl: "", searchKey: "scoped" }))
    });
    await saveInventoryFolderEntry(db, first.id, { priceChartingId: "scoped-folder-0", quantity: 2 }, actor);
    await saveInventoryFolderEntry(db, first.id, { priceChartingId: "scoped-folder-1", quantity: 1 }, actor);
    await saveInventoryFolderEntry(db, second.id, { priceChartingId: "scoped-folder-0", quantity: 100 }, actor);
    const full = await listStockForBusiness(db, actor.businessId);
    assert.deepEqual((await listStock(db)).items, full.items);
    const read = instrument(db);
    const folder = await getInventoryItem(read.measured, first.id, actor.businessId);
    assert.deepEqual(folder, full.items.find(item => item.id === first.id));
    assert.equal(folder!.folder!.totalCards, 3);
    assert.equal(folder!.folder!.missingPrices, 1);
    assert.equal(folder!.folder!.valueUsd, 24.68);
    assert.equal(folder!.priceArs, 9000);
    assert.equal(folder!.availableQuantity, 0);
    const valuation = read.queries.find(query => query.sql.includes("inventory_folder_entries"))!;
    assert.deepEqual(valuation.params, [actor.businessId, [first.id]]);
    assert.equal(valuation.rows, 1);
    assert.equal((await getInventoryItem(db, second.id, actor.businessId))!.folder!.totalCards, 100);
  } finally { await db.close(); }
});

test("point lookup does not materialize the complete inventory in a 1000-item fixture", async t => {
  const { db, actor } = await fixture();
  try {
    const rows = Array.from({ length: 1000 }, (_, index) => ({ id: crypto.randomUUID(), product: crypto.randomUUID(), variant: crypto.randomUUID(), index }));
    const json = JSON.stringify(rows);
    await db.query(`insert into card_products (id, business_id, name, expansion, card_number)
      select product, $2, 'Volume fixture ' || index, 'QA', index::text from jsonb_to_recordset($1::jsonb) as x(product uuid, index integer)`, [json, actor.businessId]);
    await db.query(`insert into card_variants (id, business_id, product_id, language, condition, finish)
      select variant, $2, product, 'EN', 'NM', 'normal' from jsonb_to_recordset($1::jsonb) as x(variant uuid, product uuid)`, [json, actor.businessId]);
    await db.query(`insert into inventory_items (id, business_id, sku, product_id, variant_id, quantity_on_hand)
      select id, $2, 'VOLUME-' || index, product, variant, 3 from jsonb_to_recordset($1::jsonb) as x(id uuid, product uuid, variant uuid, index integer)`, [json, actor.businessId]);
    const baseline = instrument(db), point = instrument(db);
    const oldStart = performance.now();
    const complete = await listStockForBusiness(baseline.measured, actor.businessId);
    const baselineMs = performance.now() - oldStart;
    const pointStart = performance.now();
    const item = await getInventoryItem(point.measured, rows[0].id, actor.businessId);
    const pointMs = performance.now() - pointStart;
    assert.deepEqual(item, complete.items.find(item => item.id === rows[0].id));
    assert.equal(point.queries[0].rows, 1);
    assert.ok(point.queries.length <= 3);
    assert.ok(point.totals().rows <= 3);
    assert.ok(point.totals().bytes < baseline.totals().bytes / 100);
    t.diagnostic(JSON.stringify({ fixtureItems: rows.length, full: { ...baseline.totals(), ms: Math.round(baselineMs) }, point: { ...point.totals(), ms: Math.round(pointMs) }, scope: "isolated PGlite, not production latency" }));
  } finally { await db.close(); }
});
