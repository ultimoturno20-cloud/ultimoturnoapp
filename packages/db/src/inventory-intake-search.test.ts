import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { inventoryLanguageGroup, parseUiSearchQuery, scoreStockSearch, stockRowToCatalogEntry } from "@ultimoturno/domain";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, addInventoryStock, listStockForBusiness, searchInventoryIntakeCandidates } from "./index.js";

test("intake local search preserves full-stock ranking while hydrating only selected IDs", async t => {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-intake-search-")) });
  t.after(() => db.close());
  const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
  const owner = await createManagedUser(db, { displayName: "Intake owner", email: "intake-owner@qa.test", password: "isolated-intake-owner-only", role: "stock_owner" }, actor);
  await db.query(`insert into card_products(id,business_id,name,expansion,card_number,image_url)
    select md5('intake-product-'||g)::uuid,$1,'Pikachu '||g,'Set QA',(g%165)::text||'/165','/brand/ultimo-turno-logo.jpeg' from generate_series(1,1000) g`, [actor.businessId]);
  await db.query(`insert into card_variants(id,business_id,product_id,language,condition,finish)
    select md5('intake-variant-'||g)::uuid,$1,md5('intake-product-'||g)::uuid,
      case when g%4=0 then 'JA' when g%4=1 then 'CN' when g%4=2 then 'ES' else 'EN' end,
      case when g%3=0 then 'LP' else 'NM' end,case when g%2=0 then 'reverse holo' else 'normal' end from generate_series(1,1000) g`, [actor.businessId]);
  await db.query(`insert into inventory_items(id,business_id,product_id,variant_id,sku,owner_user_id,quantity_on_hand,location,tags,active)
    select md5('intake-item-'||g)::uuid,$1,md5('intake-product-'||g)::uuid,md5('intake-variant-'||g)::uuid,'INTAKE-'||g,
      case when g%2=0 then $2::uuid else null end,case when g%7=0 then 0 else 3 end,'Mesa '||(g%5),'singles,qa',g%11<>0 from generate_series(1,1000) g`, [actor.businessId, owner.id]);
  await db.query(`insert into current_prices(inventory_item_id,business_id,price_ars,price_usd)
    select md5('intake-item-'||g)::uuid,$1,1000+g,(1000+g)/1540.0 from generate_series(1,1000) g`, [actor.businessId]);
  const special = await addInventoryStock(db, { name: "Flab\u00e9b\u00e9's Target Rare", expansion: "Pok\u00e9mon 151", number: "007/165", language: "EN", condition: "GRADED", gradingCompany: "PSA", grade: "10", gradingCert: "CERT-890", finish: "normal", quantityOnHand: 1, priceArs: 5000, tags: "jugables", location: "Vitrina" }, actor);
  const baseline = (await listStockForBusiness(db, actor.businessId)).items;
  const legacy = (text: string, group: string, limit = 30, own = false) => {
    const seen = new Set<string>(), query = parseUiSearchQuery(text);
    return baseline.filter(item => (!own || item.ownerUserId === owner.id) && (group === "all" || inventoryLanguageGroup(item.variant.language) === group))
      .map(item => ({ item, score: scoreStockSearch(item, query) })).filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score || a.item.product.name.localeCompare(b.item.product.name, "es", { numeric: true }))
      .map(({ item }) => stockRowToCatalogEntry(item)).filter(entry => { if (seen.has(entry.priceChartingId)) return false; seen.add(entry.priceChartingId); return true; }).slice(0, limit);
  };
  await t.test("parity across names, plural variants, partial numbers, languages and fields", async () => {
    for (const text of ["Pikachu", "pikachus", "pikachu 007/165", "001", "INTAKE-1000", "set qa", "reverse", "mesa 3", "NM", "PSA 10", "CERT 890", "Flabebe's", "flab\u00e9b\u00e9", "jugables", "nothing matches", "%_' OR true --", "\u30d4\u30ab"])
      for (const group of ["all", "english", "japanese", "chinese"]) {
        assert.deepEqual(await searchInventoryIntakeCandidates(db, actor, { query: text, languageGroup: group }), legacy(text, group), `${text}/${group}`);
      }
  });
  await t.test("SQL returns matching metadata plus bounded item rows, not the complete stock DTO", async () => {
    const reads: Array<{ sql: string; rows: number; bytes: number }> = [];
    const measured = new Proxy(db, { get(target, property) {
      if (property === "query") return async (sql: string, params?: unknown[]) => {
        const result = await target.query(sql, params); reads.push({ sql, rows: result.rows.length, bytes: Buffer.byteLength(JSON.stringify(result.rows)) }); return result;
      };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
    const entries = await searchInventoryIntakeCandidates(measured, actor, { query: "Target Rare" });
    assert.equal(entries.length, 1); assert.equal(entries[0].productName, special.product.name);
    const stockRead = reads.find(read => read.sql.includes("latest_purchase.unit_cost_ars"));
    assert.ok(stockRead); assert.equal(stockRead.rows, 1); assert.match(stockRead.sql, /ii\.id = any\(\$2::uuid\[\]\)/);
    assert.equal(reads[0].rows, 1);
    const beforeBytes = Buffer.byteLength(JSON.stringify(baseline)), afterBytes = reads.reduce((sum, read) => sum + read.bytes, 0);
    assert.ok(afterBytes < beforeBytes / 50);
    t.diagnostic(JSON.stringify({ fixture: baseline.length, baselineDtoBytes: beforeBytes, selectedSqlRows: reads.map(r => r.rows), selectedSqlBytes: afterBytes, responseBytes: Buffer.byteLength(JSON.stringify(entries)), scope: "synthetic selective query, not production latency or all broad queries" }));
    reads.length = 0;
    assert.equal((await searchInventoryIntakeCandidates(measured, actor, { query: "Pikachu" }, 60)).length, 60);
    assert.equal(reads.find(read => read.sql.includes("latest_purchase.unit_cost_ars"))?.rows, 60);
  });
  await t.test("role/business/owner restrictions and input validation precede hydration", async () => {
    const ownActor = { ...actor, id: owner.id, roles: ["stock_owner"] };
    assert.deepEqual(await searchInventoryIntakeCandidates(db, ownActor, { query: "Pikachu" }), legacy("Pikachu", "all", 30, true));
    assert.equal((await searchInventoryIntakeCandidates(db, ownActor, { query: "Target Rare" })).length, 0);
    assert.equal((await searchInventoryIntakeCandidates(db, { ...actor, businessId: randomUUID() }, { query: "Pikachu" })).length, 0);
    for (const roles of [[], ["reseller"]]) await assert.rejects(searchInventoryIntakeCandidates(db, { ...actor, roles }, { query: "Pikachu" }), { statusCode: 403 });
    for (const query of ["", "a", "x".repeat(161)]) await assert.rejects(searchInventoryIntakeCandidates(db, actor, { query }), { statusCode: 400 });
    await assert.rejects(searchInventoryIntakeCandidates(db, actor, { query: "Pikachu", languageGroup: "bad" }), { statusCode: 400 });
  });
  await t.test("local prices are fresh after writes, including candidates not on the previous list", async () => {
    await db.query("update current_prices set price_usd=42,price_ars=64680 where inventory_item_id=$1", [special.id]);
    assert.equal((await searchInventoryIntakeCandidates(db, actor, { query: "Target Rare" }))[0].loosePriceUsd, 42);
    assert.equal((await searchInventoryIntakeCandidates(db, actor, { query: "Pikachu 140" })).some(entry => entry.productName === "Pikachu 140"), true);
  });
});
