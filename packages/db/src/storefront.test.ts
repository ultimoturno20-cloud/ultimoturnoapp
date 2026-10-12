import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { assignResellerStockBatch, createOperationalDatabase, createReseller, createSale, getDefaultOperationalUser, listStockForBusiness, listStoreCatalog, setStorefrontPublication, updateInventoryItemTags, upsertInventoryItem } from "./index.js";

it("publishes only explicitly selected, eligible central units with an isolated public DTO", async t => {
  const db = await createOperationalDatabase({ dataDir: await mkdtemp(path.join(tmpdir(), "ultimoturno-storefront-")) });
  t.after(() => db.close());
  const admin = { ...await getDefaultOperationalUser(db), roles: ["admin"] };
  const cards = [];
  for (let n = 1; n <= 12; n++) cards.push(await upsertInventoryItem(db, { sku: `PRIVATE-${n}`, name: `Carta ${n}`, expansion: "Scarlet & Violet 151", number: String(n), priceChartingId: `store-test-${n}`, language: "EN", condition: "NM", finish: "normal", quantityOnHand: 6, quantityReserved: 1, priceArs: 1000 }, admin));
  const ids = cards.map(card => card.id);

  await t.test("defaults hidden; strict admin, valid IDs, business ownership and atomic batches", async () => {
    assert.equal((await listStoreCatalog(db)).total, 0);
    assert.ok((await listStockForBusiness(db, admin.businessId)).items.every(card => card.storefrontPublished === false));
    await assert.rejects(() => setStorefrontPublication(db, { inventoryItemIds: ids, published: true }, { ...admin, roles: ["stock_owner"] }), { statusCode: 403 });
    await assert.rejects(() => setStorefrontPublication(db, { inventoryItemIds: ids, published: true }, { ...admin, roles: undefined }), { statusCode: 403 });
    for (const inventoryItemIds of [[], [ids[0], ids[0]], ["bad"], [ids[0], crypto.randomUUID()]]) {
      await assert.rejects(() => setStorefrontPublication(db, { inventoryItemIds, published: true }, admin), { statusCode: 400 });
    }
    await assert.rejects(() => setStorefrontPublication(db, { inventoryItemIds: ids, published: "true" as never }, admin), { statusCode: 400 });
    await assert.rejects(() => setStorefrontPublication(db, null as never, admin), { statusCode: 400 });
    await assert.rejects(() => setStorefrontPublication(db, { inventoryItemIds: ids, published: true }, { ...admin, businessId: crypto.randomUUID() }), { statusCode: 400 });
    assert.equal((await listStoreCatalog(db)).total, 0);
    const first = await setStorefrontPublication(db, { inventoryItemIds: ids.slice(0, 11), published: true }, admin);
    assert.equal(first.changedCount, 11);
    assert.equal((await setStorefrontPublication(db, { inventoryItemIds: ids.slice(0, 11).reverse(), published: true }, admin)).changedCount, 0);
    assert.equal((await db.query("select id from audit_log where action = 'inventory.storefront_publication'")).rows.length, 1);
    assert.ok((await db.query<{ quantity_on_hand: number; quantity_reserved: number }>("select quantity_on_hand, quantity_reserved from inventory_items")).rows.every(row => row.quantity_on_hand === 6 && row.quantity_reserved === 1));
  });

  await t.test("excludes No venta, inactive, exhausted, reserved, assigned, missing ARS prices and hidden items", async () => {
    await db.query("update inventory_items set inventory_status = 'not_for_sale' where id = $1", [ids[0]]);
    await db.query("update inventory_items set active = false where id = $1", [ids[1]]);
    await db.query("update inventory_items set quantity_on_hand = 0, quantity_reserved = 0 where id = $1", [ids[2]]);
    await db.query("update inventory_items set quantity_reserved = 6 where id = $1", [ids[3]]);
    await db.query("update current_prices set price_ars = null, price_usd = 25 where inventory_item_id = $1", [ids[4]]);
    const reseller = await createReseller(db, { displayName: "Catalog test", email: "catalog@test.local", password: "local-test-only", commissionPercent: 20 }, admin);
    await assignResellerStockBatch(db, reseller.reseller.userId, { idempotencyKey: crypto.randomUUID(), lines: [{ inventoryItemId: ids[5], quantity: 5 }, { inventoryItemId: ids[6], quantity: 2 }] }, admin);
    const page = await listStoreCatalog(db);
    assert.equal(page.total, 5);
    assert.equal(page.items.find(item => item.id === ids[6])?.availableQuantity, 3);
    assert.ok(page.items.every(item => item.priceArs === 1000));
    assert.ok(!page.items.some(item => item.id === ids[11]));
    assert.equal((await listStoreCatalog(db, {}, "nonexistent-business")).total, 0);
    const dto = page.items[0];
    assert.deepEqual(Object.keys(dto).sort(), ["id", "name", "expansion", "number", "imageUrl", "language", "condition", "finish", "gradingCompany", "grade", "cardType", "category", "itemKind", "priceArs", "availableQuantity"].sort());
    assert.equal(dto.cardType, "unknown");
    assert.equal(dto.category, "singles");
    const stock = await listStockForBusiness(db, admin.businessId);
    assert.equal(stock.items.find(item => item.id === ids[6])?.freeQuantity, 3);
    const sale = await createSale(db, { customerName: "Local reservation", saleType: "reservation", channel: "test", lines: [{ inventoryItemId: ids[6], quantity: 1, unitPriceArs: 1000 }] }, admin);
    await db.query("update sales set assigned_reseller_user_id = $1 where id = $2", [reseller.reseller.userId, sale.id]);
    assert.equal((await listStoreCatalog(db)).items.find(item => item.id === ids[6])?.availableQuantity, 3);
    assert.equal((await listStockForBusiness(db, admin.businessId)).items.find(item => item.id === ids[6])?.freeQuantity, 3);
  });

  await t.test("hides linked and legacy claim cards until the claim is no longer open", async () => {
    const claimId = crypto.randomUUID();
    await db.query("insert into claim_sessions (id, business_id, name) values ($1,$2,'Local catalog test')", [claimId, admin.businessId]);
    await db.query("insert into claim_cards (id,business_id,claim_id,pricecharting_id,product_name,inventory_item_id) values ($1,$2,$3,'local-claim','Carta 8',$4)", [crypto.randomUUID(), admin.businessId, claimId, ids[7]]);
    await db.query("insert into claim_cards (id,business_id,claim_id,pricecharting_id,product_name) values ($1,$2,$3,$4,'Carta 9')", [crypto.randomUUID(), admin.businessId, claimId, `inventory:${ids[8]}`]);
    await db.query("insert into claim_cards (id,business_id,claim_id,pricecharting_id,product_name) values ($1,$2,$3,'store-test-10','Carta 10')", [crypto.randomUUID(), admin.businessId, claimId]);
    const before = await listStoreCatalog(db);
    assert.equal(before.total, 2);
    assert.ok(!before.items.some(item => [ids[7], ids[8], ids[9]].includes(item.id)));
    await db.query("update claim_sessions set status = 'closed' where id = $1", [claimId]);
    assert.equal((await listStoreCatalog(db)).total, 5);
    await db.query("update card_products set image_url = '/api/private-image' where id = (select product_id from inventory_items where id = $1)", [ids[9]]);
    assert.equal((await listStoreCatalog(db)).items.find(item => item.id === ids[9])?.imageUrl, "");
  });

  await t.test("publication stays independent of stock edits, public prices stay current and hiding removes items", async () => {
    await upsertInventoryItem(db, { sku: "PRIVATE-11", name: "Bulbasaur", expansion: "Scarlet & Violet 151", number: "1", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 7, quantityReserved: 1, priceArs: 2300 }, admin);
    const visible = (await listStoreCatalog(db)).items.find(item => item.id === ids[10]);
    assert.equal(visible?.priceArs, 2300);
    assert.equal(visible?.availableQuantity, 6);
    assert.equal(visible?.cardType, "pokemon");
    await setStorefrontPublication(db, { inventoryItemIds: [ids[10]], published: false }, admin);
    assert.ok(!(await listStoreCatalog(db)).items.some(item => item.id === ids[10]));
    const folder = await upsertInventoryItem(db, { sku: "PUBLIC-FOLDER", name: "Master set 151", expansion: "Coleccion", itemKind: "folder", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 1, priceArs: 1234 }, admin);
    await setStorefrontPublication(db, { inventoryItemIds: [folder.id], published: true }, admin);
    const publicFolder = (await listStoreCatalog(db)).items.find(item => item.id === folder.id);
    assert.equal(publicFolder?.itemKind, "folder");
    assert.equal(publicFolder?.priceArs, folder.priceArs);
    assert.equal(publicFolder?.availableQuantity, 1);
    assert.equal(publicFolder?.category, "other");
  });

  await t.test("filters inventory product categories server-side without changing stock, prices or publication", async () => {
    const financialState = () => db.query("select ii.id, ii.quantity_on_hand, ii.quantity_reserved, ii.storefront_published, cp.price_ars from inventory_items ii join current_prices cp on cp.inventory_item_id = ii.id order by ii.id");
    const before = (await financialState()).rows;
    await updateInventoryItemTags(db, ids[6], "SELLADO; vitrina", admin);
    await updateInventoryItemTags(db, ids[7], "accesorios, private-internal-note", admin);
    await updateInventoryItemTags(db, ids[8], "otros", admin);
    const sealed = await listStoreCatalog(db, { category: "sealed" });
    assert.deepEqual(sealed.items.map(item => item.id), [ids[6]]);
    assert.equal(sealed.total, 1);
    assert.equal(sealed.items[0].availableQuantity, 3);
    assert.deepEqual((await listStoreCatalog(db, { category: "accessories" })).items.map(item => item.id), [ids[7]]);
    assert.deepEqual((await listStoreCatalog(db, { category: "singles" })).items.map(item => item.id), [ids[9]]);
    assert.equal((await listStoreCatalog(db, { category: "other" })).total, 2);
    assert.ok(!JSON.stringify(await listStoreCatalog(db)).includes("private-internal-note"));
    await updateInventoryItemTags(db, ids[6], "accesorios", admin);
    assert.equal((await listStoreCatalog(db, { category: "sealed" })).total, 0);
    assert.equal((await listStoreCatalog(db, { category: "accessories" })).total, 2);
    assert.deepEqual((await financialState()).rows, before);
  });
});
