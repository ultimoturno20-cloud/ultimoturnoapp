export type HistoryKind = "stock" | "system";
export type HistoryCursor = { at: string; id: string };
export type HistoryQuery = { kind: HistoryKind; query: string; action: string; from: string; to: string; limit: number; asOf: string; cursor: HistoryCursor | null };
export type HistoryEntry = {
  id: string; createdAt: string; action: string; entityType: string; entityId: string;
  actorName: string; inventoryItemId: string; sku: string; itemName: string;
  quantityDelta: number | null; note: string;
};
export type HistoryPage = {
  items: HistoryEntry[]; total: number; matchedTotal: number; netQuantity: number | null;
  actions: Array<{ value: string; count: number }>; limit: number; asOf: string; nextCursor: string | null;
};

const timestampPattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;
function invalid(): never {
  throw Object.assign(new Error("Filtros o pagina de historial invalidos."), { statusCode: 400 });
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 80 || !timestampPattern.test(value) || !Number.isFinite(Date.parse(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")))) invalid();
  date(value.slice(0, 10));
  return value;
}
function date(value: unknown): string {
  if (!value) return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) invalid();
  const parsed = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid();
  return value;
}

export function normalizeHistoryQuery(input: Record<string, unknown> = {}): HistoryQuery {
  const kind = input.kind || "stock";
  if (kind !== "stock" && kind !== "system") invalid();
  const limit = input.limit === undefined || input.limit === "" ? 50 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid();
  const query = String(input.query || "").trim();
  const action = String(input.action || "").trim();
  if (query.length > 160 || action.length > 100) invalid();
  const from = date(input.from), to = date(input.to);
  if (from && to && from > to) invalid();
  const asOf = input.asOf ? timestamp(input.asOf) : "";
  let cursor: HistoryCursor | null = null;
  if (input.cursor) {
    if (!asOf || typeof input.cursor !== "string" || input.cursor.length > 256) invalid();
    let parsed: Partial<HistoryCursor>;
    try { parsed = JSON.parse(input.cursor); } catch { invalid(); }
    if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)) invalid();
    cursor = { at: timestamp(parsed.at), id: parsed.id };
    if (Date.parse(cursor.at.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")) > Date.parse(asOf.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"))) invalid();
  }
  return { kind, query, action, from, to, limit, asOf, cursor };
}

export function historyRequestPath(query: Omit<HistoryQuery, "cursor"> & { cursor: string | null }): string {
  const params = new URLSearchParams({ kind: query.kind, limit: String(query.limit) });
  for (const key of ["query", "action", "from", "to", "asOf", "cursor"] as const) if (query[key]) params.set(key, query[key]!);
  return "/operational-history?" + params.toString();
}
