import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultInventoryFilters, filterInventoryItems, inventoryMetadata, inventoryPriceValue, inventoryRequestPath, normalizeInventoryQuery, type InventoryQueryItem } from "./inventory-query.js";
export function item(index: number, patch: Partial<InventoryQueryItem> = {}): InventoryQueryItem {
  return {
    id: "item-" + index, ownerUserId: "", ownerName: "UltimoTurno", sku: "QA-" + index,
    location: "A", intakeBatch: "Lote", inventoryStatus: "available", tags: "singles, jugables",
    quantityOnHand: 2, quantityReserved: 0, quantityAssigned: 0, freeQuantity: 2, availableQuantity: 2,
    priceArs: 1000 + index, priceUsd: 1, cardType: "pokemon", itemKind: "card",
    product: { name: "Pikachu " + index, expansion: "QA", number: String(index).padStart(3, "0"), imageUrl: "qa.png", identifiers: [{ source: "pricecharting", externalId: String(index) }] },
    variant: { language: "EN", condition: "NM", finish: "normal" },
    priceReferences: { priceCharting: { usd: index / 10 }, tcgplayer: { usd: null, marketPriceUsd: 0.2 }, coolstuff: { usd: 1.99 } },
    ...patch
  };
}
test("inventory query round trips every filter and rejects invalid controls", () => {
  const filters = { ...defaultInventoryFilters, query: "Boss's Orders #025", tag: "full art", owner: "abc", languageGroup: "japanese" as const, sortMode: "price" as const };
  const path = inventoryRequestPath(filters, 96, 48, "all");
  assert.deepEqual(normalizeInventoryQuery(Object.fromEntries(new URL(path, "https://qa.invalid").searchParams)), { filters, offset: 96, limit: 48, scope: "all" });
  for (const invalid of [{ limit: 101 }, { offset: -1 }, { offset: 1.5 }, { scope: "wrong" }, { availability: "none" }, { query: "x".repeat(301) }, { cardType: "bad" }, { query: "x\0y" }]) assert.throws(() => normalizeInventoryQuery(invalid), /invalidos/);
});
test("inventory preserves numbered search, accent/plural ranking and out-of-stock search behavior", () => {
  const rows = [item(25, { quantityOnHand: 0, product: { ...item(25).product, name: "Boss's Orders" } }), item(26, { product: { ...item(26).product, name: "Boss Order" } }), item(3)];
  assert.equal(filterInventoryItems(rows, defaultInventoryFilters, 1540).length, 2);
  assert.deepEqual(filterInventoryItems(rows, { ...defaultInventoryFilters, query: "boss orders 025" }, 1540).map(i => i.id), ["item-25"]);
  assert.deepEqual(filterInventoryItems(rows, { ...defaultInventoryFilters, query: "bóss" }, 1540).map(i => i.id), ["item-26", "item-25"]);
});
test("inventory filters owners, variants, quality, folders and global facets independently", () => {
  const original = item(1);
  const duplicate = { ...original, id: "duplicate" };
  const owned = item(2, { ownerUserId: "owner", ownerName: "Dueño", location: "B", tags: "promo", variant: { language: "JA", condition: "LP", finish: "reverse holo", grade: "10" } });
  const folder = item(3, { itemKind: "folder", inventoryStatus: "not_for_sale", folder: { valueUsd: 100, totalCards: 370 }, freeQuantity: 0, availableQuantity: 0 });
  const rows = [original, duplicate, owned, folder];
  const metadata = inventoryMetadata(rows, 1540);
  assert.equal(metadata.quality.duplicates, 2);
  assert.deepEqual(metadata.options.locations, ["A", "B"]);
  assert.equal(metadata.availability.all, 4);
  assert.deepEqual(metadata.owners, [{ userId: "owner", name: "Dueño" }]);
  assert.deepEqual(filterInventoryItems(rows, { ...defaultInventoryFilters, issue: "duplicates" }, 1540).map(i => i.id), ["item-1", "duplicate"]);
  assert.deepEqual(filterInventoryItems(rows, { ...defaultInventoryFilters, owner: "owner", languageGroup: "japanese", condition: "LP", tag: "promo", location: "B" }, 1540), [owned]);
  assert.equal(filterInventoryItems(rows, { ...defaultInventoryFilters, cardType: "pokemon" }, 1540).length, 3);
  assert.deepEqual(filterInventoryItems(rows, { ...defaultInventoryFilters, inventoryStatus: "not_for_sale" }, 1540), [folder]);
});
test("inventory price sorting preserves provider policies, folder content and USD-only fallback", () => {
  const folder = item(2, { itemKind: "folder", inventoryStatus: "not_for_sale", folder: { valueUsd: 10, totalCards: 2 } });
  assert.deepEqual(inventoryPriceValue(folder, "sale", 1540), { ars: 15400, usd: 10, hasPrice: true });
  assert.equal(inventoryPriceValue(item(1), "tcgplayer", 1540).ars, 800);
  assert.equal(inventoryPriceValue(item(1), "coolstuff", 1540).ars, 1.99 * 1540);
  const onlyUsd = item(3, { priceArs: 0, priceUsd: 20 });
  assert.equal(filterInventoryItems([folder, onlyUsd], { ...defaultInventoryFilters, sortMode: "price" }, 1540)[0].id, onlyUsd.id);
});
