import assert from "node:assert/strict";
import { it } from "node:test";
import { ResellerBatchKeys, resellerBatchProblem, resellerBatchTotals, type ResellerBatchDraftLine } from "../src/reseller-batch.js";

const line: ResellerBatchDraftLine = { id: "1", name: "Bulbasaur", expansion: "151", number: "1", imageUrl: "", language: "EN", condition: "NM", finish: "normal", quantity: "2", max: 3, priceArs: 1500 };
it("validates the whole selection including unavailable hidden cards", () => {
  assert.equal(resellerBatchProblem([line]), "");
  assert.match(resellerBatchProblem([line, { ...line, id: "2", max: 0 }]), /Bulbasaur/);
  assert.match(resellerBatchProblem([{ ...line, quantity: "1.5" }]), /cantidad/);
  assert.match(resellerBatchProblem(Array.from({ length: 101 }, () => line)), /100/);
});
it("totals the draft without invalid quantities", () => {
  assert.deepEqual(resellerBatchTotals([line, { ...line, quantity: "3", priceArs: 2000 }, { ...line, quantity: "" }]), { units: 5, valueArs: 9000 });
});
it("reuses keys for retries, separates edited drafts and resets for intentional new batches", () => {
  const keys = new ResellerBatchKeys();
  const key = keys.get("/batch", { lines: [1] });
  assert.equal(keys.get("/batch", { lines: [1] }), key);
  assert.notEqual(keys.get("/batch", { lines: [2] }), key);
  assert.equal(keys.get("/batch", { lines: [1] }), key);
  assert.notEqual(keys.get("/other", { lines: [1] }), key);
  const other = keys.get("/other", { lines: [1] });
  keys.reset("/batch");
  assert.equal(keys.get("/other", { lines: [1] }), other);
  keys.reset();
  assert.notEqual(keys.get("/batch", { lines: [1] }), key);
});
