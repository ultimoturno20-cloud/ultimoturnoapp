import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCoolstuffExpansionUrl } from "../packages/importers/src/index.js";
import { loadExpansionProducts, loadExpansionWithDiskCache, mergeCoolstuffExpansionFallbacks, newRunStats, parseOptions, resetWorkerCachesForTests, runCycle, runSummary } from "./coolstuff-price-worker.js";

const product = (number: string) => `<div class="product-search-row" itemtype="https://schema.org/Product"><a class="productLink" href="/p/Pokemon/Card-${number}"><span itemprop="name">Card - ${number}/132</span></a><div class="breadcrumb-trail">Pokemon » Mega Evolution</div><div itemprop="offers" itemtype="https://schema.org/Offer"><div><span class="card-qty">1</span>Near Mint</div><b itemprop="price" content="1.25"></b></div></div>`;

test("worker enforces ten seconds minimum between site requests", () => {
  assert.equal(parseOptions(["--delay-ms=1"]).delayMs, 10000);
});

test("worker accepts until-done mode", () => {
  assert.equal(parseOptions(["--until-done"]).untilDone, true);
  assert.equal(parseOptions([]).untilDone, false);
});

test("max runtime defaults to 4.5h on GitHub Actions and stays off locally", () => {
  const previous = { actions: process.env.GITHUB_ACTIONS, runtime: process.env.COOLSTUFF_MAX_RUNTIME_MS };
  try {
    delete process.env.COOLSTUFF_MAX_RUNTIME_MS;
    process.env.GITHUB_ACTIONS = "true";
    assert.equal(parseOptions([]).maxRuntimeMs, 16200000);
    delete process.env.GITHUB_ACTIONS;
    assert.equal(parseOptions([]).maxRuntimeMs, 0);
    process.env.GITHUB_ACTIONS = "true";
    assert.equal(parseOptions(["--max-runtime-ms=1000"]).maxRuntimeMs, 1000);
  } finally {
    if (previous.actions === undefined) delete process.env.GITHUB_ACTIONS; else process.env.GITHUB_ACTIONS = previous.actions;
    if (previous.runtime === undefined) delete process.env.COOLSTUFF_MAX_RUNTIME_MS; else process.env.COOLSTUFF_MAX_RUNTIME_MS = previous.runtime;
  }
});

test("failed observation POST counts as failed instead of aborting the cycle", async (t) => {
  const options = { ...parseOptions([]), apiBaseUrl: "http://localhost:4000", delayMs: 0, dryRun: false };
  const target = { priceChartingId: "local-post-fail", name: "Card", expansion: "Mega Evolution", number: "1/132", condition: "NM", finish: "normal" };
  let posts = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = String(input);
    if (url.includes("/targets?")) return Response.json({ targets: [target], status: { matchedEntries: 0, totalEntries: 1 } });
    if (url.endsWith("/observations")) {
      posts++;
      return Response.json({ error: "fk violation" }, { status: 500 });
    }
    if (url.endsWith("/pokemon/")) return new Response('<div class="set-list"><a href="/page/777">Mega Evolution</a></div>');
    if (url.includes("/page/777?")) return new Response(product("1"));
    throw new Error(`Unexpected URL: ${url}`);
  });
  const stats = newRunStats();
  assert.equal(await runCycle(options, stats), 1);
  assert.equal(posts, 1);
  assert.equal(stats.failed, 1);
  assert.equal(stats.matched, 0);
  assert.equal(stats.reviewed, 1);
  resetWorkerCachesForTests();
});

test("missing CoolStuff expansion is saved as not_found and not failed", async (t) => {
  const options = { ...parseOptions([]), apiBaseUrl: "http://localhost:4000", delayMs: 0, dryRun: false };
  const target = { priceChartingId: "local-missing-expansion", name: "Card JP", expansion: "Japanese Set", number: "1/132", condition: "NM", finish: "normal" };
  const posted: Array<{ status: string }> = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/targets?")) return Response.json({ targets: [target], status: { matchedEntries: 0, totalEntries: 1 } });
    if (url.endsWith("/observations")) {
      posted.push(JSON.parse(String(init?.body)).observations[0]);
      return Response.json({ ok: true });
    }
    if (url.endsWith("/pokemon/")) return new Response('<div class="set-list"><a href="/page/777">Mega Evolution</a></div>');
    throw new Error(`Unexpected URL: ${url}`);
  });
  const stats = newRunStats();
  assert.equal(await runCycle(options, stats), 1);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].status, "not_found");
  assert.equal(stats.notFound, 1);
  assert.equal(stats.failed, 0);
  resetWorkerCachesForTests();
});

test("run summary counts every status and renders markdown", () => {
  const stats = newRunStats();
  stats.reviewed = 5;
  stats.matched = 2;
  stats.notFound = 1;
  stats.ambiguous = 1;
  stats.failed = 1;
  stats.batches = 2;
  const summary = runSummary(stats);
  assert.match(summary, /\| 5 \| 2 \| 1 \| 1 \| 1 \| 2 \|/);
  assert.match(summary, /^## CoolStuff price worker/);
});

test("run summary appends cache coverage when present", () => {
  const summary = runSummary(newRunStats(), {
    matchedEntries: 3,
    totalEntries: 10,
    staleEntries: 2,
    notFoundEntries: 4,
    failedEntries: 1,
    lastAttemptAt: "2024-01-01T00:00:00Z"
  });
  assert.match(summary, /Cobertura cache: 3\/10 con precio \(30%\)\. Stale: 2, Not found: 4, Failed: 1\. Ultimo intento: 2024-01-01T00:00:00Z\./);
});

test("Destined Rivals fallback fills the missing CoolStuff index page", () => {
  const links = mergeCoolstuffExpansionFallbacks([]);
  assert.equal(findCoolstuffExpansionUrl("Destined Rivals", links), "https://www.coolstuffinc.com/page/8872");
  assert.equal(findCoolstuffExpansionUrl("SV: Destined Rivals", links), "https://www.coolstuffinc.com/page/8872");
  const alreadyListed = mergeCoolstuffExpansionFallbacks([
    { name: "Destined Rivals", url: "https://www.coolstuffinc.com/page/8872" }
  ]);
  assert.equal(alreadyListed.length, 1);
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

test("expansion disk cache skips CoolStuff downloads while fresh", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coolstuff-"));
  process.env.COOLSTUFF_CACHE_DIR = dir;
  t.after(() => {
    delete process.env.COOLSTUFF_CACHE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });
  const options = { ...parseOptions([]), delayMs: 0 };
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response(product("1"));
  });
  const url = "https://www.coolstuffinc.com/page/9126";
  assert.equal((await loadExpansionWithDiskCache(options, url)).length, 1);
  assert.equal((await loadExpansionWithDiskCache(options, url)).length, 1);
  assert.equal(requests, 1);
});
