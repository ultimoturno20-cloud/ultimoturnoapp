import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it, type TestContext } from "node:test";
import {
  assignResellerStockBatch, createOperationalDatabase, createReseller,
  createResellerStockRequestBatch, getDefaultOperationalUser, getResellerDashboard,
  resolveResellerStockRequestBatch, updateResellerCreditLimit, upsertInventoryItem,
  createResellerSale, type AuthenticatedUser
} from "./index.js";

async function fixture(t: TestContext) {
  const db = await createOperationalDatabase({ dataDir: await mkdtemp(path.join(tmpdir(), "ultimoturno-reseller-batch-")) });
  t.after(() => db.close());
  const admin = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
  const reseller = await createReseller(db, { displayName: "Lotes", email: "lotes@test.local", password: "local-test-only", commissionPercent: 20 }, admin);
  const actor: AuthenticatedUser = { ...admin, id: reseller.reseller.userId, roles: ["reseller"] };
  const cards = [];
  for (let n = 1; n <= 3; n++) cards.push(await upsertInventoryItem(db, { sku: `BATCH-${n}`, name: `Carta ${n}`, expansion: "Test", number: String(n), language: "EN", condition: "NM", finish: "normal", quantityOnHand: 6, quantityReserved: 1, priceArs: 1000 }, admin));
  return { db, admin, actor, cards, target: actor.id };
}

it("assigns a batch once, canonicalizes its order and never changes central quantities", async (t) => {
  const { db, admin, target, cards } = await fixture(t);
  const input = { idempotencyKey: crypto.randomUUID(), lines: cards.slice(0, 2).map((card) => ({ inventoryItemId: card.id, quantity: 2 })) };
  const first = await assignResellerStockBatch(db, target, input, admin);
  assert.equal(first.processedCount, 2);
  assert.equal(first.dashboard.summary.remainingUnits, 4);
  assert.equal(first.replayed, false);
  const replay = await assignResellerStockBatch(db, target, { ...input, lines: [...input.lines].reverse() }, admin);
  assert.equal(replay.replayed, true);
  assert.equal(replay.dashboard.summary.remainingUnits, 4);
  await assert.rejects(() => assignResellerStockBatch(db, target, { ...input, lines: [{ ...input.lines[0], quantity: 3 }] }, admin), /otro lote/);
  const stock = await db.query<{ quantity_on_hand: number; quantity_reserved: number }>("select quantity_on_hand, quantity_reserved from inventory_items where business_id = $1", [admin.businessId]);
  assert.ok(stock.rows.every((card) => card.quantity_on_hand === 6 && card.quantity_reserved === 1));
  assert.equal((await db.query("select * from reseller_stock_events")).rows.length, 2);
});

it("rolls back all batch lines and the receipt on unavailable stock or accumulated credit", async (t) => {
  const { db, admin, target, cards, actor } = await fixture(t);
  const input = { idempotencyKey: crypto.randomUUID(), lines: [{ inventoryItemId: cards[0].id, quantity: 1 }, { inventoryItemId: cards[1].id, quantity: 6 }] };
  await assert.rejects(() => assignResellerStockBatch(db, target, input, admin), /unidades libres/);
  assert.equal((await getResellerDashboard(db, target, admin.businessId)).summary.remainingUnits, 0);
  assert.equal((await db.query("select * from reseller_batch_receipts")).rows.length, 0);
  await updateResellerCreditLimit(db, target, 1500, admin);
  const lines = cards.slice(0, 2).map((card) => ({ inventoryItemId: card.id, quantity: 1 }));
  await assert.rejects(() => createResellerStockRequestBatch(db, { idempotencyKey: crypto.randomUUID(), lines }, actor), /limite/);
  assert.equal((await getResellerDashboard(db, target, admin.businessId)).stockRequests.length, 0);
  await assert.rejects(() => assignResellerStockBatch(db, target, { idempotencyKey: crypto.randomUUID(), lines }, admin), /limite/);
  assert.equal((await db.query("select * from reseller_stock_events")).rows.length, 0);
  await updateResellerCreditLimit(db, target, 4000, admin);
  const requested = await createResellerStockRequestBatch(db, { ...input, lines }, actor);
  assert.equal(requested.dashboard.stockRequests.length, 2);
  assert.equal(requested.dashboard.summary.pendingRequestValueArs, 2000);
  const updated = await createResellerStockRequestBatch(db, { idempotencyKey: crypto.randomUUID(), lines: [{ inventoryItemId: cards[0].id, quantity: 2 }] }, actor);
  assert.equal(updated.dashboard.stockRequests.length, 2);
  assert.equal(updated.dashboard.summary.pendingRequestValueArs, 3000);
});

it("approves only selected requests with partial quantities and rejects batches atomically", async (t) => {
  const { db, admin, actor, target, cards } = await fixture(t);
  const requested = await createResellerStockRequestBatch(db, { idempotencyKey: crypto.randomUUID(), lines: cards.map((card) => ({ inventoryItemId: card.id, quantity: 3 })) }, actor);
  const requests = requested.dashboard.stockRequests;
  const selected = requests[0];
  const approval = { idempotencyKey: crypto.randomUUID(), action: "approve" as const, lines: [{ requestId: selected.id, quantity: 1, priceArs: 1200 }] };
  const result = await resolveResellerStockRequestBatch(db, target, approval, admin);
  assert.equal(result.dashboard.stockRequests.length, 2);
  assert.equal(result.dashboard.summary.remainingUnits, 1);
  assert.equal(result.dashboard.assignments[0].priceArs, 1200);
  assert.equal((await resolveResellerStockRequestBatch(db, target, approval, admin)).replayed, true);
  const pending = result.dashboard.stockRequests;
  await assert.rejects(() => resolveResellerStockRequestBatch(db, target, { idempotencyKey: crypto.randomUUID(), action: "approve", lines: pending.map((request, n) => ({ requestId: request.id, quantity: n ? 4 : 1, priceArs: 1100 })) }, admin), /mas unidades/);
  assert.equal((await getResellerDashboard(db, target, admin.businessId)).stockRequests.length, 2);
  assert.equal((await getResellerDashboard(db, target, admin.businessId)).summary.remainingUnits, 1);
  const other = await createReseller(db, { displayName: "Otro", email: "otro@test.local", password: "local-test-only", commissionPercent: 20 }, admin);
  await assert.rejects(() => resolveResellerStockRequestBatch(db, other.reseller.userId, { idempotencyKey: crypto.randomUUID(), action: "reject", lines: pending.map((request) => ({ requestId: request.id })) }, admin), /no pertenece/);
  const rejected = await resolveResellerStockRequestBatch(db, target, { idempotencyKey: crypto.randomUUID(), action: "reject", lines: pending.map((request) => ({ requestId: request.id })) }, admin);
  assert.equal(rejected.dashboard.stockRequests.length, 0);
  assert.equal(rejected.dashboard.summary.remainingUnits, 1);
});

it("validates roles, ownership, business, duplicates and No venta for existing assignments", async (t) => {
  const { db, admin, actor, target, cards } = await fixture(t);
  const lines = [{ inventoryItemId: cards[0].id, quantity: 1 }];
  const input = { idempotencyKey: crypto.randomUUID(), lines };
  await assert.rejects(() => assignResellerStockBatch(db, target, input, actor), /No podes/);
  await assert.rejects(() => assignResellerStockBatch(db, target, { ...input, lines: [...lines, ...lines] }, admin), /repetirse/);
  await assert.rejects(() => assignResellerStockBatch(db, target, { ...input, lines: [{ ...lines[0], quantity: 0 }] }, admin), /entero positivo/);
  await assert.rejects(() => assignResellerStockBatch(db, target, input, { ...admin, businessId: crypto.randomUUID() }), /no encontrado/);
  await assert.rejects(() => assignResellerStockBatch(db, target, input, { ...actor, roles: ["stock_owner"] }), /otro propietario/);
  await db.query("update inventory_items set owner_user_id = $1 where id = $2", [actor.id, cards[0].id]);
  await assignResellerStockBatch(db, target, input, { ...actor, roles: ["stock_owner"] });
  await db.query("update inventory_items set inventory_status = 'not_for_sale' where id = $1", [cards[0].id]);
  const dashboard = await getResellerDashboard(db, target, admin.businessId);
  assert.equal(dashboard.assignments[0].remaining, 1);
  assert.equal(dashboard.assignments[0].sellable, 0);
  await assert.rejects(() => createResellerStockRequestBatch(db, { ...input, idempotencyKey: crypto.randomUUID() }, actor), /No venta/);
  await assert.rejects(() => assignResellerStockBatch(db, target, { ...input, idempotencyKey: crypto.randomUUID() }, admin), /No venta/);
  await assert.rejects(() => createResellerSale(db, { lines: [{ inventoryItemId: cards[0].id, quantity: 1, unitPriceArs: 1000 }] }, actor), /No venta/);
  assert.equal((await db.query("select * from reseller_sales")).rows.length, 0);
});
