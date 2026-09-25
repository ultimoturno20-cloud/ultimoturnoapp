import { findCoolstuffExpansionUrl, matchCoolstuffProduct, parseCoolstuffExpansionLinks, parseCoolstuffPageCount, parseCoolstuffProducts, type CoolstuffExpansionLink, type CoolstuffPriceTarget, type CoolstuffProduct } from "../packages/importers/src/index.js";

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
  sleepMs: number;
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

function parseOptions(argv: string[]): Options {
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
    apiBaseUrl: (values.get("api") || process.env.npm_config_api || process.env.ULTIMOTURNO_API_URL || "https://ultimoturnoapp-api.vercel.app/api").replace(/\/+$/, ""),
    accessKey: values.get("access-key") || process.env.ULTIMOTURNO_ACCESS_KEY || "",
    batchSize: clamp(values.get("batch") || process.env.npm_config_batch, 1, 100, 20),
    delayMs: clamp(values.get("delay-ms") || process.env.npm_config_delay_ms, 5000, 60000, 10000),
    refreshHours: clamp(values.get("refresh-hours") || process.env.npm_config_refresh_hours, 6, 24 * 30, 24),
    loop: flags.has("loop") || process.env.npm_config_loop === "true",
    sleepMs: clamp(values.get("sleep-ms") || process.env.npm_config_sleep_ms, 60000, 24 * 60 * 60 * 1000, 60 * 60 * 1000),
    dryRun: flags.has("dry-run") || process.env.npm_config_dry_run === "true"
  };
}

function clamp(raw: string | undefined, minimum: number, maximum: number, fallback: number) {
  const value = Number(raw || fallback);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
}

function showHelp() {
  console.log(`
UltimoTurno CoolStuff price worker

Uso recomendado:
  npm run coolstuff:prices:daemon

El worker procesa solo cartas inglesas con stock, conserva el progreso en
Supabase y espera 10 segundos entre consultas a CoolStuff.

Opciones:
  --batch=20
  --delay-ms=10000
  --refresh-hours=24
  --loop
  --sleep-ms=3600000
  --dry-run
  --api=https://ultimoturnoapp-api.vercel.app/api

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

async function fetchCoolstuffHtml(options: Options, url: URL | string) {
  const waitMs = Math.max(0, options.delayMs - (Date.now() - lastCoolstuffRequestAt));
  if (waitMs) await sleep(waitMs);
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
  const html = await fetchCoolstuffHtml(options, "https://www.coolstuffinc.com/pokemon/");
  const links = parseCoolstuffExpansionLinks(html);
  if (!links.length) throw new Error("No se pudo leer el indice de expansiones de CoolStuff.");
  return links;
}

async function loadExpansionProducts(options: Options, expansionUrl: string): Promise<CoolstuffProduct[]> {
  const firstUrl = new URL(expansionUrl);
  firstUrl.searchParams.set("sh", "1");
  firstUrl.searchParams.set("page", "1");
  const firstHtml = await fetchCoolstuffHtml(options, firstUrl);
  const products = parseCoolstuffProducts(firstHtml);
  const pageCount = parseCoolstuffPageCount(firstHtml, firstUrl.toString());
  for (let page = 2; page <= pageCount; page++) {
    const pageUrl = new URL(firstUrl);
    pageUrl.searchParams.set("page", String(page));
    products.push(...parseCoolstuffProducts(await fetchCoolstuffHtml(options, pageUrl)));
  }
  if (!products.length) throw new Error("La expansion CoolStuff no devolvio productos con precio.");
  return products;
}

async function searchCoolstuff(target: WorkerTarget, options: Options, expansionLinks: CoolstuffExpansionLink[], expansionCache: Map<string, Promise<CoolstuffProduct[]>>) {
  const expansionUrl = findCoolstuffExpansionUrl(target.expansion, expansionLinks);
  if (!expansionUrl) throw new Error(`No se encontro una expansion CoolStuff confiable para ${target.expansion}.`);
  let pending = expansionCache.get(expansionUrl);
  if (!pending) {
    pending = loadExpansionProducts(options, expansionUrl);
    expansionCache.set(expansionUrl, pending);
  }
  try {
    return await pending;
  } catch (error) {
    expansionCache.delete(expansionUrl);
    throw error;
  }
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

async function runCycle(options: Options) {
  const response = await getJson<{ targets: WorkerTarget[]; status: { matchedEntries: number; totalEntries: number } }>(options, `/coolstuff-prices/targets?limit=${options.batchSize}&refreshHours=${options.refreshHours}`);
  console.log(`[${new Date().toLocaleString("es-AR")}] CoolStuff cache: ${response.status.matchedEntries}/${response.status.totalEntries} con precio. Pendientes en tanda: ${response.targets.length}.`);
  if (!response.targets.length) return 0;
  const expansionLinks = await loadExpansionLinks(options);
  const expansionCache = new Map<string, Promise<CoolstuffProduct[]>>();
  let matched = 0;
  let reviewed = 0;
  for (const target of response.targets) {
    let observation: Observation;
    try {
      const match = matchCoolstuffProduct(target, await searchCoolstuff(target, options, expansionLinks, expansionCache));
      observation = observationForMatch(target, match);
      if (observation.status === "matched") matched++;
      console.log(`${target.name} ${target.number} [${target.condition}/${target.finish}] -> ${observation.status}${observation.priceUsd ? ` USD ${observation.priceUsd.toFixed(2)}` : ""}`);
    } catch (error) {
      observation = failedObservation(target, error);
      console.error(`${target.name}: ${observation.errorMessage}`);
    }
    reviewed++;
    if (!options.dryRun) await postJson(options, "/coolstuff-prices/observations", { observations: [observation] });
  }
  console.log(`Tanda terminada: revisadas=${reviewed}, precios=${matched}, modo=${options.dryRun ? "simulacion" : "guardado"}.`);
  return reviewed;
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
  console.log(`Worker conectado a ${options.apiBaseUrl}. Pausa CoolStuff: ${Math.round(options.delayMs / 1000)}s.`);
  do {
    const processed = await runCycle(options);
    if (!options.loop) break;
    if (!processed) console.log(`Sin cartas vencidas. Proxima revision en ${Math.round(options.sleepMs / 60000)} min.`);
    await sleep(options.sleepMs);
  } while (true);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
