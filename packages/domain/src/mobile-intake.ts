import { normalizeHistoryQuery, type HistoryCursor } from "./operational-history.js";
import { normalizeInventoryText } from "./inventory-query.js";

export type MobileInventoryEntry = {
  id: string; businessId: string; status: "pending" | "reviewed" | "rejected";
  helperName: string; source: string; matchType: "inventory" | "card_index" | "manual";
  inventoryItemId?: string; priceChartingId: string; sku: string; name: string;
  expansion: string; number: string; language: string; condition: string; finish: string;
  gradingCompany: string; grade: string; location: string; intakeBatch: string;
  quantityOnHand: number; priceArs: number; priceUsd: number | null; imageUrl: string; notes: string;
  createdAt: string; reviewedAt?: string; reviewedByName?: string;
};
export type MobileIntakeStatus = "all" | MobileInventoryEntry["status"];
export type MobileIntakeQuery = {
  status: MobileIntakeStatus; query: string; limit: number; asOf: string; cursor: HistoryCursor | null;
};
export type MobileIntakePage = {
  entries: MobileInventoryEntry[]; total: number; matchedTotal: number;
  summary: { pending: number; reviewed: number; today: number };
  limit: number; asOf: string; nextCursor: string | null;
};
export function normalizeMobileIntakeQuery(input: Record<string, unknown> = {}): MobileIntakeQuery {
  const status = input.status || "all";
  if (typeof status !== "string" || !["all", "pending", "reviewed", "rejected"].includes(status)) {
    throw Object.assign(new Error("Estado de captura invalido."), { statusCode: 400 });
  }
  const { query, limit, asOf, cursor } = normalizeHistoryQuery({ query: input.query, limit: input.limit ?? 25, asOf: input.asOf, cursor: input.cursor });
  return { status: status as MobileIntakeStatus, query, limit, asOf, cursor };
}
export function mobileIntakeRequestPath(query: Omit<MobileIntakeQuery, "cursor"> & { cursor: string | null }) {
  const params = new URLSearchParams({ status: query.status, limit: String(query.limit) });
  for (const key of ["query", "asOf", "cursor"] as const) if (query[key]) params.set(key, query[key]!);
  return "/mobile-intake/view?" + params;
}
export function mobileCaptureKey(entry: { inventoryItemId?: string; priceChartingId?: string; name: string; expansion: string; number?: string }) {
  if (entry.inventoryItemId) return `stock:${entry.inventoryItemId}`;
  if (entry.priceChartingId) return `pc:${entry.priceChartingId}`;
  return normalizeInventoryText([entry.name, entry.expansion, entry.number].join(" "));
}
