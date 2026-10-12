import type { StoreCatalogItem } from "@ultimoturno/domain";

export type StoreResultView = "grid" | "list";
export const readStoreResultView = (value: string | null): StoreResultView | null => value === "grid" || value === "list" ? value : null;
export const resolveStoreResultView = (query: string, choice: StoreResultView | null): StoreResultView => choice || (query.trim() ? "list" : "grid");
export const storeConditionLabel = (condition: string) => ({ NM: "Near Mint", LP: "Lightly Played", MP: "Moderately Played", HP: "Heavily Played", DMG: "Damaged" } as Record<string,string>)[condition] || condition;

export type StoreResultGroup = { key: string; item: StoreCatalogItem; offers: StoreCatalogItem[] };
export function groupStoreSearchResults(items: StoreCatalogItem[]): StoreResultGroup[] {
  const groups = new Map<string,StoreResultGroup>();
  for (const item of items) {
    // Solo presentacion: no normalizamos nombres, sumamos stock ni mezclamos variantes.
    const key = JSON.stringify([item.itemKind === "folder" ? item.id : "", item.name, item.expansion, item.number, item.language, item.finish, item.gradingCompany, item.grade, item.imageUrl, item.cardType, item.category]);
    const group = groups.get(key);
    if (group) group.offers.push(item);
    else groups.set(key,{key,item,offers:[item]});
  }
  return [...groups.values()];
}
