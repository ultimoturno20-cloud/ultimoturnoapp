import { inventoryLanguageGroup, normalizeInventoryText as normalize, primaryCardNumber, type InventoryQueryItem } from "./inventory-query.js";

export type CatalogPickerEntry = {
  cardType?: "pokemon" | "supporter" | "item" | "stadium" | "tool" | "energy" | "unknown";
  catalogId?: string; priceChartingId: string; canonicalUrl: string; sourceUrl: string;
  priceChartingUrl?: string; tcgplayerUrl?: string; tcgplayerProductId?: string;
  productName: string; normalizedName?: string; expansionName: string; normalizedExpansion?: string;
  cardNumber: string; languageGroup: "all" | "english" | "japanese" | "chinese";
  language?: string; finish?: string; loosePriceUsd: number | null; priceChartingPriceUsd?: number | null;
  tcgplayerPriceUsd?: number | null; tcgplayerSubtype?: string; imageUrl: string; imageFallbackUrl?: string; importedAt: string;
};
export type IntakeSearchQuery = { query: string; languageGroup: CatalogPickerEntry["languageGroup"] };
export type IntakeSearchResult = { entries: CatalogPickerEntry[]; warning?: string };
export function normalizeIntakeSearchQuery(input: Record<string, unknown>): IntakeSearchQuery {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const languageGroup = input.languageGroup || "all";
  if (query.length < 2 || query.length > 160 || typeof languageGroup !== "string" || !["all", "english", "japanese", "chinese"].includes(languageGroup)) {
    throw Object.assign(new Error("Escribi entre 2 y 160 caracteres y elegi un idioma valido."), { statusCode: 400 });
  }
  return { query, languageGroup: languageGroup as IntakeSearchQuery["languageGroup"] };
}

export function stockRowToCatalogEntry(item: InventoryQueryItem): CatalogPickerEntry {
  const identifier = item.product.identifiers.find(value => value.source === "pricecharting");
  const reference = item.priceReferences?.priceCharting as { usd: number | null; priceChartingId?: string; url?: string } | undefined;
  const tcg = item.priceReferences?.tcgplayer as { usd: number | null; marketPriceUsd: number | null; subTypeName?: string } | undefined;
  return {
    cardType: item.cardType as CatalogPickerEntry["cardType"],
    priceChartingId: reference?.priceChartingId || identifier?.externalId || item.sku,
    canonicalUrl: reference?.url || identifier?.url || "", sourceUrl: "",
    productName: item.product.name, expansionName: item.product.expansion, cardNumber: item.product.number || "",
    languageGroup: inventoryLanguageGroup(item.variant.language), language: item.variant.language, finish: item.variant.finish || "normal",
    loosePriceUsd: reference?.usd ?? item.priceUsd, tcgplayerPriceUsd: tcg?.marketPriceUsd ?? tcg?.usd ?? null,
    tcgplayerSubtype: tcg?.subTypeName || "", imageUrl: item.product.imageUrl || "", importedAt: ""
  };
}
export function mergeCatalogPickerEntries(primary: CatalogPickerEntry[], fallback: CatalogPickerEntry[], limit: number): CatalogPickerEntry[] {
  const seen = new Set<string>(), identities = new Set<string>(), looseIdentities = new Set<string>();
  const merged: CatalogPickerEntry[] = [];
  const sortedPrimary = [...primary].sort((left, right) => {
    const leftHasPrice = left.loosePriceUsd !== null && left.loosePriceUsd !== undefined;
    const rightHasPrice = right.loosePriceUsd !== null && right.loosePriceUsd !== undefined;
    if (leftHasPrice !== rightHasPrice) return leftHasPrice ? -1 : 1;
    if (Boolean(left.imageUrl) !== Boolean(right.imageUrl)) return left.imageUrl ? -1 : 1;
    return left.productName.localeCompare(right.productName, "es", { numeric: true });
  });
  for (const entry of [...sortedPrimary, ...fallback]) {
    const key = entry.priceChartingId || [normalize(entry.productName), normalize(entry.expansionName), normalize(entry.cardNumber), normalize(entry.language || "")].join("|");
    const identity = catalogPickerIdentity(entry), looseIdentity = catalogPickerLooseIdentity(entry);
    const referenceOnly = isTcgCatalogEntry(entry) && (entry.loosePriceUsd === null || entry.loosePriceUsd === undefined);
    if (seen.has(key) || (referenceOnly && (identities.has(identity) || looseIdentities.has(looseIdentity)))) continue;
    seen.add(key); identities.add(identity); looseIdentities.add(looseIdentity); merged.push(entry);
    if (merged.length >= limit) break;
  }
  return merged;
}
export function isTcgCatalogEntry(entry: CatalogPickerEntry) {
  return entry.priceChartingId.startsWith("tcgcsv-") || entry.canonicalUrl.includes("tcgplayer.com") || Boolean(entry.tcgplayerUrl && !entry.priceChartingUrl);
}
export function catalogSourceLabel(entry: CatalogPickerEntry) {
  return isTcgCatalogEntry(entry) ? "TCGPlayer" : "PriceCharting";
}
export function cleanCatalogPickerName(entry: CatalogPickerEntry) {
  const name = entry.productName.replace(/\s+-\s+\d+\s*\/\s*\d+\s*$/i, "").trim();
  return name || entry.productName;
}
export function cleanCatalogPickerExpansion(entry: CatalogPickerEntry) {
  return entry.expansionName.replace(/^[A-Z]{1,5}\d*:\s*/i, "").trim() || entry.expansionName;
}
function catalogPickerIdentity(entry: CatalogPickerEntry) {
  return [normalize(cleanCatalogPickerName(entry)), normalize(entry.normalizedExpansion || cleanCatalogPickerExpansion(entry)), primaryCardNumber(entry.cardNumber || ""), normalize(entry.language || entry.languageGroup || ""), normalize(entry.finish || "normal")].join("|");
}
function catalogPickerLooseIdentity(entry: CatalogPickerEntry) {
  return [normalize(cleanCatalogPickerName(entry)), primaryCardNumber(entry.cardNumber || ""), normalize(entry.language || entry.languageGroup || ""), normalize(entry.finish || "normal")].join("|");
}
