type ValuedStockItem = {
  quantityOnHand: number;
  freeQuantity: number;
  quantityReserved: number;
  quantityAssigned: number;
  inventoryStatus: string;
  priceArs: number;
  priceUsd: number | null;
  folder?: { valueUsd: number; missingPrices: number };
  priceReferences?: {
    tcgplayer: { marketPriceUsd: number | null; usd: number | null };
    priceCharting: { usd: number | null };
  };
};

export function stockItemValues(item: ValuedStockItem, blueRateSell: number) {
  const units = Math.max(0, item.quantityOnHand);
  const collection = item.inventoryStatus === "not_for_sale";
  const saleUnitArs = item.priceArs || Math.max(0, item.priceUsd ?? 0) * blueRateSell;
  // A folder contributes its contents once, never its sale price plus its contents.
  const unitArs = item.folder ? item.folder.valueUsd * blueRateSell : saleUnitArs;
  const marketUsd = item.folder?.valueUsd
    ?? item.priceReferences?.tcgplayer.marketPriceUsd
    ?? item.priceReferences?.tcgplayer.usd
    ?? item.priceReferences?.priceCharting.usd
    ?? 0;
  return {
    units,
    unitArs,
    totalArs: unitArs * units,
    freeArs: collection ? 0 : unitArs * Math.max(0, item.freeQuantity),
    reservedArs: collection ? 0 : unitArs * Math.max(0, item.quantityReserved),
    resellersArs: collection ? 0 : unitArs * Math.max(0, item.quantityAssigned),
    collectionArs: collection ? unitArs * units : 0,
    saleArs: collection ? 0 : saleUnitArs * units,
    collection,
    marketUsd,
    missingFolderPrices: units ? item.folder?.missingPrices ?? 0 : 0
  };
}
