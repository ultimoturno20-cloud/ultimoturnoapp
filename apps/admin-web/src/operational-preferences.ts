export type OrderOperationalView = "all" | "to_deliver" | "to_pack" | "contact" | "debt";
export type OperationalPeriod = "all" | "today" | "month";
export type OperationalPreferences = {
  orders: { query: string; sort: "current" | "money_desc" | "money_asc" | "units_desc" | "units_asc"; boardId: string; mobileColumnId: string; history: boolean; list: boolean; view: OrderOperationalView };
  orderList: { query: string; sort: "current" | "money_desc" | "money_asc" | "units_desc" | "units_asc"; board: string; filter: "all" | "pending" | "packed" | "paid" | "debt" | "no_message" | "message" | "note"; view: OrderOperationalView };
  cash: { query: string; period: OperationalPeriod; view: "all" | "receivables" | "purchases" | "sales" };
  purchases: { query: string; mode: "all" | "low" | "recent" };
};
export type OperationalSection = keyof OperationalPreferences;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export const defaultOperationalPreferences: OperationalPreferences = {
  orders: { query: "", sort: "current", boardId: "", mobileColumnId: "", history: false, list: false, view: "all" },
  orderList: { query: "", sort: "current", board: "all", filter: "all", view: "all" },
  cash: { query: "", period: "all", view: "all" },
  purchases: { query: "", mode: "all" }
};
const enums: Record<string, readonly string[]> = {
  sort: ["current", "money_desc", "money_asc", "units_desc", "units_asc"],
  "orders.view": ["all", "to_deliver", "to_pack", "contact", "debt"],
  "orderList.filter": ["all", "pending", "packed", "paid", "debt", "no_message", "message", "note"],
  "orderList.view": ["all", "to_deliver", "to_pack", "contact", "debt"],
  "cash.period": ["all", "today", "month"],
  "cash.view": ["all", "receivables", "purchases", "sales"],
  "purchases.mode": ["all", "low", "recent"]
};
export function normalizeOperationalPreferences<T extends OperationalSection>(section: T, value: unknown): OperationalPreferences[T] {
  const next = { ...defaultOperationalPreferences[section] };
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  for (const [field, fallback] of Object.entries(next)) {
    const input = candidate[field];
    const allowed = enums[`${section}.${field}`] || enums[field];
    if (typeof fallback === "boolean" ? typeof input === "boolean" : typeof input === "string" && input.length <= 300 && (!allowed || allowed.includes(input))) Object.assign(next, { [field]: input });
  }
  return next;
}
function preferenceKey(scope: string, section: OperationalSection) {
  return scope ? `${scope}:operations:v1:${section}` : "";
}
export function readOperationalPreferences<T extends OperationalSection>(storage: Storage | undefined, scope: string, section: T): OperationalPreferences[T] {
  try {
    const key = preferenceKey(scope, section);
    if (!storage || !key) return normalizeOperationalPreferences(section, null);
    const raw = storage.getItem(key);
    if (!raw || raw.length > 10_000) return normalizeOperationalPreferences(section, null);
    const parsed = JSON.parse(raw);
    return normalizeOperationalPreferences(section, parsed?.version === 1 ? parsed.current : null);
  } catch { return normalizeOperationalPreferences(section, null); }
}
export function writeOperationalPreferences<T extends OperationalSection>(storage: Storage | undefined, scope: string, section: T, current: OperationalPreferences[T]): boolean {
  try {
    const key = preferenceKey(scope, section);
    if (!storage || !key) return false;
    storage.setItem(key, JSON.stringify({ version: 1, current: normalizeOperationalPreferences(section, current) }));
    return true;
  } catch { return false; }
}
export function orderMatchesOperationalView(order: { status: string; messageSentAt?: string | null; lines: Array<{ packed: boolean }> }, view: OrderOperationalView, hasDebt: boolean) {
  if (view === "all") return true;
  if (order.status === "delivered" || order.status === "cancelled") return false;
  if (view === "to_deliver") return order.status === "paid";
  if (view === "to_pack") return order.lines.some((line) => !line.packed);
  if (view === "contact") return !order.messageSentAt;
  return hasDebt;
}
const argentinaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" });
function dateParts(date: Date) {
  return Object.fromEntries(argentinaDate.formatToParts(date).map((part) => [part.type, part.value]));
}
export function matchesOperationalPeriod(timestamp: string, period: OperationalPeriod, now = new Date()) {
  if (period === "all") return true;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return false;
  const left = dateParts(date); const right = dateParts(now);
  return left.year === right.year && left.month === right.month && (period === "month" || left.day === right.day);
}
