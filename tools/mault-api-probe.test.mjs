import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeCards, createMaultReader, probe } from "./mault-api-probe.mjs";

const config = { baseUrl: "https://mault.test/api", apiKey: "mv_fixture_only" };
const card = (extra = {}) => ({ object: "scanned_card", id: "scan-a", card_id: "printing-a", name: "Fixture", set: "fixture", collector_number: "001", game: "pokemon", lang: "es", condition: "NM", finish: "foil", foil_type: "Reverse Holo (Master Ball)", needs_review: false, tcgplayer_product_id: 123, location: { id: "box-a" }, ...extra });
const page = (data, more = false, next = null) => ({ object: "list", data, has_more: more, next_page: next });
const response = body => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const dependencies = handler => ({ fetchImpl: handler, pause: async () => {} });

test("reader follows every page, uses GET and refuses redirects", async () => {
  const calls = [];
  const client = createMaultReader(config, dependencies(async (url, options) => {
    calls.push(String(url));
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["X-API-Key"], config.apiKey);
    return calls.length === 1 ? response(page([card()], true, "https://mault.test/api/v1/cards?cursor=next")) : response(page([card({ id: "scan-b" })]));
  }));
  assert.equal((await client.cards("collection-a")).length, 2);
  assert.match(calls[0], /collection=collection-a/);
  assert.equal(calls.length, 2);
});

test("reader never sends credentials to another origin, endpoint or userinfo URL", async () => {
  for (const target of ["https://evil.test/api/v1/cards", "https://mault.test/api/v1/locations", "https://user@mault.test/api/v1/cards"]) {
    let calls = 0;
    const client = createMaultReader(config, dependencies(async () => { calls++; return response(page([], true, target)); }));
    await assert.rejects(client.cards(), /endpoint permitido/);
    assert.equal(calls, 1);
  }
});

test("reader reports auth/rate failures without reflecting a secret response", async () => {
  for (const status of [401, 403, 429, 500]) {
    const client = createMaultReader(config, dependencies(async () => new Response(config.apiKey, { status })));
    await assert.rejects(client.cards(), error => error.message.includes(`HTTP ${status}`) && !error.message.includes(config.apiKey));
  }
});

test("invalid JSON, HTML and broken pagination fail instead of returning partial results", async () => {
  const invalid = [() => new Response("<html>"), () => new Response("{", { headers: { "content-type": "application/json" } }), () => response({ data: [] }), () => response(page([], true))];
  for (const make of invalid) await assert.rejects(createMaultReader(config, dependencies(async () => make())).cards());
  const cycle = createMaultReader(config, dependencies(async () => response(page([], true, "https://mault.test/api/v1/cards?limit=500"))));
  await assert.rejects(cycle.cards(), /ciclica/);
});

test("reader sanitizes fetch errors and rejects insecure configuration", async () => {
  const client = createMaultReader(config, dependencies(async () => { throw new Error(config.apiKey); }));
  await assert.rejects(client.cards(), error => !error.message.includes(config.apiKey));
  for (const baseUrl of ["http://mault.test", "https://user@mault.test", "https://mault.test?key=secret"]) assert.throws(() => createMaultReader({ ...config, baseUrl }));
  assert.throws(() => createMaultReader({ ...config, apiKey: "" }));
});

test("report counts individual copies, deduplicates records and preserves language and subtype", () => {
  const data = analyzeCards([card(), card(), card({ id: "scan-b", lang: "pt", foil_type: "Reverse Holo (Dusk Ball)" })]);
  assert.equal(data.physicalCopies, 2);
  assert.equal(data.duplicateRecordsIgnored, 1);
  assert.equal(data.byLanguage.pt, 1);
  assert.equal(data.byFinish["Reverse Holo (Dusk Ball)"], 1);
  assert.equal(data.pendingReview, 0);
  assert.equal(data.inventoryWrites, 0);
  assert.equal(data.catalogMatchingPerformed, false);
});

test("uncertain, incomplete and contradictory variants remain pending", () => {
  const rows = [card({ id: "a", needs_review: true }), card({ id: "b", lang: "" }), card({ id: "c", foil_type: null }), card({ id: "d", finish: "nonfoil" }), card({ id: "e", condition: "unknown" }), card({ id: "f", card_id: "" })];
  assert.equal(analyzeCards(rows).pendingReview, 6);
  assert.throws(() => analyzeCards([card({ id: "" })]));
});

test("selected collection must belong to authenticated organization", async () => {
  let calls = 0;
  await assert.rejects(probe({ ...config, collectionId: "other-org" }, dependencies(async () => { calls++; return response(page([{ id: "ours" }])); })), /no pertenece/);
  assert.equal(calls, 1);
});

test("probe only consults collections and cards and marks its result read-only", async () => {
  const result = await probe(config, dependencies(async url => response(page(url.pathname.endsWith("collections") ? [{ id: "ours" }] : [card()]))));
  assert.equal(result.mode, "read_only");
  assert.equal(result.collectionCount, 1);
  assert.equal(result.physicalCopies, 1);
});
