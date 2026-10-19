import assert from "node:assert/strict";
import { test } from "node:test";
import { orderBoardScrollMetrics } from "../src/order-board-scroll.js";

test("an empty or fitting board does not need a horizontal slider", () => {
  assert.deepEqual(orderBoardScrollMetrics({ scrollWidth: 0, clientWidth: 0, scrollLeft: 0 }), { maximum: 0, position: 0 });
  assert.deepEqual(orderBoardScrollMetrics({ scrollWidth: 600, clientWidth: 800, scrollLeft: 80 }), { maximum: 0, position: 0 });
});

test("the slider tracks the complete overflowing board, not its visible columns", () => {
  assert.deepEqual(orderBoardScrollMetrics({ scrollWidth: 2074, clientWidth: 1100, scrollLeft: 298 }), { maximum: 974, position: 298 });
  assert.deepEqual(orderBoardScrollMetrics({ scrollWidth: 2074, clientWidth: 1100, scrollLeft: 974 }), { maximum: 974, position: 974 });
});

test("resizes and overscroll keep the slider within its new limits", () => {
  assert.deepEqual(orderBoardScrollMetrics({ scrollWidth: 2074, clientWidth: 1400, scrollLeft: 974 }), { maximum: 674, position: 674 });
  assert.deepEqual(orderBoardScrollMetrics({ scrollWidth: 2074, clientWidth: 1100, scrollLeft: -20 }), { maximum: 974, position: 0 });
  assert.deepEqual(orderBoardScrollMetrics({ scrollWidth: 2074, clientWidth: 1100, scrollLeft: 298.4 }), { maximum: 974, position: 298 });
});
