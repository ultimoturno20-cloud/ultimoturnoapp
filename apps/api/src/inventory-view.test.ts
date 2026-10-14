import assert from "node:assert/strict";
import { test } from "node:test";
import { inventoryView } from "./inventory-view.js";
import { defaultInventoryFilters, filterInventoryItems, type InventoryPage } from "@ultimoturno/domain";
import type { DbStockRow } from "@ultimoturno/db";
const rate = { buy: null, sell: 1540, source: "QA", updatedAt: "2026-10-14", fallback: false };
const rows = Array.from({ length: 1000 }, (_, index) => ({
  id: "item-" + index, ownerUserId: "", ownerName: "UltimoTurno", sku: "QA-" + index,
  location: "A", intakeBatch: "QA", inventoryStatus: "available", tags: "singles",
  quantityOnHand: 2, quantityReserved: 0, quantityAssigned: 0, freeQuantity: 2, availableQuantity: 2,
  priceArs: 1000 + index, priceUsd: 1, cardType: "pokemon", itemKind: "standard",
  businessId: "business-qa", active: true, purchaseCost: null, purchaseCurrency: "ARS", lastPurchaseArs: null,
  product: { id: "product-" + index, businessId: "business-qa", name: "Pikachu " + index, expansion: "QA", number: String(index), imageUrl: "qa.png", identifiers: [{ source: "pricecharting", externalId: String(index) }] },
  variant: { id: "variant-" + index, productId: "product-" + index, language: "EN", condition: "NM", finish: "normal" },
  priceReferences: { sale: { ars: 1000 + index, usd: 1 }, priceCharting: { usd: index / 10, priceChartingId: String(index), url: "" },
    tcgplayer: { usd: null, marketPriceUsd: 0.2, productId: "", url: "", subTypeName: "", lowPriceUsd: null, midPriceUsd: null, highPriceUsd: null, directLowPriceUsd: null },
    coolstuff: { usd: 1.99, url: "" } }
}) satisfies DbStockRow);
const summary = { totalSkus: 1000, totalUnits: 2000, reservedUnits: 0, availableUnits: 2000, stockValueArs: 2999000, collectionUnits: 0, collectionValueArs: 0, totalValueArs: 2999000 };
test("inventory pages traverse 1000 items exactly, with global totals and full export/IDs", t => {
  const expected = filterInventoryItems(rows, defaultInventoryFilters, rate.sell);
  const collected: string[] = [];
  for (let offset = 0; offset < 1000; offset += 24) {
    const page = inventoryView({ items: rows, summary }, rate, { offset, limit: 24 }) as InventoryPage<DbStockRow>;
    assert.ok(page.items.length <= 24);
    assert.deepEqual(page.summary, summary);
    assert.equal(page.metadata.availability.all, 1000);
    assert.equal(page.matchedTotal, 1000);
    collected.push(...page.items.map(i => i.id));
  }
  assert.deepEqual(collected, expected.map(i => i.id));
  const full = inventoryView({ items: rows, summary }, rate, { scope: "all" });
  const ids = inventoryView({ items: rows, summary }, rate, { scope: "ids" });
  assert.ok("items" in full && "ids" in ids);
  assert.deepEqual(full.items, expected);
  assert.deepEqual(ids.ids, collected);
  const page = inventoryView({ items: rows, summary }, rate, { limit: 24 });
  const oldBytes = Buffer.byteLength(JSON.stringify({ items: rows, summary })), pageBytes = Buffer.byteLength(JSON.stringify(page));
  assert.ok(pageBytes < oldBytes / 10);
  t.diagnostic(JSON.stringify({ fixture: 1000, oldBytes, pageBytes, scope: "synthetic payload, not production latency or cold SQL" }));
});
test("inventory filtered pages keep global quality/facets and restart-compatible revision", () => {
  const stock = { items: rows, summary };
  const full = inventoryView(stock, rate, { query: "pikachu", scope: "all", sortMode: "price" });
  const page = inventoryView(stock, rate, { query: "pikachu", limit: 96, offset: 99999, sortMode: "price" }) as InventoryPage<DbStockRow>;
  assert.ok(full.items);
  assert.deepEqual(page.items, full.items.slice(960));
  assert.equal(page.metadata.quality.lowStock, 0);
  assert.equal(page.total, 1000);
  const next = inventoryView({ ...stock, items: rows.map((i, n) => n === 0 ? { ...i, priceArs: 99 } : i) }, rate, {});
  assert.notEqual(page.revision, next.revision);
  assert.notEqual(page.revision, inventoryView(stock, { ...rate, sell: 1600 }, {}).revision);
  const empty = inventoryView(stock, rate, { query: "no-such-card", offset: 9999 }) as InventoryPage<DbStockRow>;
  assert.equal(empty.offset, 0); assert.deepEqual(empty.items, []);
  assert.equal(empty.metadata.availability.all, 1000);
});
