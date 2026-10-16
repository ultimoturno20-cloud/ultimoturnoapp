import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMobileIntakeQuery, mobileIntakeRequestPath, mobileCaptureKey } from "./mobile-intake.js";

test("mobile query: bounded pages, exact cursors, safe URL roundtrip and identities", () => {
  assert.deepEqual(normalizeMobileIntakeQuery(), { status: "all", query: "", limit: 25, asOf: "", cursor: null });
  const cursor = JSON.stringify({ at: "2026-10-12 12:00:00.123456+00", id: "00000000-0000-0000-0000-000000000001" });
  const input = { status: "pending" as const, query: "Mesa + & lote", limit: 50, asOf: "2026-10-12 12:00:01.123456+00", cursor };
  const path = mobileIntakeRequestPath(input);
  assert.deepEqual(normalizeMobileIntakeQuery(Object.fromEntries(new URL(path, "http://local.test").searchParams)), normalizeMobileIntakeQuery(input));
  for (const invalid of [{ status: "other" }, { status: ["pending"] }, { limit: 0 }, { limit: 101 }, { limit: "NaN" }, { query: "x".repeat(161) }, { cursor }, { cursor: "bad", asOf: input.asOf }]) assert.throws(() => normalizeMobileIntakeQuery(invalid), { statusCode: 400 });
  assert.equal(mobileCaptureKey({ name: "Flab\u00e9b\u00e9's", expansion: "QA", number: "001" }), "flabebes qa 001");
  assert.equal(mobileCaptureKey({ name: "QA", expansion: "", inventoryItemId: "item", priceChartingId: "pc" }), "stock:item");
  assert.equal(mobileCaptureKey({ name: "QA", expansion: "", priceChartingId: "pc" }), "pc:pc");
});
