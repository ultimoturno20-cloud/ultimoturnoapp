import assert from "node:assert/strict";
import { test } from "node:test";
import { maultSource, verifyMaultImage } from "./mault-source.js";

test("Mault pagination rebases the hosted alias without leaking credentials or changing filters", async () => {
  const requests: string[] = [];
  const since = "2026-11-20T00:00:00.000Z";
  let next = `https://mault.test/v1/cards?limit=200&since=${encodeURIComponent(since)}&cursor=second`;
  const fetcher: typeof fetch = async (url, options) => {
    requests.push(String(url));
    assert.equal(options?.redirect, "error");
    assert.equal((options?.headers as Record<string,string>)["X-API-Key"], "mv_fixture_only");
    return new Response(JSON.stringify({ object: "list", data: [], has_more: true, next_page: next, next_since: since }), { headers: { "content-type": "application/json" } });
  };
  const source = maultSource({ baseUrl: "https://mault.test/api", apiKey: "mv_fixture_only" }, fetcher);
  const first = await source.page(null, since);
  assert.equal(new URL(first.nextPage!).pathname, "/api/v1/cards");
  next = "https://external.test/v1/cards?limit=200";
  await assert.rejects(source.page(first.nextPage, since), /fuera de alcance/);
  assert.equal(new URL(requests[1]).pathname, "/api/v1/cards");
  assert.ok(requests.every(url => new URL(url).hostname === "mault.test"));
  next = "https://mault.test/v1/cards?limit=200&cursor=third";
  await assert.rejects(source.page(null, since), /invalida/);
  await assert.rejects(source.page("https://external.test/cards", since), /fuera de alcance/);
  assert.equal(requests.length, 3);
});

test("Mault image verification refuses other hosts, languages, redirects and non-image payloads", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_url, options) => { calls++; assert.equal(options?.redirect, "error");
    return new Response("<html>not an image</html>", { headers: { "content-type": "image/png" } }); };
  for (const url of ["https://other.test/es/card.webp", "https://assets.tcgdex.net/en/card.webp", "https://assets.tcgdex.net/es/card.webp?redirect=x", "http://assets.tcgdex.net/es/card.webp"]) {
    await assert.rejects(verifyMaultImage(url, "es", fetcher), /fuera/);
  }
  assert.equal(calls, 0);
  await assert.rejects(verifyMaultImage("https://assets.tcgdex.net/es/card.webp", "es", fetcher), /imagen valida/);
  assert.equal(calls, 1);
});
