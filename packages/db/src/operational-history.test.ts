import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createOperationalDatabase, getDefaultOperationalUser, addInventoryStock, listMovements, getAuditLog, listOperationalHistory } from "./index.js";

test("operational history: bounded SQL pages, full counters, permissions and precision", async t => {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-history-")) });
  t.after(() => db.close());
  const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
  const item = await addInventoryStock(db, { name: "History QA", expansion: "QA", number: "1", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 1, priceArs: 2000 }, actor);
  const before = await db.query<{ count: number }>("select count(*)::integer as count from inventory_movements where business_id=$1", [actor.businessId]);
  await db.query(`insert into inventory_movements(id,business_id,inventory_item_id,movement_type,quantity_delta,note,created_at)
    select md5('history-movement-' || g)::uuid,$1,$2,case when g%2=0 then 'sale' else 'manual_adjustment' end,
      case when g%2=0 then -1 else 2 end,'fixture history ' || g,
      '2026-10-12 12:00:00.123456+00'::timestamptz + (g%2) * interval '1 microsecond'
    from generate_series(1,1000) g`, [actor.businessId, item.id]);
  await db.query(`insert into audit_log(id,business_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,created_at)
    select md5('history-audit-' || g)::uuid,$1,$2,'inventory.update','inventory_item','fixture history ' || g,
      jsonb_build_object('private_snapshot',repeat('x',4000)),jsonb_build_object('private_snapshot',repeat('y',4000)),
      '2026-10-12 12:00:00.123456+00'::timestamptz from generate_series(1,1000) g`, [actor.businessId, actor.id]);

  await t.test("walks all 1000 matches exactly once with tied timestamps and no OFFSET", async () => {
    let page = await listOperationalHistory(db, actor, { query: "fixture history", limit: 37 });
    assert.equal(page.total, before.rows[0].count + 1000);
    assert.equal(page.matchedTotal, 1000);
    assert.equal(page.netQuantity, 500);
    assert.match(page.items[0].createdAt, /123457/);
    const ids = new Set<string>();
    let pages = 0;
    while (true) {
      pages += 1;
      assert.ok(page.items.length <= 37);
      assert.equal(page.matchedTotal, 1000);
      assert.equal(page.netQuantity, 500);
      for (const row of page.items) { assert.equal(ids.has(row.id), false); ids.add(row.id); }
      if (!page.nextCursor) break;
      page = await listOperationalHistory(db, actor, { query: "fixture history", limit: 37, asOf: page.asOf, cursor: page.nextCursor });
    }
    assert.equal(ids.size, 1000); assert.equal(pages, 28);
  });

  await t.test("filter totals are global, not page-local; queries treat SQL metacharacters literally", async () => {
    const page = await listOperationalHistory(db, actor, { query: "FIXTURE HISTORY", action: "sale", limit: 25 });
    assert.equal(page.matchedTotal, 500); assert.equal(page.netQuantity, -500);
    assert.equal(page.items.length, 25); assert.ok(page.items.every(row => row.action === "sale"));
    assert.equal((await listOperationalHistory(db, actor, { query: "%_' OR true --" })).matchedTotal, 0);
    assert.equal((await listOperationalHistory(db, actor, { query: "not present" })).nextCursor, null);
  });

  await t.test("audit pages omit unused private snapshots; legacy consumers remain unchanged", async () => {
    const page = await listOperationalHistory(db, actor, { kind: "system", query: "fixture history", limit: 25 });
    assert.equal(page.matchedTotal, 1000); assert.equal(page.netQuantity, null);
    assert.equal(page.items.length, 25); assert.equal(page.items[0].actorName, actor.displayName);
    assert.equal("beforeData" in page.items[0], false); assert.equal("afterData" in page.items[0], false);
    const legacyMovements = await listMovements(db, actor.businessId), legacyAudit = await getAuditLog(db, actor.businessId);
    assert.equal(legacyMovements.movements.length, 100); assert.equal(legacyAudit.audit.length, 100);
    assert.ok("beforeData" in legacyAudit.audit[0]);
    const baselineBytes = Buffer.byteLength(JSON.stringify([legacyMovements, legacyAudit]));
    const pagedBytes = Buffer.byteLength(JSON.stringify(page));
    assert.ok(pagedBytes < baselineBytes / 3, `${pagedBytes} must be less than one third of ${baselineBytes}`);
    t.diagnostic(JSON.stringify({ fixtureRows: 1000, baselineRecords: 200, pageRecords: 25, baselineBytes, pagedBytes }));
  });

  await t.test("Argentina date boundaries include the entire chosen day", async () => {
    await db.query(`insert into inventory_movements(id,business_id,inventory_item_id,movement_type,quantity_delta,note,created_at)
      values($1,$3,$4,'manual_adjustment',1,'timezone QA','2026-10-13 02:59:59.999999+00'),
      ($2,$3,$4,'manual_adjustment',2,'timezone QA','2026-10-13 03:00:00+00')`, [randomUUID(), randomUUID(), actor.businessId, item.id]);
    const first = await listOperationalHistory(db, actor, { query: "timezone QA", from: "2026-10-12", to: "2026-10-12" });
    assert.equal(first.matchedTotal, 1); assert.equal(first.netQuantity, 1);
    assert.equal((await listOperationalHistory(db, actor, { query: "timezone QA", from: "2026-10-13", to: "2026-10-13" })).netQuantity, 2);
  });

  await t.test("rows appended after the boundary do not shift existing pages", async () => {
    const first = await listOperationalHistory(db, actor, { query: "fixture history", limit: 25 });
    await db.query(`insert into inventory_movements(id,business_id,inventory_item_id,movement_type,quantity_delta,note,created_at)
      values($1,$2,$3,'manual_adjustment',9,'fixture history new', $4::timestamptz + interval '1 microsecond')`, [randomUUID(), actor.businessId, item.id, first.asOf]);
    const next = await listOperationalHistory(db, actor, { query: "fixture history", limit: 25, asOf: first.asOf, cursor: first.nextCursor });
    assert.equal(next.matchedTotal, 1000);
    assert.equal(next.items.some(row => first.items.some(previous => previous.id === row.id)), false);
    assert.equal((await listOperationalHistory(db, actor, { query: "fixture history" })).matchedTotal, 1001);
  });

  await t.test("role/business limits also apply to counts and facets; malformed input is rejected", async () => {
    await assert.rejects(listOperationalHistory(db, { ...actor, roles: ["stock_owner"] }), { statusCode: 403 });
    const foreign = randomUUID();
    await db.query("insert into businesses(id,name,slug,default_currency) values($1,'Foreign QA','history-foreign','ARS')", [foreign]);
    await db.query("insert into audit_log(id,business_id,action,entity_type,entity_id) values($1,$2,'private.foreign','private','foreign-only')", [randomUUID(), foreign]);
    const ours = await listOperationalHistory(db, actor, { kind: "system" });
    assert.equal(ours.actions.some(action => action.value === "private.foreign"), false);
    const theirs = await listOperationalHistory(db, { ...actor, businessId: foreign }, { kind: "system" });
    assert.equal(theirs.total, 1); assert.equal(theirs.items[0].entityId, "foreign-only");
    await assert.rejects(listOperationalHistory(db, actor, { limit: 100000 }), { statusCode: 400 });
  });
});
