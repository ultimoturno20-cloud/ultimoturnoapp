import assert from "node:assert/strict";
import { it } from "node:test";
import { defaultStoreCatalogQuery } from "@ultimoturno/domain";
import { activeStoreFilters, matchingStoreExpansions, storeLanguageLabel } from "../src/storefront-filters.js";

it("lists only active public filters, not sorting, offset or all", () => {
  assert.deepEqual(activeStoreFilters({ ...defaultStoreCatalogQuery, sort: "price_desc", offset: 36 }), []);
  assert.deepEqual(activeStoreFilters({ ...defaultStoreCatalogQuery, query: "Mew", expansion: "151", language: "JP", condition: "NM", cardType: "tool" }), [
    { field: "query", label: "Mew" }, { field: "expansion", label: "151" }, { field: "language", label: "Japones" }, { field: "condition", label: "NM" }, { field: "cardType", label: "Tool" }
  ]);
});

it("retains unfamiliar variant labels rather than silently changing their filters", () => {
  assert.equal(storeLanguageLabel("CUSTOM"), "CUSTOM");
  assert.deepEqual(activeStoreFilters({ ...defaultStoreCatalogQuery, cardType: "future", language: "CUSTOM" }), [{ field: "language", label: "CUSTOM" }, { field: "cardType", label: "future" }]);
});

it("searches expansion names case and accent insensitively without changing their identities", () => {
  const names = ["Pok\u00e9mon 151", "Mega Evolution", "Promo"];
  assert.deepEqual(matchingStoreExpansions(names, " POKEMON "), ["Pok\u00e9mon 151"]);
  assert.deepEqual(matchingStoreExpansions(names, ""), names);
  assert.deepEqual(matchingStoreExpansions(names, "missing"), []);
});
