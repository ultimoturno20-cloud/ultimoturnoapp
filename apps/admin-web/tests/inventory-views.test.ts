import test from "node:test";
import assert from "node:assert/strict";
import { defaultInventoryFilters, emptyInventoryPreferences, inventoryPreferencesKey, inventoryPresets, inventoryStatesEqual, maxInventoryViews, normalizeInventoryState, readInventoryPreferences, writeInventoryPreferences, type SavedInventoryView } from "../src/inventory-views.js";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
const view: SavedInventoryView = { id: "custom-test", name: "151 ingles", filters: { ...defaultInventoryFilters, query: "151", languageGroup: "english", sortMode: "price" }, density: "compact" };

test("inventory preferences are isolated by business and user, never anonymous", () => {
  assert.equal(inventoryPreferencesKey("", "user"), "");
  assert.equal(inventoryPreferencesKey("business", ""), "");
  const keys = [inventoryPreferencesKey("b", "u"), inventoryPreferencesKey("b", "other"), inventoryPreferencesKey("other", "u"), inventoryPreferencesKey("a:b", "c"), inventoryPreferencesKey("a", "b:c")];
  assert.equal(new Set(keys).size, keys.length);
  const storage = memoryStorage();
  writeInventoryPreferences(storage, keys[0], { current: view, views: [view] });
  assert.equal(readInventoryPreferences(storage, keys[1]).views.length, 0);
  assert.equal(readInventoryPreferences(storage, keys[2]).current.filters.query, "");
});
test("current filters and named views preserve each other across updates", () => {
  const storage = memoryStorage();
  assert.equal(writeInventoryPreferences(storage, "key", { views: [view] }), true);
  writeInventoryPreferences(storage, "key", { current: view });
  assert.deepEqual(readInventoryPreferences(storage, "key").views, [view]);
  assert.deepEqual(readInventoryPreferences(storage, "key").current, { filters: view.filters, density: view.density });
  writeInventoryPreferences(storage, "key", { views: [] });
  assert.equal(readInventoryPreferences(storage, "key").current.filters.query, "151");
  assert.equal(readInventoryPreferences(storage, "key").views.length, 0);
});
test("invalid, future and oversized preferences fail closed to defaults", () => {
  const storage = memoryStorage();
  for (const raw of ["{broken", "null", '[]', '{"version":2}', " ".repeat(100_001)]) {
    storage.setItem("key", raw);
    assert.deepEqual(readInventoryPreferences(storage, "key"), emptyInventoryPreferences());
  }
});
test("known fields are restored and invalid enum, oversized strings and secret payloads are dropped", () => {
  const state = normalizeInventoryState({ filters: { ...view.filters, availability: "invalid", cardType: "javascript", query: "x".repeat(301), authToken: "secret", inventoryItemId: "item" }, density: "invalid", cart: [{ quantity: 100 }] });
  assert.equal(state.filters.availability, "in_stock");
  assert.equal(state.filters.cardType, "all");
  assert.equal(state.filters.query, "");
  assert.equal(state.density, "comfortable");
  assert.equal(JSON.stringify(state).includes("secret"), false);
  assert.equal(JSON.stringify(state).includes("quantity"), false);
  assert.equal(state.filters.languageGroup, "english");
  const storage = memoryStorage();
  writeInventoryPreferences(storage, "key", { current: { ...view, authToken: "secret", cart: [{ quantity: 100 }] } as typeof view });
  assert.equal(storage.getItem("key")!.includes("secret"), false);
  assert.equal(storage.getItem("key")!.includes('"cart"'), false);
});
test("saved view list has bounds, trims names and rejects duplicate or invalid identities", () => {
  const storage = memoryStorage();
  storage.setItem("key", JSON.stringify({ version: 1, current: view, views: [view, { ...view, id: "custom-other", name: " 151 INGLES " }, { ...view, id: "stock", name: "Invalid" }, ...Array.from({ length: 40 }, (_, index) => ({ ...view, id: `custom-${index}`, name: `Vista ${index}` }))] }));
  const views = readInventoryPreferences(storage, "key").views;
  assert.equal(views.length, maxInventoryViews);
  assert.equal(views.filter((entry) => entry.name.toLowerCase() === "151 ingles").length, 1);
  assert.equal(views.some((entry) => entry.id === "stock"), false);
});
test("unavailable or full storage does not crash and reports write failure", () => {
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  assert.deepEqual(readInventoryPreferences(blocked, "key"), emptyInventoryPreferences());
  assert.equal(writeInventoryPreferences(blocked, "key", { views: [view] }), false);
  assert.equal(writeInventoryPreferences(undefined, "key", { views: [view] }), false);
  assert.equal(writeInventoryPreferences(memoryStorage(), "", { views: [view] }), false);
});
test("presets fully reset hidden filters and collection uses the existing no sale status", () => {
  const collection = inventoryPresets.find((entry) => entry.id === "collection")!;
  assert.equal(collection.filters.inventoryStatus, "not_for_sale");
  assert.equal(collection.filters.availability, "in_stock");
  assert.equal(collection.filters.query, "");
  assert.deepEqual(Object.keys(collection.filters).sort(), Object.keys(defaultInventoryFilters).sort());
});
test("matching a saved view compares all filters and density independent of key order", () => {
  assert.equal(inventoryStatesEqual(view, { filters: { ...view.filters }, density: "compact" }), true);
  assert.equal(inventoryStatesEqual(view, { filters: { ...view.filters, owner: "different" }, density: "compact" }), false);
  assert.equal(inventoryStatesEqual(view, { filters: view.filters, density: "comfortable" }), false);
});
