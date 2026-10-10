import test from "node:test";
import assert from "node:assert/strict";
import { defaultOperationalPreferences, normalizeOperationalPreferences, readOperationalPreferences, writeOperationalPreferences, orderMatchesOperationalView, matchesOperationalPeriod } from "../src/operational-preferences.js";

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("operational preferences isolate users and sections without storing drafts", () => {
  const storage = memoryStorage();
  writeOperationalPreferences(storage, "business:user", "orders", { ...defaultOperationalPreferences.orders, query: "151", view: "to_pack" });
  assert.equal(readOperationalPreferences(storage, "business:user", "orders").query, "151");
  assert.equal(readOperationalPreferences(storage, "business:other", "orders").query, "");
  assert.equal(readOperationalPreferences(storage, "other:user", "orders").query, "");
  assert.equal(readOperationalPreferences(storage, "business:user", "purchases").query, "");
  assert.equal(writeOperationalPreferences(storage, "", "cash", defaultOperationalPreferences.cash), false);
  const state = normalizeOperationalPreferences("purchases", { query: "Pikachu", mode: "low", token: "secret", cart: [{ quantity: 1 }], seller: "private" });
  assert.deepEqual(state, { query: "Pikachu", mode: "low" });
});

test("invalid preferences and storage failures fall back without breaking the view", () => {
  const storage = memoryStorage();
  writeOperationalPreferences(storage, "scope", "cash", { query: "151", period: "month", view: "sales" });
  const key = [...storage.data.keys()][0];
  for (const raw of ["{broken", "null", '[]', '{"version":2}', " ".repeat(10_001)]) {
    storage.setItem(key, raw);
    assert.deepEqual(readOperationalPreferences(storage, "scope", "cash"), defaultOperationalPreferences.cash);
  }
  assert.deepEqual(normalizeOperationalPreferences("orders", { query: "x".repeat(301), sort: "hack", boardId: 2, history: "true", view: "unknown", list: true }), { ...defaultOperationalPreferences.orders, list: true });
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); } };
  assert.deepEqual(readOperationalPreferences(blocked, "scope", "cash"), defaultOperationalPreferences.cash);
  assert.equal(writeOperationalPreferences(blocked, "scope", "cash", defaultOperationalPreferences.cash), false);
  assert.equal(writeOperationalPreferences(undefined, "scope", "cash", defaultOperationalPreferences.cash), false);
});

test("resetting one section does not erase preferences of other sectors", () => {
  const storage = memoryStorage();
  writeOperationalPreferences(storage, "scope", "cash", { query: "Proveedor", period: "today", view: "purchases" });
  writeOperationalPreferences(storage, "scope", "orders", { ...defaultOperationalPreferences.orders, query: "Cliente", boardId: "custom", mobileColumnId: "column", list: true });
  writeOperationalPreferences(storage, "scope", "cash", defaultOperationalPreferences.cash);
  assert.equal(readOperationalPreferences(storage, "scope", "orders").query, "Cliente");
  assert.equal(readOperationalPreferences(storage, "scope", "orders").list, true);
  assert.equal(readOperationalPreferences(storage, "scope", "cash").query, "");
});

test("task views use real order states and packing lines, excluding closed orders", () => {
  const pending = { status: "pending", lines: [{ packed: true }, { packed: false }] };
  assert.equal(orderMatchesOperationalView(pending, "to_pack", true), true);
  assert.equal(orderMatchesOperationalView({ ...pending, lines: [{ packed: true }] }, "to_pack", true), false);
  assert.equal(orderMatchesOperationalView({ ...pending, lines: [] }, "to_pack", true), false);
  assert.equal(orderMatchesOperationalView(pending, "to_deliver", true), false);
  assert.equal(orderMatchesOperationalView({ ...pending, status: "paid" }, "to_deliver", false), true);
  assert.equal(orderMatchesOperationalView(pending, "contact", true), true);
  assert.equal(orderMatchesOperationalView({ ...pending, messageSentAt: "2026-10-10" }, "contact", true), false);
  assert.equal(orderMatchesOperationalView(pending, "debt", true), true);
  assert.equal(orderMatchesOperationalView(pending, "debt", false), false);
  for (const status of ["delivered", "cancelled"]) {
    for (const view of ["to_pack", "to_deliver", "contact", "debt"] as const) assert.equal(orderMatchesOperationalView({ ...pending, status }, view, true), false);
    assert.equal(orderMatchesOperationalView({ ...pending, status }, "all", false), true);
  }
});

test("today and month use Buenos Aires calendar rather than UTC or device timezone", () => {
  const now = new Date("2026-10-01T02:30:00Z"); // September 30 in Buenos Aires.
  assert.equal(matchesOperationalPeriod("2026-09-30T04:00:00Z", "today", now), true);
  assert.equal(matchesOperationalPeriod("2026-10-01T03:01:00Z", "today", now), false);
  assert.equal(matchesOperationalPeriod("2026-09-01T02:00:00Z", "month", now), false);
  assert.equal(matchesOperationalPeriod("2026-09-01T03:00:00Z", "month", now), true);
  assert.equal(matchesOperationalPeriod("2025-09-30T04:00:00Z", "month", now), false);
  assert.equal(matchesOperationalPeriod("invalid", "month", now), false);
  assert.equal(matchesOperationalPeriod("invalid", "all", now), true);
});
