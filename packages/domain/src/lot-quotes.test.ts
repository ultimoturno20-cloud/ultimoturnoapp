import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "csv-parse/sync";
import { lotQuoteTotals, normalizeLotQuote, normalizeLotQuoteSave, lotQuoteCsv, type LotQuoteDraft, type LotQuoteLine } from "./lot-quotes.js";

const line = (overrides: Partial<LotQuoteLine> = {}): LotQuoteLine => ({ id: crypto.randomUUID(), name: "QA card", expansion: "QA set", number: "025/100", language: "EN", condition: "NM", finish: "normal", quantity: 1, referencePrice: 0.1, unitPrice: 0.2, imageUrl: "", sourceUrl: "", sourceName: "Manual", sourceUpdatedAt: "", notes: "", ...overrides });
const draft = (overrides: Partial<LotQuoteDraft> = {}): LotQuoteDraft => ({ name: "QA lot", currency: "USD", exchangeRate: 1500, purchasePercent: 70, status: "draft", notes: "", lines: [line({ quantity: 3 }), line({ referencePrice: 0.2, unitPrice: null }), line({ quantity: 2, referencePrice: null, unitPrice: 0 })], ...overrides });

test("lot quotes distinguish unknown prices from zero and compute totals in cents", () => {
  assert.deepEqual(lotQuoteTotals(normalizeLotQuote(draft())), { units: 6, referenceTotal: 0.5, saleTotal: 0.6, purchaseTotal: 0.35, missingReference: 2, missingSale: 1 });
  assert.equal(lotQuoteTotals(draft({ purchasePercent: 0 })).purchaseTotal, 0);
  assert.equal(lotQuoteTotals(draft({ purchasePercent: 100 })).purchaseTotal, 0.5);
  assert.equal(lotQuoteTotals(draft({ lines: [] })).missingReference, 0);
  const large = normalizeLotQuote(draft({ purchasePercent: 99.99, lines: [line({ referencePrice: 99_999_999.99, quantity: 100 })] }));
  const cents = 999999999900n;
  assert.equal(lotQuoteTotals(large).purchaseTotal, Number((cents * 9999n + 5000n) / 10000n) / 100);
});

test("lot quote validation bounds money, percentages, quantities, URLs and full payloads", () => {
  for (const patch of [{ purchasePercent: -1 }, { purchasePercent: 101 }, { purchasePercent: NaN }, { purchasePercent: 1.123 }, { exchangeRate: 0 }, { currency: "EUR" }, { currency: ["ARS"] }, { status: "sold" }, { status: ["draft"] }, { lines: null }, { name: "" }]) assert.throws(() => normalizeLotQuote({ ...draft(), ...patch }), { statusCode: 400 });
  for (const patch of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: "2" }, { referencePrice: -1 }, { unitPrice: Infinity }, { unitPrice: 0.001 }, { imageUrl: "javascript:alert(1)" }, { sourceUrl: "/api/private" }, { name: "" }, { id: "bad" }]) assert.throws(() => normalizeLotQuote(draft({ lines: [line(patch as Partial<LotQuoteLine>)] })), { statusCode: 400 });
  const row = line();
  assert.equal(normalizeLotQuote(draft({ lines: [line({ imageUrl: "/pricecharting-images/files/qa-card.jpg" })] })).lines[0].imageUrl, "/pricecharting-images/files/qa-card.jpg");
  assert.throws(() => normalizeLotQuote(draft({ lines: [row, { ...row, id: row.id.toUpperCase() }] })), { statusCode: 400 });
  assert.throws(() => normalizeLotQuote(draft({ lines: Array.from({ length: 1001 }, () => line()) })), { statusCode: 400 });
  assert.throws(() => normalizeLotQuote(draft({ lines: Array.from({ length: 1000 }, () => line({ imageUrl: "https://example.test/" + "x".repeat(2000), sourceUrl: "https://example.test/" + "y".repeat(2000), notes: "z".repeat(1000) })) })), /3,5 MB/);
  assert.throws(() => normalizeLotQuote(draft({ lines: [line({ quantity: 10000, referencePrice: 100_000_000 })] })), { statusCode: 400 });
  const requestId = crypto.randomUUID();
  assert.equal(normalizeLotQuoteSave({ requestId: requestId.toUpperCase(), version: 0, draft: draft() }).requestId, requestId);
  for (const version of [-1, 0.5, "0", null]) assert.throws(() => normalizeLotQuoteSave({ requestId, version, draft: draft() }), { statusCode: 400 });
});

test("lot quote CSV preserves every row, identity, links, quoted newlines and neutralizes formulas", () => {
  const value = draft({ name: '=IMPORTXML("https://example.test")', notes: "First\nSecond", lines: [line({ name: 'QA, "card"', sourceUrl: "https://example.test/card", imageUrl: "https://example.test/card.png", referencePrice: null }), line({ name: " \t+SUM(1,2)", notes: "@formula" })] });
  const csv = lotQuoteCsv(value);
  const rows = parse(csv, { bom: true, relax_column_count: true, skip_empty_lines: false }) as string[][];
  assert.equal(rows[0][1][0], "'"); assert.equal(rows[4][1], value.notes);
  assert.equal(rows[7][0], value.lines[0].name); assert.equal(rows[7][7], "");
  assert.equal(rows[7][12], value.lines[0].sourceUrl); assert.equal(rows[7][13], value.lines[0].imageUrl);
  assert.equal(rows[8][0][0], "'"); assert.equal(rows[8][15], "'@formula");
  const many = draft({ lines: Array.from({ length: 1000 }, (_, i) => line({ name: `QA ${i}` })) });
  assert.equal(parse(lotQuoteCsv(many), { bom: true, relax_column_count: true }).filter((row: string[]) => /^QA \d+$/.test(row[0])).length, 1000);
});
