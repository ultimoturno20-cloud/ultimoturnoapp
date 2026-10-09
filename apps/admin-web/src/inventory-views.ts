export type InventoryFilters = {
  cardType: string; query: string; expansion: string; language: string;
  languageGroup: "all" | "english" | "japanese" | "chinese";
  condition: string; location: string; intakeBatch: string; inventoryStatus: string;
  tag: string; owner: string;
  availability: "all" | "in_stock" | "available" | "assigned" | "reserved" | "out";
  priceSource: "sale" | "pricecharting" | "tcgplayer" | "coolstuff";
  sortMode: "name" | "expansion" | "number" | "price" | "quantity";
  issue: "all" | "missingImage" | "missingPriceCharting" | "zeroPrice" | "lowStock" | "duplicates";
};
export type InventoryViewState = { filters: InventoryFilters; density: "comfortable" | "compact" };
export type SavedInventoryView = InventoryViewState & { id: string; name: string };
type Preferences = { version: 1; current: InventoryViewState; views: SavedInventoryView[] };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export const maxInventoryViews = 20;
export const defaultInventoryFilters: InventoryFilters = {
  cardType: "all", query: "", expansion: "all", language: "all", languageGroup: "all",
  condition: "all", location: "all", intakeBatch: "all", inventoryStatus: "all",
  tag: "all", owner: "all", availability: "in_stock", priceSource: "sale", sortMode: "name", issue: "all"
};
export const inventoryPresets: SavedInventoryView[] = [
  { id: "stock", name: "En stock", filters: { ...defaultInventoryFilters }, density: "comfortable" },
  { id: "available", name: "Disponibles", filters: { ...defaultInventoryFilters, availability: "available" }, density: "comfortable" },
  { id: "collection", name: "Coleccion / no venta", filters: { ...defaultInventoryFilters, inventoryStatus: "not_for_sale" }, density: "comfortable" },
  { id: "reserved", name: "Reservadas", filters: { ...defaultInventoryFilters, availability: "reserved" }, density: "comfortable" }
];
const choices = {
  languageGroup: ["all", "english", "japanese", "chinese"],
  availability: ["all", "in_stock", "available", "assigned", "reserved", "out"],
  priceSource: ["sale", "pricecharting", "tcgplayer", "coolstuff"],
  sortMode: ["name", "expansion", "number", "price", "quantity"],
  issue: ["all", "missingImage", "missingPriceCharting", "zeroPrice", "lowStock", "duplicates"],
  cardType: ["all", "pokemon", "supporter", "item", "stadium", "tool", "energy", "unknown"],
  inventoryStatus: ["all", "available", "pending_intake", "review", "not_for_sale", "missing_price", "missing_image"]
};
function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function normalizeInventoryState(value: unknown): InventoryViewState {
  const source = record(value);
  const candidate = record(source.filters);
  const filters = { ...defaultInventoryFilters };
  for (const key of Object.keys(filters) as Array<keyof InventoryFilters>) {
    const next = candidate[key];
    const allowed = choices[key as keyof typeof choices];
    if (typeof next !== "string" || next.length > 300 || (allowed && !allowed.includes(next))) continue;
    // Only allow known preference fields; never store an item, cart or auth payload.
    Object.assign(filters, { [key]: next });
  }
  return { filters, density: source.density === "compact" ? "compact" : "comfortable" };
}
export function inventoryPreferencesKey(businessId: string, userId: string) {
  return businessId && userId ? `ultimoturno:inventory-views:v1:${encodeURIComponent(businessId)}:${encodeURIComponent(userId)}` : "";
}
export function emptyInventoryPreferences(): Preferences {
  return { version: 1, current: normalizeInventoryState(null), views: [] };
}
function normalizeInventoryViews(value: unknown): SavedInventoryView[] {
  const ids = new Set<string>(); const names = new Set<string>();
  const views: SavedInventoryView[] = [];
  for (const candidate of Array.isArray(value) ? value : []) {
    const entry = record(candidate);
    const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 60) : "";
    if (typeof entry.id !== "string" || !/^custom-[a-zA-Z0-9-]{1,80}$/.test(entry.id) || !name || ids.has(entry.id) || names.has(name.toLocaleLowerCase())) continue;
    ids.add(entry.id); names.add(name.toLocaleLowerCase());
    views.push({ id: entry.id, name, ...normalizeInventoryState(entry) });
    if (views.length === maxInventoryViews) break;
  }
  return views;
}
export function readInventoryPreferences(storage: Storage | undefined, key: string): Preferences {
  try {
    if (!key || !storage) return emptyInventoryPreferences();
    const raw = storage.getItem(key);
    if (!raw || raw.length > 100_000) return emptyInventoryPreferences();
    const parsed = record(JSON.parse(raw));
    if (parsed.version !== 1) return emptyInventoryPreferences();
    return { version: 1, current: normalizeInventoryState(parsed.current), views: normalizeInventoryViews(parsed.views) };
  } catch { return emptyInventoryPreferences(); }
}
export function writeInventoryPreferences(storage: Storage | undefined, key: string, patch: { current?: InventoryViewState; views?: SavedInventoryView[] }): boolean {
  try {
    if (!key || !storage) return false;
    const previous = readInventoryPreferences(storage, key);
    const next: Preferences = { version: 1, current: normalizeInventoryState(patch.current ?? previous.current), views: normalizeInventoryViews(patch.views ?? previous.views) };
    storage.setItem(key, JSON.stringify(next));
    return true;
  } catch { return false; }
}
export function inventoryStatesEqual(left: InventoryViewState, right: InventoryViewState) {
  return left.density === right.density && (Object.keys(defaultInventoryFilters) as Array<keyof InventoryFilters>).every((key) => left.filters[key] === right.filters[key]);
}
