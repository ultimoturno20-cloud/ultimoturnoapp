import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { createOperationalDatabase, getDefaultOperationalUser, createClaimSession, closeActiveClaim, previewActiveClaimOrders, listClaimsWorkspace, addClaimFree } from "./index.js";

async function fixture(count: number) {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-close-test-")) });
  const actor = await getDefaultOperationalUser(db);
  const claimId = (await createClaimSession(db, { name: "Isolated close", paymentDueAt: "2026-10-20" }, actor)).activeClaim!.id;
  const rows = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(), product: crypto.randomUUID(), variant: crypto.randomUUID(), item: crypto.randomUUID(), index,
    origin: index % 5 === 0 ? "claim_added" : "existing"
  }));
  const json = JSON.stringify(rows);
  await db.query(`insert into card_products (id, business_id, name, expansion, card_number)
    select product, $2, 'Close fixture ' || index, 'QA', index::text from jsonb_to_recordset($1::jsonb) as x(product uuid, index integer)`, [json, actor.businessId]);
  await db.query(`insert into card_variants (id, business_id, product_id, language, condition, finish)
    select variant, $2, product, 'EN', 'NM', 'normal' from jsonb_to_recordset($1::jsonb) as x(variant uuid, product uuid)`, [json, actor.businessId]);
  await db.query(`insert into inventory_items (id, business_id, sku, product_id, variant_id, quantity_on_hand, quantity_reserved)
    select item, $2, 'QA-' || index, product, variant, 3, 0 from jsonb_to_recordset($1::jsonb) as x(item uuid, index integer, product uuid, variant uuid)`, [json, actor.businessId]);
  await db.query(`insert into claim_cards (id, business_id, claim_id, pricecharting_id, product_name, quantity, buyer, final_price_ars, final_price_usd, stock_origin, stocked_quantity, inventory_item_id, sort_order)
    select id, $2, $3, 'QA-' || index, 'Close fixture ' || index, 3, 'Buyer ' || (index % 60) || ',,Buyer ' || ((index + 1) % 60),
      case when index % 2 = 0 then 1234.56 else 0 end, case when index % 2 = 1 then 2.34 else 0 end,
      origin, case when origin = 'claim_added' then 3 else 0 end, item, index
    from jsonb_to_recordset($1::jsonb) as x(id uuid, index integer, origin text, item uuid)`, [json, actor.businessId, claimId]);
  await db.query(`insert into audit_log (id, business_id, actor_user_id, action, entity_type, entity_id, after_data)
    select gen_random_uuid(), $2, $3, 'inventory.create_from_claim', 'inventory_item', item::text, jsonb_build_object('claimCardId', id::text)
    from jsonb_to_recordset($1::jsonb) as x(item uuid, id uuid, origin text) where origin = 'claim_added'`, [json, actor.businessId, actor.id]);
  return { db, actor, claimId, rows };
}

function instrument(db: PGlite, options: { fail?: RegExp; beforeTransaction?: () => Promise<void> } = {}) {
  const queries: string[] = [];
  const wrap = (connection: PGlite) => ({
    query: async (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (options.fail?.test(sql)) throw new Error("Injected close write failure");
      return connection.query(sql, params);
    }
  }) as unknown as PGlite;
  const measured = wrap(db);
  measured.transaction = async work => {
    await options.beforeTransaction?.();
    return db.transaction(tx => work(wrap(tx as unknown as PGlite) as unknown as typeof tx));
  };
  return { measured, queries };
}

test("423-card close batches writes and preserves order preview, partial slots, frees and stock", async t => {
  const { db, actor, claimId, rows } = await fixture(423);
  try {
    await db.query("update claim_cards set status='ignored' where id=$1", [rows[0].id]);
    await db.query("update claim_cards set buyer='' where id=$1", [rows[1].id]);
    await addClaimFree(db, { buyer: "Buyer 1,Only Free", finalName: "Prize QA", quantity: 2 }, actor);
    const preview = await previewActiveClaimOrders(db, actor);
    const { measured, queries } = instrument(db);
    const start = performance.now();
    const closed = await closeActiveClaim(measured, actor, claimId);
    t.diagnostic(`423 cards: ${queries.length} SQL queries, ${Math.round(performance.now() - start)}ms in isolated PGlite`);
    assert.ok(queries.length <= 35, `Expected batched close, received ${queries.length} queries`);
    assert.equal(queries.filter(sql => /left join pricecharting_image_cache pic/.test(sql)).length, 1);
    assert.equal(closed.activeClaim, null);
    assert.equal(closed.history[0].closedSaleIds.length, preview.buyers.length);
    const sales = (await db.query<{ id: string; customer_name: string; total_ars: number; total_usd: number; payment_due_at: string }>("select id, customer_name, total_ars, total_usd, payment_due_at::text from sales where channel='claim'")).rows;
    for (const buyer of preview.buyers) {
      const sale = sales.find(sale => sale.customer_name === buyer.buyer)!;
      assert.ok(sale);
      assert.equal(Number(sale.total_ars), Math.round(buyer.totalArs * 100) / 100);
      assert.equal(Number(sale.total_usd), Math.round(buyer.totalUsd * 100) / 100);
      assert.ok(String(sale.payment_due_at).includes("2026-10-20"));
      const lines = (await db.query<{ quantity: number; price_currency: string; inventory_item_id: string | null }>("select * from sale_items where sale_id=$1", [sale.id])).rows;
      assert.equal(lines.reduce((sum, line) => sum + Number(line.quantity), 0), buyer.units);
      for (const line of lines) assert.equal(Boolean(line.inventory_item_id), line.price_currency !== "FREE");
    }
    const quantities = (await db.query<{ id: string; quantity_on_hand: number; quantity_reserved: number }>("select * from inventory_items")).rows;
    for (const row of rows) {
      const stock = quantities.find(item => item.id === row.item)!;
      assert.equal(stock.quantity_on_hand, 3);
      assert.equal(stock.quantity_reserved, row.index < 2 ? 0 : 2);
    }
    const count = (await db.query<{ count: number }>("select count(*)::int as count from audit_log where action='claim.close'")).rows[0].count;
    assert.equal(count, 1);
    await Promise.all([closeActiveClaim(db, actor, claimId), closeActiveClaim(db, actor, claimId)]);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from sales")).rows[0].count, sales.length);
    const next = await createClaimSession(db, { name: "Next isolated claim" }, actor);
    await closeActiveClaim(db, actor, claimId);
    assert.equal((await listClaimsWorkspace(db, actor.businessId)).activeClaim!.id, next.activeClaim!.id);
    await assert.rejects(closeActiveClaim(db, { ...actor, businessId: crypto.randomUUID() }, claimId), /cerrado/);
    await assert.rejects(closeActiveClaim(db, actor, "invalid"), /valido/);
  } finally { await db.close(); }
});

test("close rollback leaves all orders, stock, reservations and claim unchanged on a later batch failure", async () => {
  const { db, actor, claimId } = await fixture(205);
  try {
    const snapshot = async () => JSON.stringify((await db.query("select id, quantity_on_hand, quantity_reserved from inventory_items order by id")).rows);
    const before = await snapshot();
    const { measured } = instrument(db, { fail: /insert into reservations/ });
    await assert.rejects(closeActiveClaim(measured, actor, claimId), /Injected/);
    assert.equal(await snapshot(), before);
    for (const table of ["sales", "sale_items", "reservations", "inventory_movements"]) {
      assert.equal((await db.query<{ count: number }>(`select count(*)::int as count from ${table}`)).rows[0].count, 0);
    }
    assert.equal((await listClaimsWorkspace(db, actor.businessId)).activeClaim!.id, claimId);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from audit_log where action='claim.close'")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("close builds its plan after taking the transaction lock and aggregates a shared inventory shortage", async () => {
  const { db, actor, claimId, rows } = await fixture(2);
  try {
    await db.query("update claim_cards set inventory_item_id=$1, stock_origin='existing' where claim_id=$2", [rows[0].item, claimId]);
    await db.query("update inventory_items set quantity_on_hand=1, quantity_reserved=1 where id=$1", [rows[0].item]);
    const { measured } = instrument(db, { beforeTransaction: async () => {
      await db.query("update claim_cards set final_price_ars=5000, final_price_usd=0 where claim_id=$1", [claimId]);
    } });
    await closeActiveClaim(measured, actor, claimId);
    const stock = (await db.query<{ quantity_on_hand: number; quantity_reserved: number }>("select * from inventory_items where id=$1", [rows[0].item])).rows[0];
    assert.equal(stock.quantity_on_hand, 5);
    assert.equal(stock.quantity_reserved, 5);
    const totals = (await db.query<{ total: number }>("select sum(total_ars) as total from sales where channel='claim'")).rows[0];
    assert.equal(Number(totals.total), 20000);
    const incoming = (await db.query<{ quantity: number }>("select sum(quantity_delta) as quantity from inventory_movements where movement_type='claim_stock_in'")).rows[0];
    assert.equal(Number(incoming.quantity), 4);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from audit_log where action='claim.close'")).rows[0].count, 1);
  } finally { await db.close(); }
});
