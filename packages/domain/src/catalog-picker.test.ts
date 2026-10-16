import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeCatalogPickerEntries, normalizeIntakeSearchQuery, cleanCatalogPickerName, cleanCatalogPickerExpansion, type CatalogPickerEntry } from "./catalog-picker.js";
const entry = (id: string, patch: Partial<CatalogPickerEntry> = {}): CatalogPickerEntry => ({ priceChartingId: id, canonicalUrl: "", sourceUrl: "", productName: "Pikachu", expansionName: "ME: QA", cardNumber: "001/165", languageGroup: "english", language: "EN", finish: "normal", loosePriceUsd: 1, imageUrl: "", importedAt: "", ...patch });
test("catalog picker preserves primary ordering, reference deduplication and distinct variants", () => {
  const pc = entry("pc"), tcg = entry("tcgcsv-1", { loosePriceUsd: null }), reverse = entry("tcgcsv-2", { loosePriceUsd: null, finish: "reverse holo" });
  assert.deepEqual(mergeCatalogPickerEntries([tcg, pc, reverse], [pc], 30).map(e => e.priceChartingId), ["pc", "tcgcsv-2"]);
  assert.equal(mergeCatalogPickerEntries([], [pc, pc, entry("other")], 1).length, 1);
  assert.equal(cleanCatalogPickerName(entry("a", { productName: "Pikachu - 001/165" })), "Pikachu");
  assert.equal(cleanCatalogPickerExpansion(pc), "QA");
  assert.deepEqual(normalizeIntakeSearchQuery({ query: "  pikachu  ", languageGroup: "japanese" }), { query: "pikachu", languageGroup: "japanese" });
  for (const input of [{ query: "a" }, { query: "x".repeat(161) }, { query: ["pikachu"] }, { query: "pikachu", languageGroup: ["english"] }]) assert.throws(() => normalizeIntakeSearchQuery(input), { statusCode: 400 });
});
