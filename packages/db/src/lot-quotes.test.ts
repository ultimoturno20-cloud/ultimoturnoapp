import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createOperationalDatabase, getDefaultOperationalUser, addInventoryStock, createClaimSession, createIsolatedStockUser, listLotQuotes, getLotQuote, saveLotQuote } from "./index.js";
import type { LotQuoteDraft, SaveLotQuote } from "@ultimoturno/domain";

const draft = (): LotQuoteDraft => ({ name: "QA lot", notes: "QA only", status: "draft", currency: "ARS", exchangeRate: 1500, purchasePercent: 70, lines: [{ id: crypto.randomUUID(), name: "QA card", expansion: "QA", number: "1", language: "EN", condition: "NM", finish: "reverse", quantity: 3, referencePrice: 1200, unitPrice: 1500, imageUrl: "https://example.test/card.png", sourceUrl: "https://example.test/card", sourceName: "QA", sourceUpdatedAt: "2026-11-09", notes: "" }] });
const request = (): SaveLotQuote => ({ requestId: crypto.randomUUID(), version: 0, draft: draft() });
const database = async () => createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-lot-quotes-")) });

test("lot quote saves and archive do not modify any inventory, claims, orders or other operational tables", async () => {
  const db = await database();
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    await addInventoryStock(db, { name: "QA card", expansion: "QA", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 8, priceArs: 9000 }, actor);
    await createClaimSession(db, { name: "Unrelated QA claim" }, actor);
    const snapshot = async () => {
      const tables = (await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not in ('audit_log','lot_quotes') order by table_name")).rows;
      const hash = createHash("sha256");
      for (const { table_name: table } of tables) { assert.match(table, /^[a-z_0-9]+$/); hash.update(JSON.stringify((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as data from "${table}" t`)).rows)); }
      return hash.digest("hex");
    };
    const before = await snapshot();
    const id = crypto.randomUUID(), body = request();
    const created = await saveLotQuote(db, actor, id, body);
    assert.equal(created.version, 1); assert.deepEqual(created.lines, body.draft.lines);
    assert.deepEqual(await getLotQuote(db, actor, id), created);
    const updated = await saveLotQuote(db, actor, id, { ...body, requestId: crypto.randomUUID(), version: 1, draft: { ...body.draft, status: "archived" } });
    assert.equal(updated.version, 2); assert.equal(updated.status, "archived");
    assert.equal(await snapshot(), before);
    const list = await listLotQuotes(db, actor);
    assert.equal(list.total, 1); assert.equal(list.items[0].lineCount, 1); assert.equal("lines" in list.items[0], false);
    assert.equal((await db.query("select id from audit_log where entity_type='lot_quote'")).rows.length, 2);
  } finally { await db.close(); }
});

test("lot quote retries, competing versions and reused request IDs cannot duplicate or overwrite", async () => {
  const db = await database();
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    const id = crypto.randomUUID(), body = request();
    const [one, two] = await Promise.all([saveLotQuote(db, actor, id, body), saveLotQuote(db, actor, id, body)]);
    assert.deepEqual(one, two);
    assert.equal((await db.query("select id from audit_log where entity_type='lot_quote'")).rows.length, 1);
    await assert.rejects(saveLotQuote(db, actor, id, { ...body, draft: { ...body.draft, name: "Changed retry" } }), { statusCode: 409 });
    const first = { requestId: crypto.randomUUID(), version: 1, draft: { ...body.draft, name: "First tab" } };
    const second = { requestId: crypto.randomUUID(), version: 1, draft: { ...body.draft, name: "Second tab" } };
    const races = await Promise.allSettled([saveLotQuote(db, actor, id, first), saveLotQuote(db, actor, id, second)]);
    assert.equal(races.filter(result => result.status === "fulfilled").length, 1);
    const failure = races.find(result => result.status === "rejected") as PromiseRejectedResult;
    assert.equal(failure.reason.statusCode, 409);
    assert.equal((await getLotQuote(db, actor, id)).name, "First tab");
    assert.equal((await saveLotQuote(db, actor, id, first)).version, 2);
    await assert.rejects(saveLotQuote(db, actor, id, body), { statusCode: 409 });
    assert.equal((await db.query("select id from audit_log where entity_type='lot_quote'")).rows.length, 2);
  } finally { await db.close(); }
});

test("lot quotes deny nonadmins and all reads/writes across businesses, including create collisions", async () => {
  const db = await database();
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    const isolated = await createIsolatedStockUser(db, { requestId: crypto.randomUUID(), businessName: "Other QA", displayName: "Other QA", email: "other@quotes.test", password: "quotes-test-only-password" }, actor);
    const other = { ...actor, id: isolated.user.id, businessId: isolated.business.id };
    const id = crypto.randomUUID(); await saveLotQuote(db, actor, id, request());
    for (const roles of [undefined, [], ["stock_owner"], ["reseller"], ["admin_readonly"]]) {
      const denied = { ...actor, roles };
      await assert.rejects(listLotQuotes(db, denied), { statusCode: 403 });
      await assert.rejects(getLotQuote(db, denied, id), { statusCode: 403 });
      await assert.rejects(saveLotQuote(db, denied, id, request()), { statusCode: 403 });
    }
    assert.equal((await listLotQuotes(db, other)).total, 0);
    await assert.rejects(getLotQuote(db, other, id), { statusCode: 404 });
    await assert.rejects(saveLotQuote(db, other, id, request()), { statusCode: 404 });
    await assert.rejects(saveLotQuote(db, other, id, { ...request(), version: 1 }), { statusCode: 404 });
    await assert.rejects(getLotQuote(db, actor, "invalid"), { statusCode: 404 });
    await assert.rejects(listLotQuotes(db, actor, { offset: -1 }), { statusCode: 400 });
    await assert.rejects(saveLotQuote(db, actor, crypto.randomUUID(), { ...request(), draft: {} }), { statusCode: 400 });
    assert.equal((await getLotQuote(db, actor, id)).version, 1);
  } finally { await db.close(); }
});

test("lot quotes preserve all 1000 lines, paginate complete history and roll back on audit failure", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ut-lot-quotes-"));
  let db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    const id = crypto.randomUUID(), body = request();
    body.draft.lines = Array.from({ length: 1000 }, (_, index) => ({ ...body.draft.lines[0], id: crypto.randomUUID(), name: `QA ${index}` }));
    await saveLotQuote(db, actor, id, body);
    assert.equal((await getLotQuote(db, actor, id)).lines.length, 1000);
    const rows = Array.from({ length: 31 }, () => ({ id: crypto.randomUUID(), requestId: crypto.randomUUID() }));
    await db.query(`insert into lot_quotes(id,business_id,created_by,version,document,last_request_id)
      select id,$2,$3,1,$4::jsonb,"requestId" from jsonb_to_recordset($1::jsonb) as x(id uuid,"requestId" uuid)`, [JSON.stringify(rows), actor.businessId, actor.id, JSON.stringify(draft())]);
    const first = await listLotQuotes(db, actor), second = await listLotQuotes(db, actor, { offset: 30 });
    assert.equal(first.total, 32); assert.equal(first.items.length, 30); assert.equal(second.items.length, 2);
    assert.equal(new Set([...first.items, ...second.items].map(row => row.id)).size, 32);
    const failId = crypto.randomUUID();
    await assert.rejects(saveLotQuote(db, { ...actor, id: crypto.randomUUID() }, id, { ...request(), version: 1 }));
    assert.equal((await getLotQuote(db, actor, id)).version, 1);
    await assert.rejects(saveLotQuote(db, { ...actor, id: crypto.randomUUID() }, failId, request()));
    await assert.rejects(getLotQuote(db, actor, failId), { statusCode: 404 });
    await db.close();
    db = await createOperationalDatabase({ driver: "pglite", dataDir: dir });
    assert.equal((await getLotQuote(db, actor, id)).lines.length, 1000);
  } finally { await db.close(); }
});
