import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createOperationalDatabase, createIsolatedStockUser, createManagedUser, getDefaultOperationalUser, getAuthenticatedUserContext, loginUser, logoutUser, addInventoryStock, getInventoryItem, listStockForBusiness, listManagedUsers, type IsolatedStockUserInput } from "./index.js";

const input = (): IsolatedStockUserInput => ({ requestId: crypto.randomUUID(), businessName: "Independent QA", displayName: "Owner QA", email: `owner-${crypto.randomUUID()}@isolated.test`, password: "isolated-account-test-only" });
const database = async () => createOperationalDatabase({ driver: "pglite", dataDir: await mkdtemp(path.join(tmpdir(), "ut-isolated-stock-")) });

test("isolated stock account starts empty and never joins the central inventory", async () => {
  const db = await database();
  try {
    const admin = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    const card = { name: "Shared identity QA", expansion: "QA", number: "1", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 3, priceArs: 1000 };
    const central = await addInventoryStock(db, card, admin);
    const result = await createIsolatedStockUser(db, input(), admin);
    assert.equal(result.created, true);
    assert.notEqual(result.business.id, admin.businessId);
    assert.deepEqual(result.user.roles, ["stock_owner"]);
    assert.equal((await listStockForBusiness(db, result.business.id)).items.length, 0);
    assert.equal((await listManagedUsers(db, admin.businessId)).users.some(user => user.id === result.user.id), false);
    const actor = { id: result.user.id, businessId: result.business.id, displayName: result.user.displayName, email: result.user.email, roles: result.user.roles };
    const own = await addInventoryStock(db, { ...card, ownerUserId: admin.id, productId: central.product.id, variantId: central.variant.id, sku: central.sku, priceArs: 7000, quantityOnHand: 2 }, actor);
    assert.notEqual(own.id, central.id);
    assert.notEqual(own.product.id, central.product.id);
    assert.equal(own.ownerUserId, result.user.id);
    assert.equal(own.quantityOnHand, 2);
    assert.equal(own.priceArs, 7000);
    assert.deepEqual((await listStockForBusiness(db, admin.businessId)).items.map(x => [x.id,x.quantityOnHand,x.priceArs]), [[central.id,3,1000]]);
    assert.equal(await getInventoryItem(db, central.id, actor.businessId), null);
    assert.equal(await getInventoryItem(db, own.id, admin.businessId), null);
    assert.equal((await db.query("select 1 from store_settings where business_id=$1", [actor.businessId])).rows.length, 0);
  } finally { await db.close(); }
});

test("isolated account retries preserve identity and password without extra tenants or audits", async () => {
  const db = await database();
  try {
    const admin = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    const data = input();
    const results = await Promise.all([createIsolatedStockUser(db, data, admin),createIsolatedStockUser(db, data, admin)]);
    assert.equal(results.filter(x => x.created).length, 1);
    assert.equal(results[0].user.id, results[1].user.id);
    const retry = await createIsolatedStockUser(db, { ...data, password: "a-different-test-password" }, admin);
    assert.equal(retry.created, false);
    const session = await loginUser(db, data.email, data.password);
    const me = await getAuthenticatedUserContext(db, session.token);
    assert.equal(me?.businessId, data.requestId);
    assert.deepEqual(me?.roles, ["stock_owner"]);
    await logoutUser(db, session.token);
    await assert.rejects(loginUser(db, data.email, "a-different-test-password"), /incorrectos/);
    assert.equal((await db.query("select id from audit_log where action='user.create-isolated-stock'")).rows.length, 1);
    await assert.rejects(createIsolatedStockUser(db, { ...data, email: "other@isolated.test" }, admin), { statusCode: 409 });
    await assert.rejects(createIsolatedStockUser(db, { ...data, requestId: crypto.randomUUID() }, admin), { statusCode: 409 });
    assert.equal((await db.query("select id from businesses")).rows.length, 2);
  } finally { await db.close(); }
});

test("isolated provisioning denies other roles, tenant admins, invalid data and occupied IDs", async () => {
  const db = await database();
  try {
    const admin = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    for (const roles of [undefined, [], ["stock_owner"], ["reseller"]]) await assert.rejects(createIsolatedStockUser(db, input(), { ...admin, roles }), { statusCode: 403 });
    for (const override of [{ requestId: admin.businessId },{ requestId: "invalid" },{ email: "invalid" },{ businessName: "" },{ displayName: "" },{ displayName: "Sistema local" },{ password: "short" }]) await assert.rejects(createIsolatedStockUser(db, { ...input(), ...override }, admin), { statusCode: 400 });
    const first = await createIsolatedStockUser(db, input(), admin);
    await assert.rejects(createIsolatedStockUser(db, input(), { ...admin, businessId: first.business.id }), { statusCode: 403 });
    const occupied = crypto.randomUUID();
    await db.query("insert into businesses(id,name,slug) values($1,'Existing QA','existing-qa')", [occupied]);
    await assert.rejects(createIsolatedStockUser(db, { ...input(), requestId: occupied }, admin), { statusCode: 409 });
    const managed = await createManagedUser(db, { displayName: "Existing managed QA", email: "existing@isolated.test", password: "existing-managed-test-password", role: "admin" }, admin);
    await assert.rejects(createIsolatedStockUser(db, { ...input(), email: managed.email.toUpperCase() }, admin), { statusCode: 409 });
    assert.equal((await db.query("select id from businesses")).rows.length, 3);
  } finally { await db.close(); }
});

test("isolated provisioning rolls back the whole account when the audit fails", async () => {
  const db = await database();
  try {
    const admin = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
    const data = input();
    await assert.rejects(createIsolatedStockUser(db, data, { ...admin, id: crypto.randomUUID() }));
    assert.equal((await db.query("select id from businesses where id=$1", [data.requestId])).rows.length, 0);
    assert.equal((await db.query("select id from app_users where email=$1", [data.email])).rows.length, 0);
    assert.equal((await db.query("select id from roles where business_id=$1", [data.requestId])).rows.length, 0);
  } finally { await db.close(); }
});
