import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  addInventoryStock,
  createOperationalDatabase,
  createSale,
  getDefaultOperationalUser,
  getOrderBoards,
  listSales,
  mergeDuplicateCustomerOrders,
  updateSalePayment
} from "./index.js";

test("USD orders can take partial payments and leave Vencidas when the dollar balance is settled", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ut-payment-usd-"));
  const db = await createOperationalDatabase({ dataDir });
  try {
    const user = await getDefaultOperationalUser(db);
    const item = await addInventoryStock(db, {
      name: "USD Parcial",
      expansion: "Test",
      language: "EN",
      condition: "NM",
      finish: "normal",
      quantityOnHand: 2,
      priceArs: 100
    }, user);
    const sale = await createSale(db, {
      customerName: "Cliente USD",
      saleType: "reservation",
      channel: "claim",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 100 }]
    }, user);
    await db.query("update sales set total_ars = 0, total_usd = 25, payment_due_at = current_date - 1 where id = $1", [sale.id]);

    const partial = await updateSalePayment(db, sale.id, undefined, user, undefined, 10);
    assert.equal(partial.amountPaidUsd, 10);
    assert.equal(partial.totalUsd, 25);
    let workspace = await getOrderBoards(db, user.businessId);
    let column = workspace.columns.find((item) => item.id === workspace.cards.find((card) => card.saleId === sale.id)?.columnId);
    assert.equal(column?.name, "Vencidas");

    const settled = await updateSalePayment(db, sale.id, undefined, user, undefined, 25);
    assert.equal(settled.amountPaidUsd, 25);
    workspace = await getOrderBoards(db, user.businessId);
    column = workspace.columns.find((item) => item.id === workspace.cards.find((card) => card.saleId === sale.id)?.columnId);
    assert.notEqual(column?.name, "Vencidas");
    assert.equal((await listSales(db, user.businessId, sale.id)).sales[0].amountPaidUsd, 25);
  } finally {
    await db.close();
  }
});

test("duplicate order merges preserve partial USD payments", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ut-payment-usd-merge-"));
  const db = await createOperationalDatabase({ dataDir });
  try {
    const user = await getDefaultOperationalUser(db);
    const item = await addInventoryStock(db, {
      name: "USD Merge",
      expansion: "Test",
      language: "EN",
      condition: "NM",
      finish: "normal",
      quantityOnHand: 3,
      priceArs: 100
    }, user);
    const first = await createSale(db, {
      customerName: "Cliente USD Merge",
      saleType: "reservation",
      channel: "claim",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 100 }]
    }, user);
    const second = await createSale(db, {
      customerName: "Cliente USD Merge",
      saleType: "reservation",
      channel: "claim",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 100 }]
    }, user);
    await db.query("update sales set total_ars = 0, total_usd = 10 where id = $1", [first.id]);
    await db.query("update sales set total_ars = 0, total_usd = 20 where id = $1", [second.id]);
    await updateSalePayment(db, first.id, undefined, user, undefined, 4);
    await updateSalePayment(db, second.id, undefined, user, undefined, 6);

    const merged = await mergeDuplicateCustomerOrders(db, user);
    assert.equal(merged.merged, 1);
    const sales = await listSales(db, user.businessId);
    assert.equal(sales.sales.length, 1);
    assert.equal(sales.sales[0].totalUsd, 30);
    assert.equal(sales.sales[0].amountPaidUsd, 10);
    assert.equal(sales.sales[0].lines.reduce((sum, line) => sum + line.quantity, 0), 2);
  } finally {
    await db.close();
  }
});
