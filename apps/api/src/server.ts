import { createServer, IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getOrderBoards,
  changeOrderBoard,
  adjustInventoryQuantity,
  addClaimFree,
  addPriceChartingCardsToClaim,
  approveCardIndexEntriesByConfidence,
  archiveActiveClaim,
  applyInventorySnapshot,
  addInventoryStock,
  inventoryTransaction,
  cancelReservationSale,
  claimPriceChartingImageQueue,
  closeActiveClaim,
  completeReservationSale,
  createMobileInventoryEntry,
  createClaimSession,
  createClaimSection,
  createPurchase,
  createSale,
  checkPostgresConnection,
  createOperationalDatabase,
  deleteMobileInventoryEntry,
  deleteClaimCard,
  deleteClaimSection,
  deferPriceChartingImageQueueEntry,
  ensurePriceChartingImageQueueForAll,
  ensurePriceChartingImageQueueForActiveClaim,
  ensurePriceChartingImageQueueForStock,
  getAuditLog,
  getCardIndexStatus,
  getDefaultOperationalUser,
  getHealth,
  getInventoryItem,
  getPriceChartingCacheStatus,
  getPriceChartingImageCacheStatus,
  getLatestTcgplayerPriceSourceVersion,
  getTcgplayerPriceCacheStatus,
  loadExampleInventory,
  listImports,
  listMovements,
  listPurchases,
  listClaimsWorkspace,
  listCardIndex,
  listMobileInventoryEntries,
  listActiveClaimMissingPriceChartingImages,
  listPriceChartingCache,
  listSales,
  listStockForBusiness,
  listStockImageReview,
  listPriceChartingImageCatalog,
  previewInventorySnapshot,
  previewActiveClaimOrders,
  markSalePacked,
  markSaleDelivered,
  mergeDuplicateCustomerOrders,
  recordPriceChartingCacheFailure,
  recordPriceChartingImageFailure,
  recordPriceChartingImageSuccess,
  recordPriceChartingImageUrlDiscovered,
  recordTcgplayerPriceCacheFailure,
  recordTcgplayerPriceCacheSkipped,
  replacePriceChartingCache,
  replaceTcgplayerPriceCache,
  refreshCardIndexFromPriceChartingBatch,
  refreshActiveClaimPricesFromPriceCharting,
  refreshCardIndexFromPriceCharting,
  resetInventoryStock,
  reviewCardIndexEntry,
  updateMobileInventoryEntryStatus,
  updateInventoryItemTags,
  updateClaimCard,
  updateClaimSection,
  updateActiveClaimSettings,
  updateSaleItemPacked,
  updateSaleInternalNote,
  updateSaleMessageSent,
  updateSalePayment,
  upsertInventoryItem,
  type AuthenticatedUser,
  type DbStockRow,
  type MobileInventoryEntry,
  type MobileInventoryInput,
  type TcgplayerPriceCacheInput,
  type UpsertInventoryInput
} from "@ultimoturno/db";
import { parsePriceChartingCsv } from "@ultimoturno/importers";

const port = Number(process.env.API_PORT || 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..", "..");
const dataDir = process.env.PGLITE_DATA_DIR || defaultPgliteDataDir();

function defaultPgliteDataDir() {
  const repoApiDataDir = path.resolve(projectRoot, "apps", "api", ".data", "ultimoturno-pilot-real");
  if (existsSync(repoApiDataDir)) return repoApiDataDir;
  return path.resolve(projectRoot, ".data", "ultimoturno-pilot-real");
}
const runtimeEnv = String(process.env.ULTIMOTURNO_ENV || "local").trim().toLowerCase() || "local";
const productionMode = runtimeEnv === "production" || runtimeEnv === "prod";
const dbDriver = String(process.env.ULTIMOTURNO_DB_DRIVER || "pglite").trim().toLowerCase() === "postgres" ? "postgres" : "pglite";
const databaseUrlChoice = selectDatabaseUrl();
const databaseUrl = databaseUrlChoice.value;
const databaseSsl = String(process.env.ULTIMOTURNO_DATABASE_SSL || (productionMode && dbDriver === "postgres" ? "true" : "false")).toLowerCase();
const databaseSslEnabled = ["1", "true", "yes", "require"].includes(databaseSsl);
const databasePoolMax = Number(process.env.ULTIMOTURNO_DATABASE_POOL_MAX || 10);
const deploymentCommitSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
const dbPromise = createOperationalDatabase({
  driver: dbDriver,
  dataDir,
  databaseUrl,
  ssl: databaseSslEnabled,
  poolMax: databasePoolMax
});
const priceChartingCategory = String(process.env.PRICECHARTING_CATEGORY || "pokemon-cards").trim() || "pokemon-cards";
const priceChartingBaseUrl = "https://www.pricecharting.com/price-guide/download-custom";
const priceChartingImageDir = process.env.PRICECHARTING_IMAGE_DIR
  ? path.resolve(process.env.PRICECHARTING_IMAGE_DIR)
  : path.resolve(dataDir, "..", "pricecharting-images");
const priceChartingImageReadDirs = [...new Set([
  priceChartingImageDir,
  // Compatibility with the shared cache used by the Windows launchers.
  path.resolve(projectRoot, "..", "pricecharting-images"),
  path.resolve(dataDir, "..", "pricecharting-images"),
  path.resolve(dataDir, "pricecharting-images"),
  path.resolve(dataDir, "..", "ultimoturno-pglite", "pricecharting-images")
])];
const externalImageIndexPath = path.resolve(dataDir, "..", "external-image-index.json");
const allowedOrigins = String(process.env.ULTIMOTURNO_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
for (const vercelHost of [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
]) {
  const normalizedHost = String(vercelHost || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (normalizedHost) allowedOrigins.push(`https://${normalizedHost}`);
}
for (const vercelHost of [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
]) {
  const normalizedHost = String(vercelHost || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (normalizedHost) allowedOrigins.push(`https://${normalizedHost}`);
}
const dataProfile = String(process.env.ULTIMOTURNO_DATA_PROFILE || "PILOTO REAL").trim() || "PILOTO REAL";
const allowExamples = String(process.env.ULTIMOTURNO_ALLOW_EXAMPLES || "false").toLowerCase() !== "false";
const priceChartingAutoRefreshEnabled = String(process.env.PRICECHARTING_AUTO_REFRESH_ENABLED || "false").toLowerCase() !== "false";
const priceChartingAutoRefreshTime = normalizeDailyTime(process.env.PRICECHARTING_AUTO_REFRESH_TIME || "06:00");
const tcgCsvBaseUrl = String(process.env.TCGCSV_BASE_URL || "https://tcgcsv.com").replace(/\/+$/, "");
const tcgplayerPriceCategoryId = String(process.env.TCGPLAYER_PRICE_CATEGORY_ID || "3").trim() || "3";
const tcgplayerPriceAutoRefreshEnabled = String(process.env.TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED || "false").toLowerCase() !== "false";
const tcgplayerPriceAutoRefreshTime = normalizeDailyTime(process.env.TCGPLAYER_PRICE_AUTO_REFRESH_TIME || "18:30");
const configuredBlueRateSell = Number(process.env.ULTIMOTURNO_BLUE_RATE_ARS || 1540);
const useLiveBlueRate = String(process.env.ULTIMOTURNO_BLUE_RATE_MODE || "manual").toLowerCase() === "auto";
const sharedAccessKey = String(process.env.ULTIMOTURNO_ACCESS_KEY || "").trim();
let priceChartingImageCooldownUntil = 0;
let priceChartingAutoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let priceChartingAutoRefreshRunning = false;
let priceChartingAutoRefreshNextRunAt = "";
let priceChartingAutoRefreshLastStartedAt = "";
let priceChartingAutoRefreshLastCompletedAt = "";
let priceChartingAutoRefreshLastStatus: "never" | "success" | "failed" | "skipped" = "never";
let priceChartingAutoRefreshLastError = "";
let priceChartingAutoRefreshLastEntries = 0;
let tcgplayerPriceAutoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let tcgplayerPriceAutoRefreshRunning = false;
let tcgplayerPriceAutoRefreshNextRunAt = "";
let tcgplayerPriceAutoRefreshLastStartedAt = "";
let tcgplayerPriceAutoRefreshLastCompletedAt = "";
let tcgplayerPriceAutoRefreshLastStatus: "never" | "success" | "failed" | "skipped" = "never";
let tcgplayerPriceAutoRefreshLastError = "";
let tcgplayerPriceAutoRefreshLastEntries = 0;
const imageProxyAllowedHosts = new Set([
  "images.pokemontcg.io",
  "images.pricecharting.com",
  "storage.googleapis.com",
  "assets.tcgdex.net",
  "tcgplayer-cdn.tcgplayer.com"
]);
let blueRateCache: { fetchedAt: number; payload: BlueExchangeRate } | null = null;

type BlueExchangeRate = {
  buy: number | null;
  sell: number;
  source: string;
  updatedAt: string;
  fallback: boolean;
};

type TcgCsvGroup = {
  groupId: number | string;
  name: string;
  abbreviation?: string;
};

type TcgCsvPrice = {
  productId: number | string;
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
  directLowPrice?: number | null;
  subTypeName?: string;
};

type TcgCsvProduct = {
  productId: number | string;
  name: string;
  cleanName?: string;
  imageUrl?: string;
  url?: string;
  groupId: number | string;
  extendedData?: Array<{ name?: string; displayName?: string; value?: string }>;
};

type TcgplayerPriceAutoRefreshStatus = {
  enabled: boolean;
  time: string;
  timezone: string;
  source: string;
  categoryId: string;
  running: boolean;
  nextRunAt: string;
  lastStartedAt: string;
  lastCompletedAt: string;
  lastStatus: "never" | "success" | "failed" | "skipped";
  lastError: string;
  lastEntries: number;
};

type ExternalImageMatch = {
  source: string;
  externalId: string;
  imageUrl: string;
  confidence: number;
};

type ImageResolverMode = "auto" | "pokemon-tcg";
type ImageDiscoverySourceMode = "pricecharting-url" | "pricecharting-storage" | "auto";
type ExternalImageProvider = "pokemontcg" | "tcgdex";

type ExternalImageIndexCard = {
  provider: ExternalImageProvider;
  externalId: string;
  name: string;
  expansion: string;
  number: string;
  imageUrl: string;
};

type ExternalImageIndex = {
  builtAt: string;
  providers: ExternalImageProvider[];
  cards: ExternalImageIndexCard[];
  errors: string[];
};

type ExternalImageIndexLookup = {
  byExact: Map<string, ExternalImageIndexCard[]>;
  byNumber: Map<string, ExternalImageIndexCard[]>;
};

function normalizePriceChartingToken(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.searchParams.get("t")?.trim() || value;
  } catch {
    const queryToken = value.match(/(?:^|[?&])t=([^&]+)/i);
    return queryToken ? decodeURIComponent(queryToken[1]).trim() : value;
  }
}

function buildPriceChartingDownloadUrl(token: string): string {
  const url = new URL(priceChartingBaseUrl);
  url.searchParams.set("t", token);
  url.searchParams.set("category", priceChartingCategory);
  return url.toString();
}

function normalizeDailyTime(value: string): string {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "06:00";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "06:00";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function nextDailyRunAt(time: string, from = new Date()): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(from);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

async function refreshPriceChartingCacheFromConfiguredToken(db: Awaited<typeof dbPromise>) {
  const token = normalizePriceChartingToken(String(process.env.PRICECHARTING_TOKEN || ""));
  if (!token) throw new Error("Falta configurar PRICECHARTING_TOKEN en el entorno de la API.");
  if (token.length !== 40) {
    throw new Error(`PRICECHARTING_TOKEN no parece valido: tiene ${token.length} caracteres y PriceCharting normalmente usa tokens de 40. Ejecuta Configurar PriceCharting.cmd y pega el token o el link API/Download completo.`);
  }

  const sourceUrl = buildPriceChartingDownloadUrl(token);
  const sourceResponse = await fetch(sourceUrl, {
    headers: { "User-Agent": "Mozilla/5.0 UltimoTurnoPriceChartingCache/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(120000)
  });
  if (!sourceResponse.ok) {
    throw new Error(describePriceChartingDownloadFailure(sourceResponse.status, token));
  }
  const csvText = await sourceResponse.text();
  const parsed = parsePriceChartingCsv(csvText);
  return replacePriceChartingCache(db, {
    category: priceChartingCategory,
    sourceHash: crypto.createHash("sha256").update(csvText).digest("hex"),
    rowsReceived: parsed.rowsReceived,
    rowsSkipped: parsed.rowsSkipped,
    rows: parsed.rows
  });
}

function priceChartingAutoRefreshStatus() {
  return {
    enabled: priceChartingAutoRefreshEnabled,
    time: priceChartingAutoRefreshTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
    category: priceChartingCategory,
    running: priceChartingAutoRefreshRunning,
    nextRunAt: priceChartingAutoRefreshNextRunAt,
    lastStartedAt: priceChartingAutoRefreshLastStartedAt,
    lastCompletedAt: priceChartingAutoRefreshLastCompletedAt,
    lastStatus: priceChartingAutoRefreshLastStatus,
    lastError: priceChartingAutoRefreshLastError,
    lastEntries: priceChartingAutoRefreshLastEntries
  };
}

function scheduleNextPriceChartingAutoRefresh() {
  if (!priceChartingAutoRefreshEnabled) return;
  if (priceChartingAutoRefreshTimer) clearTimeout(priceChartingAutoRefreshTimer);
  const next = nextDailyRunAt(priceChartingAutoRefreshTime);
  priceChartingAutoRefreshNextRunAt = next.toISOString();
  const delay = Math.max(1000, next.getTime() - Date.now());
  priceChartingAutoRefreshTimer = setTimeout(() => {
    void runPriceChartingAutoRefresh("schedule").finally(scheduleNextPriceChartingAutoRefresh);
  }, delay);
  priceChartingAutoRefreshTimer.unref?.();
}

async function runPriceChartingAutoRefresh(reason: "schedule" | "startup") {
  if (!priceChartingAutoRefreshEnabled) return;
  if (priceChartingAutoRefreshRunning) {
    priceChartingAutoRefreshLastStatus = "skipped";
    priceChartingAutoRefreshLastError = "Ya habia una actualizacion PriceCharting en curso.";
    return;
  }
  priceChartingAutoRefreshRunning = true;
  priceChartingAutoRefreshLastStartedAt = new Date().toISOString();
  priceChartingAutoRefreshLastError = "";
  try {
    const db = await dbPromise;
    const status = await refreshPriceChartingCacheFromConfiguredToken(db);
    priceChartingAutoRefreshLastStatus = "success";
    priceChartingAutoRefreshLastEntries = status.totalEntries;
    priceChartingAutoRefreshLastCompletedAt = new Date().toISOString();
    console.log(`PriceCharting auto refresh (${reason}) OK: ${status.totalEntries} entradas.`);
  } catch (error) {
    const db = await dbPromise.catch(() => null);
    const message = error instanceof Error ? error.message : String(error);
    if (db) await recordPriceChartingCacheFailure(db, { category: priceChartingCategory, errorMessage: message }).catch(() => undefined);
    priceChartingAutoRefreshLastStatus = "failed";
    priceChartingAutoRefreshLastError = message;
    priceChartingAutoRefreshLastCompletedAt = new Date().toISOString();
    console.error(`PriceCharting auto refresh (${reason}) fallo: ${message}`);
  } finally {
    priceChartingAutoRefreshRunning = false;
  }
}

async function runMissedPriceChartingAutoRefreshOnStartup() {
  if (!priceChartingAutoRefreshEnabled) return;
  const now = new Date();
  const [hours, minutes] = priceChartingAutoRefreshTime.split(":").map(Number);
  const todayScheduled = new Date(now);
  todayScheduled.setHours(hours, minutes, 0, 0);
  if (now.getTime() < todayScheduled.getTime()) return;
  try {
    const db = await dbPromise;
    const status = await getPriceChartingCacheStatus(db);
    const lastCompletedAt = status.lastRun?.completedAt ? new Date(status.lastRun.completedAt) : null;
    if (!lastCompletedAt || lastCompletedAt.getTime() < todayScheduled.getTime()) {
      await runPriceChartingAutoRefresh("startup");
    }
  } catch (error) {
    priceChartingAutoRefreshLastStatus = "failed";
    priceChartingAutoRefreshLastError = error instanceof Error ? error.message : String(error);
  }
}

async function fetchTcgCsvJson<T>(pathName: string): Promise<T> {
  const url = `${tcgCsvBaseUrl}${pathName}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UltimoTurnoTcgplayerPriceCache/1.0"
    },
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw new Error(`TCGCSV HTTP ${response.status}: ${url}`);
  const payload = await response.json() as { success?: boolean; errors?: unknown[]; results?: T };
  if (payload && payload.success === false) throw new Error(`TCGCSV error: ${(payload.errors || []).join(", ")}`);
  return (payload && "results" in payload ? payload.results : payload) as T;
}

async function fetchTcgCsvLastUpdated(): Promise<string> {
  const response = await fetch(`${tcgCsvBaseUrl}/last-updated.txt`, {
    headers: { "User-Agent": "UltimoTurnoTcgplayerPriceCache/1.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`TCGCSV last-updated HTTP ${response.status}`);
  return (await response.text()).trim();
}

function tcgPriceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tcgCsvExtendedValue(product: TcgCsvProduct, ...names: string[]): string {
  const wanted = new Set(names.map(normalizeTcgText));
  for (const item of product.extendedData || []) {
    const keys = [item.name, item.displayName].map((value) => normalizeTcgText(String(value || "")));
    if (keys.some((key) => wanted.has(key))) return String(item.value || "").trim();
  }
  return "";
}

function normalizeTcgText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTcgNumber(value: string): string {
  return normalizeTgPrimaryNumber(value).replace(/^0+([0-9])/, "$1");
}

function normalizeTgPrimaryNumber(value: string): string {
  return normalizeTcgText(String(value || "").split("/")[0] || "").replace(/\s+/g, "");
}

function normalizeTcgName(value: string): string {
  return normalizeTcgText(value)
    .replace(/\b(reverse holo|reverse|holofoil|holo|foil|normal|unlimited|1st edition|first edition|cosmos|master ball|poke ball|pokeball|masterball)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTcgExpansion(value: string): string {
  return normalizeTcgText(value)
    .replace(/^pokemon\s+/, "")
    .replace(/^[a-z]{1,5}\d{0,4}\s*:\s*/, "")
    .replace(/^[a-z]{1,5}\d{0,4}\s+/, "")
    .replace(/\b(scarlet violet|sword shield|sun moon|xy|black white)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tcgTokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared++;
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function upgradeTcgplayerImageUrl(value: string): string {
  return value.replace(/_200w(?=\.(?:jpg|jpeg|png|webp)(?:$|\?))/i, "_in_1000x1000");
}

function scoreTcgCandidate(entry: Record<string, unknown>, product: TcgCsvProduct, group: TcgCsvGroup, number: string) {
  let score = 0;
  const reasons: string[] = [];
  if (normalizeTcgNumber(String(entry.card_number || "")) === normalizeTcgNumber(number)) {
    score += 38;
    reasons.push("numero");
  }
  const entryName = normalizeTcgName(String(entry.canonical_name || ""));
  const productName = normalizeTcgName(String(product.cleanName || product.name || ""));
  if (entryName && productName) {
    if (entryName === productName) {
      score += 34;
      reasons.push("nombre exacto");
    } else if (entryName.includes(productName) || productName.includes(entryName)) {
      score += 24;
      reasons.push("nombre contenido");
    } else if (tcgTokenOverlap(entryName, productName) >= 0.72) {
      score += 18;
      reasons.push("nombre similar");
    } else {
      score -= 20;
    }
  }
  const entryExpansion = normalizeTcgExpansion(String(entry.canonical_expansion || ""));
  const groupExpansion = normalizeTcgExpansion(String(group.name || ""));
  const groupAbbreviation = normalizeTcgExpansion(String(group.abbreviation || ""));
  if (entryExpansion && groupExpansion) {
    if (entryExpansion === groupExpansion || groupExpansion.endsWith(entryExpansion) || entryExpansion.endsWith(groupExpansion)) {
      score += 26;
      reasons.push("set");
    } else if (groupAbbreviation && (entryExpansion === groupAbbreviation || groupExpansion.includes(entryExpansion))) {
      score += 18;
      reasons.push("set abreviado");
    } else if (tcgTokenOverlap(entryExpansion, groupExpansion) >= 0.6) {
      score += 12;
      reasons.push("set similar");
    } else {
      score -= 16;
    }
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

async function loadTcgCandidateRowsForProducts(db: Awaited<typeof dbPromise>, products: TcgCsvProduct[]) {
  const numbers = [...new Set(products
    .map((product) => normalizeTcgNumber(tcgCsvExtendedValue(product, "Number", "Card Number")))
    .filter(Boolean))];
  if (!numbers.length) return new Map<string, Record<string, unknown>[]>();
  const params = numbers;
  const placeholders = params.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await db.query<Record<string, unknown>>(`
    select id, canonical_name, canonical_expansion, card_number, tcgplayer_product_id, match_confidence
    from card_index_entries
    where regexp_replace(lower(split_part(coalesce(card_number, ''), '/', 1)), '^0+', '') in (${placeholders})
  `, params);
  const byNumber = new Map<string, Record<string, unknown>[]>();
  for (const row of rows.rows) {
    const number = normalizeTcgNumber(String(row.card_number || ""));
    const bucket = byNumber.get(number) || [];
    bucket.push(row);
    byNumber.set(number, bucket);
  }
  return byNumber;
}

async function linkTcgCsvProduct(db: Awaited<typeof dbPromise>, product: TcgCsvProduct, group: TcgCsvGroup, candidatesByNumber?: Map<string, Record<string, unknown>[]>) {
  const number = normalizeTgPrimaryNumber(tcgCsvExtendedValue(product, "Number", "Card Number"));
  const productId = String(product.productId || "").trim();
  const rawName = String(product.name || product.cleanName || "").trim();
  const rawExpansion = String(group.name || "").trim();
  if (!number || !productId || !rawName || !rawExpansion) return "skipped" as const;

  const normalizedNumber = normalizeTcgNumber(number);
  const candidateRows = candidatesByNumber
    ? (candidatesByNumber.get(normalizedNumber) || []).slice(0, 500)
    : (await db.query<Record<string, unknown>>(`
      select id, canonical_name, canonical_expansion, card_number, tcgplayer_product_id, match_confidence
      from card_index_entries
      where regexp_replace(lower(split_part(coalesce(card_number, ''), '/', 1)), '^0+', '') = $1
      limit 500
    `, [normalizedNumber])).rows;
  let best: { row: Record<string, unknown>; score: number; reasons: string[] } | null = null;
  for (const row of candidateRows) {
    const scored = scoreTcgCandidate(row, product, group, number);
    if (!best || scored.score > best.score) best = { row, ...scored };
  }
  if (!best || best.score < 72) return "skipped" as const;

  const currentTcgId = String(best.row.tcgplayer_product_id || "").trim();
  const isConflict = !!currentTcgId && currentTcgId !== productId;
  const matchStatus = isConflict ? "conflict" : best.score >= 86 ? "matched" : "weak_match";
  const productUrl = String(product.url || "").trim();
  const imageUrl = upgradeTcgplayerImageUrl(String(product.imageUrl || "").trim());
  const evidence = {
    source: "tcgcsv",
    groupId: String(group.groupId || ""),
    groupName: rawExpansion,
    groupAbbreviation: String(group.abbreviation || ""),
    reasons: best.reasons,
    extendedData: product.extendedData || []
  };

  await db.query(`
    update card_index_entries
    set
      tcgplayer_product_id = case when $7 = 'conflict' then tcgplayer_product_id else $2 end,
      tcgplayer_url = case when $7 = 'conflict' then tcgplayer_url else $3 end,
      tcgplayer_image_url = case when $7 = 'conflict' then tcgplayer_image_url else $4 end,
      image_url = case
        when coalesce(image_url, '') <> '' then image_url
        when $7 = 'conflict' then image_url
        else $4
      end,
      image_source = case
        when coalesce(image_url, '') <> '' then image_source
        when $7 = 'conflict' then image_source
        when $4 <> '' then 'tcgplayer'
        else image_source
      end,
      match_confidence = greatest(match_confidence, $5),
      match_status = case
        when match_status = 'manual' then match_status
        when $7 = 'conflict' then 'conflict'
        when $5 > match_confidence then $7
        else match_status
      end,
      evidence_json = $6::jsonb,
      updated_at = now(),
      last_verified_at = now()
    where id = $1
  `, [best.row.id, productId, productUrl, imageUrl, best.score, JSON.stringify(evidence), matchStatus]);

  await db.query(`
    insert into card_source_links (
      id, card_index_id, source, external_id, url, raw_name, raw_expansion, raw_number,
      raw_variant, image_url, confidence, evidence_json, created_at, updated_at
    ) values ($1, $2, 'tcgplayer', $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now(), now())
    on conflict (card_index_id, source) do update set
      external_id = excluded.external_id,
      url = excluded.url,
      raw_name = excluded.raw_name,
      raw_expansion = excluded.raw_expansion,
      raw_number = excluded.raw_number,
      raw_variant = excluded.raw_variant,
      image_url = excluded.image_url,
      confidence = excluded.confidence,
      evidence_json = excluded.evidence_json,
      updated_at = now()
  `, [
    crypto.randomUUID(),
    best.row.id,
    productId,
    productUrl,
    rawName,
    rawExpansion,
    number,
    tcgCsvExtendedValue(product, "Printing", "Variant", "Finish"),
    imageUrl,
    best.score,
    JSON.stringify(evidence)
  ]);

  return isConflict ? "conflict" as const : matchStatus === "matched" ? "matched" as const : "weak" as const;
}

async function refreshTcgplayerPricesFromTcgCsv(db: Awaited<typeof dbPromise>, options: { force?: boolean } = {}) {
  const sourceVersion = await fetchTcgCsvLastUpdated().catch(() => "");
  if (sourceVersion && !options.force) {
    const lastVersion = await getLatestTcgplayerPriceSourceVersion(db, "tcgcsv", tcgplayerPriceCategoryId);
    if (lastVersion === sourceVersion) {
      return recordTcgplayerPriceCacheSkipped(db, {
        source: "tcgcsv",
        categoryId: tcgplayerPriceCategoryId,
        sourceVersion,
        reason: "TCGCSV no publico cambios desde la ultima corrida exitosa."
      });
    }
  }

  const groups = await fetchTcgCsvJson<TcgCsvGroup[]>(`/tcgplayer/${encodeURIComponent(tcgplayerPriceCategoryId)}/groups`);
  const rows: TcgplayerPriceCacheInput[] = [];
  let rowsReceived = 0;
  let rowsSkipped = 0;

  for (const group of groups) {
    const groupId = String(group.groupId || "").trim();
    if (!groupId) {
      rowsSkipped += 1;
      continue;
    }
    const prices = await fetchTcgCsvJson<TcgCsvPrice[]>(`/tcgplayer/${encodeURIComponent(tcgplayerPriceCategoryId)}/${encodeURIComponent(groupId)}/prices`);
    rowsReceived += prices.length;
    for (const price of prices) {
      const productId = String(price.productId || "").trim();
      const subTypeName = String(price.subTypeName || "").trim();
      if (!productId || !subTypeName) {
        rowsSkipped += 1;
        continue;
      }
      rows.push({
        tcgplayerProductId: productId,
        subTypeName,
        lowPriceUsd: tcgPriceNumber(price.lowPrice),
        midPriceUsd: tcgPriceNumber(price.midPrice),
        highPriceUsd: tcgPriceNumber(price.highPrice),
        marketPriceUsd: tcgPriceNumber(price.marketPrice),
        directLowPriceUsd: tcgPriceNumber(price.directLowPrice),
        sourceGroupId: groupId
      });
    }
    await sleep(120);
  }

  return replaceTcgplayerPriceCache(db, {
    source: "tcgcsv",
    categoryId: tcgplayerPriceCategoryId,
    sourceVersion,
    groupsSeen: groups.length,
    rowsReceived,
    rowsSkipped,
    rows
  });
}

function tcgplayerPriceAutoRefreshStatus(): TcgplayerPriceAutoRefreshStatus {
  return {
    enabled: tcgplayerPriceAutoRefreshEnabled,
    time: tcgplayerPriceAutoRefreshTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
    source: "tcgcsv",
    categoryId: tcgplayerPriceCategoryId,
    running: tcgplayerPriceAutoRefreshRunning,
    nextRunAt: tcgplayerPriceAutoRefreshNextRunAt,
    lastStartedAt: tcgplayerPriceAutoRefreshLastStartedAt,
    lastCompletedAt: tcgplayerPriceAutoRefreshLastCompletedAt,
    lastStatus: tcgplayerPriceAutoRefreshLastStatus,
    lastError: tcgplayerPriceAutoRefreshLastError,
    lastEntries: tcgplayerPriceAutoRefreshLastEntries
  };
}

function scheduleNextTcgplayerPriceAutoRefresh() {
  if (!tcgplayerPriceAutoRefreshEnabled) return;
  if (tcgplayerPriceAutoRefreshTimer) clearTimeout(tcgplayerPriceAutoRefreshTimer);
  const next = nextDailyRunAt(tcgplayerPriceAutoRefreshTime);
  tcgplayerPriceAutoRefreshNextRunAt = next.toISOString();
  const delay = Math.max(1000, next.getTime() - Date.now());
  tcgplayerPriceAutoRefreshTimer = setTimeout(() => {
    void runTcgplayerPriceAutoRefresh("schedule").finally(scheduleNextTcgplayerPriceAutoRefresh);
  }, delay);
  tcgplayerPriceAutoRefreshTimer.unref?.();
}

async function runTcgplayerPriceAutoRefresh(reason: "schedule" | "startup") {
  if (!tcgplayerPriceAutoRefreshEnabled) return;
  if (tcgplayerPriceAutoRefreshRunning) {
    tcgplayerPriceAutoRefreshLastStatus = "skipped";
    tcgplayerPriceAutoRefreshLastError = "Ya habia una actualizacion TCGplayer en curso.";
    return;
  }
  tcgplayerPriceAutoRefreshRunning = true;
  tcgplayerPriceAutoRefreshLastStartedAt = new Date().toISOString();
  tcgplayerPriceAutoRefreshLastError = "";
  try {
    const db = await dbPromise;
    const status = await refreshTcgplayerPricesFromTcgCsv(db);
    tcgplayerPriceAutoRefreshLastStatus = status.lastRun?.status === "skipped" ? "skipped" : "success";
    tcgplayerPriceAutoRefreshLastEntries = status.totalEntries;
    tcgplayerPriceAutoRefreshLastCompletedAt = new Date().toISOString();
    console.log(`TCGplayer price auto refresh (${reason}) ${tcgplayerPriceAutoRefreshLastStatus}: ${status.totalEntries} precios.`);
  } catch (error) {
    const db = await dbPromise.catch(() => null);
    const message = error instanceof Error ? error.message : String(error);
    if (db) await recordTcgplayerPriceCacheFailure(db, { source: "tcgcsv", categoryId: tcgplayerPriceCategoryId, errorMessage: message }).catch(() => undefined);
    tcgplayerPriceAutoRefreshLastStatus = "failed";
    tcgplayerPriceAutoRefreshLastError = message;
    tcgplayerPriceAutoRefreshLastCompletedAt = new Date().toISOString();
    console.error(`TCGplayer price auto refresh (${reason}) fallo: ${message}`);
  } finally {
    tcgplayerPriceAutoRefreshRunning = false;
  }
}

async function runMissedTcgplayerPriceAutoRefreshOnStartup() {
  if (!tcgplayerPriceAutoRefreshEnabled) return;
  const now = new Date();
  const [hours, minutes] = tcgplayerPriceAutoRefreshTime.split(":").map(Number);
  const todayScheduled = new Date(now);
  todayScheduled.setHours(hours, minutes, 0, 0);
  if (now.getTime() < todayScheduled.getTime()) return;
  try {
    const db = await dbPromise;
    const status = await getTcgplayerPriceCacheStatus(db);
    const lastCompletedAt = status.lastRun?.completedAt ? new Date(status.lastRun.completedAt) : null;
    if (!lastCompletedAt || lastCompletedAt.getTime() < todayScheduled.getTime()) {
      await runTcgplayerPriceAutoRefresh("startup");
    }
  } catch (error) {
    tcgplayerPriceAutoRefreshLastStatus = "failed";
    tcgplayerPriceAutoRefreshLastError = error instanceof Error ? error.message : String(error);
  }
}

async function syncCardIndexTcgCsvInProcess(options: { groupOffset?: number; groupLimit?: number }) {
  const db = await dbPromise;
  const groups = (await fetchTcgCsvJson<TcgCsvGroup[]>(`/tcgplayer/${encodeURIComponent(tcgplayerPriceCategoryId)}/groups`))
    .filter((group) => group && group.groupId && group.name);
  const groupOffset = Math.max(0, Math.floor(Number(options.groupOffset || 0)));
  const groupLimit = Math.max(1, Math.min(25, Math.floor(Number(options.groupLimit || 5))));
  const selectedGroups = groups.slice(groupOffset, groupOffset + groupLimit);
  let rowsSeen = 0;
  let rowsMatched = 0;
  let rowsWeak = 0;
  let rowsConflict = 0;
  let rowsSkipped = 0;

  for (const group of selectedGroups) {
    const groupId = String(group.groupId || "").trim();
    if (!groupId) continue;
    const groupProducts = await fetchTcgCsvJson<TcgCsvProduct[]>(`/tcgplayer/${encodeURIComponent(tcgplayerPriceCategoryId)}/${encodeURIComponent(groupId)}/products`);
    const productsWithGroup = groupProducts.map((product) => ({ ...product, groupId: product.groupId || group.groupId }));
    const candidatesByNumber = await loadTcgCandidateRowsForProducts(db, productsWithGroup);
    for (const rawProduct of productsWithGroup) {
      rowsSeen++;
      const result = await linkTcgCsvProduct(db, rawProduct, group, candidatesByNumber);
      if (result === "matched") rowsMatched++;
      else if (result === "weak") rowsWeak++;
      else if (result === "conflict") rowsConflict++;
      else rowsSkipped++;
    }
    await sleep(120);
  }

  await db.query(`
    insert into card_index_sync_runs (
      id, source, status, rows_seen, rows_matched, rows_weak, rows_conflict,
      started_at, completed_at
    ) values ($1, 'tcgcsv-api', 'completed', $2, $3, $4, $5, now(), now())
  `, [crypto.randomUUID(), rowsSeen, rowsMatched, rowsWeak, rowsConflict]);
  const nextGroupOffset = groupOffset + selectedGroups.length < groups.length ? groupOffset + selectedGroups.length : null;
  return {
    status: await getCardIndexStatus(db),
    rowsSeen,
    rowsMatched,
    rowsWeak,
    rowsConflict,
    rowsSkipped,
    groupOffset,
    groupLimit,
    groupsProcessed: selectedGroups.length,
    totalGroups: groups.length,
    nextGroupOffset,
    complete: nextGroupOffset === null
  };
}

function tcgCsvWorkerProgressPath(): string {
  return path.resolve(projectRoot, "outputs", "tcgcsv-card-index-progress.json");
}

function tcgCsvWorkerLogPath(): string {
  return path.resolve(projectRoot, "outputs", "tcgcsv-card-index-worker.log");
}

function cardIndexImageWorkerProgressPath(): string {
  return path.resolve(projectRoot, "outputs", "card-index-image-progress.json");
}

function cardIndexImageWorkerLogPath(): string {
  return path.resolve(projectRoot, "outputs", "card-index-image-worker.log");
}

async function readTcgCsvWorkerProgress(): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(tcgCsvWorkerProgressPath(), "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function startTcgCsvCardIndexWorker(options: { groupOffset?: number; groupLimit?: number; loop?: boolean }) {
  return {
    started: false,
    disabled: true,
    requested: options,
    progress: await readTcgCsvWorkerProgress(),
    progressPath: tcgCsvWorkerProgressPath(),
    logPath: tcgCsvWorkerLogPath(),
    error: "Deshabilitado por seguridad: este worker abre PGlite desde otro proceso. Usar sincronizaciones HTTP/in-process del API."
  };
}

async function readCardIndexImageWorkerProgress(): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(cardIndexImageWorkerProgressPath(), "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function startCardIndexImageWorker(options: { batchSize?: number; concurrency?: number; loop?: boolean }) {
  return {
    started: false,
    disabled: true,
    requested: options,
    progress: await readCardIndexImageWorkerProgress(),
    progressPath: cardIndexImageWorkerProgressPath(),
    logPath: cardIndexImageWorkerLogPath(),
    replacementEndpoint: "/pricecharting-images/reindex-local",
    error: "Deshabilitado por seguridad: este worker abre PGlite desde otro proceso. Usar /pricecharting-images/reindex-local o tools/pricecharting-image-worker.ts."
  };
}

function describePriceChartingDownloadFailure(status: number, token: string): string {
  if (status === 429) return "PriceCharting respondio HTTP 429. Espera antes de volver a sincronizar.";
  if (status === 404) {
    const tokenHint = token.length === 40
      ? "El token tiene 40 caracteres, pero PriceCharting no habilito ese CSV para la categoria configurada."
      : `El token configurado tiene ${token.length} caracteres; PriceCharting normalmente usa tokens de 40 caracteres.`;
    return `PriceCharting respondio HTTP 404. ${tokenHint} Categoria: ${priceChartingCategory}.`;
  }
  return `PriceCharting respondio HTTP ${status}. Categoria: ${priceChartingCategory}.`;
}

function priceChartingPageCandidates(pageUrl: string): string[] {
  const clean = pageUrl.split("#")[0].split("?")[0].replace(/\/+$/g, "");
  const urls = [clean];
  const match = clean.match(/^(https:\/\/www\.pricecharting\.com\/game\/)([^/]+)\/(.+)$/i);
  if (match && !match[2].startsWith("pokemon-")) {
    urls.push(`${match[1]}pokemon-${match[2]}/${match[3]}`);
  }
  return [...new Set(urls)];
}

function extractPriceChartingImageUrl(html: string): string {
  const direct = html.match(/https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'<>\s]+\/1600\.jpg/i);
  if (direct) return direct[0];
  const storageImage = html.match(/https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'<>\s]+\/(?:60|160|400|800)\.jpg/i);
  if (storageImage) return storageImage[0].replace(/\/(?:60|160|400|800)\.jpg$/i, "/1600.jpg");
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return ogImage?.[1]?.replace(/\/(?:60|160|400|800)\.jpg$/i, "/1600.jpg") || "";
}

function directPriceChartingImageCandidates(priceChartingId: string): string[] {
  if (!/^\d+$/.test(priceChartingId)) return [];
  return [1600, 800, 400].map((size) => `https://storage.googleapis.com/images.pricecharting.com/${priceChartingId}/${size}.jpg`);
}

function safeImageFileStem(value: string): string {
  const clean = String(value || "").trim();
  if (/^[a-zA-Z0-9_-]+$/.test(clean)) return clean;
  return crypto.createHash("sha256").update(clean || crypto.randomUUID()).digest("hex").slice(0, 24);
}

function slugPriceChartingText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "qqaposqq")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-?qqaposqq-?/g, "%27")
    .replace(/-+/g, "-");
}

function priceChartingCardUrlCandidates(input: { canonicalUrl: string; productName: string; expansionName: string; cardNumber: string }): string[] {
  const urls = [input.canonicalUrl].filter(Boolean);
  const match = input.canonicalUrl.match(/^(https:\/\/www\.pricecharting\.com\/game\/)([^/]+)\/(.+)$/i);
  const category = match?.[2] || slugPriceChartingText(input.expansionName);
  const prefixedCategory = category.startsWith("pokemon-") ? category : `pokemon-${category}`;
  const productSlug = slugPriceChartingText([input.productName, input.cardNumber].filter(Boolean).join(" "));
  if (prefixedCategory && productSlug) urls.push(`https://www.pricecharting.com/game/${prefixedCategory}/${productSlug}`);
  return [...new Set(urls)];
}

function decodePriceChartingHref(value: string): string {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, "\"");
}

function priceChartingSearchResultCandidates(html: string, input: { productName: string; expansionName: string; cardNumber: string }): string[] {
  const expectedCategory = `pokemon-${slugPriceChartingText(input.expansionName)}`;
  const expectedProduct = slugPriceChartingText([input.productName, input.cardNumber].filter(Boolean).join(" "));
  const nameOnly = slugPriceChartingText(input.productName);
  const hrefs = [...html.matchAll(/href=["']([^"']*\/game\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => decodePriceChartingHref(match[1]))
    .map((href) => href.startsWith("http") ? href : `https://www.pricecharting.com${href}`)
    .filter((href) => href.includes("/game/"));
  return [...new Set(hrefs)]
    .map((href) => {
      const parts = href.match(/\/game\/([^/]+)\/([^/?#]+)/i);
      const category = parts?.[1] || "";
      const product = parts?.[2] || "";
      let score = 0;
      if (category === expectedCategory) score += 80;
      else if (category.includes(expectedCategory) || expectedCategory.includes(category)) score += 35;
      if (expectedProduct && product === expectedProduct) score += 80;
      else if (expectedProduct && (product.startsWith(`${expectedProduct}-`) || expectedProduct.startsWith(`${product}-`))) score += 50;
      else if (nameOnly && product.includes(nameOnly)) score += 30;
      if (input.cardNumber && product.endsWith(`-${slugPriceChartingText(input.cardNumber)}`)) score += 20;
      return { href, score };
    })
    .filter((candidate) => candidate.score >= 80)
    .sort((left, right) => right.score - left.score)
    .map((candidate) => candidate.href);
}

async function expandedPriceChartingCardUrlCandidates(input: { canonicalUrl: string; productName: string; expansionName: string; cardNumber: string }): Promise<string[]> {
  const urls = priceChartingCardUrlCandidates(input);
  const expanded = [...urls];
  for (const candidate of urls) {
    try {
      const response = await fetch(candidate, {
        headers: { "User-Agent": "Mozilla/5.0 UltimoTurnoImageCache/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) continue;
      const html = await response.text();
      const finalUrl = response.url || candidate;
      const isSearchPage = finalUrl.includes("/search-products")
        || /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/search-products/i.test(html);
      if (isSearchPage) expanded.push(...priceChartingSearchResultCandidates(html, input));
      else expanded.push(finalUrl);
    } catch {
      // The normal resolver will surface detailed failures for each candidate.
    }
  }
  return [...new Set(expanded)];
}

function unwrapImageSourceUrl(sourceImageUrl: string): string {
  const tagged = sourceImageUrl.match(/^(?:pokemontcg|tcgdex):[^:]+:(https?:\/\/.+)$/i);
  return tagged ? tagged[1] : sourceImageUrl;
}

function normalizeMatchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCardNumber(value: string): string {
  return normalizeMatchText(String(value || "").split("/")[0] || "").replace(/\s+/g, "").replace(/^0+([0-9])/, "$1");
}

function stripVariantWords(value: string): string {
  return normalizeMatchText(value)
    .replace(/\b(reverse|holofoil|holo|foil|cosmos|master ball|poke ball|pokeball|masterball|1st edition|first edition)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function externalNameCandidates(value: string): string[] {
  const clean = String(value || "")
    .replace(/\s*\[(?:reverse holo|cosmos holo|holo|master ball|poke ball|pokemon center)\]\s*/ig, " ")
    .replace(/\s+(?:reverse holo|cosmos holo|holo|foil)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set([clean, stripVariantWords(value)].filter(Boolean))];
}

function scoreExternalImageMatch(input: { productName: string; expansionName: string; cardNumber: string }, candidate: { name: string; expansion: string; number: string }) {
  const expectedName = stripVariantWords(input.productName);
  const candidateName = stripVariantWords(candidate.name);
  const expectedExpansion = normalizeMatchText(input.expansionName);
  const candidateExpansion = normalizeMatchText(candidate.expansion);
  const expectedNumber = normalizeCardNumber(input.cardNumber);
  const candidateNumber = normalizeCardNumber(candidate.number);
  if (!expectedName || !candidateName || !expectedNumber || !candidateNumber) return 0;
  if (expectedNumber !== candidateNumber) return 0;
  let score = 55;
  if (expectedName === candidateName) score += 30;
  else if (expectedName.includes(candidateName) || candidateName.includes(expectedName)) score += 18;
  else return 0;
  if (expectedExpansion && candidateExpansion) {
    if (expectedExpansion === candidateExpansion) score += 20;
    else if (expectedExpansion.includes(candidateExpansion) || candidateExpansion.includes(expectedExpansion)) score += 10;
    else score -= 18;
  }
  return Math.max(0, Math.min(100, score));
}

function externalIndexCardKey(name: string, number: string): string {
  return `${normalizeCardNumber(number)}|${stripVariantWords(name)}`;
}

function externalSourceImageUrl(match: ExternalImageIndexCard): string {
  return `${match.provider}:${match.externalId}:${match.imageUrl}`;
}

function readExternalImageIndexFromDisk(): Promise<ExternalImageIndex | null> {
  return readFile(externalImageIndexPath, "utf8")
    .then((text) => JSON.parse(text) as ExternalImageIndex)
    .catch(() => null);
}

async function writeExternalImageIndex(index: ExternalImageIndex): Promise<void> {
  await mkdir(path.dirname(externalImageIndexPath), { recursive: true });
  await writeFile(externalImageIndexPath, JSON.stringify(index, null, 2), "utf8");
}

function isFreshExternalImageIndex(index: ExternalImageIndex): boolean {
  const builtAt = Date.parse(index.builtAt);
  return Number.isFinite(builtAt) && Date.now() - builtAt < 7 * 24 * 60 * 60 * 1000 && index.cards.length > 0;
}

async function getExternalImageIndexStatus() {
  const index = await readExternalImageIndexFromDisk();
  if (!index) {
    return {
      exists: false,
      fresh: false,
      path: externalImageIndexPath,
      builtAt: "",
      providers: [] as ExternalImageProvider[],
      cards: 0,
      errors: [] as string[]
    };
  }
  return {
    exists: true,
    fresh: isFreshExternalImageIndex(index),
    path: externalImageIndexPath,
    builtAt: index.builtAt,
    providers: index.providers,
    cards: index.cards.length,
    errors: index.errors
  };
}

async function buildPokemonTcgImageIndex(): Promise<ExternalImageIndexCard[]> {
  const cards: ExternalImageIndexCard[] = [];
  const apiKey = String(process.env.POKEMONTCG_API_KEY || "").trim();
  const pageSize = 250;
  let page = 1;
  let totalCount = Number.POSITIVE_INFINITY;
  while ((page - 1) * pageSize < totalCount) {
    const url = new URL("https://api.pokemontcg.io/v2/cards");
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("select", "id,name,number,set.name,images");
    const response = await fetch(url, {
      headers: {
        "User-Agent": "UltimoTurnoExternalImageIndex/1.0",
        ...(apiKey ? { "X-Api-Key": apiKey } : {})
      },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`PokemonTCG API respondio HTTP ${response.status} al indexar pagina ${page}.`);
    const payload = await response.json() as {
      totalCount?: unknown;
      data?: Array<{ id?: unknown; name?: unknown; number?: unknown; set?: { name?: unknown }; images?: { large?: unknown; small?: unknown } }>;
    };
    totalCount = Number(payload.totalCount || 0);
    for (const card of payload.data || []) {
      const imageUrl = String(card.images?.large || card.images?.small || "");
      if (!imageUrl) continue;
      cards.push({
        provider: "pokemontcg",
        externalId: String(card.id || ""),
        name: String(card.name || ""),
        expansion: String(card.set?.name || ""),
        number: String(card.number || ""),
        imageUrl
      });
    }
    page += 1;
    await wait(apiKey ? 120 : 2100);
  }
  return cards;
}

async function buildPokemonTcgGithubImageIndex(): Promise<ExternalImageIndexCard[]> {
  const headers = { "User-Agent": "UltimoTurnoExternalImageIndex/1.0" };
  const setsResponse = await fetch("https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json", {
    headers,
    signal: AbortSignal.timeout(30000)
  });
  if (!setsResponse.ok) throw new Error(`PokemonTCG raw sets respondio HTTP ${setsResponse.status}.`);
  const sets = await setsResponse.json() as Array<{ id?: unknown; name?: unknown }>;
  const setNames = new Map(sets.map((set) => [String(set.id || ""), String(set.name || "")]));

  const listResponse = await fetch("https://api.github.com/repos/PokemonTCG/pokemon-tcg-data/contents/cards/en?ref=master", {
    headers,
    signal: AbortSignal.timeout(30000)
  });
  if (!listResponse.ok) throw new Error(`GitHub contents respondio HTTP ${listResponse.status}.`);
  const files = await listResponse.json() as Array<{ name?: unknown; download_url?: unknown; type?: unknown }>;
  const cards: ExternalImageIndexCard[] = [];
  for (const file of files) {
    const fileName = String(file.name || "");
    const downloadUrl = String(file.download_url || "");
    if (String(file.type || "") !== "file" || !fileName.endsWith(".json") || !downloadUrl) continue;
    const setId = fileName.replace(/\.json$/i, "");
    const cardResponse = await fetch(downloadUrl, {
      headers,
      signal: AbortSignal.timeout(30000)
    });
    if (!cardResponse.ok) continue;
    const payload = await cardResponse.json() as Array<{ id?: unknown; name?: unknown; number?: unknown; images?: { large?: unknown; small?: unknown } }>;
    for (const card of payload) {
      const imageUrl = String(card.images?.large || card.images?.small || "");
      if (!imageUrl) continue;
      cards.push({
        provider: "pokemontcg",
        externalId: String(card.id || ""),
        name: String(card.name || ""),
        expansion: setNames.get(setId) || setId,
        number: String(card.number || ""),
        imageUrl
      });
    }
    await wait(80);
  }
  return cards;
}

async function buildTcgdexImageIndex(): Promise<ExternalImageIndexCard[]> {
  const languages = ["en", "ja", "zh-tw", "zh-cn"];
  const cards: ExternalImageIndexCard[] = [];
  for (const language of languages) {
    const setsResponse = await fetch(`https://api.tcgdex.net/v2/${language}/sets`, {
      headers: { "User-Agent": "UltimoTurnoExternalImageIndex/1.0" },
      signal: AbortSignal.timeout(30000)
    });
    if (!setsResponse.ok) throw new Error(`TCGdex ${language} respondio HTTP ${setsResponse.status} al listar sets.`);
    const sets = await setsResponse.json() as Array<{ id?: unknown }>;
    for (const set of sets) {
      const setId = String(set.id || "");
      if (!setId) continue;
      try {
        const setResponse = await fetch(`https://api.tcgdex.net/v2/${language}/sets/${encodeURIComponent(setId)}`, {
          headers: { "User-Agent": "UltimoTurnoExternalImageIndex/1.0" },
          signal: AbortSignal.timeout(30000)
        });
        if (!setResponse.ok) continue;
        const payload = await setResponse.json() as {
          name?: unknown;
          cards?: Array<{ id?: unknown; name?: unknown; localId?: unknown; image?: unknown }>;
        };
        for (const card of payload.cards || []) {
          const image = String(card.image || "");
          if (!image) continue;
          cards.push({
            provider: "tcgdex",
            externalId: String(card.id || ""),
            name: String(card.name || ""),
            expansion: String(payload.name || ""),
            number: String(card.localId || ""),
            imageUrl: `${image}/high.webp`
          });
        }
      } catch {
        // Continue with the rest of the sets; the index can be partial.
      }
      await wait(150);
    }
  }
  return cards;
}

async function loadExternalImageIndex(options: { rebuild?: boolean; providers?: ExternalImageProvider[] } = {}): Promise<ExternalImageIndex> {
  const providers: ExternalImageProvider[] = options.providers?.length ? options.providers : ["pokemontcg", "tcgdex"];
  const cached = options.rebuild ? null : await readExternalImageIndexFromDisk();
  if (cached && isFreshExternalImageIndex(cached)) return cached;
  const cards: ExternalImageIndexCard[] = [];
  const errors: string[] = [];
  if (providers.includes("pokemontcg")) {
    try {
      cards.push(...await buildPokemonTcgImageIndex());
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      try {
        cards.push(...await buildPokemonTcgGithubImageIndex());
      } catch (githubError) {
        errors.push(githubError instanceof Error ? githubError.message : String(githubError));
      }
    }
  }
  if (providers.includes("tcgdex")) {
    try {
      cards.push(...await buildTcgdexImageIndex());
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (!cards.length) throw new Error(`No se pudo construir el indice externo de imagenes. ${errors.join(" / ")}`);
  const index: ExternalImageIndex = { builtAt: new Date().toISOString(), providers, cards, errors };
  await writeExternalImageIndex(index);
  return index;
}

function buildExternalImageIndexLookup(index: ExternalImageIndex): ExternalImageIndexLookup {
  const byExact = new Map<string, ExternalImageIndexCard[]>();
  const byNumber = new Map<string, ExternalImageIndexCard[]>();
  for (const card of index.cards) {
    const number = normalizeCardNumber(card.number);
    if (!number) continue;
    const exactKey = externalIndexCardKey(card.name, card.number);
    const exactBucket = byExact.get(exactKey) || [];
    exactBucket.push(card);
    byExact.set(exactKey, exactBucket);
    const numberBucket = byNumber.get(number) || [];
    numberBucket.push(card);
    byNumber.set(number, numberBucket);
  }
  return { byExact, byNumber };
}

function findExternalIndexMatch(
  lookup: ExternalImageIndexLookup,
  entry: { productName: string; expansionName: string; cardNumber: string }
): ExternalImageIndexCard | null {
  const candidates: ExternalImageIndexCard[] = [];
  for (const name of externalNameCandidates(entry.productName)) {
    candidates.push(...(lookup.byExact.get(externalIndexCardKey(name, entry.cardNumber)) || []));
  }
  if (!candidates.length) candidates.push(...(lookup.byNumber.get(normalizeCardNumber(entry.cardNumber)) || []));
  const scored = [...new Set(candidates)]
    .map((card) => ({
      card,
      score: scoreExternalImageMatch(entry, {
        name: card.name,
        expansion: card.expansion,
        number: card.number
      })
    }))
    .filter((match) => match.score >= 85)
    .sort((left, right) => right.score - left.score);
  return scored[0]?.card || null;
}

function pokemonTcgQueryValue(value: string): string {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function findPokemonTcgApiImage(input: { productName: string; expansionName: string; cardNumber: string }): Promise<ExternalImageMatch | null> {
  const number = normalizeCardNumber(input.cardNumber);
  const names = externalNameCandidates(input.productName);
  if (!number || !names.length) return null;
  for (const name of names) {
    const baseClauses = [`number:${pokemonTcgQueryValue(number)}`, `name:${pokemonTcgQueryValue(name)}`];
    const queryAttempts = input.expansionName
      ? [[...baseClauses, `set.name:${pokemonTcgQueryValue(input.expansionName.replace(/^Japanese\s+/i, ""))}`], baseClauses]
      : [baseClauses];
    for (const clauses of queryAttempts) {
      const url = new URL("https://api.pokemontcg.io/v2/cards");
      url.searchParams.set("q", clauses.join(" "));
      url.searchParams.set("pageSize", "20");
      url.searchParams.set("select", "id,name,number,set.name,images");
      const response = await fetch(url, {
        headers: { "User-Agent": "UltimoTurnoImageResolver/1.0" },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error(`PokemonTCG API respondio HTTP ${response.status}.`);
      const payload = await response.json() as { data?: Array<{ id?: unknown; name?: unknown; number?: unknown; set?: { name?: unknown }; images?: { large?: unknown; small?: unknown } }> };
      const matches = (payload.data || [])
        .map((card) => ({
          source: "pokemontcg",
          externalId: String(card.id || ""),
          imageUrl: String(card.images?.large || card.images?.small || ""),
          confidence: scoreExternalImageMatch(input, {
            name: String(card.name || ""),
            expansion: String(card.set?.name || ""),
            number: String(card.number || "")
          })
        }))
        .filter((match) => match.externalId && match.imageUrl && match.confidence >= 85)
        .sort((left, right) => right.confidence - left.confidence);
      if (matches[0]) return matches[0];
    }
  }
  return null;
}

async function findTcgdexImage(input: { productName: string; expansionName: string; cardNumber: string }): Promise<ExternalImageMatch | null> {
  const number = normalizeCardNumber(input.cardNumber);
  const names = externalNameCandidates(input.productName);
  if (!number || !names.length) return null;
  for (const name of names) {
    const url = new URL("https://api.tcgdex.net/v2/en/cards");
    url.searchParams.set("name", name);
    url.searchParams.set("pagination:itemsPerPage", "20");
    const response = await fetch(url, {
      headers: { "User-Agent": "UltimoTurnoImageResolver/1.0" },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`TCGdex respondio HTTP ${response.status}.`);
    const cards = await response.json() as Array<{ id?: unknown; name?: unknown; localId?: unknown; image?: unknown; set?: { name?: unknown } }>;
    const matches = cards
      .map((card) => ({
        source: "tcgdex",
        externalId: String(card.id || ""),
        imageUrl: card.image ? `${String(card.image)}/high.png` : "",
        confidence: scoreExternalImageMatch(input, {
          name: String(card.name || ""),
          expansion: String(card.set?.name || ""),
          number: String(card.localId || "")
        })
      }))
      .filter((match) => match.externalId && match.imageUrl && match.confidence >= 85)
      .sort((left, right) => right.confidence - left.confidence);
    if (matches[0]) return matches[0];
  }
  return null;
}

async function findExternalCardImage(input: { productName: string; expansionName: string; cardNumber: string }, mode: ImageResolverMode): Promise<ExternalImageMatch | null> {
  const errors: string[] = [];
  const resolvers = mode === "pokemon-tcg" ? [findPokemonTcgApiImage] : [findPokemonTcgApiImage, findTcgdexImage];
  for (const resolver of resolvers) {
    try {
      const match = await resolver(input);
      if (match) return match;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length) throw new Error(`No se pudo resolver imagen externa (${errors.join(" / ")}).`);
  return null;
}

async function fetchPriceChartingPageHtml(pageUrl: string): Promise<string> {
  let lastError = "";
  for (const candidate of priceChartingPageCandidates(pageUrl)) {
    const pageResponse = await fetch(candidate, {
      headers: { "User-Agent": "Mozilla/5.0 UltimoTurnoImageCache/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(30000)
    });
    if (pageResponse.ok) {
      const html = await pageResponse.text();
      const finalUrl = pageResponse.url || candidate;
      const isSearchPage = finalUrl.includes("/search-products")
        || /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/search-products/i.test(html);
      if (!isSearchPage) return html;
      lastError = "PriceCharting devolvio una pagina de busqueda";
      continue;
    }
    lastError = `HTTP ${pageResponse.status}`;
    if (pageResponse.status === 429) throw new Error("PriceCharting respondio HTTP 429 al buscar imagen.");
  }
  throw new Error(`No se pudo leer la pagina de PriceCharting (${lastError}).`);
}

async function verifyRemoteImageUrl(sourceImageUrl: string): Promise<string> {
  const response = await fetch(sourceImageUrl, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0 UltimoTurnoImageCache/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Google storage respondio HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) throw new Error(`Google storage no devolvio imagen: ${contentType}.`);
  return sourceImageUrl;
}

async function discoverPriceChartingImageUrl(input: {
  priceChartingId: string;
  canonicalUrl: string;
  sourceMode: ImageDiscoverySourceMode;
}): Promise<string> {
  const errors: string[] = [];
  if (input.sourceMode === "pricecharting-storage" || input.sourceMode === "auto") {
    for (const directUrl of directPriceChartingImageCandidates(input.priceChartingId)) {
      try {
        return await verifyRemoteImageUrl(directUrl);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (input.sourceMode === "pricecharting-url" || input.sourceMode === "auto") {
    const html = await fetchPriceChartingPageHtml(input.canonicalUrl);
    const imageUrl = extractPriceChartingImageUrl(html);
    if (imageUrl) return imageUrl;
    errors.push("La pagina de PriceCharting no contiene URL de imagen.");
  }
  throw new Error(errors.slice(0, 3).join(" / ") || "No se encontro URL de imagen.");
}

async function downloadImageUrl(sourceImageUrl: string, priceChartingId: string, sourceLabel = "Imagen") {
  const imageResponse = await fetch(sourceImageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 UltimoTurnoImageCache/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000)
  });
  if (!imageResponse.ok) throw new Error(`${sourceLabel} respondio HTTP ${imageResponse.status}.`);
  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) throw new Error(`Respuesta inesperada al bajar imagen: ${contentType}.`);

  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  const contentHash = crypto.createHash("sha256").update(bytes).digest("hex");
  const extension = contentType.toLowerCase().includes("png") ? "png" : contentType.toLowerCase().includes("webp") ? "webp" : "jpg";
  const fileName = `${safeImageFileStem(priceChartingId)}.${extension}`;
  await mkdir(priceChartingImageDir, { recursive: true });
  const localPath = path.join(priceChartingImageDir, fileName);
  await writeFile(localPath, bytes);
  return {
    sourceImageUrl,
    localPath,
    publicUrl: `/pricecharting-images/files/${fileName}`,
    contentType,
    byteSize: bytes.length,
    contentHash
  };
}

async function downloadPriceChartingImage(input: { priceChartingId: string; canonicalUrl: string; sourceImageUrl?: string; productName: string; expansionName: string; cardNumber: string; allowPriceCharting: boolean; mode: ImageResolverMode }) {
  const existing = await findLocalPriceChartingImage(input.priceChartingId);
  if (existing) return existing;

  if (input.sourceImageUrl) {
    const downloaded = await downloadImageUrl(unwrapImageSourceUrl(input.sourceImageUrl), input.priceChartingId, imageDownloadSourceLabel(input.sourceImageUrl));
    return {
      ...downloaded,
      sourceImageUrl: input.sourceImageUrl
    };
  }

  const directErrors: string[] = [];
  if (input.allowPriceCharting) {
    for (const directUrl of directPriceChartingImageCandidates(input.priceChartingId)) {
      try {
        return await downloadImageUrl(directUrl, input.priceChartingId, "PriceCharting storage");
      } catch (error) {
        directErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  try {
    const external = await findExternalCardImage(input, input.mode);
    if (external) {
      const downloaded = await downloadImageUrl(external.imageUrl, input.priceChartingId, external.source);
      return {
        ...downloaded,
        sourceImageUrl: `${external.source}:${external.externalId}:${external.imageUrl}`
      };
    }
  } catch (error) {
    directErrors.push(error instanceof Error ? error.message : String(error));
  }

  if (!input.allowPriceCharting || input.mode === "pokemon-tcg") {
    const directHint = directErrors.length ? ` Intentos externos: ${directErrors.slice(0, 2).join(" / ")}.` : "";
    throw new Error(`No se encontro imagen fuerte con ${input.mode === "pokemon-tcg" ? "Pokemon TCG API" : "APIs externas"}.${directHint}`);
  }

  const html = await fetchPriceChartingPageHtml(input.canonicalUrl);
  const sourceImageUrl = extractPriceChartingImageUrl(html);
  if (!sourceImageUrl) {
    const directHint = directErrors.length ? ` Intentos directos: ${directErrors.slice(0, 2).join(" / ")}.` : "";
    throw new Error(`La pagina de PriceCharting no contiene una imagen principal.${directHint}`);
  }
  return downloadImageUrl(sourceImageUrl, input.priceChartingId, "PriceCharting imagen");
}

function imageDownloadSourceLabel(sourceImageUrl: string): string {
  if (sourceImageUrl.startsWith("pokemontcg:")) return "Pokemon TCG API";
  if (sourceImageUrl.startsWith("tcgdex:")) return "TCGdex";
  if (sourceImageUrl.includes("images.pricecharting.com")) return "PriceCharting storage";
  if (sourceImageUrl) return "PriceCharting HTML";
  return "Local";
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function isPriceChartingProductPageUrl(parsed: URL): boolean {
  return parsed.hostname.toLowerCase().endsWith("pricecharting.com")
    && parsed.pathname.toLowerCase().startsWith("/game/");
}

function isDirectImageUrl(parsed: URL): boolean {
  const lowerPath = parsed.pathname.toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/.test(lowerPath)
    || parsed.hostname.toLowerCase() === "storage.googleapis.com"
    || parsed.hostname.toLowerCase().includes("images.pricecharting.com");
}

async function resolveManualClaimImageUrl(cardId: string, inputImageUrl: string, user: AuthenticatedUser): Promise<string> {
  const clean = String(inputImageUrl || "").trim();
  if (!clean || clean.startsWith("/")) return clean;

  const parsed = parseHttpUrl(clean);
  if (!parsed) return clean;

  const db = await dbPromise;
  const cardResult = await db.query<{ pricecharting_id: string | null }>(
    "select pricecharting_id from claim_cards where id = $1 and business_id = $2 limit 1",
    [cardId, user.businessId]
  );
  const priceChartingId = String(cardResult.rows[0]?.pricecharting_id || "").trim();
  if (!priceChartingId) return clean;

  let sourceImageUrl = clean;
  if (isPriceChartingProductPageUrl(parsed)) {
    const html = await fetchPriceChartingPageHtml(clean);
    sourceImageUrl = extractPriceChartingImageUrl(html);
    if (!sourceImageUrl) throw new Error("No pude extraer una imagen desde ese link de PriceCharting.");
  } else if (!isDirectImageUrl(parsed)) {
    return clean;
  }

  const result = await downloadImageUrl(sourceImageUrl, priceChartingId, imageDownloadSourceLabel(sourceImageUrl));
  await recordPriceChartingImageSuccess(db, {
    priceChartingId,
    ...result
  });
  return result.publicUrl;
}

async function findInventoryImageTarget(db: Awaited<typeof dbPromise>, inventoryItemId: string, user: AuthenticatedUser) {
  const result = await db.query<Record<string, unknown>>(`
    with target as (
      select
        ii.id as item_id,
        p.id as product_id,
        p.name as product_name,
        p.expansion as expansion_name,
        coalesce(p.card_number, '') as card_number,
        coalesce(p.image_url, '') as current_image_url,
        coalesce(ei.external_id, '') as external_pricecharting_id,
        coalesce(ei.external_url, '') as external_pricecharting_url
      from inventory_items ii
      join card_products p on p.id = ii.product_id
      left join external_sources es on es.name = 'pricecharting'
      left join external_identifiers ei on ei.product_id = p.id and ei.business_id = ii.business_id and ei.source_id = es.id
      where ii.id = $1 and ii.business_id = $2 and ii.active = true
      limit 1
    )
    select
      target.*,
      coalesce(pce.pricecharting_id, '') as matched_pricecharting_id,
      coalesce(nullif(target.external_pricecharting_url, ''), pce.canonical_url, case when target.external_pricecharting_id like 'http%' then target.external_pricecharting_id else '' end, '') as canonical_url,
      coalesce(pce.image_url, '') as cache_image_url
    from target
    left join pricecharting_cache_entries pce on
      pce.pricecharting_id = target.external_pricecharting_id
      or pce.canonical_url = target.external_pricecharting_url
      or (
        pce.normalized_name = lower(target.product_name)
        and pce.normalized_expansion = lower(target.expansion_name)
        and coalesce(nullif(pce.card_number, ''), '') = coalesce(nullif(target.card_number, ''), '')
      )
    order by case
      when pce.pricecharting_id = target.external_pricecharting_id then 0
      when pce.canonical_url = target.external_pricecharting_url then 1
      when pce.pricecharting_id is not null then 2
      else 3
    end
    limit 1
  `, [inventoryItemId, user.businessId]);
  const row = result.rows[0];
  if (!row) throw new Error("No se encontro el producto para forzar la imagen.");
  const externalPriceChartingId = String(row.external_pricecharting_id || "").trim();
  const matchedPriceChartingId = String(row.matched_pricecharting_id || "").trim();
  const priceChartingId = parseHttpUrl(externalPriceChartingId) ? matchedPriceChartingId : (externalPriceChartingId || matchedPriceChartingId);
  return {
    itemId: String(row.item_id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    expansionName: String(row.expansion_name),
    cardNumber: String(row.card_number || ""),
    currentImageUrl: String(row.current_image_url || ""),
    priceChartingId,
    canonicalUrl: String(row.canonical_url || ""),
    cacheImageUrl: String(row.cache_image_url || "")
  };
}

async function setInventoryProductImage(db: Awaited<typeof dbPromise>, productId: string, imageUrl: string, user: AuthenticatedUser) {
  await db.query(`
    update card_products
    set image_url = $1, updated_at = now()
    where id = $2 and business_id = $3
  `, [imageUrl, productId, user.businessId]);
}

async function forceInventoryProductImage(
  db: Awaited<typeof dbPromise>,
  inventoryItemId: string,
  input: { manualUrl?: string; mode?: ImageResolverMode },
  user: AuthenticatedUser
) {
  const target = await findInventoryImageTarget(db, inventoryItemId, user);
  const manualUrl = String(input.manualUrl || "").trim();
  let imageUrl = "";
  let source = "";

  if (manualUrl) {
    if (manualUrl.startsWith("/")) {
      imageUrl = manualUrl;
      source = "URL local manual";
    } else {
      const parsed = parseHttpUrl(manualUrl);
      if (!parsed) throw new Error("La URL manual no parece valida.");
      let sourceImageUrl = manualUrl;
      if (isPriceChartingProductPageUrl(parsed)) {
        const html = await fetchPriceChartingPageHtml(manualUrl);
        sourceImageUrl = extractPriceChartingImageUrl(html);
        if (!sourceImageUrl) throw new Error("No pude extraer una imagen desde ese link de PriceCharting.");
      }
      if (target.priceChartingId || isDirectImageUrl(parseHttpUrl(sourceImageUrl) || parsed)) {
        const result = await downloadImageUrl(sourceImageUrl, target.priceChartingId || target.itemId, imageDownloadSourceLabel(sourceImageUrl));
        imageUrl = result.publicUrl;
        source = imageDownloadSourceLabel(sourceImageUrl);
        if (target.priceChartingId && /^[a-zA-Z0-9_-]+$/.test(target.priceChartingId)) {
          await recordPriceChartingImageSuccess(db, {
            priceChartingId: target.priceChartingId,
            ...result
          });
        }
      } else {
        imageUrl = sourceImageUrl;
        source = "URL manual";
      }
    }
  } else if (target.priceChartingId) {
    const fallbackCanonicalUrl = priceChartingCardUrlCandidates({
      canonicalUrl: target.canonicalUrl,
      productName: target.productName,
      expansionName: target.expansionName,
      cardNumber: target.cardNumber
    })[0] || target.canonicalUrl;
    const cachedSourceImageUrl = parseHttpUrl(extractRemoteImageUrl(target.cacheImageUrl) || target.cacheImageUrl) ? target.cacheImageUrl : "";
    const result = await downloadPriceChartingImage({
      priceChartingId: target.priceChartingId,
      canonicalUrl: fallbackCanonicalUrl,
      sourceImageUrl: cachedSourceImageUrl,
      productName: target.productName,
      expansionName: target.expansionName,
      cardNumber: target.cardNumber,
      allowPriceCharting: true,
      mode: input.mode === "pokemon-tcg" ? "pokemon-tcg" : "auto"
    });
    await recordPriceChartingImageSuccess(db, {
      priceChartingId: target.priceChartingId,
      ...result
    });
    imageUrl = result.publicUrl;
    source = imageDownloadSourceLabel(result.sourceImageUrl || target.cacheImageUrl);
  } else {
    const external = await findExternalCardImage(target, input.mode === "pokemon-tcg" ? "pokemon-tcg" : "auto");
    if (!external) throw new Error("No encontre imagen automatica y esta carta no tiene ID de PriceCharting para forzar.");
    const result = await downloadImageUrl(external.imageUrl, target.itemId, external.source);
    imageUrl = result.publicUrl;
    source = external.source;
  }

  await setInventoryProductImage(db, target.productId, imageUrl, user);
  const item = await getInventoryItem(db, inventoryItemId, user.businessId);
  if (!item) throw new Error("La imagen se guardo, pero no pude releer el producto.");
  return {
    item,
    imageUrl,
    source,
    message: `Imagen actualizada${source ? ` desde ${source}` : ""}.`
  };
}

async function getBlueExchangeRate(): Promise<BlueExchangeRate> {
  if (!useLiveBlueRate) {
    return {
      buy: null,
      sell: configuredBlueRateSell,
      source: "config local",
      updatedAt: new Date().toISOString(),
      fallback: false
    };
  }
  if (blueRateCache && Date.now() - blueRateCache.fetchedAt < 10 * 60 * 1000) return blueRateCache.payload;
  try {
    const rateResponse = await fetch("https://dolarapi.com/v1/dolares/blue", {
      headers: { "User-Agent": "UltimoTurnoBlueRate/1.0" },
      signal: AbortSignal.timeout(6000)
    });
    if (!rateResponse.ok) throw new Error(`HTTP ${rateResponse.status}`);
    const payload = await rateResponse.json() as { compra?: unknown; venta?: unknown; casa?: unknown; nombre?: unknown; fechaActualizacion?: unknown };
    const sell = Number(payload.venta);
    if (!Number.isFinite(sell) || sell <= 0) throw new Error("La respuesta no contiene venta valida");
    const nextRate = {
      buy: Number.isFinite(Number(payload.compra)) ? Number(payload.compra) : null,
      sell,
      source: String(payload.nombre || payload.casa || "DolarAPI blue"),
      updatedAt: String(payload.fechaActualizacion || new Date().toISOString()),
      fallback: false
    };
    blueRateCache = { fetchedAt: Date.now(), payload: nextRate };
    return nextRate;
  } catch {
    return {
      buy: null,
      sell: configuredBlueRateSell,
      source: "fallback local",
      updatedAt: "",
      fallback: true
    };
  }
}

async function findLocalPriceChartingImage(priceChartingId: string): Promise<{
  sourceImageUrl: string;
  localPath: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
  contentHash: string;
} | null> {
  for (const extension of ["jpg", "jpeg", "png", "webp"]) {
    const fileName = `${priceChartingId}.${extension}`;
    const localPath = path.join(priceChartingImageDir, fileName);
    try {
      const info = await stat(localPath);
      if (!info.isFile()) continue;
      const bytes = await readFile(localPath);
      const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
      return {
        sourceImageUrl: "",
        localPath,
        publicUrl: `/pricecharting-images/files/${fileName}`,
        contentType,
        byteSize: bytes.length,
        contentHash: crypto.createHash("sha256").update(bytes).digest("hex")
      };
    } catch {
      // No local file for this extension.
    }
  }
  return null;
}

function imageContentTypeFromExtension(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function reindexLocalPriceChartingImages(limit = 10000) {
  const db = await dbPromise;
  const seen = new Set<string>();
  let scanned = 0;
  let indexed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const dir of priceChartingImageReadDirs) {
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch (error) {
      errors.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const fileName of entries) {
      if (indexed >= limit) break;
      const match = fileName.match(/^(\d+)\.(?:jpe?g|png|webp)$/i);
      if (!match) continue;
      const priceChartingId = match[1];
      if (seen.has(priceChartingId)) {
        skipped++;
        continue;
      }
      seen.add(priceChartingId);
      scanned++;

      const localPath = path.join(dir, fileName);
      try {
        const info = await stat(localPath);
        if (!info.isFile() || info.size <= 0) {
          skipped++;
          continue;
        }
        const existing = await db.query<{ pricecharting_id: string }>(`
          select pricecharting_id
          from pricecharting_image_cache
          where pricecharting_id = $1
            and status = 'downloaded'
            and public_url = $2
          limit 1
        `, [priceChartingId, `/pricecharting-images/files/${fileName}`]);
        if (existing.rows[0]) {
          skipped++;
          continue;
        }
        const bytes = await readFile(localPath);
        await recordPriceChartingImageSuccess(db, {
          priceChartingId,
          sourceImageUrl: `local-reindex:${localPath}`,
          localPath,
          publicUrl: `/pricecharting-images/files/${fileName}`,
          contentType: imageContentTypeFromExtension(fileName),
          byteSize: bytes.length,
          contentHash: crypto.createHash("sha256").update(bytes).digest("hex")
        });
        await db.query(`
          update card_index_entries
          set image_url = $2,
            image_source = 'pricecharting-local',
            updated_at = now(),
            last_verified_at = now()
          where pricecharting_id = $1
            and coalesce(image_url, '') not like '/pricecharting-images/files/%'
        `, [priceChartingId, `/pricecharting-images/files/${fileName}`]);
        indexed++;
      } catch (error) {
        errors.push(`${localPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return {
    scanned,
    indexed,
    skipped,
    directories: priceChartingImageReadDirs,
    errors: errors.slice(0, 20)
  };
}

async function processPriceChartingImageQueue(batchSize: number, concurrency: number, mode: ImageResolverMode, options: {
  onlyWithSourceImageUrl?: boolean;
  activeClaimBusinessId?: string;
} = {}) {
  const db = await dbPromise;
  const queue = await claimPriceChartingImageQueue(db, batchSize, {
    includeUrlFound: true,
    onlyWithSourceImageUrl: options.onlyWithSourceImageUrl,
    activeClaimBusinessId: options.activeClaimBusinessId
  });
  const items: Array<{ priceChartingId: string; status: "downloaded" | "failed"; source?: string; error?: string }> = [];
  let rateLimited = false;

  async function processEntry(entry: typeof queue[number]) {
    const allowPriceCharting = !options.onlyWithSourceImageUrl && mode === "auto" && Date.now() >= priceChartingImageCooldownUntil;
    try {
      const result = await downloadPriceChartingImage({
        priceChartingId: entry.priceChartingId,
        canonicalUrl: entry.canonicalUrl,
        sourceImageUrl: entry.sourceImageUrl,
        productName: entry.productName,
        expansionName: entry.expansionName,
        cardNumber: entry.cardNumber,
        allowPriceCharting,
        mode
      });
      await recordPriceChartingImageSuccess(db, {
        priceChartingId: entry.priceChartingId,
        ...result
      });
      items.push({ priceChartingId: entry.priceChartingId, status: "downloaded", source: imageDownloadSourceLabel(result.sourceImageUrl) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const priceChartingRateLimit = message.includes("429") && message.includes("PriceCharting");
      if (priceChartingRateLimit) {
        rateLimited = true;
        priceChartingImageCooldownUntil = Date.now() + 10 * 60 * 1000;
      }
      await recordPriceChartingImageFailure(db, {
        priceChartingId: entry.priceChartingId,
        errorMessage: message,
        retryAfterMinutes: priceChartingRateLimit ? 180 : 60
      });
      items.push({ priceChartingId: entry.priceChartingId, status: "failed", error: message });
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async (_, workerIndex) => {
    for (let index = workerIndex; index < queue.length; index += concurrency) {
      await processEntry(queue[index]);
    }
  });
  await Promise.all(workers);

  return {
    processed: items.length,
    downloaded: items.filter((item) => item.status === "downloaded").length,
    failed: items.filter((item) => item.status === "failed").length,
    mode,
    rateLimited,
    cooldownUntil: rateLimited ? new Date(priceChartingImageCooldownUntil).toISOString() : "",
    items
  };
}

async function wait(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function processPriceChartingImageUrlQueue(batchSize: number, concurrency: number, sourceMode: ImageDiscoverySourceMode, delayMs = 0) {
  const db = await dbPromise;
  if (Date.now() < priceChartingImageCooldownUntil && sourceMode !== "pricecharting-storage") {
    return {
      processed: 0,
      urlFound: 0,
      failed: 0,
      sourceMode,
      rateLimited: true,
      cooldownUntil: new Date(priceChartingImageCooldownUntil).toISOString(),
      items: []
    };
  }
  const queue = await claimPriceChartingImageQueue(db, batchSize, { onlyMissingSourceImageUrl: true });
  const items: Array<{ priceChartingId: string; status: "url_found" | "failed"; source?: string; error?: string }> = [];
  let rateLimited = Date.now() < priceChartingImageCooldownUntil;

  async function processEntry(entry: typeof queue[number]) {
    if (Date.now() < priceChartingImageCooldownUntil && sourceMode !== "pricecharting-storage") {
      items.push({ priceChartingId: entry.priceChartingId, status: "failed", error: "PriceCharting esta en pausa por rate limit." });
      return;
    }
    try {
      const sourceImageUrl = await discoverPriceChartingImageUrl({
        priceChartingId: entry.priceChartingId,
        canonicalUrl: entry.canonicalUrl,
        sourceMode
      });
      await recordPriceChartingImageUrlDiscovered(db, {
        priceChartingId: entry.priceChartingId,
        sourceImageUrl
      });
      items.push({ priceChartingId: entry.priceChartingId, status: "url_found", source: imageDownloadSourceLabel(sourceImageUrl) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const priceChartingRateLimit = message.includes("429") && message.includes("PriceCharting");
      if (priceChartingRateLimit) {
        rateLimited = true;
        priceChartingImageCooldownUntil = Date.now() + 10 * 60 * 1000;
      }
      await recordPriceChartingImageFailure(db, {
        priceChartingId: entry.priceChartingId,
        errorMessage: message,
        retryAfterMinutes: priceChartingRateLimit ? 180 : 60
      });
      items.push({ priceChartingId: entry.priceChartingId, status: "failed", error: message });
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async (_, workerIndex) => {
    for (let index = workerIndex; index < queue.length; index += concurrency) {
      await processEntry(queue[index]);
      if (delayMs > 0 && index + concurrency < queue.length) await wait(delayMs);
    }
  });
  await Promise.all(workers);

  return {
    processed: items.length,
    urlFound: items.filter((item) => item.status === "url_found").length,
    failed: items.filter((item) => item.status === "failed").length,
    sourceMode,
    rateLimited,
    cooldownUntil: rateLimited ? new Date(priceChartingImageCooldownUntil).toISOString() : "",
    items
  };
}

async function processActiveClaimPriceChartingPageImages(businessId: string, batchSize: number) {
  const db = await dbPromise;
  const queue = await listActiveClaimMissingPriceChartingImages(db, businessId, batchSize);
  const items: Array<{ priceChartingId: string; status: "downloaded" | "failed"; source?: string; error?: string }> = [];
  let rateLimited = false;

  for (const entry of queue) {
    try {
      if (!entry.canonicalUrl) throw new Error("La carta no tiene link de PriceCharting.");
      let sourceImageUrl = "";
      const errors: string[] = [];
      for (const candidateUrl of await expandedPriceChartingCardUrlCandidates(entry)) {
        try {
          sourceImageUrl = await discoverPriceChartingImageUrl({
            priceChartingId: entry.priceChartingId,
            canonicalUrl: candidateUrl,
            sourceMode: "auto"
          });
          break;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (!sourceImageUrl) throw new Error(errors.slice(-2).join(" / ") || "No se encontro imagen en PriceCharting.");
      const result = await downloadImageUrl(sourceImageUrl, entry.priceChartingId, "PriceCharting imagen");
      await recordPriceChartingImageSuccess(db, {
        priceChartingId: entry.priceChartingId,
        ...result
      });
      items.push({ priceChartingId: entry.priceChartingId, status: "downloaded", source: imageDownloadSourceLabel(sourceImageUrl) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const priceChartingRateLimit = message.includes("429") && message.includes("PriceCharting");
      if (priceChartingRateLimit) {
        rateLimited = true;
        priceChartingImageCooldownUntil = Date.now() + 10 * 60 * 1000;
      }
      await recordPriceChartingImageFailure(db, {
        priceChartingId: entry.priceChartingId,
        errorMessage: message,
        retryAfterMinutes: priceChartingRateLimit ? 180 : 30
      });
      items.push({ priceChartingId: entry.priceChartingId, status: "failed", error: message });
      if (priceChartingRateLimit) break;
    }
  }

  return {
    processed: items.length,
    downloaded: items.filter((item) => item.status === "downloaded").length,
    failed: items.filter((item) => item.status === "failed").length,
    rateLimited,
    cooldownUntil: rateLimited ? new Date(priceChartingImageCooldownUntil).toISOString() : "",
    items
  };
}

async function processSingleClaimCardImage(input: {
  priceChartingId: string;
  canonicalUrl: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
}) {
  const db = await dbPromise;
  try {
    if (!input.priceChartingId) throw new Error("La carta no tiene PriceCharting ID.");
    if (!input.canonicalUrl) throw new Error("La carta no tiene link de PriceCharting.");
    let sourceImageUrl = "";
    const errors: string[] = [];
    for (const candidateUrl of await expandedPriceChartingCardUrlCandidates(input)) {
      try {
        sourceImageUrl = await discoverPriceChartingImageUrl({
          priceChartingId: input.priceChartingId,
          canonicalUrl: candidateUrl,
          sourceMode: "auto"
        });
        break;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (!sourceImageUrl) throw new Error(errors.slice(-2).join(" / ") || "No se encontro imagen en PriceCharting.");
    const result = await downloadImageUrl(sourceImageUrl, input.priceChartingId, "PriceCharting imagen");
    await recordPriceChartingImageSuccess(db, {
      priceChartingId: input.priceChartingId,
      ...result
    });
    return {
      processed: 1,
      downloaded: 1,
      failed: 0,
      item: { priceChartingId: input.priceChartingId, status: "downloaded" as const, source: imageDownloadSourceLabel(sourceImageUrl) }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordPriceChartingImageFailure(db, {
      priceChartingId: input.priceChartingId,
      errorMessage: message,
      retryAfterMinutes: message.includes("429") ? 180 : 30
    });
    return {
      processed: 1,
      downloaded: 0,
      failed: 1,
      item: { priceChartingId: input.priceChartingId, status: "failed" as const, error: message }
    };
  }
}

async function processExternalImageIndexQueue(input: {
  batchSize: number;
  providers?: ExternalImageProvider[];
  rebuild?: boolean;
  deferMisses?: boolean;
  activeClaimBusinessId?: string;
}) {
  const db = await dbPromise;
  const index = await loadExternalImageIndex({ providers: input.providers, rebuild: input.rebuild });
  const lookup = buildExternalImageIndexLookup(index);
  const queue = await claimPriceChartingImageQueue(db, input.batchSize, {
    onlyMissingSourceImageUrl: true,
    activeClaimBusinessId: input.activeClaimBusinessId
  });
  const items: Array<{ priceChartingId: string; status: "url_found" | "skipped"; source?: string; error?: string }> = [];

  for (const entry of queue) {
    const match = findExternalIndexMatch(lookup, entry);
    if (!match) {
      if (input.deferMisses !== false) {
        await deferPriceChartingImageQueueEntry(db, {
          priceChartingId: entry.priceChartingId,
          errorMessage: "Sin coincidencia fuerte en indice externo",
          retryAfterMinutes: 10
        });
      }
      items.push({ priceChartingId: entry.priceChartingId, status: "skipped", error: "Sin coincidencia fuerte en indice externo" });
      continue;
    }
    await recordPriceChartingImageUrlDiscovered(db, {
      priceChartingId: entry.priceChartingId,
      sourceImageUrl: externalSourceImageUrl(match),
      publicUrl: match.imageUrl
    });
    items.push({ priceChartingId: entry.priceChartingId, status: "url_found", source: imageDownloadSourceLabel(externalSourceImageUrl(match)) });
  }

  return {
    processed: items.length,
    urlFound: items.filter((item) => item.status === "url_found").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    failed: 0,
    index: {
      builtAt: index.builtAt,
      providers: index.providers,
      cards: index.cards.length,
      errors: index.errors
    },
    items
  };
}

function isLocalBrowserOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function requestCorsOrigin(request: IncomingMessage) {
  const rawOrigin = request.headers.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin || "";
  const normalized = origin.trim().replace(/\/+$/, "");
  if (!normalized) return "";
  if (allowedOrigins.includes("*")) return normalized;
  if (allowedOrigins.includes(normalized)) return normalized;
  if (!productionMode && isLocalBrowserOrigin(normalized)) return normalized;
  if (!productionMode && allowedOrigins.length === 0) return "*";
  return "";
}

function applyCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = requestCorsOrigin(request);
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-UltimoTurno-Access-Key");
  response.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendBuffer(response: ServerResponse, statusCode: number, body: Buffer, contentType: string, omitBody = false) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable"
  });
  response.end(omitBody ? undefined : body);
}

function imageContentTypeForFile(fileName: string, fallback = "image/jpeg") {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

async function readCachedPriceChartingImage(fileName: string): Promise<{ body: Buffer; contentType: string } | null> {
  for (const directory of priceChartingImageReadDirs) {
    try {
      const body = await readFile(path.join(directory, fileName));
      return { body, contentType: imageContentTypeForFile(fileName) };
    } catch {
      // Try the next known cache location.
    }
  }
  return null;
}

function extractRemoteImageUrl(value: string) {
  const match = String(value || "").match(/https?:\/\/.+$/);
  return match?.[0] || "";
}

async function fetchAndCacheMissingPriceChartingImage(db: Awaited<typeof dbPromise>, fileName: string): Promise<{ body: Buffer; contentType: string } | null> {
  const priceChartingId = path.parse(fileName).name;
  const result = await db.query<Record<string, unknown>>(`
    select
      coalesce(nullif(pic.source_image_url, ''), nullif(pce.image_url, '')) as source_image_url
    from pricecharting_image_cache pic
    join pricecharting_cache_entries pce using (pricecharting_id)
    where pic.pricecharting_id = $1
    limit 1
  `, [priceChartingId]);
  const storedSource = String(result.rows[0]?.source_image_url || "");
  const sourceUrl = extractRemoteImageUrl(storedSource);
  if (!sourceUrl) return null;
  const parsed = new URL(sourceUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || !imageProxyAllowedHosts.has(parsed.hostname.toLowerCase())) return null;

  const imageResponse = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(30000),
    headers: { "User-Agent": "UltimoTurnoImageRepair/1.0" }
  });
  if (!imageResponse.ok) return null;
  const contentType = imageResponse.headers.get("content-type") || imageContentTypeForFile(fileName);
  if (!contentType.toLowerCase().startsWith("image/")) return null;

  const body = Buffer.from(await imageResponse.arrayBuffer());
  const localPath = path.join(priceChartingImageDir, fileName);
  await mkdir(priceChartingImageDir, { recursive: true });
  await writeFile(localPath, body);
  await recordPriceChartingImageSuccess(db, {
    priceChartingId,
    sourceImageUrl: storedSource || sourceUrl,
    localPath,
    publicUrl: `/pricecharting-images/files/${fileName}`,
    contentType,
    byteSize: body.length,
    contentHash: crypto.createHash("sha256").update(body).digest("hex")
  });
  return { body, contentType };
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) as T : {} as T;
}

async function operationalUser(): Promise<AuthenticatedUser> {
  const db = await dbPromise;
  return getDefaultOperationalUser(db);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (cookieHeader || "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
  }
  return cookies;
}

function accessKeyMatches(value: string) {
  if (!sharedAccessKey) return true;
  const expected = Buffer.from(sharedAccessKey);
  const received = Buffer.from(value || "");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function requestHasAccess(request: IncomingMessage) {
  if (!sharedAccessKey) return true;
  const headerValue = request.headers["x-ultimoturno-access-key"];
  const accessHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue || "";
  if (accessKeyMatches(accessHeader)) return true;
  return accessKeyMatches(parseCookies(request.headers.cookie).ultimoturno_access_key || "");
}

function normalizeDispatchTarget(url: URL) {
  const targetPath = url.searchParams.get("path") || "/";
  if (!targetPath.startsWith("/") || targetPath.startsWith("//")) return "/";

  const extraParams = new URLSearchParams(url.searchParams);
  extraParams.delete("path");
  const extraQuery = extraParams.toString();
  if (!extraQuery) return targetPath;

  return `${targetPath}${targetPath.includes("?") ? "&" : "?"}${extraQuery}`;
}

type DatabaseUrlChoice = {
  value: string;
  source: string;
  endpointKind: string;
};

function selectDatabaseUrl(): DatabaseUrlChoice {
  const candidates = [
    { source: "DATABASE_URL", value: cleanDatabaseUrlValue("DATABASE_URL", process.env.DATABASE_URL) },
    { source: "POSTGRES_URL", value: cleanDatabaseUrlValue("POSTGRES_URL", process.env.POSTGRES_URL) },
    { source: "POSTGRES_PRISMA_URL", value: cleanDatabaseUrlValue("POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL) },
    { source: "POSTGRES_URL_NON_POOLING", value: cleanDatabaseUrlValue("POSTGRES_URL_NON_POOLING", process.env.POSTGRES_URL_NON_POOLING) },
    { source: "POSTGRES_COMPONENTS", value: buildPostgresUrlFromComponents() }
  ]
    .filter((candidate) => candidate.value)
    .map((candidate) => ({ ...candidate, endpointKind: classifyPostgresEndpoint(candidate.value) }));
  const primary = candidates[0] || { source: "none", value: "", endpointKind: "none" };
  const pooler = candidates.find((candidate) => isPooledPostgresEndpoint(candidate.value));
  const firstValid = candidates.find((candidate) => candidate.endpointKind !== "invalid");
  if (productionMode && dbDriver === "postgres" && pooler && (primary.endpointKind === "invalid" || isSupabaseDirectEndpoint(primary.value))) return pooler;
  if (primary.endpointKind === "invalid" && firstValid) return firstValid;
  return primary;
}

function cleanDatabaseUrlValue(key: string, rawValue: unknown) {
  let value = String(rawValue || "").trim();
  const assignment = value.match(new RegExp(`(?:^|[\\r\\n])\\s*${key}\\s*=\\s*([^\\r\\n]+)`, "i"))
    || value.match(/^(DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|POSTGRES_URL_NON_POOLING)\s*=\s*([^\r\n]+)$/i);
  if (assignment) value = String(assignment[2] || assignment[1] || "").trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  const embeddedUrl = value.match(/postgres(?:ql)?:\/\/[^\s"'`]+/i);
  if (embeddedUrl) value = embeddedUrl[0].trim();
  value = value
    .replace(new RegExp(`^${key}\\s*=\\s*`, "i"), "")
    .replace(/[),;]+$/, "")
    .trim();
  return repairPostgresCredentialEncoding(value);
}

function buildPostgresUrlFromComponents() {
  const host = String(process.env.POSTGRES_HOST || "").trim();
  const user = String(process.env.POSTGRES_USER || "").trim();
  const password = String(process.env.POSTGRES_PASSWORD || "").trim();
  const database = String(process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB || "postgres").trim();
  const port = String(process.env.POSTGRES_PORT || "5432").trim();
  if (!host || !user || !password) return "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database || "postgres")}`;
}

function repairPostgresCredentialEncoding(value: string) {
  if (classifyPostgresEndpoint(value) !== "invalid") return value;
  const protocol = value.match(/^(postgres(?:ql)?:\/\/)/i)?.[1];
  if (!protocol) return value;
  const rest = value.slice(protocol.length);
  const atIndex = rest.lastIndexOf("@");
  if (atIndex <= 0) return value;
  const userInfo = rest.slice(0, atIndex);
  const hostAndPath = rest.slice(atIndex + 1);
  const separatorIndex = userInfo.indexOf(":");
  if (separatorIndex <= 0 || !hostAndPath) return value;
  const username = encodeConnectionCredential(userInfo.slice(0, separatorIndex));
  const password = encodeConnectionCredential(userInfo.slice(separatorIndex + 1));
  const repaired = `${protocol}${username}:${password}@${hostAndPath}`;
  return classifyPostgresEndpoint(repaired) === "invalid" ? value : repaired;
}

function encodeConnectionCredential(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function isSupabaseDirectEndpoint(value: string) {
  return classifyPostgresEndpoint(value) === "supabase_direct";
}

function isPooledPostgresEndpoint(value: string) {
  return classifyPostgresEndpoint(value).includes("pooler");
}

function classifyPostgresEndpoint(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const port = url.port || "5432";
    if (hostname.endsWith(".pooler.supabase.com")) {
      return port === "6543" ? "supabase_pooler_transaction" : "supabase_pooler_session";
    }
    if (/^db\.[a-z0-9-]+\.supabase\.co$/.test(hostname)) {
      return port === "6543" ? "supabase_dedicated_pooler" : "supabase_direct";
    }
    if (hostname.includes("neon.tech")) return "neon";
    if (hostname.includes("vercel-storage.com")) return "vercel_postgres";
    return value ? "other" : "none";
  } catch {
    return value ? "invalid" : "none";
  }
}

async function readPublicDataStatus() {
  try {
    const db = await dbPromise;
    const result = await db.query<{
      inventory_items: string;
      stock_units: string;
      sales: string;
      claim_cards: string;
    }>(`
      select
        (select count(*)::text from inventory_items where active = true) as inventory_items,
        (select coalesce(sum(quantity_on_hand), 0)::text from inventory_items where active = true) as stock_units,
        (select count(*)::text from sales) as sales,
        (select count(*)::text from claim_cards) as claim_cards
    `);
    const row = result.rows[0];
    return {
      rawPostgres: dbDriver === "postgres" ? { reachable: true, via: "operational" } : null,
      databaseReachable: true,
      hasInventoryItems: Number(row?.inventory_items || 0) > 0,
      hasStockUnits: Number(row?.stock_units || 0) > 0,
      hasSales: Number(row?.sales || 0) > 0,
      hasClaimCards: Number(row?.claim_cards || 0) > 0
    };
  } catch (error) {
    return {
      rawPostgres: await readRawPostgresStatus(),
      databaseReachable: false,
      databaseError: classifyPublicDatabaseError(error),
      hasInventoryItems: false,
      hasStockUnits: false,
      hasSales: false,
      hasClaimCards: false
    };
  }
}

async function readRawPostgresStatus() {
  if (dbDriver !== "postgres") return null;
  try {
    await checkPostgresConnection({
      databaseUrl,
      ssl: databaseSslEnabled,
      poolMax: 1
    });
    return { reachable: true };
  } catch (error) {
    return {
      reachable: false,
      error: classifyPublicDatabaseError(error)
    };
  }
}

function classifyPublicDatabaseError(error: unknown) {
  const combined = collectPublicErrorSignals(error);
  if (combined.includes("does not exist") || combined.includes("no such table") || combined.includes("relation")) return "schema_unavailable";
  if (combined.includes("syntax error") || combined.includes("constraint") || combined.includes("duplicate key")) return "schema_bootstrap_failed";
  if (combined.includes("password") || combined.includes("authentication") || combined.includes("sasl") || combined.includes("28p01") || combined.includes("tenant or user")) return "authentication_failed";
  if (combined.includes("permission denied") || combined.includes("42501")) return "permission_denied";
  if (combined.includes("ssl") || combined.includes("certificate") || combined.includes("self-signed")) return "ssl_failed";
  if (combined.includes("timeout") || combined.includes("etimedout")) return "timeout";
  if (combined.includes("aggregateerror") || combined.includes("enotfound") || combined.includes("eai_again") || combined.includes("econnrefused") || combined.includes("econnreset") || combined.includes("enetunreach") || combined.includes("network") || combined.includes("socket") || combined.includes("fetch failed") || combined.includes("connect")) return "connection_failed";
  if (combined.includes("cannot find module") || combined.includes("module_not_found") || combined.includes("err_module_not_found")) return "module_unavailable";
  return "unknown";
}

function collectPublicErrorSignals(error: unknown, depth = 0): string {
  if (depth > 3) return "";
  if (!error || typeof error !== "object") return String(error || "").toLowerCase();
  const record = error as Record<string, unknown>;
  const signals = [
    record.name,
    record.code,
    record.errno,
    record.syscall,
    record.type,
    error instanceof Error ? error.message : String(error)
  ];
  if (record.cause) signals.push(collectPublicErrorSignals(record.cause, depth + 1));
  if (Array.isArray(record.errors)) {
    for (const child of record.errors.slice(0, 5)) signals.push(collectPublicErrorSignals(child, depth + 1));
  }
  return signals.filter(Boolean).join(" ").toLowerCase();
}

type MobileInventoryCandidate = {
  id: string;
  matchType: "inventory" | "card_index";
  inventoryItemId?: string;
  priceChartingId: string;
  sku: string;
  name: string;
  expansion: string;
  number: string;
  language: string;
  condition: string;
  finish: string;
  gradingCompany: string;
  grade: string;
  availableQuantity: number;
  priceArs: number;
  priceUsd: number | null;
  imageUrl: string;
  helper: string;
  score: number;
};

type MobileInventoryApplyResult = {
  requestedEntries: number;
  appliedEntries: number;
  appliedGroups: number;
  unitsApplied: number;
  createdItems: number;
  updatedItems: number;
  skippedEntries: number;
  errors: Array<{ id: string; name: string; error: string }>;
};

type MobileInventoryApplyGroup = {
  key: string;
  entries: MobileInventoryEntry[];
  quantity: number;
  representative: MobileInventoryEntry;
  stockItem?: DbStockRow;
};

function stockPriceChartingId(item: DbStockRow): string {
  return item.priceReferences?.priceCharting?.priceChartingId
    || item.product.identifiers.find((identifier) => identifier.source === "pricecharting")?.externalId
    || "";
}

function mobileGeneratedSku(entry: Pick<MobileInventoryEntry, "name" | "expansion" | "number" | "language" | "condition" | "finish" | "gradingCompany" | "grade">): string {
  return [entry.name, entry.expansion, entry.number, entry.language, entry.gradingCompany || entry.condition, entry.grade, entry.finish]
    .map((part) => String(part || "").trim().slice(0, 12).replace(/[^a-z0-9]+/gi, "").toUpperCase())
    .filter(Boolean)
    .join("-");
}

function mobileInventoryIdentityKey(entry: Pick<MobileInventoryEntry, "name" | "expansion" | "number" | "language" | "condition" | "finish" | "gradingCompany" | "grade">): string {
  return [
    normalizeMatchText(entry.name),
    normalizeMatchText(entry.expansion),
    normalizeCardNumber(entry.number),
    normalizeMatchText(entry.language || "EN"),
    normalizeMatchText(entry.gradingCompany || entry.condition || "NM"),
    normalizeMatchText(entry.grade || ""),
    normalizeMatchText(entry.finish || "normal")
  ].join("|");
}

function stockInventoryIdentityKey(item: DbStockRow): string {
  return [
    normalizeMatchText(item.product.name),
    normalizeMatchText(item.product.expansion),
    normalizeCardNumber(item.product.number || ""),
    normalizeMatchText(item.variant.language || "EN"),
    normalizeMatchText(item.variant.gradingCompany || item.variant.condition || "NM"),
    normalizeMatchText(item.variant.grade || ""),
    normalizeMatchText(item.variant.finish || "normal")
  ].join("|");
}

function mobileApplyNote(entries: MobileInventoryEntry[], quantity: number): string {
  const helpers = [...new Set(entries.map((entry) => entry.helperName.trim()).filter(Boolean))].slice(0, 4);
  const batches = [...new Set(entries.map((entry) => entry.intakeBatch.trim()).filter(Boolean))].slice(0, 3);
  const helperText = helpers.length ? ` - ${helpers.join(", ")}` : "";
  const batchText = batches.length ? ` - ${batches.join(", ")}` : "";
  return `Carga movil: ${quantity} u. en ${entries.length} captura(s)${helperText}${batchText}`;
}

function mobileEntryToInventoryInput(entry: MobileInventoryEntry, quantity: number, note: string): UpsertInventoryInput {
  return {
    sku: entry.sku || mobileGeneratedSku(entry) || undefined,
    name: entry.name || "Carta sin nombre",
    expansion: entry.expansion || "Sin expansion",
    number: entry.number || "",
    imageUrl: entry.imageUrl || "",
    priceChartingId: entry.priceChartingId || "",
    language: entry.language || "EN",
    condition: entry.condition || "NM",
    finish: entry.finish || "normal",
    gradingCompany: entry.gradingCompany || "",
    grade: entry.grade || "",
    location: entry.location || "",
    intakeBatch: entry.intakeBatch || "",
    inventoryStatus: "available",
    quantityOnHand: quantity,
    quantityReserved: 0,
    priceArs: Math.max(0, Number(entry.priceArs || 0)),
    priceUsd: entry.priceUsd && entry.priceUsd > 0 ? entry.priceUsd : null,
    notes: entry.notes || "",
    stockMovementNote: note,
    stockMovementReferenceType: "mobile_intake"
  };
}

async function applyMobileInventoryEntries(db: Awaited<typeof dbPromise>, user: AuthenticatedUser, ids: unknown): Promise<MobileInventoryApplyResult> {
  return inventoryTransaction(db, (connection) => applyMobileInventoryEntriesInTransaction(connection, user, ids));
}

async function applyMobileInventoryEntriesInTransaction(db: Awaited<typeof dbPromise>, user: AuthenticatedUser, ids: unknown): Promise<MobileInventoryApplyResult> {
  const requestedIds = Array.isArray(ids)
    ? [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  const requestedIdSet = new Set(requestedIds);
  const receipts = await db.query<{ id: string }>("select id from mobile_inventory_entries where business_id = $1 and applied_at is not null", [user.businessId]);
  const appliedIds = new Set(receipts.rows.map((entry) => entry.id));
  const pendingEntries = (await listMobileInventoryEntries(db, user.businessId, "pending", 20000)).entries.filter((entry) => !appliedIds.has(entry.id));
  const entries = requestedIds.length
    ? pendingEntries.filter((entry) => requestedIdSet.has(entry.id))
    : pendingEntries;
  const stock = await listStockForBusiness(db, user.businessId);
  const stockById = new Map(stock.items.map((item) => [item.id, item]));
  const stockBySku = new Map<string, DbStockRow>();
  const stockByPriceCharting = new Map<string, DbStockRow>();
  const stockByIdentity = new Map<string, DbStockRow>();
  const refreshStockIndexes = (item: DbStockRow) => {
    stockById.set(item.id, item);
    if (item.sku) stockBySku.set(item.sku.trim().toLowerCase(), item);
    const priceChartingId = stockPriceChartingId(item).trim();
    if (priceChartingId && !stockByPriceCharting.has(priceChartingId)) stockByPriceCharting.set(`${priceChartingId}|${stockInventoryIdentityKey(item)}`, item);
    const identityKey = stockInventoryIdentityKey(item);
    if (identityKey && !stockByIdentity.has(identityKey)) stockByIdentity.set(identityKey, item);
  };
  stock.items.forEach(refreshStockIndexes);

  const groups = new Map<string, MobileInventoryApplyGroup>();
  for (const entry of entries) {
    const quantity = Math.max(1, Math.floor(Number(entry.quantityOnHand || 1)));
    const priceChartingId = entry.priceChartingId.trim();
    const sku = entry.sku.trim();
    const generatedSku = mobileGeneratedSku(entry);
    const identityKey = mobileInventoryIdentityKey(entry);
    const matchedStock = (entry.inventoryItemId ? stockById.get(entry.inventoryItemId) : undefined)
      || (sku ? stockBySku.get(sku.toLowerCase()) : undefined)
      || (generatedSku ? stockBySku.get(generatedSku.toLowerCase()) : undefined)
      || (priceChartingId ? stockByPriceCharting.get(`${priceChartingId}|${identityKey}`) : undefined)
      || stockByIdentity.get(identityKey);
    const key = matchedStock?.id
      ? `stock:${matchedStock.id}`
      : priceChartingId
        ? `pc:${priceChartingId}|${identityKey}`
        : `identity:${identityKey}`;
    const group = groups.get(key) || { key, entries: [], quantity: 0, representative: entry, stockItem: matchedStock };
    group.entries.push(entry);
    group.quantity += quantity;
    if (!group.representative.imageUrl && entry.imageUrl) group.representative = entry;
    if (!group.stockItem && matchedStock) group.stockItem = matchedStock;
    groups.set(key, group);
  }

  const result: MobileInventoryApplyResult = {
    requestedEntries: entries.length,
    appliedEntries: 0,
    appliedGroups: 0,
    unitsApplied: 0,
    createdItems: 0,
    updatedItems: 0,
    skippedEntries: requestedIds.length ? Math.max(0, requestedIds.length - entries.length) : 0,
    errors: []
  };

  for (const group of groups.values()) {
    try {
      const note = mobileApplyNote(group.entries, group.quantity);
      const stockItem = group.stockItem ? stockById.get(group.stockItem.id) || group.stockItem : undefined;
      if (stockItem) {
        const updated = await adjustInventoryQuantity(db, {
          inventoryItemId: stockItem.id,
          quantityDelta: group.quantity,
          note
        }, user);
        refreshStockIndexes(updated);
        result.updatedItems += 1;
      } else {
        const created = await upsertInventoryItem(db, mobileEntryToInventoryInput(group.representative, group.quantity, note), user);
        refreshStockIndexes(created);
        result.createdItems += 1;
      }
      for (const entry of group.entries) {
        await updateMobileInventoryEntryStatus(db, entry.id, "reviewed", user);
        await db.query("update mobile_inventory_entries set applied_at = now() where id = $1 and business_id = $2", [entry.id, user.businessId]);
      }
      result.appliedEntries += group.entries.length;
      result.appliedGroups += 1;
      result.unitsApplied += group.quantity;
    } catch (error) {
      throw new Error("No se cargo el lote; podes reintentar. " + (error instanceof Error ? error.message : String(error)));
    }
  }

  return result;
}

function scoreMobileCandidate(query: string, candidate: { name: string; expansion: string; number: string; sku?: string; priceChartingId?: string }) {
  const tokens = normalizeMatchText(query).split(" ").filter(Boolean);
  if (!tokens.length) return 1;
  const name = normalizeMatchText(candidate.name);
  const expansion = normalizeMatchText(candidate.expansion);
  const sku = normalizeMatchText(candidate.sku || "");
  const id = normalizeMatchText(candidate.priceChartingId || "");
  const number = normalizeCardNumber(candidate.number);
  let score = 0;
  for (const token of tokens) {
    const cleanNumber = token.replace(/^#/, "").replace(/^0+([0-9])/, "$1");
    if (/^[0-9]+[a-z]?$/i.test(cleanNumber)) {
      if (number === cleanNumber) score += 70;
      else if (number.includes(cleanNumber) || sku.includes(cleanNumber) || id.includes(cleanNumber)) score += 12;
      else return 0;
    } else if (name.split(" ").includes(token)) score += 45;
    else if (name.includes(token)) score += 30;
    else if (expansion.includes(token)) score += 16;
    else if (sku.includes(token) || id.includes(token)) score += 10;
    else return 0;
  }
  return score;
}

function optionalMobileNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mobileSearchWhere(query: string, params: unknown[]) {
  const tokens = normalizeMatchText(query).split(" ").filter(Boolean).slice(0, 6);
  const clauses: string[] = [];
  for (const token of tokens) {
    const cleanNumber = token.replace(/^#/, "").replace(/^0+([0-9])/, "$1");
    const likeValue = `%${token}%`;
    params.push(likeValue);
    const likeParam = `$${params.length}`;
    const haystack = `
      lower(replace(replace(
        coalesce(p.name, '') || ' ' ||
        coalesce(p.expansion, '') || ' ' ||
        coalesce(p.card_number, '') || ' ' ||
        coalesce(ii.sku, '') || ' ' ||
        coalesce(ii.tags, '') || ' ' ||
        coalesce(pc_identifier.external_id, ''),
        chr(39), ''
      ), chr(8217), ''))
    `;
    if (/^[0-9]+[a-z]?$/i.test(cleanNumber)) {
      params.push(cleanNumber);
      const exactParam = `$${params.length}`;
      clauses.push(`(
        regexp_replace(lower(split_part(coalesce(p.card_number, ''), '/', 1)), '^0+', '') = ${exactParam}
        or ${haystack} like ${likeParam}
      )`);
    } else {
      clauses.push(`(${haystack} like ${likeParam})`);
    }
  }
  return clauses.length ? `and ${clauses.join(" and ")}` : "";
}

async function searchStockMobileCandidates(db: Awaited<typeof dbPromise>, user: AuthenticatedUser, query: string, limit: number): Promise<MobileInventoryCandidate[]> {
  const params: unknown[] = [user.businessId];
  const where = mobileSearchWhere(query, params);
  params.push(Math.max(1, Math.min(100, Math.floor(limit || 48))));
  const limitParam = `$${params.length}`;
  const result = await db.query<Record<string, unknown>>(`
    select
      ii.id,
      ii.sku,
      greatest(0, ii.quantity_on_hand - ii.quantity_reserved) as available_quantity,
      coalesce(cp.price_ars, 0) as price_ars,
      cp.price_usd,
      ii.tags,
      p.name as product_name,
      p.expansion,
      p.card_number,
      p.image_url,
      v.language,
      v.condition,
      v.finish,
      v.grading_company,
      v.grade,
      coalesce(pc_identifier.external_id, '') as pricecharting_id
    from inventory_items ii
    join card_products p on p.id = ii.product_id
    join card_variants v on v.id = ii.variant_id
    left join current_prices cp on cp.inventory_item_id = ii.id
    left join lateral (
      select ei.external_id
      from external_identifiers ei
      join external_sources es on es.id = ei.source_id
      where ei.business_id = ii.business_id
        and es.name = 'pricecharting'
        and (ei.product_id = p.id or ei.variant_id = v.id)
      order by case when ei.variant_id = v.id then 0 else 1 end, ei.id
      limit 1
    ) pc_identifier on true
    where ii.business_id = $1
      and ii.active = true
      ${where}
    order by p.name, p.expansion, p.card_number, v.condition
    limit ${limitParam}
  `, params);
  return result.rows
    .map((row) => {
      const candidate = {
        id: String(row.id),
        matchType: "inventory" as const,
        inventoryItemId: String(row.id),
        priceChartingId: String(row.pricecharting_id || ""),
        sku: String(row.sku || ""),
        name: String(row.product_name || ""),
        expansion: String(row.expansion || ""),
        number: String(row.card_number || ""),
        language: String(row.language || ""),
        condition: String(row.condition || ""),
        finish: String(row.finish || ""),
        gradingCompany: String(row.grading_company || ""),
        grade: String(row.grade || ""),
        availableQuantity: Number(row.available_quantity || 0),
        priceArs: Number(row.price_ars || 0),
        priceUsd: optionalMobileNumber(row.price_usd),
        imageUrl: String(row.image_url || ""),
        helper: `${String(row.sku || "")} - disponible ${Number(row.available_quantity || 0)}`,
        score: 0
      };
      return { ...candidate, score: scoreMobileCandidate(query, candidate) };
    })
    .filter((candidate) => !query.trim() || candidate.score > 0);
}

async function searchMobileInventoryCandidates(db: Awaited<typeof dbPromise>, user: AuthenticatedUser, query: string, limit: number): Promise<{ candidates: MobileInventoryCandidate[] }> {
  const safeLimit = Math.max(1, Math.min(30, Math.floor(limit || 12)));
  const [stockCandidates, cardIndexData] = await Promise.all([
    searchStockMobileCandidates(db, user, query, Math.max(safeLimit * 4, 24)),
    listCardIndex(db, query, safeLimit, "all")
  ]);
  const seenPriceCharting = new Set(stockCandidates.map((candidate) => candidate.priceChartingId).filter(Boolean));
  const indexCandidates = cardIndexData.entries
    .filter((entry) => !seenPriceCharting.has(entry.priceChartingId))
    .map((entry) => ({
      id: entry.id,
      matchType: "card_index" as const,
      priceChartingId: entry.priceChartingId,
      sku: "",
      name: entry.canonicalName,
      expansion: entry.canonicalExpansion,
      number: entry.cardNumber,
      language: "EN",
      condition: "NM",
      finish: "normal",
      gradingCompany: "",
      grade: "",
      availableQuantity: 0,
      priceArs: 0,
      priceUsd: null,
      imageUrl: entry.imageUrl,
      helper: `Indice maestro - ${entry.matchStatus}`,
      score: Math.max(entry.matchConfidence, scoreMobileCandidate(query, {
        name: entry.canonicalName,
        expansion: entry.canonicalExpansion,
        number: entry.cardNumber,
        priceChartingId: entry.priceChartingId
      }))
    }));
  const candidates = [...stockCandidates, ...indexCandidates]
    .filter((candidate) => !query.trim() || candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "es", { numeric: true }))
    .slice(0, safeLimit);
  return { candidates };
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  applyCorsHeaders(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(requestCorsOrigin(request) ? 204 : 403);
    response.end();
    return;
  }

  try {
    let url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (productionMode && request.headers.origin && !requestCorsOrigin(request)) {
      sendJson(response, 403, { ok: false, error: "Origen no permitido." });
      return;
    }
    if (url.pathname === "/dispatch") {
      request.url = normalizeDispatchTarget(url);

      url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    }

    if (url.pathname === "/public-status" && request.method === "GET") {
      const data = await readPublicDataStatus();
      sendJson(response, 200, {
        ok: true,
        deployment: {
          commitSha: deploymentCommitSha
        },
        environment: {
          runtimeEnv,
          dbDriver,
          databaseUrlConfigured: Boolean(databaseUrl),
          databaseUrlSource: databaseUrlChoice.source,
          databaseEndpointKind: databaseUrlChoice.endpointKind,
          dataProfile,
          allowExamples,
          requiresAccessKey: Boolean(sharedAccessKey)
        },
        data
      });
      return;
    }

    if (!requestHasAccess(request)) {
      sendJson(response, 401, { ok: false, error: "Clave de acceso requerida o incorrecta." });
      return;
    }

    if (url.pathname.startsWith("/pricecharting-images/files/") && (request.method === "GET" || request.method === "HEAD")) {
      const fileName = decodeURIComponent(url.pathname.replace("/pricecharting-images/files/", ""));
      if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(fileName)) {
        sendJson(response, 400, { ok: false, error: "Nombre de imagen invalido." });
        return;
      }
      const cached = await readCachedPriceChartingImage(fileName);
      if (cached) {
        sendBuffer(response, 200, cached.body, cached.contentType, request.method === "HEAD");
        return;
      }
      const db = await dbPromise;
      const repaired = await fetchAndCacheMissingPriceChartingImage(db, fileName);
      if (repaired) {
        sendBuffer(response, 200, repaired.body, repaired.contentType, request.method === "HEAD");
        return;
      }
      sendJson(response, 404, { ok: false, error: "Imagen no encontrada." });
      return;
    }

    const db = await dbPromise;

    if (url.pathname === "/image-proxy" && request.method === "GET") {
      const rawImageUrl = url.searchParams.get("url") || "";
      let sourceUrl: URL;
      try {
        sourceUrl = new URL(rawImageUrl);
      } catch {
        sendJson(response, 400, { ok: false, error: "URL de imagen invalida." });
        return;
      }

      if (!["http:", "https:"].includes(sourceUrl.protocol) || !imageProxyAllowedHosts.has(sourceUrl.hostname.toLowerCase())) {
        sendJson(response, 400, { ok: false, error: "Host de imagen no permitido." });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const imageResponse = await fetch(sourceUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "UltimoTurnoImageProxy/1.0"
          }
        });
        if (!imageResponse.ok) {
          sendJson(response, imageResponse.status, { ok: false, error: `No se pudo descargar la imagen (${imageResponse.status}).` });
          return;
        }
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        if (!contentType.toLowerCase().startsWith("image/")) {
          sendJson(response, 415, { ok: false, error: "La URL no devolvio una imagen." });
          return;
        }
        const body = Buffer.from(await imageResponse.arrayBuffer());
        sendBuffer(response, 200, body, contentType);
      } catch (error) {
        sendJson(response, 502, { ok: false, error: `No se pudo descargar la imagen: ${error instanceof Error ? error.message : String(error)}` });
      } finally {
        clearTimeout(timeout);
      }
      return;
    }

    if (url.pathname === "/health") {
      sendJson(response, 200, { ...(await getHealth(db)), environment: { runtimeEnv, dbDriver, databaseUrlConfigured: Boolean(databaseUrl), allowDatabaseSsl: databaseSslEnabled, dataProfile, allowExamples, dataDir, priceChartingImageDir, priceChartingImageReadDirs, allowedOrigins } });
      return;
    }

    if (url.pathname === "/exchange-rate/blue" && request.method === "GET") {
      sendJson(response, 200, await getBlueExchangeRate());
      return;
    }

    const user = await operationalUser();

    if (url.pathname === "/auth/me") {
      sendJson(response, 200, { user, environment: { dataProfile, allowExamples } });
      return;
    }

    if (url.pathname === "/stock" && request.method === "GET") {
      sendJson(response, 200, await listStockForBusiness(db, user.businessId));
      return;
    }

    if (url.pathname === "/mobile-intake/search" && request.method === "GET") {
      const query = url.searchParams.get("q") || "";
      const limit = Number(url.searchParams.get("limit") || 12);
      sendJson(response, 200, await searchMobileInventoryCandidates(db, user, query, limit));
      return;
    }

    if (url.pathname === "/mobile-intake/entries" && request.method === "GET") {
      sendJson(response, 200, await listMobileInventoryEntries(
        db,
        user.businessId,
        url.searchParams.get("status") || "pending",
        Number(url.searchParams.get("limit") || 500)
      ));
      return;
    }

    if (url.pathname === "/mobile-intake/entries" && request.method === "POST") {
      const body = await readJson<MobileInventoryInput>(request);
      sendJson(response, 201, { entry: await createMobileInventoryEntry(db, body, user) });
      return;
    }

    if (url.pathname === "/mobile-intake/apply" && request.method === "POST") {
      const body = await readJson<{ ids?: string[] }>(request).catch((): { ids?: string[] } => ({}));
      sendJson(response, 200, { result: await applyMobileInventoryEntries(db, user, body.ids) });
      return;
    }

    if (url.pathname.match(/^\/mobile-intake\/entries\/[^/]+\/status$/) && request.method === "PUT") {
      const entryId = url.pathname.split("/")[3];
      const body = await readJson<{ status?: "pending" | "reviewed" | "rejected" }>(request);
      const status = body.status === "reviewed" || body.status === "rejected" ? body.status : "pending";
      sendJson(response, 200, { entry: await updateMobileInventoryEntryStatus(db, entryId, status, user) });
      return;
    }

    if (url.pathname.match(/^\/mobile-intake\/entries\/[^/]+$/) && request.method === "DELETE") {
      const entryId = url.pathname.split("/")[3];
      sendJson(response, 200, await deleteMobileInventoryEntry(db, entryId, user));
      return;
    }

    if (url.pathname === "/stock-images/review" && request.method === "GET") {
      const items = await listStockImageReview(db, user.businessId);
      sendJson(response, 200, { items, total: items.length });
      return;
    }

    if (url.pathname === "/pricecharting-images/catalog" && request.method === "GET") {
      const entries = await listPriceChartingImageCatalog(db);
      sendJson(response, 200, { entries, total: entries.length });
      return;
    }

    if (url.pathname === "/inventory/intake" && request.method === "POST") {
      const body = await readJson<UpsertInventoryInput>(request);
      sendJson(response, 200, { item: await addInventoryStock(db, body, user) });
      return;
    }

    if (url.pathname === "/inventory" && request.method === "POST") {
      const body = await readJson<Parameters<typeof upsertInventoryItem>[1]>(request);
      const item = await upsertInventoryItem(db, body, user);
      sendJson(response, 201, { item });
      void ensurePriceChartingImageQueueForStock(db, user.businessId).catch((error) => {
        console.error("No se pudo actualizar la cola de imagenes de stock", error);
      });
      return;
    }

    if (url.pathname === "/inventory/reset-stock" && request.method === "POST") {
      const body = await readJson<{ confirmation?: string }>(request);
      if (body.confirmation !== "RESET INVENTARIO") {
        sendJson(response, 400, { error: "Confirmacion invalida. Escribi RESET INVENTARIO para poner el stock en cero." });
        return;
      }
      sendJson(response, 200, { result: await resetInventoryStock(db, user) });
      return;
    }

    const imageForcePath = url.pathname.replace(/^\/api(?=\/inventory\/)/, "");
    if (imageForcePath.match(/^\/inventory\/[^/]+\/image\/force$/) && request.method === "POST") {
      const inventoryItemId = imageForcePath.split("/")[2];
      const body = await readJson<{ manualUrl?: string; mode?: ImageResolverMode }>(request).catch(() => ({}));
      sendJson(response, 200, await forceInventoryProductImage(db, inventoryItemId, body, user));
      return;
    }

    if (url.pathname.match(/^\/inventory\/[^/]+\/tags$/) && request.method === "PUT") {
      const inventoryItemId = url.pathname.split("/")[2];
      const body = await readJson<{ tags?: string }>(request);
      sendJson(response, 200, { item: await updateInventoryItemTags(db, inventoryItemId, body.tags || "", user) });
      return;
    }

    if (url.pathname.startsWith("/inventory/") && request.method === "PUT") {
      const body = await readJson<Parameters<typeof upsertInventoryItem>[1]>(request);
      const item = await upsertInventoryItem(db, body, user);
      sendJson(response, 200, { item });
      void ensurePriceChartingImageQueueForStock(db, user.businessId).catch((error) => {
        console.error("No se pudo actualizar la cola de imagenes de stock", error);
      });
      return;
    }

    if (url.pathname === "/inventory-adjustments" && request.method === "POST") {
      const body = await readJson<Parameters<typeof adjustInventoryQuantity>[1]>(request);
      sendJson(response, 201, { item: await adjustInventoryQuantity(db, body, user) });
      return;
    }

    if (url.pathname === "/movements" && request.method === "GET") {
      sendJson(response, 200, await listMovements(db, user.businessId));
      return;
    }

    if (url.pathname === "/audit" && request.method === "GET") {
      sendJson(response, 200, await getAuditLog(db, user.businessId));
      return;
    }

    if (url.pathname === "/order-boards" && request.method === "GET") {
      sendJson(response, 200, await getOrderBoards(db, user.businessId));
      return;
    }
    if (url.pathname === "/order-boards" && request.method === "POST") {
      const body = await readJson<Parameters<typeof changeOrderBoard>[1]>(request);
      sendJson(response, 200, await changeOrderBoard(db, body, user));
      return;
    }
    if (url.pathname === "/sales" && request.method === "GET") {
      sendJson(response, 200, await listSales(db, user.businessId));
      return;
    }

    if (url.pathname === "/sales" && request.method === "POST") {
      const body = await readJson<Parameters<typeof createSale>[1]>(request);
      sendJson(response, 201, { sale: await createSale(db, body, user) });
      return;
    }

    if (url.pathname === "/sales/merge-duplicate-customers" && request.method === "POST") {
      sendJson(response, 200, await mergeDuplicateCustomerOrders(db, user));
      return;
    }

    if (url.pathname.match(/^\/sales\/[^/]+\/complete$/) && request.method === "POST") {
      const saleId = url.pathname.split("/")[2];
      sendJson(response, 200, { sale: await completeReservationSale(db, saleId, user) });
      return;
    }

    if (url.pathname.match(/^\/sales\/[^/]+\/cancel$/) && request.method === "POST") {
      const saleId = url.pathname.split("/")[2];
      sendJson(response, 200, { sale: await cancelReservationSale(db, saleId, user) });
      return;
    }

    if (url.pathname.match(/^\/sales\/[^/]+\/packed$/) && request.method === "POST") {
      const saleId = url.pathname.split("/")[2];
      sendJson(response, 200, { sale: await markSalePacked(db, saleId, user) });
      return;
    }

    if (url.pathname.match(/^\/sales\/[^/]+\/delivered$/) && request.method === "POST") {
      const saleId = url.pathname.split("/")[2];
      sendJson(response, 200, { sale: await markSaleDelivered(db, saleId, user) });
      return;
    }

    if (url.pathname.match(/^\/sales\/[^/]+\/payment$/) && request.method === "PUT") {
      const saleId = url.pathname.split("/")[2];
      const body = await readJson<{ amountPaidArs?: number; paymentDueAt?: string }>(request);
      sendJson(response, 200, { sale: await updateSalePayment(db, saleId, body.amountPaidArs, user, body.paymentDueAt) });
      return;
    }

    if (url.pathname.match(/^\/sales\/[^/]+\/note$/) && request.method === "PUT") {
      const saleId = url.pathname.split("/")[2];
      const body = await readJson<{ internalNote?: string }>(request);
      sendJson(response, 200, { sale: await updateSaleInternalNote(db, saleId, body.internalNote || "", user) });
      return;
    }

    if (url.pathname.match(/^\/sales\/[^/]+\/message-sent$/) && request.method === "PUT") {
      const saleId = url.pathname.split("/")[2];
      const body = await readJson<{ sent?: boolean }>(request);
      sendJson(response, 200, { sale: await updateSaleMessageSent(db, saleId, Boolean(body.sent), user) });
      return;
    }

    if (url.pathname.match(/^\/sale-items\/[^/]+\/packed$/) && request.method === "PUT") {
      const saleItemId = url.pathname.split("/")[2];
      const body = await readJson<{ packed?: boolean }>(request);
      sendJson(response, 200, { sale: await updateSaleItemPacked(db, saleItemId, Boolean(body.packed), user) });
      return;
    }

    if (url.pathname === "/purchases" && request.method === "GET") {
      sendJson(response, 200, await listPurchases(db, user.businessId));
      return;
    }

    if (url.pathname === "/purchases" && request.method === "POST") {
      const body = await readJson<Parameters<typeof createPurchase>[1]>(request);
      sendJson(response, 201, { purchase: await createPurchase(db, body, user) });
      return;
    }

    if (url.pathname === "/claims" && request.method === "GET") {
      sendJson(response, 200, await listClaimsWorkspace(db, user.businessId));
      return;
    }

    if (url.pathname === "/claims" && request.method === "POST") {
      const body = await readJson<Parameters<typeof createClaimSession>[1]>(request);
      sendJson(response, 201, await createClaimSession(db, body, user));
      return;
    }

    if (url.pathname === "/claims/settings" && request.method === "PUT") {
      const body = await readJson<Parameters<typeof updateActiveClaimSettings>[1]>(request);
      sendJson(response, 200, await updateActiveClaimSettings(db, body, user));
      return;
    }

    if (url.pathname === "/claims/cards/from-pricecharting" && request.method === "POST") {
      const body = await readJson<{ priceChartingIds: string[]; sectionId?: string }>(request);
      sendJson(response, 201, await addPriceChartingCardsToClaim(db, body.priceChartingIds || [], user, body.sectionId || ""));
      return;
    }

    if (url.pathname === "/claims/images/search" && request.method === "POST") {
      const body: { batchSize?: number } = await readJson<{ batchSize?: number }>(request).catch(() => ({}));
      const queued = await ensurePriceChartingImageQueueForActiveClaim(db, user.businessId);
      const requestedBatchSize = Number(body.batchSize || 0);
      const missingEntries = await listActiveClaimMissingPriceChartingImages(db, user.businessId, 500);
      const missing = missingEntries.length;
      const batchSize = Math.max(1, Math.min(250, Math.max(missing, requestedBatchSize)));
      const batch = await processActiveClaimPriceChartingPageImages(user.businessId, batchSize);
      sendJson(response, 200, {
        ok: true,
        queued: queued.queued,
        missing,
        batchSize,
        processed: batch.processed,
        urlFound: 0,
        downloaded: batch.downloaded,
        skipped: 0,
        failed: batch.failed,
        rateLimited: batch.rateLimited,
        cooldownUntil: batch.cooldownUntil,
        items: batch.items,
        workspace: await listClaimsWorkspace(db, user.businessId),
        status: await getPriceChartingImageCacheStatus(db, user.businessId)
      });
      return;
    }

    if (url.pathname === "/claims/prices/refresh" && request.method === "POST") {
      sendJson(response, 200, await refreshActiveClaimPricesFromPriceCharting(db, user));
      return;
    }

    if (url.pathname.match(/^\/claims\/cards\/[^/]+\/image\/search$/) && request.method === "POST") {
      const cardId = url.pathname.split("/")[3];
      const workspace = await listClaimsWorkspace(db, user.businessId);
      const card = workspace.cards.find((claimCard) => claimCard.id === cardId);
      if (!card) {
        sendJson(response, 404, { ok: false, error: "La carta ya no existe en el claim activo." });
        return;
      }
      const result = await processSingleClaimCardImage({
        priceChartingId: card.priceChartingId,
        canonicalUrl: card.canonicalUrl,
        productName: card.productName,
        expansionName: card.expansionName,
        cardNumber: card.cardNumber
      });
      sendJson(response, 200, {
        ok: result.failed === 0,
        ...result,
        workspace: await listClaimsWorkspace(db, user.businessId),
        status: await getPriceChartingImageCacheStatus(db, user.businessId)
      });
      return;
    }

    if (url.pathname === "/claims/sections" && request.method === "POST") {
      const body = await readJson<Parameters<typeof createClaimSection>[1]>(request);
      sendJson(response, 201, await createClaimSection(db, body, user));
      return;
    }

    if (url.pathname.match(/^\/claims\/sections\/[^/]+$/) && request.method === "PUT") {
      const sectionId = url.pathname.split("/")[3];
      const body = await readJson<Parameters<typeof updateClaimSection>[2]>(request);
      sendJson(response, 200, await updateClaimSection(db, sectionId, body, user));
      return;
    }

    if (url.pathname.match(/^\/claims\/sections\/[^/]+$/) && request.method === "DELETE") {
      const sectionId = url.pathname.split("/")[3];
      sendJson(response, 200, await deleteClaimSection(db, sectionId, user));
      return;
    }

    if (url.pathname.match(/^\/claims\/cards\/[^/]+$/) && request.method === "PUT") {
      const cardId = url.pathname.split("/")[3];
      const body = await readJson<Parameters<typeof updateClaimCard>[2]>(request);
      if (body.imageUrl !== undefined) {
        body.imageUrl = await resolveManualClaimImageUrl(cardId, body.imageUrl, user);
      }
      sendJson(response, 200, await updateClaimCard(db, cardId, body, user));
      return;
    }

    if (url.pathname.match(/^\/claims\/cards\/[^/]+$/) && request.method === "DELETE") {
      const cardId = url.pathname.split("/")[3];
      sendJson(response, 200, await deleteClaimCard(db, cardId, user));
      return;
    }

    if (url.pathname === "/claims/frees" && request.method === "POST") {
      const body = await readJson<Parameters<typeof addClaimFree>[1]>(request);
      sendJson(response, 201, await addClaimFree(db, body, user));
      return;
    }

    if (url.pathname === "/claims/orders/preview" && request.method === "GET") {
      sendJson(response, 200, await previewActiveClaimOrders(db, user));
      return;
    }

    if (url.pathname === "/claims/close" && request.method === "POST") {
      sendJson(response, 200, await closeActiveClaim(db, user));
      return;
    }

    if (url.pathname === "/claims/archive" && request.method === "POST") {
      sendJson(response, 200, await archiveActiveClaim(db, user));
      return;
    }

    if (url.pathname === "/card-index" && request.method === "GET") {
      const query = url.searchParams.get("query") || "";
      const limit = Number(url.searchParams.get("limit") || 50);
      const filter = url.searchParams.get("filter") || "all";
      sendJson(response, 200, await listCardIndex(db, query, limit, filter));
      return;
    }

    if (url.pathname.match(/^\/card-index\/[^/]+\/review$/) && request.method === "PUT") {
      const cardIndexId = url.pathname.split("/")[2];
      const body = await readJson<Parameters<typeof reviewCardIndexEntry>[2]>(request);
      sendJson(response, 200, { entry: await reviewCardIndexEntry(db, cardIndexId, body) });
      return;
    }

    if (url.pathname === "/card-index/approve-by-confidence" && request.method === "POST") {
      const body = await readJson<Parameters<typeof approveCardIndexEntriesByConfidence>[1]>(request);
      sendJson(response, 200, await approveCardIndexEntriesByConfidence(db, body));
      return;
    }

    if (url.pathname === "/card-index/status" && request.method === "GET") {
      sendJson(response, 200, await getCardIndexStatus(db));
      return;
    }

    if (url.pathname === "/card-index/tcgcsv-progress" && request.method === "GET") {
      sendJson(response, 200, { progress: await readTcgCsvWorkerProgress(), progressPath: tcgCsvWorkerProgressPath() });
      return;
    }

    if (url.pathname === "/card-index/image-progress" && request.method === "GET") {
      sendJson(response, 200, { progress: await readCardIndexImageWorkerProgress(), progressPath: cardIndexImageWorkerProgressPath() });
      return;
    }

    if (url.pathname === "/card-index/rebuild-pricecharting" && request.method === "POST") {
      const body: { afterId?: string; limit?: number } = await readJson<{ afterId?: string; limit?: number }>(request).catch(() => ({}));
      const batch = await refreshCardIndexFromPriceChartingBatch(db, {
        afterId: body.afterId,
        limit: Math.max(1, Math.min(5000, Number(body.limit || 1000)))
      });
      sendJson(response, 200, { ...batch });
      return;
    }

    if (url.pathname === "/card-index/rebuild-pricecharting-batch" && request.method === "POST") {
      const body: { afterId?: string; limit?: number } = await readJson<{ afterId?: string; limit?: number }>(request).catch(() => ({}));
      const batch = await refreshCardIndexFromPriceChartingBatch(db, {
        afterId: body.afterId,
        limit: Math.max(1, Math.min(5000, Number(body.limit || 1000)))
      });
      sendJson(response, 200, { ...batch });
      return;
    }

    if (url.pathname === "/card-index/sync-tcgcsv" && request.method === "POST") {
      const body: { groupOffset?: number; groupLimit?: number; loop?: boolean } = await readJson<{ groupOffset?: number; groupLimit?: number; loop?: boolean }>(request).catch(() => ({}));
      sendJson(response, 200, await syncCardIndexTcgCsvInProcess({ groupOffset: body.groupOffset, groupLimit: body.groupLimit }));
      return;
    }

    if (url.pathname === "/card-index/download-images" && request.method === "POST") {
      const body: { batchSize?: number; concurrency?: number; loop?: boolean } = await readJson<{ batchSize?: number; concurrency?: number; loop?: boolean }>(request).catch(() => ({}));
      sendJson(response, 202, await startCardIndexImageWorker({ batchSize: body.batchSize, concurrency: body.concurrency, loop: body.loop }));
      return;
    }

    if (url.pathname === "/pricecharting-cache" && request.method === "GET") {
      const query = url.searchParams.get("query") || "";
      const limit = Number(url.searchParams.get("limit") || 50);
      sendJson(response, 200, await listPriceChartingCache(db, query, limit));
      return;
    }

    if (url.pathname === "/pricecharting-cache/status" && request.method === "GET") {
      sendJson(response, 200, await getPriceChartingCacheStatus(db));
      return;
    }

    if (url.pathname === "/pricecharting-cache/auto-refresh/status" && request.method === "GET") {
      sendJson(response, 200, priceChartingAutoRefreshStatus());
      return;
    }

    if (url.pathname === "/tcgplayer-prices/status" && request.method === "GET") {
      sendJson(response, 200, await getTcgplayerPriceCacheStatus(db));
      return;
    }

    if (url.pathname === "/tcgplayer-prices/auto-refresh/status" && request.method === "GET") {
      sendJson(response, 200, tcgplayerPriceAutoRefreshStatus());
      return;
    }

    if (url.pathname === "/tcgplayer-prices/refresh" && request.method === "POST") {
      const body: { force?: boolean } = await readJson<{ force?: boolean }>(request).catch(() => ({}));
      try {
        const status = await refreshTcgplayerPricesFromTcgCsv(db, { force: body.force !== false });
        sendJson(response, 200, { ok: true, status });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordTcgplayerPriceCacheFailure(db, { source: "tcgcsv", categoryId: tcgplayerPriceCategoryId, errorMessage: message });
        sendJson(response, 502, { ok: false, error: message });
      }
      return;
    }

    if (url.pathname === "/pricecharting-images/status" && request.method === "GET") {
      sendJson(response, 200, await getPriceChartingImageCacheStatus(db, user.businessId));
      return;
    }

    if (url.pathname === "/pricecharting-images/queue-stock" && request.method === "POST") {
      const queued = await ensurePriceChartingImageQueueForStock(db, user.businessId);
      sendJson(response, 200, { ok: true, ...queued, status: await getPriceChartingImageCacheStatus(db, user.businessId) });
      return;
    }

    if (url.pathname === "/pricecharting-images/queue-all" && request.method === "POST") {
      const body = await readJson<{ limit?: number }>(request);
      const queued = await ensurePriceChartingImageQueueForAll(db, body.limit || 1000);
      sendJson(response, 200, { ok: true, ...queued, status: await getPriceChartingImageCacheStatus(db, user.businessId) });
      return;
    }

    if (url.pathname === "/pricecharting-images/external-index/status" && request.method === "GET") {
      sendJson(response, 200, { ok: true, index: await getExternalImageIndexStatus() });
      return;
    }

    if (url.pathname === "/pricecharting-images/reindex-local" && request.method === "POST") {
      const body: { limit?: number } = await readJson<{ limit?: number }>(request).catch(() => ({}));
      const limit = Math.max(1, Math.min(2000, Number(body.limit || 500)));
      const result = await reindexLocalPriceChartingImages(limit);
      sendJson(response, 200, { ok: true, ...result, status: await getPriceChartingImageCacheStatus(db, user.businessId) });
      return;
    }

    if (url.pathname === "/pricecharting-images/process" && request.method === "POST") {
      const body = await readJson<{ batchSize?: number; delayMs?: number; concurrency?: number; includeAll?: boolean; mode?: ImageResolverMode; onlyWithSourceImageUrl?: boolean }>(request);
      await ensurePriceChartingImageQueueForStock(db, user.businessId);
      const batchSize = Math.max(1, Math.min(100, Number(body.batchSize || 10)));
      const concurrency = Math.max(1, Math.min(10, Number(body.concurrency || 4)));
      const mode: ImageResolverMode = body.mode === "pokemon-tcg" ? "pokemon-tcg" : "auto";
      if (body.includeAll) await ensurePriceChartingImageQueueForAll(db, Math.max(500, batchSize * 50));
      const result = await processPriceChartingImageQueue(batchSize, concurrency, mode, {
        onlyWithSourceImageUrl: !!body.onlyWithSourceImageUrl
      });
      sendJson(response, 200, { ok: true, ...result, status: await getPriceChartingImageCacheStatus(db, user.businessId) });
      return;
    }

    if (url.pathname === "/pricecharting-images/discover" && request.method === "POST") {
      const body = await readJson<{ batchSize?: number; concurrency?: number; delayMs?: number; includeAll?: boolean; sourceMode?: ImageDiscoverySourceMode }>(request);
      await ensurePriceChartingImageQueueForStock(db, user.businessId);
      const batchSize = Math.max(1, Math.min(1000, Number(body.batchSize || 100)));
      const sourceMode: ImageDiscoverySourceMode = body.sourceMode === "pricecharting-storage" || body.sourceMode === "auto" ? body.sourceMode : "pricecharting-url";
      const usesPriceChartingHtml = sourceMode !== "pricecharting-storage";
      const concurrency = usesPriceChartingHtml ? 1 : Math.max(1, Math.min(20, Number(body.concurrency || 6)));
      const delayMs = usesPriceChartingHtml ? Math.max(1000, Number(body.delayMs || 1100)) : 0;
      if (body.includeAll) await ensurePriceChartingImageQueueForAll(db, Math.max(1000, batchSize * 20));
      const result = await processPriceChartingImageUrlQueue(batchSize, concurrency, sourceMode, delayMs);
      sendJson(response, 200, { ok: true, ...result, status: await getPriceChartingImageCacheStatus(db, user.businessId) });
      return;
    }

    if (url.pathname === "/pricecharting-images/external-index" && request.method === "POST") {
      const body = await readJson<{ batchSize?: number; includeAll?: boolean; rebuild?: boolean; providers?: ExternalImageProvider[] }>(request);
      await ensurePriceChartingImageQueueForStock(db, user.businessId);
      const batchSize = Math.max(1, Math.min(5000, Number(body.batchSize || 1000)));
      const providers = (body.providers || []).filter((provider): provider is ExternalImageProvider => provider === "pokemontcg" || provider === "tcgdex");
      if (body.includeAll) await ensurePriceChartingImageQueueForAll(db, Math.max(1000, batchSize * 5));
      const result = await processExternalImageIndexQueue({
        batchSize,
        providers,
        rebuild: !!body.rebuild
      });
      sendJson(response, 200, { ok: true, ...result, status: await getPriceChartingImageCacheStatus(db, user.businessId) });
      return;
    }

    if (url.pathname === "/pricecharting-cache/refresh" && request.method === "POST") {
      try {
        const status = await refreshPriceChartingCacheFromConfiguredToken(db);
        sendJson(response, 200, { ok: true, status });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordPriceChartingCacheFailure(db, { category: priceChartingCategory, errorMessage: message });
        sendJson(response, 502, { ok: false, error: message });
      }
      return;
    }

    if (url.pathname === "/examples/inventory" && request.method === "POST") {
      if (!allowExamples) {
        sendJson(response, 403, { ok: false, error: "Este perfil no permite cargar ejemplos." });
        return;
      }
      sendJson(response, 201, await loadExampleInventory(db, user));
      return;
    }

    if (url.pathname === "/imports" && request.method === "GET") {
      sendJson(response, 200, await listImports(db, user.businessId));
      return;
    }

    if (url.pathname === "/imports/snapshot/preview" && request.method === "POST") {
      const body = await readJson<{ csvText: string }>(request);
      sendJson(response, 200, await previewInventorySnapshot(db, body.csvText, user.businessId));
      return;
    }

    if (url.pathname === "/imports/snapshot/apply" && request.method === "POST") {
      const body = await readJson<{ csvText: string; confirm: boolean; batchName?: string; defaultLocation?: string; defaultInventoryStatus?: string; note?: string; resolutions?: Array<{ rowNumber: number; resolution: "create" | "update" | "ignore"; matchedInventoryItemId?: string; priceChartingId?: string }> }>(request);
      if (!body.confirm) {
        sendJson(response, 400, { ok: false, error: "Para aplicar la importacion tenes que confirmar explicitamente." });
        return;
      }
      sendJson(response, 200, await applyInventorySnapshot(db, body.csvText, user, body.resolutions || [], {
        batchName: body.batchName,
        defaultLocation: body.defaultLocation,
        defaultInventoryStatus: body.defaultInventoryStatus,
        note: body.note
      }));
      return;
    }

    sendJson(response, 404, { ok: false, error: `Ruta no encontrada: ${request.method || "GET"} ${url.pathname}` });
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 500;
    sendJson(response, statusCode, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function startServer() {
  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  server.listen(port, () => {
    console.log(`UltimoTurno API listening on http://localhost:${port}`);
    console.log(dbDriver === "postgres" ? "Database driver: PostgreSQL remoto" : `PGlite data dir: ${dataDir}`);
    if (priceChartingAutoRefreshEnabled) {
      scheduleNextPriceChartingAutoRefresh();
      console.log(`PriceCharting auto refresh: ${priceChartingAutoRefreshTime} local. Proxima corrida: ${priceChartingAutoRefreshNextRunAt}`);
      void runMissedPriceChartingAutoRefreshOnStartup();
    } else {
      console.log("PriceCharting auto refresh: deshabilitado.");
    }
    if (tcgplayerPriceAutoRefreshEnabled) {
      scheduleNextTcgplayerPriceAutoRefresh();
      console.log(`TCGplayer price auto refresh: ${tcgplayerPriceAutoRefreshTime} local. Proxima corrida: ${tcgplayerPriceAutoRefreshNextRunAt}`);
      void runMissedTcgplayerPriceAutoRefreshOnStartup();
    } else {
      console.log("TCGplayer price auto refresh: deshabilitado.");
    }
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = startServer();
  const shutdown = (signal: string) => {
    console.log(`Recibido ${signal}; cerrando API UltimoTurno...`);
    if (priceChartingAutoRefreshTimer) clearTimeout(priceChartingAutoRefreshTimer);
    if (tcgplayerPriceAutoRefreshTimer) clearTimeout(tcgplayerPriceAutoRefreshTimer);
    server.close(() => {
      void dbPromise
        .then((db) => db.close())
        .then(() => {
          console.log("PGlite cerrada correctamente.");
          process.exit(0);
        })
        .catch((error) => {
          console.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        });
    });
    setTimeout(() => process.exit(1), 15000).unref();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}



