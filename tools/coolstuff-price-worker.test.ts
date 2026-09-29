import assert from "node:assert/strict";
import test from "node:test";
import { loadExpansionProducts, parseOptions, runCycle } from "./coolstuff-price-worker.js";

const product = (number: string) => `<div class="product-search-row" itemtype="https://schema.org/Product"><a class="productLink" href="/p/Pokemon/Card-${number}"><span itemprop="name">Card - ${number}/132</span></a><div class="breadcrumb-trail">Pokemon » Mega Evolution</div><div itemprop="offers" itemtype="https://schema.org/Offer"><div><span class="card-qty">1</span>Near Mint</div><b itemprop="price" content="1.25"></b></div></div>`;

test("worker enforces ten seconds minimum between site requests", () => {
  assert.equal(parseOptions(["--delay-ms=1"]).delayMs, 10000);
});

test("worker collects all pages and rejects repeated or empty pages", async (t) => {
  const options = { ...parseOptions([]), delayMs: 0 };
  const first = product("1") + '<a href="/page/9126?page=2">2</a>';
  let pages = [first, product("2")];
  t.mock.method(globalThis, "fetch", async () => new Response(pages.shift() || ""));
  const rows = await loadExpansionProducts(options, "https://www.coolstuffinc.com/page/9126");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].number, "2/132");
  pages = [first, first];
  await assert.rejects(loadExpansionProducts(options, "https://www.coolstuffinc.com/page/9126"), /vacia o repetida/);
  pages = [first, "<html>Temporarily unavailable</html>"];
  await assert.rejects(loadExpansionProducts(options, "https://www.coolstuffinc.com/page/9126"), /vacia o repetida/);
  // Page links are a sliding window: page 2 reveals page 3.
  pages = [first, product("2") + '<a href="/page/9126?page=3">3</a>', product("3")];
  assert.equal((await loadExpansionProducts(options, "https://www.coolstuffinc.com/page/9126")).length, 3);
});

test("successive batches reuse expansion downloads and save each observation", async (t) => {
  const options = { ...parseOptions([]), apiBaseUrl: "http://localhost:4000", delayMs: 0, dryRun: false };
  const target = { priceChartingId: "local-test", name: "Card", expansion: "Mega Evolution", number: "1/132", condition: "NM", finish: "normal" };
  let indexRequests = 0;
  let expansionRequests = 0;
  let writes = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/targets?")) return Response.json({ targets: [target], status: { matchedEntries: writes, totalEntries: 1 } });
    if (url.endsWith("/observations")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.observations[0].status, "matched");
      assert.equal(body.observations[0].priceUsd, 1.25);
      writes++;
      return Response.json({ ok: true });
    }
    if (url.endsWith("/pokemon/")) {
      indexRequests++;
      return new Response('<div class="set-list"><a href="/page/555">Mega Evolution</a></div>');
    }
    if (url.includes("/page/555?")) {
      expansionRequests++;
      return new Response(product("1"));
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  assert.equal(await runCycle(options), 1);
  assert.equal(await runCycle(options), 1);
  assert.equal(indexRequests, 1);
  assert.equal(expansionRequests, 1);
  assert.equal(writes, 2);
});
