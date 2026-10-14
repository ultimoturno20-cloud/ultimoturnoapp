import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import {
  createOperationalDatabase, getDefaultOperationalUser, createManagedUser, replacePriceChartingCache,
  createClaimSession, addPriceChartingCardsToClaim
} from "@ultimoturno/db";

test("claim edits invalidate stock snapshots only for affected stock and return fresh quantities over HTTP", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-claim-cache-api-"));
  for (const key of ["DATABASE_URL", "ULTIMOTURNO_DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRICECHARTING_TOKEN", "OPENAI_API_KEY"]) process.env[key] = "";
  Object.assign(process.env, {
    ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: dir,
    ULTIMOTURNO_ALLOW_EXAMPLES: "false", PRICECHARTING_AUTO_REFRESH_ENABLED: "false",
    TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: "false", ULTIMOTURNO_ACCESS_KEY: "isolated-cache-api-only",
    ULTIMOTURNO_BLUE_RATE_MODE: "manual", ULTIMOTURNO_BLUE_RATE_ARS: "1540"
  });
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  let cardId: string;
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    await createManagedUser(db, { displayName: "Cache QA", email: "cache@qa.test", password: "cache-qa-isolated-password", role: "admin" }, actor);
    await replacePriceChartingCache(db, { category: "pokemon-cards", sourceHash: "cache-qa", rowsReceived: 1, rowsSkipped: 0, rows: [{
      priceChartingId: "cache-qa", canonicalUrl: "", sourceUrl: "", productName: "Cache QA", normalizedName: "cache qa",
      expansionName: "QA", normalizedExpansion: "qa", cardNumber: "1", loosePriceUsd: 1, imageUrl: "", searchKey: "cache qa"
    }] });
    await createClaimSession(db, { name: "Cache isolated claim" }, actor);
    cardId = (await addPriceChartingCardsToClaim(db, ["cache-qa"], actor)).cards[0].id;
  } finally { await db.close(); }
  const { handleRequest } = await import("./server.js");
  const server = createServer((request, response) => { void handleRequest(request, response); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const login = await fetch(origin + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "cache@qa.test", password: "cache-qa-isolated-password" }) });
  assert.equal(login.status, 200);
  const { token } = await login.json() as { token: string };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const stock = async (fresh = false) => {
    const response = await fetch(origin + "/stock" + (fresh ? "?fresh=1" : ""), { headers });
    assert.equal(response.status, 200);
    return response.json() as Promise<{ items: Array<{ quantityOnHand: number; priceArs: number }> }>;
  };
  const edit = async (body: unknown) => {
    const response = await fetch(origin + "/claims/cards/" + cardId, { method: "PUT", headers, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    return response.json() as Promise<{ stockRefreshRequired: boolean }>;
  };
  const original = await stock(); // Prime both the shared and the memory snapshots.
  assert.equal(original.items[0].quantityOnHand, 1);
  assert.equal((await edit({ buyer: "Buyer QA", finalPriceArs: 5000 })).stockRefreshRequired, false);
  assert.deepEqual(await stock(), original);
  assert.equal((await edit({ quantity: 3 })).stockRefreshRequired, true);
  assert.equal((await stock()).items[0].quantityOnHand, 3);
  assert.equal((await stock(true)).items[0].quantityOnHand, 3);
  assert.equal((await stock()).items[0].priceArs, original.items[0].priceArs);
  assert.equal((await edit({ imageUrl: "" })).stockRefreshRequired, true);
  assert.equal((await stock()).items[0].quantityOnHand, 3);
  const anonymous = await fetch(origin + "/claims/cards/" + cardId, { method: "PUT", headers: { "Content-Type": "application/json" }, body: '{"quantity":99}' });
  assert.equal(anonymous.status, 401);
  assert.equal((await stock()).items[0].quantityOnHand, 3);
});
