import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  addInventoryStock,
  createOperationalDatabase,
  getDefaultOperationalUser,
  listStockForBusiness,
  setInventoryPurchaseCosts
} from "./index.js";

test("fills missing purchase costs from sale price percent and csv sku rows", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ut-purchase-cost-"));
  const db = await createOperationalDatabase({ dataDir });
  try {
    const user = await getDefaultOperationalUser(db);
    const first = await addInventoryStock(db, {
      name: "Costo Uno",
      expansion: "Test",
      language: "EN",
      condition: "NM",
      finish: "normal",
      quantityOnHand: 2,
      priceArs: 1000
    }, user);
    const second = await addInventoryStock(db, {
      name: "Costo Dos",
      expansion: "Test",
      language: "EN",
      condition: "NM",
      finish: "normal",
      quantityOnHand: 1,
      priceArs: 2500
    }, user);

    const filled = await setInventoryPurchaseCosts(db, { percentOfSale: 60, onlyMissing: true }, user);
    assert.equal(filled.updated, 2);
    let stock = await listStockForBusiness(db, user.businessId);
    assert.equal(stock.items.find((item) => item.id === first.id)?.purchaseCost, 600);
    assert.equal(stock.items.find((item) => item.id === second.id)?.purchaseCost, 1500);

    const skipped = await setInventoryPurchaseCosts(db, { percentOfSale: 40, onlyMissing: true }, user);
    assert.equal(skipped.updated, 0);

    const csv = await setInventoryPurchaseCosts(db, {
      rows: [{ sku: first.sku, purchaseCost: 800, purchaseCurrency: "ARS" }]
    }, user);
    assert.equal(csv.updated, 1);
    stock = await listStockForBusiness(db, user.businessId);
    assert.equal(stock.items.find((item) => item.id === first.id)?.purchaseCost, 800);
    assert.equal(stock.items.find((item) => item.id === second.id)?.purchaseCost, 1500);
  } finally {
    await db.close();
  }
});
