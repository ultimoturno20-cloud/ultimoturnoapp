import assert from "node:assert/strict";
import { it } from "node:test";
import { stockItemValues } from "../src/stock-value.js";

const stockItem = {
  quantityOnHand: 5, freeQuantity: 2, quantityReserved: 1, quantityAssigned: 2,
  inventoryStatus: "available", priceArs: 1000, priceUsd: null,
  priceReferences: { tcgplayer: { marketPriceUsd: 2, usd: 1 }, priceCharting: { usd: 3 } }
};
const folder = {
  ...stockItem, quantityOnHand: 1, freeQuantity: 0, quantityReserved: 0, quantityAssigned: 0,
  inventoryStatus: "not_for_sale", priceArs: 999999,
  folder: { valueUsd: 40, missingPrices: 3 }
};

it("includes a non-sale folder in stock value once using the current exchange rate", () => {
  const singles = stockItemValues(stockItem, 1000);
  const collection = stockItemValues(folder, 1000);
  assert.equal(singles.totalArs, 5000);
  assert.equal(singles.freeArs, 2000);
  assert.equal(singles.reservedArs, 1000);
  assert.equal(singles.resellersArs, 2000);
  assert.equal(singles.marketUsd, 2);
  assert.equal(collection.totalArs, 40000);
  assert.equal(collection.collectionArs, 40000);
  assert.equal(collection.freeArs, 0);
  assert.equal(collection.saleArs, 0);
  assert.equal(collection.marketUsd, 40);
  assert.equal(collection.missingFolderPrices, 3);
  assert.equal(singles.freeArs + singles.resellersArs + collection.collectionArs, 44000);
  assert.equal(singles.totalArs + collection.totalArs, 45000);
  assert.equal(stockItemValues(folder, 1200).totalArs, 48000);
  assert.equal(stockItemValues({ ...folder, folder: { valueUsd: 42, missingPrices: 0 } }, 1000).totalArs, 42000);
});

it("keeps folder sale proceeds separate from valuation when available or reserved", () => {
  const available = stockItemValues({ ...folder, inventoryStatus: "available", freeQuantity: 1, priceArs: 50000 }, 1000);
  assert.equal(available.totalArs, 40000);
  assert.equal(available.freeArs, 40000);
  assert.equal(available.collectionArs, 0);
  assert.equal(available.saleArs, 50000);
  const reserved = stockItemValues({ ...folder, inventoryStatus: "available", quantityReserved: 1, priceArs: 50000 }, 1000);
  assert.equal(reserved.freeArs, 0);
  assert.equal(reserved.reservedArs, 40000);
  assert.equal(reserved.totalArs, 40000);
  const assigned = stockItemValues({ ...folder, inventoryStatus: "available", quantityAssigned: 1 }, 1000);
  assert.equal(assigned.resellersArs, 40000);
  assert.equal(assigned.totalArs, 40000);
});

it("excludes sold folders and does not replace missing content prices with a sale price", () => {
  const sold = stockItemValues({ ...folder, quantityOnHand: 0 }, 1000);
  assert.equal(sold.totalArs, 0);
  assert.equal(sold.collectionArs, 0);
  assert.equal(sold.missingFolderPrices, 0);
  const unpriced = stockItemValues({ ...folder, folder: { valueUsd: 0, missingPrices: 368 } }, 1000);
  assert.equal(unpriced.totalArs, 0);
  assert.equal(unpriced.missingFolderPrices, 368);
});

it("values ordinary collection items but never treats them as free for sale", () => {
  const collection = stockItemValues({ ...stockItem, inventoryStatus: "not_for_sale" }, 1000);
  assert.equal(collection.collectionArs, 5000);
  assert.equal(collection.totalArs, 5000);
  assert.equal(collection.freeArs + collection.reservedArs + collection.resellersArs, 0);
  assert.equal(collection.saleArs, 0);
  assert.equal(stockItemValues({ ...stockItem, priceArs: 0, priceUsd: 1.5 }, 1000).totalArs, 7500);
});
