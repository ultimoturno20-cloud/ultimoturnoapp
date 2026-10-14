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
type InventoryPriceSource = InventoryFilters["priceSource"];
type IssueFilter = InventoryFilters["issue"];
type LanguageGroupFilter = InventoryFilters["languageGroup"];
export type StockQualitySummary = Record<Exclude<IssueFilter, "all">, number>;
export const defaultInventoryFilters: InventoryFilters = {
  cardType: "all", query: "", expansion: "all", language: "all", languageGroup: "all",
  condition: "all", location: "all", intakeBatch: "all", inventoryStatus: "all",
  tag: "all", owner: "all", availability: "in_stock", priceSource: "sale", sortMode: "name", issue: "all"
};
export type InventoryQueryItem = {
  id: string; ownerUserId: string; ownerName: string; sku: string; location: string; intakeBatch: string;
  inventoryStatus: string; tags: string; quantityOnHand: number; quantityReserved: number;
  quantityAssigned: number; freeQuantity: number; availableQuantity: number; priceArs: number; priceUsd: number | null;
  cardType?: string; itemKind?: string;
  folder?: { valueUsd: number; totalCards: number };
  product: { name: string; expansion: string; number?: string; imageUrl?: string; identifiers: Array<{ source: string; externalId: string; url?: string }> };
  variant: { language: string; condition: string; finish: string; gradingCompany?: string; grade?: string; gradingCert?: string };
  priceReferences?: { priceCharting: { usd: number | null }; tcgplayer: { marketPriceUsd: number | null; usd: number | null }; coolstuff: { usd: number | null } };
};
export type InventoryTotals = {
  totalSkus: number; totalUnits: number; reservedUnits: number; availableUnits: number; stockValueArs: number;
  collectionUnits: number; collectionValueArs: number; totalValueArs: number;
};
export type InventoryMetadata = {
  quality: StockQualitySummary;
  options: { expansions: string[]; languages: string[]; conditions: string[]; locations: string[]; intakeBatches: string[]; inventoryStatuses: string[]; tags: string[] };
  owners: Array<{ userId: string; name: string }>;
  availability: { all: number; inStock: number; available: number; assigned: number; reserved: number; out: number };
  priceSources: Record<InventoryPriceSource, number>;
};
export type InventoryPage<T> = {
  resellers: Array<{ userId: string; displayName: string }>;
  items: T[]; summary: InventoryTotals; metadata: InventoryMetadata; total: number; matchedTotal: number;
  offset: number; limit: number; revision: string;
  blueRate: { buy: number | null; sell: number; source: string; updatedAt: string; fallback: boolean };
};
export type InventoryQuery = { filters: InventoryFilters; offset: number; limit: number; scope: "page" | "all" | "ids" };

export function normalizeInventoryQuery(input: Record<string, unknown> = {}): InventoryQuery {
  const fail = () => { throw Object.assign(new Error("Filtros de inventario invalidos."), { statusCode: 400 }); };
  const filters = { ...defaultInventoryFilters };
  const choices: Partial<Record<keyof InventoryFilters, readonly string[]>> = {
    languageGroup: ["all", "english", "japanese", "chinese"], availability: ["all", "in_stock", "available", "assigned", "reserved", "out"],
    priceSource: ["sale", "pricecharting", "tcgplayer", "coolstuff"], sortMode: ["name", "expansion", "number", "price", "quantity"],
    issue: ["all", "missingImage", "missingPriceCharting", "zeroPrice", "lowStock", "duplicates"],
    cardType: ["all", "pokemon", "supporter", "item", "stadium", "tool", "energy", "unknown"]
  };
  for (const key of Object.keys(filters) as Array<keyof InventoryFilters>) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 300 || value.includes("\0") || (choices[key] && !choices[key]!.includes(value))) fail();
    Object.assign(filters, { [key]: value });
  }
  const offset = Number(input.offset ?? 0), limit = Number(input.limit ?? 24), scope = input.scope ?? "page";
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100 || !["page", "all", "ids"].includes(String(scope))) fail();
  return { filters, offset, limit, scope: scope as InventoryQuery["scope"] };
}

export function inventoryRequestPath(filters: InventoryFilters, offset = 0, limit = 24, scope: InventoryQuery["scope"] = "page") {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit), scope });
  for (const key of Object.keys(filters) as Array<keyof InventoryFilters>) if (filters[key] !== defaultInventoryFilters[key]) params.set(key, filters[key]);
  return "/inventory/view?" + params.toString();
}

export function inventoryPriceValue(item: InventoryQueryItem, source: InventoryPriceSource, sell: number) {
  const convert = (usd: number | null | undefined) => usd && usd > 0 ? usd * sell : 0;
  if (item.folder && (source === "pricecharting" || (source === "sale" && item.inventoryStatus === "not_for_sale"))) {
    return { ars: convert(item.folder.valueUsd), usd: item.folder.valueUsd, hasPrice: item.folder.totalCards > 0 };
  }
  if (source === "sale") return { ars: item.priceArs || null, usd: item.priceUsd, hasPrice: item.priceArs > 0 || Boolean(item.priceUsd && item.priceUsd > 0) };
  const usd = source === "pricecharting" ? item.priceReferences?.priceCharting.usd ?? null
    : source === "tcgplayer" ? item.priceReferences?.tcgplayer.marketPriceUsd ?? item.priceReferences?.tcgplayer.usd ?? null
    : item.priceReferences?.coolstuff.usd ?? null;
  const ars = usd ? (source === "tcgplayer" ? Math.max(800, Math.ceil(convert(usd) / 100) * 100) : convert(usd)) : null;
  return { ars, usd, hasPrice: usd !== null && usd > 0 };
}

export function inventoryPriceSortValue(item: InventoryQueryItem, source: InventoryPriceSource, rate: { sell: number }) {
  const price = inventoryPriceValue(item, source, rate.sell);
  return price.ars || (price.usd && price.usd > 0 ? price.usd * rate.sell : 0);
}

export function filterInventoryItems<T extends InventoryQueryItem>(items: readonly T[], filters: InventoryFilters, sell: number, duplicates = buildDuplicateIdentityKeys([...items])): T[] {
  const search = parseUiSearchQuery(filters.query);
  return items.map(item => ({ item, score: scoreStockSearch(item, search) })).filter(({ item, score }) =>
    (!search.tokens.length || score > 0) &&
    (filters.expansion === "all" || item.product.expansion === filters.expansion) &&
    (filters.language === "all" || item.variant.language === filters.language) &&
    (filters.languageGroup === "all" || inventoryLanguageGroup(item.variant.language) === filters.languageGroup) &&
    (filters.condition === "all" || item.variant.condition === filters.condition) &&
    (filters.location === "all" || item.location === filters.location) &&
    (filters.intakeBatch === "all" || item.intakeBatch === filters.intakeBatch) &&
    (filters.inventoryStatus === "all" || (item.inventoryStatus || "available") === filters.inventoryStatus) &&
    (filters.tag === "all" || inventoryTags(item.tags).includes(filters.tag)) &&
    (filters.cardType === "all" || (item.itemKind !== "folder" && (item.cardType || "unknown") === filters.cardType)) &&
    (filters.owner === "all" || (filters.owner === "ultimoturno" ? !item.ownerUserId : item.ownerUserId === filters.owner)) &&
    (filters.issue === "all" || stockItemIssues(item, duplicates).includes(filters.issue)) &&
    (filters.availability === "all" || (search.tokens.length > 0 && filters.availability === "in_stock") ||
      (filters.availability === "in_stock" && item.quantityOnHand > 0) ||
      (filters.availability === "available" && item.freeQuantity > 0) ||
      (filters.availability === "assigned" && item.quantityAssigned > 0) ||
      (filters.availability === "reserved" && item.quantityReserved > 0) ||
      (filters.availability === "out" && item.quantityOnHand === 0))
  ).sort((left, right) => {
    if (search.tokens.length && left.score !== right.score) return right.score - left.score;
    const a = left.item, b = right.item;
    if (filters.sortMode === "price") return inventoryPriceSortValue(b, filters.priceSource, { sell }) - inventoryPriceSortValue(a, filters.priceSource, { sell });
    if (filters.sortMode === "quantity") return b.availableQuantity - a.availableQuantity;
    if (filters.sortMode === "expansion") return `${a.product.expansion} ${a.product.number || ""}`.localeCompare(`${b.product.expansion} ${b.product.number || ""}`, "es", { numeric: true });
    if (filters.sortMode === "number") return (a.product.number || "").localeCompare(b.product.number || "", "es", { numeric: true });
    return a.product.name.localeCompare(b.product.name, "es");
  }).map(entry => entry.item);
}

export function inventoryMetadata(items: InventoryQueryItem[], sell: number, duplicates = buildDuplicateIdentityKeys(items)): InventoryMetadata {
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const owners = unique(items.filter(item => item.ownerUserId).map(item => item.ownerUserId + "\t" + item.ownerName));
  return {
    quality: summarizeStockQuality(items, duplicates),
    options: { expansions: unique(items.map(i => i.product.expansion)), languages: unique(items.map(i => i.variant.language)),
      conditions: unique(items.map(i => i.variant.condition)), locations: unique(items.map(i => i.location)),
      intakeBatches: unique(items.map(i => i.intakeBatch)), inventoryStatuses: unique(items.map(i => i.inventoryStatus || "available")),
      tags: unique(items.flatMap(i => inventoryTags(i.tags))) },
    owners: owners.map(owner => { const [userId, name] = owner.split("\t"); return { userId, name }; }),
    availability: { all: items.length, inStock: items.filter(i => i.quantityOnHand > 0).length, available: items.filter(i => i.freeQuantity > 0).length,
      assigned: items.filter(i => i.quantityAssigned > 0).length, reserved: items.filter(i => i.quantityReserved > 0).length, out: items.filter(i => i.quantityOnHand === 0).length },
    priceSources: Object.fromEntries((["sale", "pricecharting", "tcgplayer", "coolstuff"] as const).map(source => [source, items.filter(i => inventoryPriceValue(i, source, sell).hasPrice).length])) as InventoryMetadata["priceSources"]
  };
}

export function buildDuplicateIdentityKeys(items: InventoryQueryItem[]): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = stockIdentityKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

export function summarizeStockQuality(items: InventoryQueryItem[], duplicateKeys: Set<string>): StockQualitySummary {
  return items.reduce<StockQualitySummary>((summary, item) => {
    const issues = stockItemIssues(item, duplicateKeys);
    if (issues.includes("missingImage")) summary.missingImage += 1;
    if (issues.includes("missingPriceCharting")) summary.missingPriceCharting += 1;
    if (issues.includes("zeroPrice")) summary.zeroPrice += 1;
    if (issues.includes("lowStock")) summary.lowStock += 1;
    if (issues.includes("duplicates")) summary.duplicates += 1;
    return summary;
  }, { missingImage: 0, missingPriceCharting: 0, zeroPrice: 0, lowStock: 0, duplicates: 0 });
}

export function stockItemIssues(item: InventoryQueryItem, duplicateKeys: Set<string>): IssueFilter[] {
  const issues: IssueFilter[] = [];
  if (!item.product.imageUrl) issues.push("missingImage");
  if (!item.product.identifiers.some((identifier) => identifier.source === "pricecharting")) issues.push("missingPriceCharting");
  if (!item.priceArs) issues.push("zeroPrice");
  if (item.availableQuantity <= 1) issues.push("lowStock");
  if (duplicateKeys.has(stockIdentityKey(item))) issues.push("duplicates");
  return issues;
}

export function stockIdentityKey(item: InventoryQueryItem): string {
  return normalizeInventoryText([item.product.name, item.product.expansion, item.product.number, item.variant.language, item.variant.condition, item.variant.finish, item.variant.gradingCompany, item.variant.grade, item.variant.gradingCert].join("|"));
}

export function inventoryLanguageGroup(language: string): LanguageGroupFilter {
  const normalized = normalizeInventoryText(language);
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (["chinese", "simplified", "traditional", "taiwan"].some((token) => normalized.includes(token))) return "chinese";
  if (["zh", "cn", "chs", "cht", "china"].some((token) => tokens.has(token))) return "chinese";
  if (["japanese", "japan", "korean", "korea", "indonesia", "indonesian", "thai", "thailand", "vietnam", "asia"].some((token) => normalized.includes(token))) return "japanese";
  if (["ja", "jp", "kr", "ko"].some((token) => tokens.has(token))) return "japanese";
  return "english";
}

export function inventoryTags(value: string): string[] {
  const seen = new Set<string>();
  return String(value || "")
    .split(/[,;|]/)
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

export function normalizeInventoryText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseUiSearchQuery(value: string) {
  const raw = normalizeInventoryText(value);
  const tokens = raw.split(" ").filter((token) => token && token !== "s");
  const numberTokens = [...new Set(tokens
    .map((token) => token.replace(/^#/, ""))
    .filter((token) => /^[0-9]+[a-z]?$/i.test(token))
    .map((token) => token.replace(/^0+([0-9])/, "$1")))].slice(0, 1);
  const textTokens = [...new Set(tokens.filter((token) => !/^[0-9]+[a-z]?$/i.test(token.replace(/^#/, ""))))];
  return { raw, tokens, textTokens, numberTokens };
}

export function uiSearchTokenVariants(token: string): string[] {
  const variants = new Set([token]);
  if (token.endsWith("ies") && token.length > 4) variants.add(`${token.slice(0, -3)}y`);
  if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
  return [...variants];
}

export function normalizedTextIncludesToken(value: string, token: string): boolean {
  return uiSearchTokenVariants(token).some((variant) => value.includes(variant));
}

export function normalizedWordsIncludeToken(value: string, token: string): boolean {
  const words = new Set(value.split(" ").filter(Boolean));
  return uiSearchTokenVariants(token).some((variant) => words.has(variant));
}

export function primaryCardNumber(value: string) {
  const raw = String(value || "").trim().split("/")[0] || "";
  return normalizeInventoryText(raw).replace(/\s+/g, "").replace(/^0+([0-9])/, "$1");
}

export function scoreStockSearch(item: InventoryQueryItem, query: ReturnType<typeof parseUiSearchQuery>) {
  if (!query.tokens.length) return 1;
  const name = normalizeInventoryText(item.product.name);
  const nameWords = name.split(" ");
  const expansionText = normalizeInventoryText(item.product.expansion);
  const skuText = normalizeInventoryText(item.sku);
  const miscText = normalizeInventoryText([
    item.variant.language,
    item.variant.condition,
    item.variant.finish,
    item.variant.gradingCompany,
    item.variant.grade,
    item.variant.gradingCert,
    item.location,
    item.tags,
    item.product.identifiers.map((identifier) => `${identifier.source} ${identifier.externalId} ${identifier.url || ""}`).join(" ")
  ].join(" "));
  const haystack = `${name} ${expansionText} ${skuText} ${miscText}`;
  let score = 0;
  for (const token of query.textTokens) {
    if (normalizedWordsIncludeToken(name, token)) score += 50;
    else if (normalizedTextIncludesToken(name, token)) score += 34;
    else if (normalizedTextIncludesToken(skuText, token)) score += 24;
    else if (normalizedTextIncludesToken(expansionText, token)) score += 16;
    else if (normalizedTextIncludesToken(miscText, token)) score += 7;
    else if (normalizedTextIncludesToken(haystack, token)) score += 3;
    else return 0;
  }
  const itemNumber = primaryCardNumber(item.product.number || "");
  const fullNumber = normalizeInventoryText(item.product.number || "").replace(/\s+/g, "");
  for (const token of query.numberTokens) {
    if (itemNumber === token) score += 80;
    else if (fullNumber.includes(token)) score += 18;
    else if (skuText.includes(token)) score += 8;
    else return 0;
  }
  if (query.raw && haystack.includes(query.raw)) score += 10;
  return score;
}
