import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertReservationQuantity, availableQuantity, fixtureInventory, summarizeStock } from "./index.js";

describe("stock domain rules", () => {
  it("calculates available quantity from on-hand minus reserved", () => {
    assert.equal(availableQuantity(fixtureInventory[0]), 3);
  });

  it("summarizes stock without counting reserved units as available", () => {
    const summary = summarizeStock(fixtureInventory);
    assert.equal(summary.totalSkus, 12);
    assert.equal(summary.totalUnits, 49);
    assert.equal(summary.reservedUnits, 8);
    assert.equal(summary.availableUnits, 41);
  });

  it("rejects reservations above available stock", () => {
    assert.throws(() => assertReservationQuantity(fixtureInventory[1], 2), /Stock insuficiente/);
  });
});
