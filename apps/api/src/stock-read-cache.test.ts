import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createStockReadCache, readSharedStockSnapshot } from "./stock-read-cache.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("stock cache shares pending reads, preserves its TTL and isolates businesses", async () => {
  let now = 0;
  const cache = createStockReadCache<number>(() => now, 15_000);
  const first = deferred<number>();
  let calls = 0;
  const load = async () => { calls += 1; return first.promise; };
  const reads = [cache.read("a", load), cache.read("a", load), cache.read("a", load)];
  await tick();
  assert.equal(calls, 1);
  first.resolve(1);
  assert.deepEqual(await Promise.all(reads), [1, 1, 1]);
  assert.equal(await cache.read("a", load), 1);
  assert.equal(calls, 1);
  assert.equal(await cache.read("b", async () => 7), 7);
  cache.delete("a");
  assert.equal(await cache.read("a", async () => 2), 2);
  assert.equal(await cache.read("b", async () => 99), 7);
  now = 15_001;
  assert.equal(await cache.read("a", async () => 3), 3);
  cache.clear();
  assert.equal(await cache.read("b", async () => 8), 8);
});

test("fresh stock supersedes old pending reads and concurrent fresh reads share the new result", async () => {
  const cache = createStockReadCache<number>();
  const old = deferred<number>();
  const fresh = deferred<number>();
  const calls: boolean[] = [];
  const load = async (force: boolean) => { calls.push(force); return force ? fresh.promise : old.promise; };
  const original = cache.read("a", load);
  await tick();
  const forced = [cache.read("a", load, true), cache.read("a", load, true), cache.read("a", load)];
  await tick();
  assert.deepEqual(calls, [false, true]);
  fresh.resolve(4);
  assert.deepEqual(await Promise.all(forced), [4, 4, 4]);
  old.resolve(1);
  assert.equal(await original, 4);
  assert.equal(await cache.read("a", load), 4);
  assert.equal(await cache.read("a", async () => 5, true), 5, "Explicit fresh reads never reuse completed cached data");
});

test("invalidation cannot be undone by an old success or error; retries use a fresh read", async () => {
  for (const failure of [false, true]) {
    const cache = createStockReadCache<number>();
    const old = deferred<number>();
    const calls: boolean[] = [];
    const load = async (fresh: boolean) => { calls.push(fresh); return fresh ? 6 : old.promise; };
    const original = cache.read("a", load);
    await tick(); cache.delete("a");
    if (failure) old.reject(new Error("old read failed")); else old.resolve(1);
    assert.equal(await original, 6);
    assert.equal(await cache.read("a", load), 6);
    assert.deepEqual(calls, [false, true]);
  }
});

test("failed stock reads leave no poisoned pending entry or empty cached stock", async () => {
  const cache = createStockReadCache<number>();
  await assert.rejects(cache.read("a", async () => { throw new Error("DB unavailable"); }), /DB unavailable/);
  assert.equal(await cache.read("a", async () => 9), 9);
});

async function database() {
  const db = new PGlite();
  await db.exec(`create table stock_read_snapshots (
    business_id text primary key, payload jsonb, payload_compressed text,
    refreshed_at timestamptz not null, refresh_started_at timestamptz
  )`);
  return db;
}

function stock(totalUnits: number): Awaited<ReturnType<typeof readSharedStockSnapshot>> {
  return { items: [], summary: { totalSkus: 0, totalUnits, reservedUnits: 0, availableUnits: totalUnits, stockValueArs: 0, collectionUnits: 0, collectionValueArs: 0, totalValueArs: 0 } };
}

test("shared snapshots revoke old builders even when already dirty; old cleanup preserves the new lease", async () => {
  const db = await database();
  try {
    await db.query("insert into stock_read_snapshots(business_id,payload,refreshed_at) values('a',$1::jsonb,'1970-01-01')", [JSON.stringify(stock(99))]);
    const enteredOld = deferred<void>(), enteredNew = deferred<void>();
    const oldResult = deferred<ReturnType<typeof stock>>(), newResult = deferred<ReturnType<typeof stock>>();
    const old = readSharedStockSnapshot(db, "a", () => true, () => { enteredOld.resolve(); return oldResult.promise; });
    const rejectedOld = assert.rejects(old, (error: Error) => error.constructor.name === "SupersededStockRead");
    await enteredOld.promise;
    await db.query("update stock_read_snapshots set refreshed_at='1970-01-01', refresh_started_at=null where business_id='a'");
    const newer = readSharedStockSnapshot(db, "a", () => true, () => { enteredNew.resolve(); return newResult.promise; });
    await enteredNew.promise;
    const lease = async () => (await db.query<{ ticket: string | null }>("select refresh_started_at::text as ticket from stock_read_snapshots where business_id='a'")).rows[0].ticket;
    const newTicket = await lease();
    assert.ok(newTicket);
    oldResult.resolve(stock(1));
    await rejectedOld;
    assert.equal(await lease(), newTicket, "Old builder must neither publish nor release the new ticket");
    newResult.resolve(stock(4));
    assert.deepEqual(await newer, stock(4));
    assert.equal(await lease(), null);
    assert.deepEqual(await readSharedStockSnapshot(db, "a", () => true, async () => { throw new Error("must reuse valid compressed snapshot"); }), stock(4));
  } finally { await db.close(); }
});

test("shared snapshot failures release their own lease and expose errors instead of resurrecting invalidated data", async () => {
  const db = await database();
  try {
    await db.query("insert into stock_read_snapshots(business_id,payload,refreshed_at) values('a',$1::jsonb,'1970-01-01')", [JSON.stringify(stock(99))]);
    await assert.rejects(readSharedStockSnapshot(db, "a", () => true, async () => { throw new Error("DB unavailable"); }), /DB unavailable/);
    assert.equal((await db.query<{ refresh_started_at: string | null }>("select refresh_started_at from stock_read_snapshots where business_id='a'")).rows[0].refresh_started_at, null);
    assert.deepEqual(await readSharedStockSnapshot(db, "a", () => true, async () => stock(6)), stock(6));
  } finally { await db.close(); }
});

test("superseded memory readers cannot publish a shared snapshot after a fresh read", async () => {
  const db = await database();
  try {
    const cache = createStockReadCache<ReturnType<typeof stock>>();
    const entered = deferred<void>(), oldResult = deferred<ReturnType<typeof stock>>();
    const load = (fresh: boolean, current: () => boolean) => fresh ? Promise.resolve(stock(7)) : readSharedStockSnapshot(db, "a", current, () => { entered.resolve(); return oldResult.promise; });
    const original = cache.read("a", load);
    await entered.promise;
    assert.deepEqual(await cache.read("a", load, true), stock(7));
    oldResult.resolve(stock(1));
    assert.deepEqual(await original, stock(7));
    const snapshot = (await db.query<{ payload_compressed: string | null; refresh_started_at: string | null }>("select payload_compressed,refresh_started_at from stock_read_snapshots where business_id='a'")).rows[0];
    assert.equal(snapshot.payload_compressed, null);
    assert.equal(snapshot.refresh_started_at, null);
  } finally { await db.close(); }
});
