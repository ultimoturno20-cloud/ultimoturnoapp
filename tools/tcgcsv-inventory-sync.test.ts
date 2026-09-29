import assert from "node:assert/strict";
import test from "node:test";
import { parseOptions, syncInventory } from "./tcgcsv-inventory-sync.js";

const options = { apiBaseUrl: "http://localhost:4000", accessKey: "", groupOffset: 4 };

test("inventory sync follows server cursor and limits mutations to existing inventory", async (t) => {
  const offsets: number[] = [];
  t.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    offsets.push(body.groupOffset);
    assert.equal(body.inventoryOnly, true);
    assert.equal(body.seedMissing, false);
    assert.equal(body.groupLimit, 1);
    assert.equal(init.redirect, "error");
    return Response.json({ nextGroupOffset: offsets.length === 1 ? 7 : null, complete: offsets.length === 2, rowsMatched: 2 });
  });
  assert.equal(await syncInventory(options), 4);
  assert.deepEqual(offsets, [4, 7]);
});

test("inventory sync stops on failure without retrying writes", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  await assert.rejects(syncInventory(options), /HTTP 503.*--group-offset=4/);
  assert.equal(mock.mock.callCount(), 1);
});

test("inventory sync rejects missing or non advancing cursor", async (t) => {
  for (const cursor of [undefined, 4, 3, "5"]) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ nextGroupOffset: cursor, complete: false, rowsMatched: 0 }));
    await assert.rejects(syncInventory(options), /paginacion invalida/);
    assert.equal(mock.mock.callCount(), 1);
    mock.mock.restore();
  }
});

test("inventory sync rejects insecure remote API and missing key before fetch", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected request"); });
  await assert.rejects(syncInventory({ ...options, apiBaseUrl: "http://example.com/api", accessKey: "secret" }), /HTTPS/);
  await assert.rejects(syncInventory({ ...options, apiBaseUrl: "https://example.com/api" }), /Falta ULTIMOTURNO_ACCESS_KEY/);
  assert.equal(mock.mock.callCount(), 0);
  for (const offset of ["", "-1", "NaN", "1.5"]) assert.throws(() => parseOptions([`--group-offset=${offset}`]), /entero/);
});
