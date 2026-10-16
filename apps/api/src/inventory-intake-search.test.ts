import assert from "node:assert/strict";
import { test } from "node:test";
import { inventoryIntakeSearch } from "./inventory-intake-search.js";
import type { CatalogPickerEntry } from "@ultimoturno/domain";
const entry = (id: string): CatalogPickerEntry => ({ priceChartingId: id, canonicalUrl: "", sourceUrl: "", productName: id, expansionName: "QA", cardNumber: "1", languageGroup: "english", loosePriceUsd: 1, imageUrl: "", importedAt: "" });
test("intake combines the previous catalog-first scope and shows partial failure explicitly", async () => {
  const catalog = [entry("primary")], local = Array.from({ length: 60 }, (_, i) => entry("local-" + i));
  assert.equal((await inventoryIntakeSearch(async () => ({ entries: catalog }), async () => local)).entries.length, 30);
  const noCatalog = await inventoryIntakeSearch(async () => { throw new Error("provider down"); }, async () => local);
  assert.deepEqual(noCatalog.entries, local); assert.match(noCatalog.warning!, /catalogo/);
  const noLocal = await inventoryIntakeSearch(async () => ({ entries: catalog }), async () => { throw new Error("local down"); });
  assert.deepEqual(noLocal.entries, catalog); assert.match(noLocal.warning!, /inventario local/);
  await assert.rejects(inventoryIntakeSearch(async () => { throw Error("provider"); }, async () => { throw Error("local"); }), /No se pudo buscar/);
});
