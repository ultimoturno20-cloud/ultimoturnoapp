import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, addInventoryStock } from "@ultimoturno/db";
import type { HistoryPage } from "@ultimoturno/domain";

test("history HTTP preserves authentication, cursor validation and legacy routes", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-history-api-"));
  for (const key of ["DATABASE_URL", "ULTIMOTURNO_DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRICECHARTING_TOKEN", "OPENAI_API_KEY"]) process.env[key] = "";
  Object.assign(process.env, { ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir,
    ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false", TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false",
    ULTIMOTURNO_ACCESS_KEY: "local-history-api-only", ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1540" });
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    for (const role of ["admin", "stock_owner"] as const) await createManagedUser(db, { displayName: "History " + role, email: role + "@history.test", password: "history-isolated-password", role }, actor);
    const item = await addInventoryStock(db, { name: "HTTP History QA", expansion: "QA", number: "1", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 1, priceArs: 2000 }, actor);
    await db.query(`insert into inventory_movements(id,business_id,inventory_item_id,movement_type,quantity_delta,note,created_at)
      select md5('http-history-' || g)::uuid,$1,$2,'manual_adjustment',1,'HTTP pagination QA',now() - g * interval '1 second'
      from generate_series(1,125) g`, [actor.businessId, item.id]);
  } finally { await db.close(); }
  const { handleRequest } = await import("./server.js");
  const server = createServer((request, response) => { void handleRequest(request, response); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const login = async (role: string) => {
    const response = await fetch(origin + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: role + "@history.test", password: "history-isolated-password" }) });
    assert.equal(response.status, 200);
    return { Authorization: "Bearer " + (await response.json() as { token: string }).token };
  };
  assert.equal((await fetch(origin + "/operational-history")).status, 401);
  const headers = await login("admin");
  const firstResponse = await fetch(origin + "/operational-history?query=HTTP%20pagination%20QA&limit=50", { headers });
  assert.equal(firstResponse.status, 200);
  const first = await firstResponse.json() as HistoryPage;
  assert.equal(first.items.length, 50); assert.equal(first.matchedTotal, 125); assert.equal(first.netQuantity, 125);
  const params = new URLSearchParams({ query: "HTTP pagination QA", limit: "50", asOf: first.asOf, cursor: first.nextCursor! });
  const second = await (await fetch(origin + "/operational-history?" + params, { headers })).json() as HistoryPage;
  assert.equal(second.items.length, 50); assert.equal(second.matchedTotal, 125);
  assert.equal(second.items.some(row => first.items.some(previous => previous.id === row.id)), false);
  assert.equal((await fetch(origin + "/operational-history?limit=100000", { headers })).status, 400);
  assert.equal((await fetch(origin + "/operational-history?cursor=invalid", { headers })).status, 400);
  assert.equal((await fetch(origin + "/operational-history", { headers: await login("stock_owner") })).status, 403);
  const legacy = await (await fetch(origin + "/movements", { headers })).json() as { movements: unknown[] };
  assert.equal(legacy.movements.length, 100);
  const legacyAudit = await (await fetch(origin + "/audit", { headers })).json() as { audit: Array<Record<string, unknown>> };
  assert.ok(legacyAudit.audit.length); assert.ok("beforeData" in legacyAudit.audit[0]);
});
