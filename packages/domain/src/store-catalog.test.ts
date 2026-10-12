import assert from "node:assert/strict";
import { it } from "node:test";
import { defaultStoreCatalogQuery, normalizeStoreCatalogQuery, resolveStoreCategory, storeCatalogPage, type StoreCatalogItem } from "./store-catalog.js";

const item = (n: number): StoreCatalogItem => ({ id: String(n), name: `Pokemon ${n}`, expansion: "151", number: String(n), imageUrl: "", language: "EN", condition: "NM", finish: "normal", gradingCompany: "", grade: "", cardType: "pokemon", category: "singles", itemKind: "standard", priceArs: n * 100, availableQuantity: 1 });

it("normalizes only public filters and bounds pagination and search", () => {
  assert.deepEqual(normalizeStoreCatalogQuery({ query: "  Mew  ", sort: "price_desc", offset: "36", businessId: "private" } as never), { ...defaultStoreCatalogQuery, query: "Mew", sort: "price_desc", offset: 36 });
  for (const offset of [-1, 1.5, Infinity, "bad", 100001]) assert.equal(normalizeStoreCatalogQuery({ offset }).offset, 0);
  assert.deepEqual(normalizeStoreCatalogQuery({ query: "x".repeat(121), sort: "private", language: 123 }), defaultStoreCatalogQuery);
});

it("resolves product categories from explicit inventory tags without guessing from names", () => {
  const base = { itemKind: "standard", cardType: "unknown", number: "", tags: [] as string[] };
  assert.equal(resolveStoreCategory(base), "other");
  for (const [tag, category] of [["singles", "singles"], [" Sellado ", "sealed"], ["ACCESORIOS", "accessories"], ["otros", "other"]]) assert.equal(resolveStoreCategory({ ...base, tags: [tag] }), category);
  assert.equal(resolveStoreCategory({ ...base, tags: ["sellado", "accesorios"] }), "other");
  assert.equal(resolveStoreCategory({ ...base, tags: ["sellado", "sellado", "vitrina"] }), "sealed");
  assert.equal(resolveStoreCategory({ ...base, number: "001/165" }), "singles");
  assert.equal(resolveStoreCategory({ ...base, cardType: "tool" }), "singles");
  assert.equal(resolveStoreCategory({ ...base, cardType: "pokemon", tags: ["sellado"] }), "sealed");
  assert.equal(resolveStoreCategory({ ...base, itemKind: "folder", cardType: "pokemon", number: "151", tags: ["singles"] }), "other");
});

it("validates categories and scopes legacy card-type filters to Singles", () => {
  assert.equal(normalizeStoreCatalogQuery({ category: "private" }).category, "all");
  assert.equal(normalizeStoreCatalogQuery({ cardType: "supporter" }).category, "singles");
  const sealed = normalizeStoreCatalogQuery({ category: "sealed", cardType: "supporter" });
  assert.equal(sealed.category, "sealed");
  assert.equal(sealed.cardType, "all");
});

it("filters product categories before counting, sorting and pagination", () => {
  const items: StoreCatalogItem[] = Array.from({ length: 80 }, (_, n) => ({ ...item(n + 1), category: n % 2 ? "sealed" : "singles" }));
  const page = storeCatalogPage(items, { category: "sealed", offset: 36, sort: "price_desc" });
  assert.equal(page.total, 40);
  assert.equal(page.items.length, 4);
  assert.ok(page.items.every(item => item.category === "sealed"));
  assert.equal(storeCatalogPage(items, { category: "accessories" }).total, 0);
  assert.deepEqual(storeCatalogPage([item(1), { ...item(2), category: "sealed", cardType: "unknown" }], {}).facets.cardTypes, ["pokemon"]);
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
