import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createOperationalDatabase, getDefaultOperationalUser, listStockForBusiness, addInventoryStock,
  createIsolatedStockUser, applyMaultCopies, claimMaultLease, releaseMaultLease, getMaultConnection, stageMaultPage } from "@ultimoturno/db";
import { maultService } from "./mault-integration.js";
import { maultFixtureConfig, maultFixtureCopy, maultFixtureProvider } from "./mault-test-fixtures.js";

test("automatic Mault ingestion preserves six collection tags, languages/images, receipts and source corrections", async t => {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-mault-api-")) });
  t.after(() => db.close());
  const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
  const provider = maultFixtureProvider();
  let invalidations = 0;
  const service = maultService(db, actor, { baseUrl: "https://mault.test/api", apiKey: "mv_fixture_only" }, { fetcher: provider.fetcher, invalidate: () => { invalidations++; } });
  const untouched = await addInventoryStock(db, { name: "Unrelated stock QA", expansion: "QA", number: "99", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 9, priceArs: 3000 }, actor);
  await service.configure({ version: 1, config: maultFixtureConfig() });
  await service.run(); // Empty initial baseline: automatic ingestion only starts after this checkpoint.
  assert.equal((await service.status()).baselineComplete, true);
  const languages = ["en", "es", "pt", "it", "de", "id"];
  maultFixtureConfig().collections.forEach((collection, index) => provider.copies.set("qa-copy-" + index, maultFixtureCopy("qa-copy-" + index, languages[index], collection.label)));
  for (let i = 0; i < 3; i++) await service.run();
  const stock = await listStockForBusiness(db, actor.businessId);
  for (const [index, collection] of maultFixtureConfig().collections.entries()) {
    const item = stock.items.find(i => i.product.name === "QA Mault " + languages[index]);
    assert.ok(item); assert.equal(item.tags, collection.tags[0]); assert.equal(item.variant.language, languages[index].toUpperCase());
    assert.equal(item.quantityOnHand, 1); assert.equal(item.location, "Caja QA");
    assert.ok(item.product.imageUrl?.startsWith(`https://assets.tcgdex.net/${languages[index]}/`));
  }
  assert.equal(stock.items.find(i => i.id === untouched.id)?.quantityOnHand, 9);
  const snapshot = JSON.stringify(stock.items.map(i => [i.id, i.quantityOnHand, i.priceArs, i.tags, i.product.imageUrl]));
  await service.run();
  const repeat = await service.apply({ copyIds: ["qa-copy-0"] });
  assert.equal(repeat.repeated, 1); assert.equal(repeat.imported, 0);
  assert.equal(JSON.stringify((await listStockForBusiness(db, actor.businessId)).items.map(i => [i.id, i.quantityOnHand, i.priceArs, i.tags, i.product.imageUrl])), snapshot);
  assert.ok(invalidations >= 6);
  const concurrent = await Promise.all([applyMaultCopies(db, actor, ["qa-copy-0"], { confirmHistory: false, conditionConfirmed: false }),
    applyMaultCopies(db, actor, ["qa-copy-0"], { confirmHistory: false, conditionConfirmed: false })]);
  assert.ok(concurrent.every(result => result.repeated === 1 && result.imported === 0));
  const corrected = provider.copies.get("qa-copy-0")!;
  provider.copies.set("qa-copy-0", { ...corrected, condition: "LP", updated_at: "2026-11-20T01:00:00Z" });
  await service.run();
  await assert.rejects(service.apply({ copyIds: ["qa-copy-0"] }), /cambio de identidad/);
  assert.equal((await listStockForBusiness(db, actor.businessId)).items.find(i => i.product.name === "QA Mault en")?.quantityOnHand, 1);
  assert.equal((await service.preview({})).totals.review, 1);
  await assert.rejects(service.apply({ copyIds: [] }), /Seleccion/);
  assert.throws(() => maultService(db, { ...actor, roles: ["stock_owner"] }, null), /administrador/);
  const isolated = await createIsolatedStockUser(db, { businessName: "Other mault QA", displayName: "Other QA", email: "other-mault@qa.test", password: "isolated-mault-qa", requestId: crypto.randomUUID() }, actor);
  const otherActor = { ...actor, businessId: isolated.business.id };
  assert.equal((await maultService(db, otherActor, null).preview({})).copies.length, 0);
  await assert.rejects(applyMaultCopies(db, otherActor, ["qa-copy-1"], { confirmHistory: true, conditionConfirmed: true }));
  assert.equal((await db.query("select copy_id from mault_copies where applied_at is not null")).rows.length, 6);
});

test("baseline requires explicit historical confirmation; missing images, approval, wrong identities and failures never add units", async t => {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-mault-negative-")) });
  t.after(() => db.close());
  const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] }, provider = maultFixtureProvider();
  const service = maultService(db, actor, { baseUrl: "https://mault.test/api", apiKey: "mv_fixture_only" }, { fetcher: provider.fetcher });
  provider.copies.set("historical", maultFixtureCopy("historical"));
  await service.configure({ version: 1, config: maultFixtureConfig() }); await service.run();
  assert.equal((await service.preview({})).totals.baseline, 1);
  await assert.rejects(service.apply({ copyIds: ["historical"] }), /historico/);
  assert.equal((await service.apply({ copyIds: ["historical"], confirmHistory: true })).imported, 1);
  provider.copies.set("needs-review", maultFixtureCopy("needs-review", "en", "Tools", { is_reviewed: false }));
  provider.copies.set("no-image", maultFixtureCopy("no-image", "pt", "Supporters"));
  provider.breakImages(true); await service.run();
  assert.equal((await db.query("select copy_id from mault_copies where applied_at is not null")).rows.length, 1);
  await assert.rejects(service.apply({ copyIds: ["needs-review"] }), /source_approval_required/);
  await assert.rejects(service.apply({ copyIds: ["no-image"] }), /verified_image_required/);
  provider.breakImages(false); provider.mismatchCatalog(true);
  await assert.rejects(service.apply({ copyIds: ["no-image"] }), /verified_image_required/);
  provider.mismatchCatalog(false);
  await service.prepareSelection({ copyIds: ["no-image"] });
  provider.breakImages(true);
  await assert.rejects(service.apply({ copyIds: ["no-image"] }), /verified_image_required/);
  provider.breakImages(false);
  await db.exec("create function reject_mault_qa() returns trigger language plpgsql as $$ begin if NEW.action='mault.import' then raise exception 'Injected receipt failure'; end if; return NEW; end $$; create trigger reject_mault_qa before insert on audit_log for each row execute function reject_mault_qa();");
  const before = (await listStockForBusiness(db, actor.businessId)).items.reduce((n, i) => n + i.quantityOnHand, 0);
  await assert.rejects(service.apply({ copyIds: ["no-image"] }), /Injected receipt failure/);
  assert.equal((await listStockForBusiness(db, actor.businessId)).items.reduce((n, i) => n + i.quantityOnHand, 0), before);
  assert.equal((await service.preview({})).copies.find(r => r.copyId === "no-image")?.appliedAt, null);
  await db.exec("drop trigger reject_mault_qa on audit_log");
  assert.equal((await service.apply({ copyIds: ["no-image"] })).imported, 1);
  const lease = await claimMaultLease(db, actor);
  await assert.rejects(claimMaultLease(db, actor), /ya esta sincronizando/);
  await assert.rejects(service.configure({ version: 2, config: maultFixtureConfig() }), /sincronizando/);
  await releaseMaultLease(db, actor, lease.token);
  assert.equal((await getMaultConnection(db, actor)).version, 2);
});

test("Mault preserves central prices/images and stamped variants; unavailable copies do not block other queued copies", async t => {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-mault-variants-")) });
  t.after(() => db.close());
  const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] }, provider = maultFixtureProvider();
  const service = maultService(db, actor, { baseUrl: "https://mault.test/api", apiKey: "mv_fixture_only" }, { fetcher: provider.fetcher });
  const existing = await addInventoryStock(db, { name: "QA Mault es", expansion: "QA Expansion", number: "1", language: "ES", condition: "NM", finish: "normal", location: "Caja QA", tags: "manual", imageUrl: "https://manual.test/override.webp", quantityOnHand: 4, priceArs: 7500, priceUsd: 5 }, actor);
  await db.query("update inventory_items set quantity_reserved=2 where id=$1 and business_id=$2", [existing.id, actor.businessId]);
  await service.configure({ version: 1, config: maultFixtureConfig() }); await service.run();
  provider.copies.set("normal-copy", maultFixtureCopy("normal-copy"));
  await service.run();
  const item = (await listStockForBusiness(db, actor.businessId)).items.find(i => i.id === existing.id)!;
  assert.equal(item.quantityOnHand, 5, JSON.stringify((await listStockForBusiness(db, actor.businessId)).items.map(i => ({ name: i.product.name, expansion: i.product.expansion, number: i.product.number, variant: i.variant, location: i.location, quantity: i.quantityOnHand })))); assert.equal(item.priceArs, 7500); assert.equal(item.priceUsd, 5);
  assert.equal(item.product.imageUrl, "https://manual.test/override.webp");
  assert.equal(item.quantityReserved, 2);
  assert.ok(item.tags.includes("manual") && item.tags.includes("items"));
  provider.copies.set("stamped-copy", maultFixtureCopy("stamped-copy", "es", "Items", { stamp: "Prize Pack" }));
  await service.run();
  assert.equal((await service.preview({})).copies.find(r => r.copyId === "stamped-copy")?.status, "review");
  await service.verifyImage({ copyId: "stamped-copy", imageUrl: "https://assets.tcgdex.net/es/qa/stamped.webp", confirmIdentity: true, stamp: "Prize Pack" });
  const simultaneous = await Promise.all([applyMaultCopies(db, actor, ["stamped-copy"], { confirmHistory: false, conditionConfirmed: false }),
    applyMaultCopies(db, actor, ["stamped-copy"], { confirmHistory: false, conditionConfirmed: false })]);
  assert.equal(simultaneous.reduce((n,r) => n+r.imported,0), 1);
  assert.equal(simultaneous.reduce((n,r) => n+r.repeated,0), 1);
  assert.equal((await service.apply({ copyIds: ["stamped-copy"] })).repeated, 1);
  const variants = (await listStockForBusiness(db, actor.businessId)).items;
  assert.equal(variants.find(i => i.id === existing.id)?.quantityOnHand, 5);
  assert.ok(variants.some(i => i.variant.finish.includes("Prize Pack") && i.quantityOnHand === 1));
  assert.equal((await db.query("select id from audit_log where action='mault.verify_image'")).rows.length, 1);
  provider.copies.set("removed-copy", maultFixtureCopy("removed-copy", "en", "Tools", { is_reviewed: false }));
  await service.run(); provider.copies.delete("removed-copy");
  provider.copies.set("later-copy", maultFixtureCopy("later-copy", "pt", "Supporters"));
  await service.run();
  assert.ok((await listStockForBusiness(db, actor.businessId)).items.some(i => i.variant.language === "PT" && i.quantityOnHand === 1));
  assert.ok((await service.preview({})).copies.find(r => r.copyId === "removed-copy")?.reasons.includes("source_unavailable"));
  for (const id of ["a-blocked-1", "a-blocked-2"]) provider.copies.set(id, maultFixtureCopy(id, "en", "Tools", { is_reviewed: false }));
  provider.copies.set("z-ready-copy", maultFixtureCopy("z-ready-copy", "de", "Energy"));
  for (let i=0;i<3;i++) await service.run();
  assert.ok((await service.preview({})).copies.find(r => r.copyId === "z-ready-copy")?.appliedAt, "Unchanged review rows must not starve other copies on replayed pages");
});

test("Mault resumes a partial baseline after failure and ignores older source corrections", async t => {
  const db = await createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-mault-pages-")) });
  t.after(() => db.close());
  const actor = { ...await getDefaultOperationalUser(db), roles: ["admin"] }, provider = maultFixtureProvider();
  provider.copies.set("page-a", maultFixtureCopy("page-a")); provider.copies.set("page-b", maultFixtureCopy("page-b", "pt", "Tools"));
  let failSecond = true;
  const fetcher: typeof fetch = async (target, options) => {
    const url = new URL(String(target));
    if (url.hostname === "mault.test" && url.pathname === "/api/v1/cards") {
      const second = url.searchParams.get("cursor") === "b";
      if (second && failSecond) return new Response("", { status: 503 });
      return new Response(JSON.stringify({ object: "list", data: [provider.copies.get(second ? "page-b" : "page-a")], has_more: !second,
        next_page: second ? null : "https://mault.test/v1/cards?limit=200&cursor=b", next_since: "2026-11-20T02:00:00Z" }), { headers: { "content-type": "application/json" } });
    }
    return provider.fetcher(target, options);
  };
  const service = maultService(db, actor, { baseUrl: "https://mault.test/api", apiKey: "mv_fixture_only" }, { fetcher });
  await service.configure({ version: 1, config: maultFixtureConfig() });
  assert.equal((await service.run()).more, true);
  const checkpoint = await getMaultConnection(db, actor);
  assert.equal(checkpoint.baseline_complete, false); assert.equal(checkpoint.watermark, null); assert.ok(checkpoint.next_page);
  await assert.rejects(service.run(), /503/);
  assert.equal((await getMaultConnection(db, actor)).next_page, checkpoint.next_page);
  failSecond = false; await service.run();
  assert.equal((await service.preview({})).totals.baseline, 2);
  assert.equal((await listStockForBusiness(db, actor.businessId)).items.length, 0);
  const lease = await claimMaultLease(db, actor);
  await stageMaultPage(db, actor, lease.token, { cards: [maultFixtureCopy("page-a", "es", "Items", { condition: "LP", updated_at: "2026-11-19T00:00:00Z" })], nextPage: null, nextSince: "2026-11-20T02:00:00Z" }, false);
  await releaseMaultLease(db, actor, lease.token);
  assert.equal((await service.preview({})).copies.find(r => r.copyId === "page-a")?.copy.condition, "NM");
  assert.equal((await service.apply({ copyIds: ["page-a", "page-b"], confirmHistory: true })).imported, 2);
});

test("Mault routes require authentication and never disclose the source key", async t => {
  for (const key of ["DATABASE_URL", "ULTIMOTURNO_DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRICECHARTING_TOKEN", "OPENAI_API_KEY"]) process.env[key] = "";
  Object.assign(process.env, { ULTIMOTURNO_DB_DRIVER: "pglite", PGLITE_DATA_DIR: await mkdtemp(path.join(tmpdir(), "ut-mault-http-")), ULTIMOTURNO_ENV: "staging", ULTIMOTURNO_ALLOW_EXAMPLES: "false", ULTIMOTURNO_ACCESS_KEY: "mault-http-qa-only", MAULT_API_KEY: "mv_fixture_hidden", MAULT_BUSINESS_ID: "other-business" });
  const { handleRequest } = await import("./server.js");
  const server = createServer((req, res) => { void handleRequest(req, res); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(base + "/integrations/mault/status")).status, 401);
  const result = await fetch(base + "/integrations/mault/status", { headers: { "X-UltimoTurno-Access-Key": "mault-http-qa-only" } });
  assert.equal(result.status, 200); const text = await result.text(); assert.ok(!text.includes("mv_fixture_hidden")); assert.equal(JSON.parse(text).configured, false);
});
