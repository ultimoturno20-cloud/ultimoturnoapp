import { parse } from "csv-parse/sync";
import { load } from "cheerio";

export type CoolstuffPriceTarget = {
  priceChartingId: string;
  name: string;
  expansion: string;
  number: string;
  condition: string;
  finish: string;
};

export type CoolstuffOffer = {
  condition: string;
  priceUsd: number;
  quantity: number;
};

export type CoolstuffProduct = {
  name: string;
  expansion: string;
  number: string;
  finish: string;
  url: string;
  offers: CoolstuffOffer[];
};

export type CoolstuffExpansionLink = {
  name: string;
  url: string;
};

export type CoolstuffMatch = {
  status: "matched" | "not_found" | "ambiguous";
  confidence: number;
  product?: CoolstuffProduct;
  offer?: CoolstuffOffer;
  message: string;
};

export function parseCoolstuffProducts(html: string, baseUrl = "https://www.coolstuffinc.com"): CoolstuffProduct[] {
  const $ = load(html);
  return $(".product-search-row[itemtype='https://schema.org/Product']").toArray().map((element) => {
    const row = $(element);
    const name = row.find("[itemprop='name']").first().text().replace(/\s+/g, " ").trim();
    const breadcrumb = row.find(".breadcrumb-trail").first().text().replace(/\s+/g, " ").trim();
    const expansion = breadcrumb.split("»").slice(1).join("»").trim();
    const relativeUrl = row.find("a.productLink").first().attr("href") || "";
    const parsedIdentity = parseCoolstuffProductIdentity(name);
    const offers = row.find("[itemprop='offers'][itemtype='https://schema.org/Offer']").toArray().map((offerElement) => {
      const offer = $(offerElement);
      const priceUsd = Number(offer.find("[itemprop='price']").first().attr("content") || 0);
      const quantityText = offer.find(".card-qty").first().text().trim();
      const quantity = quantityText.includes("+") ? Number(quantityText.replace(/\D/g, "")) : Number(quantityText || 0);
      const conditionCell = offer.find(".card-qty").first().parent();
      const condition = conditionCell.clone().children("span,meta").remove().end().text().replace(/\s+/g, " ").trim();
      return { condition, priceUsd, quantity };
    }).filter((offer) => offer.priceUsd > 0 && offer.condition);
    return {
      name: parsedIdentity.name,
      expansion,
      number: parsedIdentity.number,
      finish: parsedIdentity.finish,
      url: relativeUrl ? new URL(relativeUrl, baseUrl).toString() : "",
      offers
    };
  }).filter((product) => product.name && product.url && product.offers.length);
}

export function parseCoolstuffExpansionLinks(html: string, baseUrl = "https://www.coolstuffinc.com"): CoolstuffExpansionLink[] {
  const $ = load(html);
  const unique = new Map<string, CoolstuffExpansionLink>();
  $(".set-list a[href^='/page/']").each((_, element) => {
    const link = $(element);
    const name = link.text().replace(/\s+/g, " ").trim();
    const relativeUrl = link.attr("href") || "";
    if (!name || !/^\/page\/\d+$/i.test(relativeUrl)) return;
    const url = new URL(relativeUrl, baseUrl).toString();
    unique.set(`${normalizeCoolstuffExpansion(name)}|${url}`, { name, url });
  });
  return [...unique.values()];
}

export function findCoolstuffExpansionUrl(expansion: string, links: CoolstuffExpansionLink[]) {
  const target = normalizeCoolstuffExpansion(expansion);
  if (!target) return "";
  const ranked = links.map((link) => {
    const candidate = normalizeCoolstuffExpansion(link.name);
    if (!candidate) return { link, score: 0 };
    let score = target === candidate ? 100 : 0;
    if (!score && (target.includes(candidate) || candidate.includes(target))) {
      const extraWords = Math.abs(target.split(" ").length - candidate.split(" ").length);
      score = Math.max(80, 90 - extraWords);
    }
    if (!score) {
      const targetWords = new Set(target.split(" ").filter(Boolean));
      const candidateWords = candidate.split(" ").filter(Boolean);
      const shared = candidateWords.filter((word) => targetWords.has(word)).length;
      score = candidateWords.length ? Math.round((shared / Math.max(targetWords.size, candidateWords.length)) * 70) : 0;
    }
    return { link, score };
  }).sort((left, right) => right.score - left.score);
  if (!ranked[0] || ranked[0].score < 70) return "";
  if (ranked[1] && ranked[0].score === ranked[1].score) return "";
  return ranked[0].link.url;
}

export function parseCoolstuffPageCount(html: string, pageUrl: string) {
  const $ = load(html);
  let maximum = 1;
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    let candidate: URL;
    try {
      candidate = new URL(href, pageUrl);
    } catch {
      return;
    }
    const page = Number(candidate.searchParams.get("page") || 1);
    if (Number.isInteger(page)) maximum = Math.max(maximum, Math.min(page, 50));
  });
  return maximum;
}

export function matchCoolstuffProduct(target: CoolstuffPriceTarget, products: CoolstuffProduct[]): CoolstuffMatch {
  const ranked = products.map((product) => {
    let confidence = 0;
    const targetName = normalizeCoolstuffText(target.name);
    const productName = normalizeCoolstuffText(product.name);
    const targetNumber = normalizeCoolstuffNumber(target.number);
    const productNumber = normalizeCoolstuffNumber(product.number);
    const targetExpansion = normalizeCoolstuffExpansion(target.expansion);
    const productExpansion = normalizeCoolstuffExpansion(product.expansion);
    if (targetName === productName) confidence += 50;
    else if (targetName && productName && (targetName.includes(productName) || productName.includes(targetName))) confidence += 30;
    if (targetNumber && productNumber === targetNumber) confidence += 35;
    else if (targetNumber && productNumber && primaryCoolstuffNumber(productNumber) === primaryCoolstuffNumber(targetNumber)) confidence += 22;
    if (targetExpansion && productExpansion === targetExpansion) confidence += 20;
    else if (targetExpansion && productExpansion && (targetExpansion.includes(productExpansion) || productExpansion.includes(targetExpansion))) confidence += 10;
    const finishCompatible = isCoolstuffFinishCompatible(target.finish, product.finish);
    confidence += finishCompatible ? coolstuffFinishScore(target.finish, product.finish) : -100;
    const offer = chooseCoolstuffOffer(target.condition, product.offers);
    if (offer) confidence += 8;
    return { product, offer, confidence };
  }).filter((candidate) => candidate.offer && candidate.confidence >= 78)
    .sort((left, right) => right.confidence - left.confidence);
  if (!ranked.length) return { status: "not_found", confidence: 0, message: "Sin coincidencia confiable en CoolStuff." };
  if (ranked[1] && ranked[0].confidence - ranked[1].confidence < 12) {
    return { status: "ambiguous", confidence: ranked[0].confidence, message: `Coincidencias cercanas: ${ranked[0].product.name} / ${ranked[1].product.name}.` };
  }
  return { status: "matched", confidence: Math.min(100, ranked[0].confidence), product: ranked[0].product, offer: ranked[0].offer, message: "Coincidencia confiable." };
}

export function buildCoolstuffSearchQuery(target: CoolstuffPriceTarget) {
  return [target.name, target.number].filter(Boolean).join(" ").trim();
}

function parseCoolstuffProductIdentity(value: string) {
  const match = value.match(/^(.*?)\s+-\s+([a-z0-9]+(?:\/[a-z0-9]+)?)(?:\s+\(([^)]+)\))?$/i);
  return match ? { name: match[1].trim(), number: match[2].trim(), finish: String(match[3] || "normal").trim() } : { name: value.trim(), number: "", finish: "normal" };
}

function normalizeCoolstuffText(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCoolstuffExpansion(value: string) {
  return normalizeCoolstuffText(String(value || "").replace(/^[a-z]{1,4}:\s*/i, "").replace(/\bpokemon\b/gi, "").replace(/\bcollection\b/gi, ""));
}

function normalizeCoolstuffNumber(value: string) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9/]+/g, "").replace(/^0+(?=\d)/, "");
}

function primaryCoolstuffNumber(value: string) {
  return value.split("/")[0].replace(/^0+(?=\d)/, "");
}

function coolstuffFinishScore(targetFinish: string, productFinish: string) {
  const target = normalizeCoolstuffText(targetFinish);
  const product = normalizeCoolstuffText(productFinish);
  if (target.includes("reverse")) return product.includes("reverse") ? 18 : -30;
  if (target.includes("cosmos")) return product.includes("cosmo") ? 18 : -30;
  if (target.includes("master") && target.includes("ball")) return product.includes("master") && product.includes("ball") ? 18 : -30;
  if (target.includes("poke") && target.includes("ball")) return product.includes("poke") && product.includes("ball") ? 18 : -30;
  if (target.includes("1st") || target.includes("first edition")) return product.includes("1st") || product.includes("first edition") ? 18 : -30;
  if (target.includes("holo")) return product.includes("holo") || product === "normal" ? 6 : -12;
  return product === "normal" || product.includes("non holo") ? 10 : -8;
}

function isCoolstuffFinishCompatible(targetFinish: string, productFinish: string) {
  const target = normalizeCoolstuffText(targetFinish);
  const product = normalizeCoolstuffText(productFinish);
  if (target.includes("reverse")) return product.includes("reverse");
  if (target.includes("cosmos")) return product.includes("cosmo");
  if (target.includes("master") && target.includes("ball")) return product.includes("master") && product.includes("ball");
  if (target.includes("poke") && target.includes("ball")) return product.includes("poke") && product.includes("ball") && !product.includes("master");
  if (target.includes("1st") || target.includes("first edition")) return product.includes("1st") || product.includes("first edition");
  if (target.includes("holo")) return !product.includes("reverse");
  return !product.includes("reverse")
    && !product.includes("cosmo")
    && !product.includes("master ball")
    && !product.includes("poke ball")
    && !product.includes("1st")
    && !product.includes("first edition");
}

function chooseCoolstuffOffer(condition: string, offers: CoolstuffOffer[]) {
  const expectedNearMint = ["nm", "mint", "near mint"].includes(normalizeCoolstuffText(condition));
  const preferred = offers.find((offer) => expectedNearMint ? normalizeCoolstuffText(offer.condition).includes("near mint") : normalizeCoolstuffText(offer.condition).includes("played"));
  return preferred || (expectedNearMint ? undefined : offers.find((offer) => normalizeCoolstuffText(offer.condition).includes("near mint")));
}

export type ParsedImportRow = {
  localRowId: string;
  name: string;
  originalName?: string;
  expansion: string;
  number?: string;
  quantity: number;
  language?: string;
  scannerAverageUsd?: number;
  reviewReason?: string;
};

export type ImportParseResult = {
  source: "monprice_csv";
  rows: ParsedImportRow[];
  reviewRows: ParsedImportRow[];
};

export type ImportQualityInput = {
  name?: string;
  expansion?: string;
  number?: string;
  language?: string;
  condition?: string;
  quantity?: number;
  priceArs?: number;
  currentPriceArs?: number;
};

export type CandidateMatchInput = {
  id: string;
  name: string;
  expansion?: string;
  number?: string;
  language?: string;
  condition?: string;
};

export type CandidateMatch = CandidateMatchInput & {
  confidence: number;
  reasons: string[];
};

const demoNameTranslations: Record<string, string> = {
  "\u30d4\u30ab\u30c1\u30e5\u30a6": "Pikachu",
  "\u30ea\u30b6\u30fc\u30c9\u30f3": "Charizard",
  "\u30a4\u30fc\u30d6\u30a4": "Eevee",
  "\u30df\u30e5\u30a6\u30c4\u30fc": "Mewtwo",
  "\u30b2\u30f3\u30ac\u30fc": "Gengar",
  "\u30ec\u30c3\u30af\u30a6\u30b6": "Rayquaza",
  "\u6770\u5c3c\u9f9f": "Squirtle",
  "\u76ae\u5361\u4e18": "Pikachu",
  "\u4f0a\u5e03": "Eevee",
  "\u55b7\u706b\u9f99": "Charizard",
  "\u8def\u5361\u5229\u6b27": "Lucario",
  "\u70c8\u7a7a\u5750": "Rayquaza"
};

export function translateDemoCardName(value: string): string {
  const clean = String(value || "").trim();
  return demoNameTranslations[clean] || clean;
}

export function expandDemoSearchTerms(value: string): string[] {
  const clean = String(value || "").trim();
  const translated = translateDemoCardName(clean);
  return [...new Set([clean, translated].filter(Boolean))];
}

export function buildImportQualityWarnings(input: ImportQualityInput): string[] {
  const warnings: string[] = [];
  if (!input.name) warnings.push("Falta nombre reconocible");
  if (!input.expansion) warnings.push("Falta expansion");
  if (!input.number) warnings.push("Falta numero de carta");
  if (!input.language) warnings.push("Falta idioma");
  if (!input.condition) warnings.push("Falta condicion");
  if (!input.quantity || input.quantity <= 0) warnings.push("Cantidad invalida");
  if (!input.priceArs || input.priceArs <= 0) warnings.push("Precio no informado");
  if (input.currentPriceArs && input.priceArs && Math.abs(input.currentPriceArs - input.priceArs) >= 1000) {
    warnings.push("Precio distinto al cache actual");
  }
  return warnings;
}

export function rankImportCandidates(
  query: CandidateMatchInput,
  candidates: CandidateMatchInput[],
  minimumConfidence = 58
): CandidateMatch[] {
  const queryName = normalizeForMatch(translateDemoCardName(query.name));
  const queryFirst = queryName.split(" ")[0] || queryName;
  return candidates
    .map((candidate) => {
      let confidence = 30;
      const reasons: string[] = [];
      const candidateName = normalizeForMatch(candidate.name);
      if (queryFirst && candidateName.includes(queryFirst)) {
        confidence += 28;
        reasons.push("nombre");
      }
      if (candidate.expansion && candidate.expansion === query.expansion) {
        confidence += 18;
        reasons.push("expansion");
      }
      if (candidate.number && candidate.number === query.number) {
        confidence += 18;
        reasons.push("numero");
      }
      if (candidate.language && candidate.language === query.language) {
        confidence += 10;
        reasons.push("idioma");
      }
      if (candidate.condition && candidate.condition === query.condition) {
        confidence += 8;
        reasons.push("condicion");
      }
      return { ...candidate, confidence: Math.min(98, confidence), reasons };
    })
    .filter((candidate) => candidate.confidence >= minimumConfidence)
    .sort((left, right) => right.confidence - left.confidence);
}

export function parseDemoMonPriceCsv(csvText: string): ImportParseResult {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { source: "monprice_csv", rows: [], reviewRows: [] };
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((value) => value.trim().toLowerCase());
  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split(delimiter).map((value) => value.trim());
    const get = (name: string) => cells[headers.indexOf(name)] || "";
    const quantity = Number(get("count") || get("cantidad") || 0);
    const originalName = get("name") || get("nombre");
    const translatedName = translateDemoCardName(originalName);
    const parsed: ParsedImportRow = {
      localRowId: `demo-row-${index + 1}`,
      name: translatedName,
      originalName: originalName === translatedName ? undefined : originalName,
      expansion: get("set") || get("expansion"),
      number: get("number") || get("numero"),
      quantity,
      language: get("language") || get("idioma"),
      scannerAverageUsd: Number(get("average price") || get("scanner avg usd") || 0) || undefined
    };
    if (!parsed.name || !parsed.expansion || quantity <= 0) {
      parsed.reviewReason = "Fila ficticia incompleta o cantidad invalida";
    }
    return parsed;
  });
  return {
    source: "monprice_csv",
    rows,
    reviewRows: rows.filter((row) => !!row.reviewReason)
  };
}

export type LegacyConciliationRow = {
  sku?: string;
  stockQuantity?: number;
  salesQuantity?: number;
  movementQuantity?: number;
};

export type LegacyConciliationIssue = {
  sku: string;
  expectedQuantity: number;
  observedQuantity: number;
  reason: string;
};

export function buildLegacyConciliationReport(rows: LegacyConciliationRow[]): LegacyConciliationIssue[] {
  return rows.flatMap((row, index) => {
    const sku = row.sku || `fila-${index + 1}`;
    const stock = Number(row.stockQuantity || 0);
    const movements = Number(row.movementQuantity || 0);
    const sales = Number(row.salesQuantity || 0);
    const expected = movements - sales;
    if (stock === expected) return [];
    return [{
      sku,
      expectedQuantity: expected,
      observedQuantity: stock,
      reason: "Diferencia entre stock observado y movimientos menos ventas"
    }];
  });
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

export type PriceChartingCacheRow = {
  priceChartingId: string;
  canonicalUrl: string;
  sourceUrl: string;
  productName: string;
  normalizedName: string;
  expansionName: string;
  normalizedExpansion: string;
  cardNumber: string;
  loosePriceUsd: number | null;
  imageUrl: string;
  searchKey: string;
};

export type PriceChartingParseResult = {
  rowsReceived: number;
  rowsSkipped: number;
  rows: PriceChartingCacheRow[];
};

export function parsePriceChartingCsv(csvText: string): PriceChartingParseResult {
  const records = parse(csvText, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true
  }) as string[][];
  if (records.length < 2) throw new Error("El CSV de PriceCharting esta vacio o no tiene datos.");

  const headers = records[0].map(normalizePriceChartingHeader);
  const index = new Map(headers.map((header, position) => [header, position]));
  const rows: PriceChartingCacheRow[] = [];
  let rowsSkipped = 0;

  for (const record of records.slice(1)) {
    const id = getPriceChartingValue(record, index, ["id", "product-id"]);
    const rawName = decodePriceChartingHtml(getPriceChartingValue(record, index, ["product-name", "name"]));
    if (!id || !rawName) {
      rowsSkipped += 1;
      continue;
    }

    const expansionName = cleanPriceChartingExpansion(decodePriceChartingHtml(getPriceChartingValue(record, index, ["console-name", "set-name"])));
    const parsedName = parsePriceChartingName(rawName);
    const sourceUrl = getPriceChartingValue(record, index, ["url", "product-url", "pricecharting-url"])
      || buildPriceChartingUrl(expansionName, rawName);
    const imageUrl = getPriceChartingValue(record, index, ["image-url", "image", "photo-url", "thumbnail-url", "thumbnail"]);
    const normalizedName = normalizePriceChartingText(parsedName.name);
    const normalizedExpansion = normalizePriceChartingText(expansionName);

    rows.push({
      priceChartingId: id,
      canonicalUrl: canonicalPriceChartingUrl(sourceUrl),
      sourceUrl,
      productName: parsedName.name,
      normalizedName,
      expansionName,
      normalizedExpansion,
      cardNumber: parsedName.number,
      loosePriceUsd: parsePriceChartingPrice(getPriceChartingValue(record, index, [
        "loose-price", "loose", "used-price", "used", "ungraded-price", "ungraded", "ungrounded-price"
      ])),
      imageUrl,
      searchKey: [normalizedName, normalizedExpansion, normalizePriceChartingText(parsedName.number)].filter(Boolean).join(" ")
    });
  }

  return { rowsReceived: records.length - 1, rowsSkipped, rows };
}

function getPriceChartingValue(row: string[], index: Map<string, number>, names: string[]): string {
  for (const name of names) {
    const position = index.get(normalizePriceChartingHeader(name));
    if (position !== undefined) return String(row[position] || "").trim();
  }
  return "";
}

function normalizePriceChartingHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePriceChartingText(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodePriceChartingHtml(value: string): string {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ");
}

function parsePriceChartingName(value: string): { name: string; number: string } {
  const match = value.trim().match(/^(.*)\s+#([^#]+)$/);
  return match ? { name: match[1].trim(), number: match[2].trim() } : { name: value.trim(), number: "" };
}

function cleanPriceChartingExpansion(value: string): string {
  return value.replace(/^Pokemon\s+/i, "").trim();
}

function parsePriceChartingPrice(value: string): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const hasDecimal = /[.,]\d{1,2}$/.test(raw);
  const hasCurrency = raw.includes("$");
  let cleaned = raw.replace(/[^\d.,-]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/,/g, "");
  else if (cleaned.includes(",")) cleaned = cleaned.replace(",", ".");
  const number = Number(cleaned);
  if (!Number.isFinite(number) || number <= 0) return null;
  if (!hasCurrency && !hasDecimal && Number.isInteger(number)) return number / 100;
  return number;
}

function canonicalPriceChartingUrl(value: string): string {
  const clean = String(value || "").trim().replace(/^http:\/\//i, "https://").split("#")[0].split("?")[0].replace(/\/+$/g, "");
  const match = clean.match(/^(https:\/\/www\.pricecharting\.com\/game\/)([^/]+)\/([^/]+)$/i);
  if (!match) return clean.toLowerCase();
  return `${match[1].toLowerCase()}${slugPriceChartingPath(decodeUri(match[2]))}/${slugPriceChartingPath(decodeUri(match[3]))}`;
}

function buildPriceChartingUrl(expansion: string, product: string): string {
  return `https://www.pricecharting.com/game/${slugPriceChartingPath(expansion)}/${slugPriceChartingPath(product)}`;
}

function slugPriceChartingPath(value: string): string {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function decodeUri(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}
