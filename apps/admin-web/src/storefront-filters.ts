import type { StoreCatalogQuery } from "@ultimoturno/domain";

export const storeTypeLabels: Record<string, string> = { pokemon: "Pokemon", supporter: "Supporter", item: "Item", stadium: "Stadium", tool: "Tool", energy: "Energia", unknown: "Sin clasificar" };
export const storeLanguageLabel = (value: string) => ({ EN: "Ingles", JP: "Japones", JA: "Japones", CHS: "Chino", CH: "Chino", CN: "Chino", ZH: "Chino" } as Record<string, string>)[value] || value;
export type StoreFilterField = "query" | "expansion" | "language" | "condition" | "cardType";

export function activeStoreFilters(query: StoreCatalogQuery): Array<{ field: StoreFilterField; label: string }> {
  return (["query", "expansion", "language", "condition", "cardType"] as const).flatMap(field => {
    if (!query[field] || (field !== "query" && query[field] === "all")) return [];
    const label = field === "language" ? storeLanguageLabel(query[field]) : field === "cardType" ? storeTypeLabels[query[field]] || query[field] : query[field];
    return [{ field, label }];
  });
}

export function matchingStoreExpansions(values: string[], search: string): string[] {
  const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return values.filter(value => fold(value).includes(fold(search.trim())));
}
