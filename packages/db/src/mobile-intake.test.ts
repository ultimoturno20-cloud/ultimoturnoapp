import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mobileCaptureKey } from "@ultimoturno/domain";
import { createOperationalDatabase, getDefaultOperationalUser, listMobileIntakePage, listMobileInventoryEntries, listPendingMobileInventoryEntries, getMobilePendingMatch, createMobileInventoryEntry, addInventoryStock } from "./index.js";

test("mobile intake: SQL pages preserve full scopes, identities, counts and business boundaries", async t => {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-mobile-pages-")) });
  t.after(() => db.close());
  const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
  await db.query(`insert into mobile_inventory_entries(id,business_id,status,name,helper_name,intake_batch,quantity_on_hand,price_ars,created_at)
    select md5('mobile-page-'||g)::uuid,$1,case when g%5=0 then 'reviewed' when g%5=1 then 'rejected' else 'pending' end,
      'Carta QA '||g,'Mesa '||(g%3),'Lote QA',2,1500,
      '2026-10-12 12:00:00.123456+00'::timestamptz + (g%2)*interval '1 microsecond'
    from generate_series(1,1000) g`, [actor.businessId]);

  await t.test("all 1000 tied timestamps are traversed once, counters remain global", async () => {
    let page = await listMobileIntakePage(db, actor, { limit: 37 });
    const ids = new Set<string>();
    while (true) {
      assert.equal(page.total, 1000); assert.equal(page.matchedTotal, 1000);
      assert.equal(page.summary.pending, 600); assert.equal(page.summary.reviewed, 200);
      assert.ok(page.entries.length <= 37); assert.match(page.entries[0].createdAt, /12345[67]/);
      for (const entry of page.entries) { assert.equal(ids.has(entry.id), false); ids.add(entry.id); }
      if (!page.nextCursor) break;
      page = await listMobileIntakePage(db, actor, { limit: 37, asOf: page.asOf, cursor: page.nextCursor });
    }
    assert.equal(ids.size, 1000);
  });
  await t.test("filters/counts and legacy endpoint retain their full meanings; payload bounded", async () => {
    const page = await listMobileIntakePage(db, actor, { status: "pending", query: "LOTE QA", limit: 25 });
    assert.equal(page.matchedTotal, 600); assert.equal(page.entries.length, 25);
    assert.equal(page.summary.reviewed, 200);
    assert.ok(page.entries.every(e => e.status === "pending" && e.quantityOnHand === 2 && e.priceArs === 1500));
    assert.equal((await listMobileIntakePage(db, actor, { query: "%_' OR true --" })).matchedTotal, 0);
    const baseline = await listMobileInventoryEntries(db, actor.businessId, "all", 20000);
    assert.equal(baseline.entries.length, 1000);
    const beforeBytes = Buffer.byteLength(JSON.stringify(baseline)), afterBytes = Buffer.byteLength(JSON.stringify(page));
    assert.ok(afterBytes < beforeBytes / 20);
    t.diagnostic(JSON.stringify({ fixture: 1000, baselineRows: 1000, pageRows: 25, beforeBytes, afterBytes, scope: "synthetic payload, not production latency" }));
  });
  await t.test("pending preview and ID selection are independent of pages and exclude applied receipts", async () => {
    const pending = await listPendingMobileInventoryEntries(db, actor);
    assert.equal(pending.entries.length, 600);
    assert.equal((await listPendingMobileInventoryEntries(db, actor, [])).entries.length, 0);
    const selected = pending.entries.at(-1)!;
    assert.equal((await listPendingMobileInventoryEntries(db, actor, [selected.id])).entries[0].id, selected.id);
    await db.query("update mobile_inventory_entries set applied_at=now() where id=$1", [selected.id]);
    assert.equal((await listPendingMobileInventoryEntries(db, actor, [selected.id])).entries.length, 0);
    assert.equal((await listMobileIntakePage(db, actor)).summary.pending, 599);
    await assert.rejects(listPendingMobileInventoryEntries(db, actor, ["bad-id"]), { statusCode: 400 });
  });
  await t.test("duplicate counts use all pending captures, exact key priority and accent normalization", async () => {
    const identity = { name: "Flabe\u0301be\u0301's\u2019", expansion: "Pok\u00e9mon-151", number: "001/165" };
    await createMobileInventoryEntry(db, { ...identity, quantityOnHand: 7, helperName: "Mesa QA" }, actor);
    assert.deepEqual(await getMobilePendingMatch(db, actor, mobileCaptureKey(identity)), { count: 1, units: 7 });
    const item = await addInventoryStock(db, { name: "Mobile QA stock", expansion: "QA", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 1, priceArs: 3000 }, actor);
    const stockEntry = await createMobileInventoryEntry(db, { ...identity, inventoryItemId: item.id, priceChartingId: "pc-qa", quantityOnHand: 3 }, actor);
    const pcEntry = await createMobileInventoryEntry(db, { ...identity, priceChartingId: "pc-qa", quantityOnHand: 5 }, actor);
    assert.deepEqual(await getMobilePendingMatch(db, actor, mobileCaptureKey(stockEntry)), { count: 1, units: 3 });
    assert.deepEqual(await getMobilePendingMatch(db, actor, mobileCaptureKey(pcEntry)), { count: 1, units: 5 });
    assert.equal((await getMobilePendingMatch(db, actor, mobileCaptureKey(identity))).units, 7);
  });
  await t.test("appends do not shift traversal, Argentina today and permissions are global", async () => {
    const page = await listMobileIntakePage(db, actor, { query: "Carta QA", limit: 25 });
    await db.query(`insert into mobile_inventory_entries(id,business_id,name,created_at) values($1,$2,'Carta QA nueva',$3::timestamptz + interval '1 microsecond')`, [randomUUID(), actor.businessId, page.asOf]);
    const next = await listMobileIntakePage(db, actor, { query: "Carta QA", limit: 25, asOf: page.asOf, cursor: page.nextCursor });
    assert.equal(next.matchedTotal, 1000); assert.equal(next.total, 1004);
    assert.ok(next.entries.every(e => !page.entries.some(previous => previous.id === e.id)));
    await db.query(`insert into mobile_inventory_entries(id,business_id,name,created_at)
      values($1,$3,'Yesterday',(date_trunc('day',statement_timestamp() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires') - interval '1 microsecond'),
      ($2,$3,'Today',date_trunc('day',statement_timestamp() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')`, [randomUUID(), randomUUID(), actor.businessId]);
    const count = await db.query<{ count: number }>(`select count(*)::integer as count from mobile_inventory_entries where business_id=$1 and (created_at at time zone 'America/Argentina/Buenos_Aires')::date=(statement_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date`, [actor.businessId]);
    assert.equal((await listMobileIntakePage(db, actor)).summary.today, count.rows[0].count);
    const foreign = randomUUID();
    await db.query("insert into businesses(id,name,slug,default_currency) values($1,'Other QA','mobile-foreign','ARS')", [foreign]);
    await db.query("insert into mobile_inventory_entries(id,business_id,name) values($1,$2,'Private')", [randomUUID(), foreign]);
    assert.equal((await listMobileIntakePage(db, { ...actor, businessId: foreign })).total, 1);
    assert.equal((await listMobileIntakePage(db, actor, { query: "Private" })).matchedTotal, 0);
    assert.equal((await listPendingMobileInventoryEntries(db, { ...actor, businessId: foreign })).entries.length, 1);
    assert.deepEqual(await getMobilePendingMatch(db, { ...actor, businessId: foreign }, "pc:pc-qa"), { count: 0, units: 0 });
    for (const roles of [["stock_owner"], ["reseller"], []]) {
      await assert.rejects(listMobileIntakePage(db, { ...actor, roles }), { statusCode: 403 });
      await assert.rejects(listPendingMobileInventoryEntries(db, { ...actor, roles }), { statusCode: 403 });
      await assert.rejects(getMobilePendingMatch(db, { ...actor, roles }, "private"), { statusCode: 403 });
    }
    await assert.rejects(listMobileIntakePage(db, actor, { limit: 20000 }), { statusCode: 400 });
  });
  await t.test("full pending scope is not silently truncated at the old 20000 limit", async () => {
    await db.query(`insert into mobile_inventory_entries(id,business_id,name)
      select md5('mobile-large-'||g)::uuid,$1,'Large QA' from generate_series(1,20001) g`, [actor.businessId]);
    const page = await listMobileIntakePage(db, actor, { query: "Large QA", limit: 25 });
    assert.equal(page.matchedTotal, 20001); assert.equal(page.entries.length, 25);
    const pending = await listPendingMobileInventoryEntries(db, actor);
    assert.equal(pending.entries.filter(e => e.name === "Large QA").length, 20001);
  });
});
