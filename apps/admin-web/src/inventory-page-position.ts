type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type InventoryPagePosition = { filterKey: string; offset: number; limit: number };

export function inventoryPageStorage(): Storage | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}

export function readInventoryPagePosition(storage: Storage | undefined, scope: string, filterKey: string): InventoryPagePosition {
  const fallback = { filterKey, offset: 0, limit: 24 };
  try {
    if (!storage || !scope) return fallback;
    const raw = storage.getItem(scope + ":page:v1");
    if (!raw || raw.length > 10_000) return fallback;
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || ![24, 48, 96].includes(value.limit)) return fallback;
    const validOffset = Number.isSafeInteger(value.offset) && value.offset >= 0 && value.offset % value.limit === 0;
    return { filterKey, limit: value.limit, offset: value.filterKey === filterKey && validOffset ? value.offset : 0 };
  } catch { return fallback; }
}

export function writeInventoryPagePosition(storage: Storage | undefined, scope: string, position: InventoryPagePosition) {
  try {
    if (!storage || !scope) return;
    storage.setItem(scope + ":page:v1", JSON.stringify({ version: 1, filterKey: position.filterKey, offset: position.offset, limit: position.limit }));
  } catch { /* Navigation still works when browser storage is unavailable. */ }
}
