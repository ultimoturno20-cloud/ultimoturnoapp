import { findCoolstuffExpansionUrl, matchCoolstuffProduct, parseCoolstuffExpansionLinks, parseCoolstuffPageCount, parseCoolstuffProducts, type CoolstuffExpansionLink, type CoolstuffPriceTarget, type CoolstuffProduct } from "../packages/importers/src/index.js";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type WorkerTarget = CoolstuffPriceTarget & {
  quantityOnHand: number;
  lastStatus: string;
  lastAttemptAt: string;
};

type Options = {
  apiBaseUrl: string;
  accessKey: string;
  batchSize: number;
  delayMs: number;
  refreshHours: number;
  loop: boolean;
  untilDone: boolean;
  sleepMs: number;
  maxRuntimeMs: number;
  dryRun: boolean;
};

type Observation = {
  priceChartingId: string;
  condition: string;
  finish: string;
  status: "matched" | "not_found" | "ambiguous" | "failed";
  coolstuffUrl?: string;
  productName?: string;
  expansionName?: string;
  cardNumber?: string;
  sourceCondition?: string;
  priceUsd?: number | null;
  quantity?: number;
  confidence?: number;
  errorMessage?: string;
};

export type RunStats = {
  reviewed: number;
  matched: number;
  notFound: number;
  ambiguous: number;
  failed: number;
  batches: number;
};

export function newRunStats(): RunStats {
  return { reviewed: 0, matched: 0, notFound: 0, ambiguous: 0, failed: 0, batches: 0 };
}

export type CacheStatusSummary = {
  matchedEntries: number;
  totalEntries: number;
  staleEntries: number;
  notFoundEntries: number;
  failedEntries: number;
  lastAttemptAt: string;
};

export function runSummary(stats: RunStats, cache?: CacheStatusSummary): string {
  const lines = [
    "## CoolStuff price worker: resumen del run",
    "",
    "| Revisadas | Con precio | Not found | Ambiguous | Failed | Tandas |",
    "|---|---|---|---|---|---|",
    `| ${stats.reviewed} | ${stats.matched} | ${stats.notFound} | ${stats.ambiguous} | ${stats.failed} | ${stats.batches} |`
  ];
  if (cache) {
    const pct = cache.totalEntries ? Math.round((cache.matchedEntries / cache.totalEntries) * 100) : 0;
    lines.push("", `Cobertura cache: ${cache.matchedEntries}/${cache.totalEntries} con precio (${pct}%). Stale: ${cache.staleEntries}, Not found: ${cache.notFoundEntries}, Failed: ${cache.failedEntries}. Ultimo intento: ${cache.lastAttemptAt || "n/a"}.`);
  }
  return lines.join("\n");
}

function reportRun(stats: RunStats, cache?: CacheStatusSummary) {
  console.log(runSummary(stats, cache).split("\n").filter((line) => !line.startsWith("|---")).join("\n"));
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, `\n${runSummary(stats, cache)}\n`);
    } catch (error) {
      console.error(`No se pudo escribir GITHUB_STEP_SUMMARY: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function loadCacheStatus(options: Options): Promise<CacheStatusSummary | undefined> {
  try {
    return await getJson<CacheStatusSummary>(options, "/coolstuff-prices/status");
  } catch (error) {
    console.error(`No se pudo leer el estado del cache: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export function parseOptions(argv: string[]): Options {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const argument of argv) {
    if (!argument.startsWith("--")) continue;
    const [key, ...rawValue] = argument.slice(2).split("=");
    const value = rawValue.join("=").trim();
    if (value) values.set(key.trim(), value);
    else flags.add(key.trim());
  }
  return {
    apiBaseUrl: (values.get("api") || process.env.npm_config_api || process.env.ULTIMOTURNO_API_URL || "https://ultimoturno.app/api").replace(/\/+$/, ""),
    accessKey: values.get("access-key") || process.env.ULTIMOTURNO_ACCESS_KEY || "",
    batchSize: clamp(values.get("batch") || process.env.npm_config_batch, 1, 100, 20),
    delayMs: clamp(values.get("delay-ms") || process.env.npm_config_delay_ms, 10000, 60000, 10000),
    refreshHours: clamp(values.get("refresh-hours") || process.env.npm_config_refresh_hours, 6, 24 * 30, 24),
    loop: flags.has("loop") || process.env.npm_config_loop === "true",
    untilDone: flags.has("until-done") || process.env.npm_config_until_done === "true",
    sleepMs: clamp(values.get("sleep-ms") || process.env.npm_config_sleep_ms, 60000, 24 * 60 * 60 * 1000, 60 * 60 * 1000),
    maxRuntimeMs: maxRuntimeMs(values.get("max-runtime-ms") || process.env.npm_config_max_runtime_ms || process.env.COOLSTUFF_MAX_RUNTIME_MS),
    dryRun: flags.has("dry-run") || process.env.npm_config_dry_run === "true"
  };
}

function clamp(raw: string | undefined, minimum: number, maximum: number, fallback: number) {
  const value = Number(raw || fallback);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
}

function maxRuntimeMs(raw: string | undefined) {
  if (raw === undefined || raw === "") return process.env.GITHUB_ACTIONS === "true" ? 16200000 : 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : (process.env.GITHUB_ACTIONS === "true" ? 16200000 : 0);
}

function showHelp() {
  console.log(`
UltimoTurno CoolStuff price worker

Uso recomendado:
  npm run coolstuff:prices:daemon

El worker procesa solo cartas inglesas con stock, conserva el progreso en
Supabase y espera 10 segundos entre consultas a CoolStuff.
En modo loop sigue con las tandas pendientes; espera una hora solo cuando
no quedan pendientes o falla la API. Dry-run ejecuta una sola tanda.
En modo --until-done procesa todas las tandas pendientes y termina.

Opciones:
  --batch=20
  --delay-ms=10000
  --refresh-hours=24
  --loop
  --until-done
  --sleep-ms=3600000
  --max-runtime-ms=16200000
  --dry-run
  --api=https://ultimoturno.app/api

Para opciones personalizadas con esta version de npm:
  npx tsx tools/coolstuff-price-worker.ts --batch=5 --dry-run

Variable requerida para produccion:
  ULTIMOTURNO_ACCESS_KEY
`);
}

function authHeaders(options: Options) {
  return {
    "Content-Type": "application/json",
    ...(options.accessKey ? { "X-UltimoTurno-Access-Key": options.accessKey } : {})
  };
}

function isLocalApi(value: string) {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(value).hostname.toLowerCase());
  } catch {
    return value === "/api";
  }
}

function apiUrl(options: Options, route: string) {
  const path = route.startsWith("/") ? route : `/${route}`;
  return isLocalApi(options.apiBaseUrl) ? `${options.apiBaseUrl}${path}` : `${options.apiBaseUrl}/dispatch?path=${encodeURIComponent(path)}`;
}

async function getJson<T>(options: Options, route: string): Promise<T> {
  const url = apiUrl(options, route);
  const response = await fetch(url, { headers: authHeaders(options), signal: AbortSignal.timeout(30000) });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function postJson<T>(options: Options, route: string, body: unknown): Promise<T> {
  const url = apiUrl(options, route);
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(options),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`POST ${url} -> ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

let lastCoolstuffRequestAt = 0;
let expansionLinksCache: { expiresAt: number; links: CoolstuffExpansionLink[] } | undefined;
const expansionCache = new Map<string, { expiresAt: number; products: Promise<CoolstuffProduct[]> }>();

export function resetWorkerCachesForTests() {
  lastCoolstuffRequestAt = 0;
  expansionLinksCache = undefined;
  expansionCache.clear();
}

// CoolStuff omits some live set pages from the /pokemon/ index.
export const COOLSTUFF_EXPANSION_FALLBACKS: CoolstuffExpansionLink[] = [
  { name: "Destined Rivals", url: "https://www.coolstuffinc.com/page/8872" }
];

export function mergeCoolstuffExpansionFallbacks(links: CoolstuffExpansionLink[], fallbacks = COOLSTUFF_EXPANSION_FALLBACKS) {
  const byUrl = new Map(links.map((link) => [link.url.replace(/\/+$/, ""), link]));
  for (const fallback of fallbacks) {
    const key = fallback.url.replace(/\/+$/, "");
    if (!byUrl.has(key)) byUrl.set(key, fallback);
  }
  return [...byUrl.values()];
}

async function fetchCoolstuffHtml(options: Options, url: URL | string) {
  const waitMs = Math.max(0, options.delayMs - (Date.now() - lastCoolstuffRequestAt));
  if (waitMs) await sleep(waitMs);
  lastCoolstuffRequestAt = Date.now();
  const response = await fetch(url, {
    headers: {
      "User-Agent": "UltimoTurnoPriceWorker/1.0 (inventory price cache; sequential requests)",
      Accept: "text/html,application/xhtml+xml"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000)
  });
  lastCoolstuffRequestAt = Date.now();
  if (!response.ok) throw new Error(`CoolStuff HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("CoolStuff respondio sin contenido; se reintentara mas tarde.");
  return new TextDecoder("windows-1252").decode(bytes);
}

async function loadExpansionLinks(options: Options): Promise<CoolstuffExpansionLink[]> {
  if (expansionLinksCache && expansionLinksCache.expiresAt > Date.now()) return expansionLinksCache.links;
  const html = await fetchCoolstuffHtml(options, "https://www.coolstuffinc.com/pokemon/");
  const links = parseCoolstuffExpansionLinks(html);
  if (!links.length) throw new Error("No se pudo leer el indice de expansiones de CoolStuff.");
  const withFallbacks = mergeCoolstuffExpansionFallbacks(links);
  expansionLinksCache = { expiresAt: Date.now() + 86400000, links: withFallbacks };
  return withFallbacks;
}

export async function loadExpansionProducts(options: Options, expansionUrl: string): Promise<CoolstuffProduct[]> {
  const firstUrl = new URL(expansionUrl);
  firstUrl.searchParams.set("sh", "1");
  firstUrl.searchParams.set("page", "1");
  const firstHtml = await fetchCoolstuffHtml(options, firstUrl);
  const products = parseCoolstuffProducts(firstHtml);
  if (!products.length) throw new Error("La expansion CoolStuff no devolvio productos con precio.");
  const seen = new Set(products.map((product) => product.url));
  // CoolStuff shows a sliding window of page links, so the total can grow on every page.
  let pageCount = parseCoolstuffPageCount(firstHtml, firstUrl.toString());
  for (let page = 2; page <= pageCount; page++) {
    const pageUrl = new URL(firstUrl);
    pageUrl.searchParams.set("page", String(page));
    const html = await fetchCoolstuffHtml(options, pageUrl);
    pageCount = Math.max(pageCount, parseCoolstuffPageCount(html, pageUrl.toString()));
    const next = parseCoolstuffProducts(html);
    const unique = next.filter((product) => !seen.has(product.url));
    if (!unique.length) throw new Error(`CoolStuff pagina ${page}: vacia o repetida; no se guardara una expansion incompleta.`);
    for (const product of unique) seen.add(product.url);
    products.push(...unique);
  }
  if (!products.length) throw new Error("La expansion CoolStuff no devolvio productos con precio.");
  return products;
}

// Actions restores this folder between runs (actions/cache), so each set is scraped at most once per COOLSTUFF_CACHE_HOURS.
function diskCachePath(url: string) {
  return join(process.env.COOLSTUFF_CACHE_DIR || "", url.replace(/[^a-z0-9]+/gi, "_") + ".json");
}

export async function loadExpansionWithDiskCache(options: Options, url: string): Promise<CoolstuffProduct[]> {
  const dir = process.env.COOLSTUFF_CACHE_DIR;
  if (!dir) return loadExpansionProducts(options, url);
  const maxAgeMs = Number(process.env.COOLSTUFF_CACHE_HOURS || 48) * 3600000;
  try {
    const entry = JSON.parse(readFileSync(diskCachePath(url), "utf8")) as { fetchedAt: number; products: CoolstuffProduct[] };
    if (Date.now() - entry.fetchedAt < maxAgeMs && entry.products.length) return entry.products;
  } catch {
    // Missing or unreadable cache file: download the set again.
  }
  const products = await loadExpansionProducts(options, url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(diskCachePath(url), JSON.stringify({ fetchedAt: Date.now(), products }));
  return products;
}

// PriceCharting files many promos under a bare "Promo" set; the number prefix tells which CoolStuff promo set holds the card.
const COOLSTUFF_PROMO_SETS: Array<[RegExp, string, string]> = [
  [/^swsh\s*\d/i, "SWSH Promos", "5973"],
  [/^svp\s*\d/i, "SV Promos", "7495"],
  [/^sm\s*\d/i, "SM Promos", "3651"],
  [/^xy\s*\d/i, "XY Promos", "1898"],
  [/^mep?\s*\d/i, "ME Promos", "9796"]
];

export function coolstuffPromoTarget<T extends CoolstuffPriceTarget>(target: T): { target: T; url: string } {
  if (!/^promos?$/i.test(target.expansion.trim())) return { target, url: "" };
  const hit = COOLSTUFF_PROMO_SETS.find(([pattern]) => pattern.test(target.number.trim()));
  if (!hit) return { target, url: "" };
  return { target: { ...target, expansion: hit[1] }, url: "https://www.coolstuffinc.com/page/" + hit[2] };
}

async function searchCoolstuff(target: WorkerTarget, options: Options, expansionLinks: CoolstuffExpansionLink[], knownUrl = "") {
  const expansionUrl = knownUrl || findCoolstuffExpansionUrl(target.expansion, expansionLinks);
  if (!expansionUrl) throw new Error(`No se encontro una expansion CoolStuff confiable para ${target.expansion}.`);
  let cached = expansionCache.get(expansionUrl);
  if (!cached || cached.expiresAt <= Date.now()) {
    const products = loadExpansionWithDiskCache(options, expansionUrl);
    cached = { expiresAt: Date.now() + options.refreshHours * 3600000, products };
    expansionCache.set(expansionUrl, cached);
    const entry = cached;
    // Keep failures briefly too: do not fetch the same broken set for every card.
    void products.catch(() => { entry.expiresAt = Date.now() + 15 * 60000; });
  }
  return cached.products;
}

function observationForMatch(target: WorkerTarget, match: ReturnType<typeof matchCoolstuffProduct>): Observation {
  if (match.status !== "matched" || !match.product || !match.offer) {
    return {
      priceChartingId: target.priceChartingId,
      condition: target.condition,
      finish: target.finish,
      status: match.status,
      confidence: match.confidence,
      errorMessage: match.message
    };
  }
  return {
    priceChartingId: target.priceChartingId,
    condition: target.condition,
    finish: target.finish,
    status: "matched",
    coolstuffUrl: match.product.url,
    productName: match.product.name,
    expansionName: match.product.expansion,
    cardNumber: match.product.number,
    sourceCondition: match.offer.condition,
    priceUsd: match.offer.priceUsd,
    quantity: match.offer.quantity,
    confidence: match.confidence
  };
}

function failedObservation(target: WorkerTarget, error: unknown): Observation {
  return {
    priceChartingId: target.priceChartingId,
    condition: target.condition,
    finish: target.finish,
    status: "failed",
    errorMessage: error instanceof Error ? error.message : String(error)
  };
}

export async function runCycle(options: Options, stats: RunStats = newRunStats()) {
  const response = await getJson<{ targets: WorkerTarget[]; status: { matchedEntries: number; totalEntries: number } }>(options, `/coolstuff-prices/targets?limit=${options.batchSize}&refreshHours=${options.refreshHours}`);
  console.log(`[${new Date().toLocaleString("es-AR")}] CoolStuff cache: ${response.status.matchedEntries}/${response.status.totalEntries} con precio. Pendientes en tanda: ${response.targets.length}.`);
  if (!response.targets.length) return 0;
  const expansionLinks = await loadExpansionLinks(options);
  stats.batches++;
  let batchReviewed = 0;
  const matchedBefore = stats.matched;
  for (const target of response.targets) {
    let observation: Observation;
    try {
      const promo = coolstuffPromoTarget(target);
      const match = matchCoolstuffProduct(promo.target, await searchCoolstuff(promo.target, options, expansionLinks, promo.url));
      observation = observationForMatch(target, match);
      if (observation.status === "matched") stats.matched++;
      else if (observation.status === "not_found") stats.notFound++;
      else if (observation.status === "ambiguous") stats.ambiguous++;
      console.log(`${target.name} ${target.number} [${target.condition}/${target.finish}] -> ${observation.status}${observation.priceUsd ? ` USD ${observation.priceUsd.toFixed(2)}` : ""}`);
    } catch (error) {
      observation = failedObservation(target, error);
      if (/No se encontro una expansion CoolStuff/i.test(observation.errorMessage)) {
        observation.status = "not_found";
        stats.notFound++;
      } else {
        stats.failed++;
      }
      console.error(`${target.name}: ${observation.errorMessage}`);
    }
    stats.reviewed++;
    batchReviewed++;
    if (!options.dryRun) {
      try {
        await postJson(options, "/coolstuff-prices/observations", { observations: [observation] });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`No se pudo guardar la observacion de ${target.name}: ${message}`);
        if (observation.status === "matched" && stats.matched > 0) stats.matched--;
        else if (observation.status === "not_found" && stats.notFound > 0) stats.notFound--;
        else if (observation.status === "ambiguous" && stats.ambiguous > 0) stats.ambiguous--;
        stats.failed++;
      }
    }
  }
  console.log(`Tanda terminada: revisadas=${batchReviewed}, precios=${stats.matched - matchedBefore}, modo=${options.dryRun ? "simulacion" : "guardado"}.`);
  return batchReviewed;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    return;
  }
  const options = parseOptions(process.argv.slice(2));
  if (!options.accessKey && !isLocalApi(options.apiBaseUrl)) {
    throw new Error("Falta ULTIMOTURNO_ACCESS_KEY para conectar el worker con produccion.");
  }
  await getJson(options, "/health");
  const stats = newRunStats();
  console.log(`Worker conectado a ${options.apiBaseUrl}. Pausa CoolStuff: ${Math.round(options.delayMs / 1000)}s.`);
  const startedAt = Date.now();
  let consecutiveErrors = 0;
  do {
    if (options.untilDone && options.maxRuntimeMs > 0 && Date.now() - startedAt >= options.maxRuntimeMs) {
      console.log(`Presupuesto de tiempo agotado (${Math.round(options.maxRuntimeMs / 60000)} min). Terminando; el progreso ya quedo guardado.`);
      reportRun(stats, await loadCacheStatus(options));
      break;
    }
    let processed: number;
    try {
      processed = await runCycle(options, stats);
      consecutiveErrors = 0;
    } catch (error) {
      if ((!options.loop && !options.untilDone) || options.dryRun) throw error;
      consecutiveErrors++;
      console.error(`Tanda interrumpida; se reintentara: ${error instanceof Error ? error.message : String(error)}`);
      if (options.untilDone) {
        if (consecutiveErrors >= 3) {
          console.error("3 errores consecutivos de ciclo; terminando con error.");
          reportRun(stats, await loadCacheStatus(options));
          process.exitCode = 1;
          break;
        }
        await sleep(30000);
        continue;
      }
      await sleep(options.sleepMs);
      continue;
    }
    {
      if (options.dryRun) break;
      if (options.untilDone) {
        if (!processed) {
          console.log("Sin cartas vencidas. Modo until-done terminado.");
          reportRun(stats, await loadCacheStatus(options));
          if (stats.reviewed > 0 && stats.failed === stats.reviewed) process.exitCode = 1;
          break;
        }
        continue;
      }
      if (!options.loop) break;
      if (processed) continue;
      console.log(`Sin cartas vencidas. Proxima revision en ${Math.round(options.sleepMs / 60000)} min.`);
    }
    await sleep(options.sleepMs);
  } while (true);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
