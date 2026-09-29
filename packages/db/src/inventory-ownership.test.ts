import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import {
  addInventoryStock,
  assignResellerStock,
  createManagedUser,
  createOperationalDatabase,
  createReseller,
  createSale,
  getAuthenticatedUserContext,
  getDefaultOperationalUser,
  listStockForActor,
  listStockForBusiness,
  loginUser
} from "./index.js";

it("separates owned stock and prevents owners from selling another user's units", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-ownership-"));
  const db = await createOperationalDatabase({ dataDir });
  const admin = { ...(await getDefaultOperationalUser(db)), roles: ["admin"] };
  const germanUser = await createManagedUser(db, {
    displayName: "German",
    email: "german@test.local",
    password: "password-segura-123",
    role: "stock_owner"
  }, admin);
  const session = await loginUser(db, germanUser.email, "password-segura-123");
  const german = await getAuthenticatedUserContext(db, session.token);
  assert.ok(german?.roles.includes("stock_owner"));

  const companyItem = await addInventoryStock(db, {
    name: "Pikachu Compartido",
    expansion: "Set Test",
    number: "25",
    language: "EN",
    condition: "NM",
    finish: "normal",
    quantityOnHand: 2,
    priceArs: 10000
  }, admin);
  const germanItem = await addInventoryStock(db, {
    ownerUserId: germanUser.id,
    name: "Pikachu Compartido",
    expansion: "Set Test",
    number: "25",
    language: "EN",
    condition: "NM",
    finish: "normal",
    quantityOnHand: 2,
    priceArs: 10000
  }, admin);

  assert.notEqual(companyItem.id, germanItem.id);
  assert.equal((await listStockForBusiness(db, admin.businessId)).items.length, 2);
  assert.deepEqual((await listStockForActor(db, german!)).items.map((item) => item.id), [germanItem.id]);
  const reseller = await createReseller(db, {
    displayName: "Revendedor Test",
    email: "revendedor@test.local",
    password: "password-segura-456",
    commissionPercent: 20
  }, admin);
  await assert.rejects(
    () => assignResellerStock(db, reseller.reseller.userId, companyItem.id, 1, german!),
    /otro propietario/
  );
  const assigned = await assignResellerStock(db, reseller.reseller.userId, germanItem.id, 1, german!);
  assert.equal(assigned.assignments.find((item) => item.inventoryItemId === germanItem.id)?.assigned, 1);
  await assert.rejects(() => createSale(db, {
    customerName: "Venta ajena",
    saleType: "sale",
    channel: "mostrador",
    lines: [{ inventoryItemId: companyItem.id, quantity: 1, unitPriceArs: 10000 }]
  }, german!), /otro propietario/);
  await createSale(db, {
    customerName: "Venta propia",
    saleType: "sale",
    channel: "mostrador",
    lines: [{ inventoryItemId: germanItem.id, quantity: 1, unitPriceArs: 10000 }]
  }, german!);
  await createSale(db, {
    customerName: "Venta admin",
    saleType: "sale",
    channel: "mostrador",
    lines: [{ inventoryItemId: germanItem.id, quantity: 1, unitPriceArs: 10000 }]
  }, admin);
  assert.equal((await listStockForBusiness(db, admin.businessId)).items.find((item) => item.id === germanItem.id)?.quantityOnHand, 0);
  await db.close();
});
