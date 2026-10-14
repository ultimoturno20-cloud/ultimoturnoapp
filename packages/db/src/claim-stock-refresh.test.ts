import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createOperationalDatabase, getDefaultOperationalUser, replacePriceChartingCache, createClaimSession,
  addPriceChartingCardsToClaim, updateClaimCard, getInventoryItem, addInventoryStock, type ClaimCardPatchInput
} from "./index.js";

async function fixture() {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-claim-refresh-")) });
  const actor = await getDefaultOperationalUser(db);
  await replacePriceChartingCache(db, { category: "pokemon-cards", sourceHash: "refresh-qa", rowsReceived: 1, rowsSkipped: 0, rows: [{
    priceChartingId: "refresh-qa", canonicalUrl: "", sourceUrl: "", productName: "Refresh QA", normalizedName: "refresh qa", expansionName: "QA", normalizedExpansion: "qa", cardNumber: "1", loosePriceUsd: 1, imageUrl: "", searchKey: "refresh qa"
  }] });
  await createClaimSession(db, { name: "Isolated refresh" }, actor);
  const workspace = await addPriceChartingCardsToClaim(db, ["refresh-qa"], actor);
  const cardId = workspace.cards[0].id;
  const inventoryItemId = (await db.query<{ inventory_item_id: string }>("select inventory_item_id from claim_cards where id=$1", [cardId])).rows[0].inventory_item_id;
  return { db, actor, cardId, inventoryItemId };
}

test("claim metadata updates skip stock refresh while preserving central stock and prices", async () => {
  const { db, actor, cardId, inventoryItemId } = await fixture();
  try {
    const before = await getInventoryItem(db, inventoryItemId, actor.businessId);
    await db.query("insert into stock_read_snapshots (business_id, payload, refreshed_at) values ($1, '{}'::jsonb, now())", [actor.businessId]);
    const snapshotDate = async () => (await db.query<{ date: string }>("select refreshed_at::text as date from stock_read_snapshots where business_id=$1", [actor.businessId])).rows[0].date;
    const cachedAt = await snapshotDate();
    const patches: ClaimCardPatchInput[] = [
      { finalPriceArs: 2500 }, { finalPriceUsd: 2.50 }, { buyer: "Buyer QA" },
      { tags: "QA tag" }, { finalName: "Final name QA" }, { status: "ready" }, { sectionId: "" }, { status: "ignored" }
    ];
    for (const patch of patches) {
      const result = await updateClaimCard(db, cardId, patch, actor);
      assert.equal(result.stockRefreshRequired, false, JSON.stringify(patch));
      assert.ok(result.activeClaim);
      assert.equal(result.cards.length, 1);
      assert.deepEqual(await getInventoryItem(db, inventoryItemId, actor.businessId), before);
      assert.equal(await snapshotDate(), cachedAt, "Metadata must not invalidate an unchanged stock snapshot");
    }
  } finally { await db.close(); }
});

test("claim quantity and image patches require stock refresh including no-op values", async () => {
  const { db, actor, cardId, inventoryItemId } = await fixture();
  try {
    await db.query("insert into stock_read_snapshots (business_id, payload, refreshed_at, refresh_started_at) values ($1, '{}'::jsonb, now(), now())", [actor.businessId]);
    const result = await updateClaimCard(db, cardId, { quantity: 3 }, actor);
    assert.equal(result.stockRefreshRequired, true);
    assert.equal(result.cards[0].quantity, 3);
    assert.match((await db.query<{ date: string }>("select refreshed_at::text as date from stock_read_snapshots where business_id=$1", [actor.businessId])).rows[0].date, /^1970-01-01/);
    assert.equal((await db.query<{ refresh_started_at: string | null }>("select refresh_started_at from stock_read_snapshots where business_id=$1", [actor.businessId])).rows[0].refresh_started_at, null);
    assert.equal((await getInventoryItem(db, inventoryItemId, actor.businessId))!.quantityOnHand, 3);
    assert.equal((await updateClaimCard(db, cardId, { quantity: 3 }, actor)).stockRefreshRequired, true);
    assert.equal((await updateClaimCard(db, cardId, { imageUrl: "https://image.example.test/qa.jpg" }, actor)).stockRefreshRequired, true);
    assert.equal((await getInventoryItem(db, inventoryItemId, actor.businessId))!.product.imageUrl, "https://image.example.test/qa.jpg");
  } finally { await db.close(); }
});

test("legacy stock repair during a buyer-only patch still requires refresh", async () => {
  const { db, actor, cardId } = await fixture();
  try {
    const existing = await addInventoryStock(db, { name: "Existing legacy QA", expansion: "QA", number: "2", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 5, priceArs: 3000 }, actor);
    await db.query("update claim_cards set inventory_item_id=$1, stock_origin='claim_added', stocked_quantity=2 where id=$2", [existing.id, cardId]);
    const result = await updateClaimCard(db, cardId, { buyer: "Legacy Buyer QA" }, actor);
    assert.equal(result.stockRefreshRequired, true);
    assert.equal((await getInventoryItem(db, existing.id, actor.businessId))!.quantityOnHand, 3);
    const state = (await db.query<{ stock_origin: string; stocked_quantity: number }>("select stock_origin, stocked_quantity from claim_cards where id=$1", [cardId])).rows[0];
    assert.equal(state.stock_origin, "existing");
    assert.equal(state.stocked_quantity, 0);
    assert.equal((await updateClaimCard(db, cardId, { buyer: "Legacy Buyer QA 2" }, actor)).stockRefreshRequired, false);
  } finally { await db.close(); }
});
