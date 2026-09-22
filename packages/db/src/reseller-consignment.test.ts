import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import {
  assignResellerStock,
  cancelOwnResellerOrder,
  cancelResellerSale,
  confirmOwnResellerOrder,
  createOperationalDatabase,
  createReseller,
  createResellerOrder,
  createResellerSale,
  createSale,
  getAuthenticatedUserContext,
  getDefaultOperationalUser,
  getResellerDashboard,
  listStockForBusiness,
  loginUser,
  updateOwnResellerOrderWorkflow,
  upsertInventoryItem
} from "./index.js";

it("keeps consigned stock available centrally and validates real stock when a reseller sells", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-reseller-"));
  const db = await createOperationalDatabase({ dataDir });
  const admin = await getDefaultOperationalUser(db);
  const item = await upsertInventoryItem(db, {
    sku: "TEST-CONSIGNMENT-001",
    name: "Pikachu Consignacion",
    expansion: "Set Test",
    number: "25",
    language: "EN",
    condition: "NM",
    finish: "normal",
    quantityOnHand: 3,
    quantityReserved: 0,
    priceArs: 10000
  }, admin);
  let dashboard = await createReseller(db, {
    displayName: "Revendedor Test",
    email: "revendedor@test.local",
    password: "password-segura",
    commissionPercent: 20
  }, admin);
  dashboard = await assignResellerStock(db, dashboard.reseller.userId, item.id, 2, admin);
  assert.equal(dashboard.summary.remainingUnits, 2);
  assert.equal(dashboard.globalStock[0].availableQuantity, 3);
  assert.equal((await listStockForBusiness(db, admin.businessId)).items[0].availableQuantity, 3);

  const session = await loginUser(db, "revendedor@test.local", "password-segura");
  const reseller = await getAuthenticatedUserContext(db, session.token);
  assert.ok(reseller?.roles.includes("reseller"));
  dashboard = await createResellerOrder(db, {
    customerName: "Pedido cancelado",
    lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 12000 }]
  }, reseller!);
  assert.equal(dashboard.orders[0].status, "pending");
  assert.equal((await listStockForBusiness(db, admin.businessId)).items[0].quantityOnHand, 3);
  dashboard = await cancelOwnResellerOrder(db, dashboard.orders[0].id, reseller!);
  assert.equal(dashboard.orders[0].status, "cancelled");
  dashboard = await createResellerOrder(db, {
    customerName: "Cliente final",
    lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 12000 }]
  }, reseller!);
  const pendingOrder = dashboard.orders.find((order) => order.status === "pending")!;
  assert.equal(pendingOrder.fulfillmentStatus, "to_pack");
  assert.equal(pendingOrder.paymentStatus, "pending");
  await assert.rejects(() => updateOwnResellerOrderWorkflow(db, pendingOrder.id, { fulfillmentStatus: "to_deliver" }, reseller!), /Primero confirma la venta/);

  await createSale(db, {
    customerName: "Venta central",
    saleType: "sale",
    channel: "mostrador",
    lines: [{ inventoryItemId: item.id, quantity: 2, unitPriceArs: 10000 }]
  }, admin);
  dashboard = await getResellerDashboard(db, dashboard.reseller.userId, admin.businessId);
  assert.equal(dashboard.assignments[0].remaining, 2);
  assert.equal(dashboard.assignments[0].sellable, 1);

  await assert.rejects(() => createResellerSale(db, {
    customerName: "No alcanza",
    lines: [{ inventoryItemId: item.id, quantity: 2, unitPriceArs: 12000 }]
  }, reseller!), /vendio parte de este stock/);

  dashboard = await confirmOwnResellerOrder(db, pendingOrder.id, reseller!);
  const sale = dashboard.sales[0];
  assert.equal(dashboard.orders.find((order) => order.id === pendingOrder.id)?.status, "converted");
  dashboard = await updateOwnResellerOrderWorkflow(db, pendingOrder.id, { fulfillmentStatus: "to_deliver", paymentStatus: "paid" }, reseller!);
  const readyOrder = dashboard.orders.find((order) => order.id === pendingOrder.id)!;
  assert.equal(readyOrder.fulfillmentStatus, "to_deliver");
  assert.equal(readyOrder.paymentStatus, "paid");
  assert.ok(readyOrder.packedAt);
  assert.ok(readyOrder.paidAt);
  dashboard = await updateOwnResellerOrderWorkflow(db, pendingOrder.id, { fulfillmentStatus: "delivered" }, reseller!);
  assert.ok(dashboard.orders.find((order) => order.id === pendingOrder.id)?.deliveredAt);
  assert.equal(sale.commissionArs, 2400);
  assert.equal(sale.netDueArs, 9600);
  assert.equal((await listStockForBusiness(db, admin.businessId)).items[0].quantityOnHand, 0);

  dashboard = await cancelResellerSale(db, sale.id, admin);
  assert.equal(dashboard.assignments[0].sold, 0);
  assert.equal((await listStockForBusiness(db, admin.businessId)).items[0].quantityOnHand, 1);
  await db.close();
});
