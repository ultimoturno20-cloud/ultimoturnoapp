import { parse } from "csv-parse/sync";

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
