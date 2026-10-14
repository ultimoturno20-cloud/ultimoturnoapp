import assert from "node:assert/strict";
import { test } from "node:test";
import { historyRequestPath, normalizeHistoryQuery } from "./operational-history.js";

test("history query defaults, bounded pages and exact microsecond cursors", () => {
  assert.deepEqual(normalizeHistoryQuery(), { kind: "stock", query: "", action: "", from: "", to: "", limit: 50, asOf: "", cursor: null });
  const cursor = { at: "2026-10-12 12:00:00.123456+00", id: "00000000-0000-0000-0000-000000000001" };
  const query = normalizeHistoryQuery({ kind: "system", query: "  QA %_  ", limit: "25", from: "2026-10-12", to: "2026-10-12", asOf: "2026-10-14 00:00:00+00", cursor: JSON.stringify(cursor) });
  assert.equal(query.query, "QA %_");
  assert.deepEqual(query.cursor, cursor);
  const path = historyRequestPath({ ...query, cursor: JSON.stringify(cursor) });
  const params = Object.fromEntries(new URL(path, "https://qa.invalid").searchParams);
  assert.deepEqual(normalizeHistoryQuery(params), query);
});

test("invalid history filters/cursors fail before SQL, including impossible calendar dates", () => {
  for (const input of [
    { kind: "other" }, { limit: 0 }, { limit: 101 }, { limit: -1 }, { limit: "NaN" }, { limit: 1.5 },
    { query: "a".repeat(161) }, { action: "a".repeat(101) }, { from: "2026-02-30" },
    { from: "2026-10-14", to: "2026-10-12" }, { cursor: "{}" },
    { asOf: "2026-02-30 00:00:00+00" }, { asOf: "0000-01-01 00:00:00+00" },
    { asOf: "2026-10-14 00:00:00+00", cursor: "null" },
    { asOf: "2026-10-14 00:00:00+00", cursor: JSON.stringify({ at: "2026-10-15 00:00:00+00", id: "00000000-0000-0000-0000-000000000001" }) }
  ]) assert.throws(() => normalizeHistoryQuery(input), { statusCode: 400 }, JSON.stringify(input));
});
