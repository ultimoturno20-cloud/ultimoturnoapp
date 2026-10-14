import { createHash } from "node:crypto";
import { buildDuplicateIdentityKeys, filterInventoryItems, inventoryMetadata, normalizeInventoryQuery, type InventoryPage } from "@ultimoturno/domain";
import type { DbStockRow, DbStockSummary } from "@ultimoturno/db";

type Rate = InventoryPage<DbStockRow>["blueRate"];
export function inventoryView(stock: { summary: DbStockSummary; items: DbStockRow[] }, rate: Rate, input: Record<string, unknown>) {
  const query = normalizeInventoryQuery(input);
  const duplicates = buildDuplicateIdentityKeys(stock.items);
  const matched = filterInventoryItems(stock.items, query.filters, rate.sell, duplicates);
  const revision = createHash("sha256").update(JSON.stringify([stock, rate.sell])).digest("hex").slice(0, 24);
  if (query.scope === "ids") return { ids: matched.map(item => item.id), matchedTotal: matched.length, revision };
  if (query.scope === "all") return { items: matched, matchedTotal: matched.length, revision };
  const offset = matched.length ? Math.min(query.offset, Math.floor((matched.length - 1) / query.limit) * query.limit) : 0;
  const page: InventoryPage<DbStockRow> = {
    resellers: [],
    items: matched.slice(offset, offset + query.limit), summary: stock.summary,
    metadata: inventoryMetadata(stock.items, rate.sell, duplicates), total: stock.items.length, matchedTotal: matched.length,
    offset, limit: query.limit, revision, blueRate: rate
  };
  return page;
}
