import test from "node:test";
import assert from "node:assert/strict";
import { readInventoryPagePosition, writeInventoryPagePosition } from "../src/inventory-page-position.js";

function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("inventory page survives reload only in its account and current filter", () => {
  const memory = storage();
  const position = { filterKey: "filter-a", offset: 96, limit: 48 };
  writeInventoryPagePosition(memory, "business:user", position);
  assert.deepEqual(readInventoryPagePosition(memory, "business:user", "filter-a"), position);
  assert.deepEqual(readInventoryPagePosition(memory, "business:other", "filter-a"), { filterKey: "filter-a", offset: 0, limit: 24 });
  assert.deepEqual(readInventoryPagePosition(memory, "business:user", "filter-b"), { filterKey: "filter-b", offset: 0, limit: 48 });
});

test("inventory page position does not persist an anonymous session or unknown payloads", () => {
  const memory = storage();
  writeInventoryPagePosition(memory, "", { filterKey: "a", offset: 24, limit: 24 });
  assert.equal(memory.getItem(":page:v1"), null);
  writeInventoryPagePosition(memory, "u", { filterKey: "a", offset: 24, limit: 24, cart: ["private"] } as never);
  assert.equal(memory.getItem("u:page:v1")!.includes("private"), false);
});

test("invalid persisted page state fails closed without breaking inventory", () => {
  const memory = storage();
  const fallback = { filterKey: "a", offset: 0, limit: 24 };
  for (const raw of ["broken", "null", "[]", '{"version":2}', "x".repeat(10_001), JSON.stringify({ version: 1, filterKey: "a", limit: 100, offset: 100 })]) {
    memory.setItem("u:page:v1", raw);
    assert.deepEqual(readInventoryPagePosition(memory, "u", "a"), fallback);
  }
  for (const offset of [-24, 1.5, 25, "24", Number.MAX_SAFE_INTEGER + 1]) {
    memory.setItem("u:page:v1", JSON.stringify({ version: 1, filterKey: "a", limit: 24, offset }));
    assert.deepEqual(readInventoryPagePosition(memory, "u", "a"), fallback);
  }
});

test("blocked or absent browser storage does not interrupt navigation", () => {
  const blocked = { getItem() { throw Error("denied"); }, setItem() { throw Error("quota"); } };
  for (const memory of [undefined, blocked]) {
    const position = { filterKey: "a", offset: 0, limit: 24 };
    assert.deepEqual(readInventoryPagePosition(memory, "u", "a"), position);
    assert.doesNotThrow(() => writeInventoryPagePosition(memory, "u", position));
  }
});
