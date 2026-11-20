import { inventoryTags } from "./inventory-query.js";
import type { MaultIntakeCopy } from "./mault-intake.js";

export type MaultSyncConfig = {
  enabled: boolean; autoImport: boolean; requireReviewed: boolean; requireStorage: boolean;
  acceptRecordedCondition: boolean; newItemPriceArs: number | null;
  collections: Array<{ id: string; label: string; tags: string[] }>;
};
export const defaultMaultSyncConfig = (): MaultSyncConfig => ({ enabled: false, autoImport: false,
  requireReviewed: true, requireStorage: true, acceptRecordedCondition: false, newItemPriceArs: null, collections: [] });
export function normalizeMaultSyncConfig(input: unknown): MaultSyncConfig {
  const bad = (): never => { throw Object.assign(new Error("Configuracion Mault invalida."), { statusCode: 400 }); };
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad();
  const row = input as Record<string, unknown>, defaults = defaultMaultSyncConfig();
  if (Object.keys(row).some(k => !Object.hasOwn(defaults, k))) return bad();
  for (const k of ["enabled", "autoImport", "requireReviewed", "requireStorage", "acceptRecordedCondition"] as const) {
    if (row[k] !== undefined && typeof row[k] !== "boolean") return bad();
  }
  const price = row.newItemPriceArs;
  if (price != null && (typeof price !== "number" || !Number.isFinite(price) || price < 800 || price > 100_000_000)) return bad();
  if (!Array.isArray(row.collections) || row.collections.length > 40) return bad();
  const collections = row.collections.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return bad();
    const c = value as Record<string, unknown>;
    if (Object.keys(c).some(k => !["id", "label", "tags"].includes(k)) || typeof c.id !== "string"
      || !/^[a-zA-Z0-9._-]{1,200}$/.test(c.id) || typeof c.label !== "string" || c.label.length > 160
      || !Array.isArray(c.tags) || !c.tags.length || c.tags.length > 12
      || c.tags.some(t => typeof t !== "string" || !t.trim() || t.length > 80)) return bad();
    return { id: c.id, label: c.label.trim(), tags: inventoryTags((c.tags as string[]).join(",")) };
  });
  if (new Set(collections.map(c => c.id)).size !== collections.length) return bad();
  const config = { ...defaults, ...row, newItemPriceArs: price == null ? null : price as number, collections } as MaultSyncConfig;
  if (config.enabled && !collections.length) return bad();
  return config;
}
export type MaultResolvedImage = { imageUrl: string; name: string; expansion: string; verifiedFingerprint: string; verifiedBy: "tcgdex" | "admin" };
export type MaultCopyView = {
  copyId: string; status: string; copy: MaultIntakeCopy; resolved: MaultResolvedImage | null;
  reasons: string[]; inventoryItemId: string | null; appliedAt: string | null;
};
