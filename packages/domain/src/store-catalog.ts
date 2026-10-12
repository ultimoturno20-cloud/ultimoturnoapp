export const storeCategories = ["singles", "sealed", "accessories", "other"] as const;
export type StoreCategory = typeof storeCategories[number];
export const storeCategoryLabels: Record<StoreCategory, string> = { singles: "Singles", sealed: "Sellado", accessories: "Accesorios", other: "Otros" };
export const storeCategoryTags: Record<StoreCategory, string> = { singles: "singles", sealed: "sellado", accessories: "accesorios", other: "otros" };

export function resolveStoreCategory(input: { itemKind: string; cardType: string; number: string; tags: string[] }): StoreCategory {
  if (input.itemKind === "folder") return "other";
  const tags = new Set(input.tags.map(tag => tag.trim().toLowerCase()));
  const explicit = storeCategories.filter(category => tags.has(storeCategoryTags[category]));
  if (explicit.length === 1) return explicit[0];
  if (explicit.length > 1) return "other";
  const cardTypes = ["pokemon", "supporter", "item", "stadium", "tool", "energy"];
  return cardTypes.includes(input.cardType) || /^\d+(?:\/\d+)?$/.test(input.number.trim()) ? "singles" : "other";
}

export type StoreCatalogItem = {
  id: string; name: string; expansion: string; number: string; imageUrl: string;
  language: string; condition: string; finish: string; gradingCompany: string; grade: string;
  cardType: string; category: StoreCategory; itemKind: "standard" | "folder"; priceArs: number; availableQuantity: number;
};
export type StoreCatalogQuery = {
  query: string; expansion: string; language: string; condition: string; cardType: string; category: StoreCategory | "all";
  sort: "name" | "price_asc" | "price_desc"; offset: number;
};
export type StoreCatalogPage = {
  items: StoreCatalogItem[]; total: number; offset: number; pageSize: number;
  facets: { expansions: string[]; languages: string[]; conditions: string[]; cardTypes: string[] };
};
export const defaultStoreCatalogQuery: StoreCatalogQuery = { query: "", expansion: "all", language: "all", condition: "all", cardType: "all", category: "all", sort: "name", offset: 0 };

export function normalizeStoreCatalogQuery(value: Partial<Record<keyof StoreCatalogQuery, unknown>>): StoreCatalogQuery {
  const next = { ...defaultStoreCatalogQuery };
  for (const field of ["query", "expansion", "language", "condition", "cardType"] as const) {
    if (typeof value[field] === "string" && value[field].length <= 120) next[field] = value[field].trim();
  }
  if (value.category === "all" || storeCategories.includes(value.category as StoreCategory)) next.category = value.category as StoreCatalogQuery["category"];
  if (next.category !== "all" && next.category !== "singles") next.cardType = "all";
  else if (next.cardType !== "all") next.category = "singles";
  if (["name", "price_asc", "price_desc"].includes(String(value.sort))) next.sort = value.sort as StoreCatalogQuery["sort"];
  const offset = Number(value.offset);
  if (Number.isSafeInteger(offset) && offset >= 0 && offset <= 100_000) next.offset = offset;
  return next;
}
const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function storeCatalogPage(items: StoreCatalogItem[], input: Partial<StoreCatalogQuery>): StoreCatalogPage {
  const query = normalizeStoreCatalogQuery(input);
  const values = (field: "expansion" | "language" | "condition" | "cardType", source = items) => [...new Set(source.map(item => item[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const tokens = searchText(query.query).split(/\s+/).filter(Boolean);
  const filtered = items.filter(item => (query.category === "all" || query.category === item.category) && tokens.every(token => searchText(`${item.name} ${item.expansion} ${item.number} ${item.language} ${item.finish}`).includes(token)) &&
    (["expansion", "language", "condition", "cardType"] as const).every(field => query[field] === "all" || query[field] === item[field]));
  filtered.sort((a, b) => (query.sort === "price_asc" ? a.priceArs - b.priceArs : query.sort === "price_desc" ? b.priceArs - a.priceArs : 0) || a.name.localeCompare(b.name, "es", { numeric: true }) || a.id.localeCompare(b.id));
  return { items: filtered.slice(query.offset, query.offset + 36), total: filtered.length, offset: query.offset, pageSize: 36,
    facets: { expansions: values("expansion"), languages: values("language"), conditions: values("condition"), cardTypes: values("cardType", items.filter(item => item.category === "singles")) } };
}
