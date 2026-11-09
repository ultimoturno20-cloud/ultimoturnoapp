import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, createIsolatedStockUser } from "@ultimoturno/db";
import type { LotQuote, SaveLotQuote } from "@ultimoturno/domain";

test("lot quote HTTP routes require authentication/admin and preserve scoped versions through dispatch", async t => {
  for (const key of Object.keys(process.env)) if (/^(DATABASE_URL|ULTIMOTURNO_.*|POSTGRES_.*|SUPABASE_.*|PRICECHARTING_.*|TCG.*|COOLSTUFF_.*|OPENAI_API_KEY)$/.test(key)) delete process.env[key];
  const dir = await mkdtemp(path.join(tmpdir(), "ut-quotes-http-"));
  Object.assign(process.env, { ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir, ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false", TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false", ULTIMOTURNO_ACCESS_KEY: "lot-quotes-http-test-only", ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1500" });
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    for (const role of ["admin", "stock_owner"] as const) await createManagedUser(db, { displayName: role, email: `${role}@quotes.test`, password: "quotes-http-password", role }, actor);
    const isolated = await createIsolatedStockUser(db, { requestId: crypto.randomUUID(), businessName: "Other HTTP QA", displayName: "Other HTTP QA", email: "isolated@quotes.test", password: "quotes-http-password" }, actor);
    await db.query("insert into roles(id,business_id,name) values($1,$2,'admin')", [crypto.randomUUID(), isolated.business.id]);
    await createManagedUser(db, { displayName: "Other admin", email: "other-admin@quotes.test", password: "quotes-http-password", role: "admin" }, { ...actor, businessId: isolated.business.id });
  } finally { await db.close(); }
  // Vercel's entrypoint intentionally imports emitted API code. Resolve it only
  // at runtime so tsc does not treat its own dist declarations as source input.
  const entrypoint = "../../../api/[...path].ts";
  const { default: handler } = await import(entrypoint);
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const route = (path: string) => origin + "/api/dispatch?path=" + encodeURIComponent(path);
  const login = async (email: string) => {
    const response = await fetch(route("/auth/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "quotes-http-password" }) });
    assert.equal(response.status, 200);
    return { Authorization: "Bearer " + ((await response.json()) as { token: string }).token, "Content-Type": "application/json" };
  };
  const headers = await login("admin@quotes.test"), owner = await login("stock_owner@quotes.test"), other = await login("other-admin@quotes.test");
  const id = crypto.randomUUID();
  const body: SaveLotQuote = { version: 0, requestId: crypto.randomUUID(), draft: { name: "HTTP QA", status: "draft", currency: "USD", exchangeRate: 1500, purchasePercent: 70, notes: "", lines: [] } };
  const put = (data: unknown, auth = headers, quoteId = id) => fetch(route("/lot-quotes/" + quoteId), { method: "PUT", headers: auth, body: JSON.stringify(data) });
  for (const pathname of ["/lot-quotes", "/lot-quotes/" + id]) {
    assert.equal((await fetch(route(pathname))).status, 401);
    assert.equal((await fetch(route(pathname), { headers: owner })).status, 403);
  }
  assert.equal((await put(body, owner)).status, 403);
  const created = await put(body); assert.equal(created.status, 200); assert.equal(((await created.json()) as LotQuote).version, 1);
  assert.equal((await put(body)).status, 200);
  const read = await fetch(route("/lot-quotes/" + id), { headers }); assert.equal(read.status, 200); assert.equal(((await read.json()) as LotQuote).name, "HTTP QA");
  assert.equal((await fetch(route("/lot-quotes/" + id), { headers: other })).status, 404);
  assert.equal((await put(body, other)).status, 404);
  const ownList = await fetch(route("/lot-quotes"), { headers: other }); assert.equal((await ownList.json() as { total: number }).total, 0);
  assert.equal((await put({ ...body, requestId: crypto.randomUUID() })).status, 409);
  assert.equal((await put({ ...body, version: 1, requestId: crypto.randomUUID(), draft: { ...body.draft, purchasePercent: 101 } })).status, 400);
  assert.equal((await fetch(route("/lot-quotes/" + id), { method: "PUT", headers, body: "{" })).status, 400);
  assert.equal((await fetch(route("/lot-quotes?offset=bad"), { headers })).status, 400);
  assert.equal((await fetch(route("/lot-quotes/invalid"), { headers })).status, 404);
});
