import assert from "node:assert/strict";
import { it } from "node:test";
import { defaultStoreCatalogQuery, normalizeStoreCatalogQuery, storeCatalogPage, type StoreCatalogItem } from "./store-catalog.js";

const item = (n: number): StoreCatalogItem => ({ id: String(n), name: `Pokemon ${n}`, expansion: "151", number: String(n), imageUrl: "", language: "EN", condition: "NM", finish: "normal", gradingCompany: "", grade: "", cardType: "pokemon", itemKind: "standard", priceArs: n * 100, availableQuantity: 1 });

it("normalizes only public filters and bounds pagination and search", () => {
  assert.deepEqual(normalizeStoreCatalogQuery({ query: "  Mew  ", sort: "price_desc", offset: "36", businessId: "private" } as never), { ...defaultStoreCatalogQuery, query: "Mew", sort: "price_desc", offset: 36 });
  for (const offset of [-1, 1.5, Infinity, "bad", 100001]) assert.equal(normalizeStoreCatalogQuery({ offset }).offset, 0);
  assert.deepEqual(normalizeStoreCatalogQuery({ query: "x".repeat(121), sort: "private", language: 123 }), defaultStoreCatalogQuery);
});

it("searches accented tokens, combines filters and sorts without mutating input", () => {
  const items = [item(3), item(1), { ...item(2), name: "Pok\u00e9mon Mew", language: "JP", cardType: "supporter" }];
  assert.deepEqual(storeCatalogPage(items, { query: "pokemon mew 151", language: "JP", cardType: "supporter" }).items.map(i => i.id), ["2"]);
  assert.deepEqual(storeCatalogPage(items, { sort: "price_asc" }).items.map(i => i.id), ["1", "2", "3"]);
  assert.deepEqual(storeCatalogPage(items, { sort: "price_desc" }).items.map(i => i.id), ["3", "2", "1"]);
  assert.deepEqual(items.map(i => i.id), ["3", "1", "2"]);
});

it("paginates at 36 and retains facets across filtered pages", () => {
  const items = Array.from({ length: 40 }, (_, n) => item(n + 1));
  items[39] = { ...items[39], language: "JP", expansion: "Promo" };
  const page = storeCatalogPage(items, { offset: 36 });
  assert.equal(page.total, 40);
  assert.equal(page.pageSize, 36);
  assert.equal(page.items.length, 4);
  assert.deepEqual(storeCatalogPage(items, { language: "EN" }).facets.languages, ["EN", "JP"]);
  assert.equal(storeCatalogPage(items, { offset: 72 }).items.length, 0);
});
