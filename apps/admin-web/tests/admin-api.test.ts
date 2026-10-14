import assert from "node:assert/strict";
import { test } from "node:test";
import { createAdminApi } from "../src/admin-api.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const json = (value: unknown, etag = "") => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json", ...(etag ? { etag } : {}) } });

function fixture() {
  let session = "admin-a";
  const calls: Array<{ url: string; init?: RequestInit; response: ReturnType<typeof deferred<Response>> }> = [];
  const client = createAdminApi({
    url: (path) => `/api${path}`, session: () => session,
    fetch: (async (url, init) => {
      const response = deferred<Response>();
      calls.push({ url: String(url), init, response });
      return response.promise;
    }) as typeof fetch
  });
  return { client, calls, session: (value: string) => { session = value; } };
}

test("shared admin reads: three overlapping views use one GET per resource, not a result TTL", async () => {
  const { client, calls } = fixture();
  const loads = [client.request("/stock"), client.request("/stock"), client.request("/stock")];
  await tick();
  assert.equal(calls.length, 1);
  calls[0].response.resolve(json({ units: 3 }, '"stock-3"'));
  assert.deepEqual(await Promise.all(loads), [{ units: 3 }, { units: 3 }, { units: 3 }]);
  const next = client.request("/stock");
  await tick();
  assert.equal(calls.length, 2);
  assert.equal((calls[1].init?.headers as Record<string, string>)["If-None-Match"], '"stock-3"');
  calls[1].response.resolve(new Response(null, { status: 304 }));
  assert.deepEqual(await next, { units: 3 });
});

test("read keys isolate URL queries and effective admin/reseller/anonymous tokens", async () => {
  const { client, calls } = fixture();
  const reads = [client.request("/stock"), client.request("/stock?fresh=1"), client.request("/stock", { token: "reseller" }), client.request("/stock", { skipSession: true })];
  await tick();
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((call) => (call.init?.headers as Record<string, string>).Authorization), ["Bearer admin-a", "Bearer admin-a", "Bearer reseller", undefined]);
  calls.forEach((call, i) => call.response.resolve(json(i)));
  assert.deepEqual(await Promise.all(reads), [0, 1, 2, 3]);
});

test("late reads and old ETags are discarded across a write; reads wait, writes never replay", async () => {
  const { client, calls } = fixture();
  const old = client.request("/stock");
  await tick();
  const write = client.request("/claims/cards/qa", { method: "PUT", body: { quantity: 4 } });
  calls[0].response.resolve(json({ units: 1 }, '"old"'));
  await tick();
  assert.equal(calls.length, 2);
  calls[1].response.resolve(json({ saved: true }));
  await write;
  await tick();
  assert.equal(calls[2].url, "/api/stock?fresh=1");
  assert.equal((calls[2].init?.headers as Record<string, string>)["If-None-Match"], undefined);
  calls[2].response.resolve(json({ units: 4 }, '"new"'));
  assert.deepEqual(await old, { units: 4 });
  assert.equal(calls.filter((call) => call.init?.method === "PUT").length, 1);
});

test("failed writes invalidate too; failed GETs can be retried without a stuck pending entry", async () => {
  const { client, calls } = fixture();
  const write = client.request("/inventory/qa", { method: "PUT" });
  const rejectedWrite = assert.rejects(write, /504/);
  calls[0].response.resolve(new Response(JSON.stringify({ error: "unknown outcome" }), { status: 504 }));
  await rejectedWrite;
  const read = client.request("/stock");
  await tick();
  const rejectedRead = assert.rejects(read, /503/);
  calls[1].response.resolve(new Response("{}", { status: 503 }));
  await rejectedRead;
  const retry = client.request("/stock");
  await tick();
  assert.equal(calls[2].url, "/api/stock?fresh=1");
  calls[2].response.resolve(json({ units: 4 }));
  assert.deepEqual(await retry, { units: 4 });
});

test("batch does not apply an early resolved resource from before a write", async () => {
  const { client, calls } = fixture();
  const applied: unknown[] = [];
  const batch = client.readAndApply(() => Promise.all([client.request("/stock"), client.request("/claims")]), (value) => applied.push(value));
  await tick();
  calls[0].response.resolve(json({ units: 1 }));
  await tick();
  const write = client.request("/claims/cards/qa", { method: "PUT" });
  calls[2].response.resolve(json({ saved: true }));
  await write;
  calls[1].response.resolve(json({ quantity: 1 }));
  await tick();
  calls[3].response.resolve(json({ quantity: 4 }));
  await tick();
  assert.equal(applied.length, 0);
  calls[4].response.resolve(json({ units: 4 }));
  calls[5].response.resolve(json({ quantity: 4 }));
  await batch;
  assert.deepEqual(applied, [[{ units: 4 }, { quantity: 4 }]]);
});

test("session replacement cancels old reads even if an old server returns 401", async () => {
  const { client, calls, session } = fixture();
  const old = client.request("/stock");
  const rejected = assert.rejects(old, { name: "AbortError" });
  await tick();
  session("admin-b"); client.invalidate();
  const next = client.request("/stock");
  await tick();
  calls[0].response.resolve(new Response("{}", { status: 401 }));
  calls[1].response.resolve(json({ ownUnits: 7 }));
  await rejected;
  assert.deepEqual(await next, { ownUnits: 7 });
  assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, "Bearer admin-b");
});

test("manual refresh and price events invalidate pending reads and request fresh stock", async () => {
  const { client, calls } = fixture();
  const old = client.request("/stock");
  await tick();
  client.invalidate();
  const fresh = client.request("/stock");
  await tick();
  calls[0].response.resolve(json({ price: 1 }));
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "/api/stock?fresh=1");
  calls[1].response.resolve(json({ price: 2 }));
  assert.deepEqual(await Promise.all([old, fresh]), [{ price: 2 }, { price: 2 }]);
});

test("caller-owned signals are not shared; abort remains immediate while waiting for a write", async () => {
  const { client, calls } = fixture();
  const normal = client.request("/claims");
  const controller = new AbortController();
  const cancellable = client.request("/claims", { signal: controller.signal });
  const rejected = assert.rejects(cancellable, { name: "AbortError" });
  await tick();
  assert.equal(calls.length, 2);
  controller.abort();
  calls[1].response.resolve(json({ stale: true }));
  calls[0].response.resolve(json({ okay: true }));
  await rejected;
  assert.deepEqual(await normal, { okay: true });
  const write = client.request("/claims/qa", { method: "PUT" });
  const waitingController = new AbortController();
  const waiting = client.request("/claims", { signal: waitingController.signal });
  const rejectedWaiting = assert.rejects(waiting, { name: "AbortError" });
  waitingController.abort();
  await rejectedWaiting;
  assert.equal(calls.length, 3);
  calls[2].response.resolve(json({ saved: true }));
  await write;
});
