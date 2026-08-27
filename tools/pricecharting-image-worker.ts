type ImageSourceMode = "external-index" | "pricecharting-url" | "pricecharting-storage" | "auto";
type SaveMode = "url" | "local";

type ImageStatus = {
  totalEntries: number;
  pendingEntries: number;
  urlEntries: number;
  downloadedEntries: number;
  failedEntries: number;
  bytesStored: number;
  stockLinkedEntries: number;
};

type WorkerResult = {
  ok: boolean;
  processed: number;
  urlFound?: number;
  downloaded?: number;
  skipped?: number;
  failed: number;
  rateLimited?: boolean;
  cooldownUntil?: string;
  status: ImageStatus;
  index?: { builtAt: string; providers: string[]; cards: number; errors: string[] };
  error?: string;
};

type ExternalIndexStatus = {
  exists: boolean;
  fresh: boolean;
  path: string;
  builtAt: string;
  providers: string[];
  cards: number;
  errors: string[];
};

type WorkerOptions = {
  apiBaseUrl: string;
  saveMode: SaveMode;
  sourceMode: ImageSourceMode;
  includeAll: boolean;
  rebuildIndex: boolean;
  batchSize: number;
  concurrency: number;
  loop: boolean;
  delayMs: number;
  sleepMs: number;
};

function parseOptions(argv: string[]): WorkerOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...rawValue] = arg.slice(2).split("=");
    const key = rawKey.trim();
    const value = rawValue.join("=").trim();
    if (value) values.set(key, value);
    else flags.add(key);
  }
  const saveMode = values.get("save") === "local" ? "local" : "url";
  const rawSource = values.get("source") || "pricecharting-url";
  const sourceMode: ImageSourceMode = rawSource === "external-index" || rawSource === "pricecharting-storage" || rawSource === "auto" ? rawSource : "pricecharting-url";
  return {
    apiBaseUrl: (values.get("api") || process.env.ULTIMOTURNO_API_URL || "http://localhost:4000").replace(/\/+$/g, ""),
    saveMode,
    sourceMode,
    includeAll: !flags.has("stock-only"),
    rebuildIndex: flags.has("rebuild-index"),
    batchSize: Math.max(1, Math.min(5000, Number(values.get("batch") || (saveMode === "url" && sourceMode === "external-index" ? 1000 : saveMode === "url" ? 500 : 50)))),
    concurrency: Math.max(1, Math.min(20, Number(values.get("concurrency") || (saveMode === "url" && sourceMode !== "pricecharting-storage" ? 1 : 4)))),
    loop: flags.has("loop") || flags.has("continuous"),
    delayMs: Math.max(0, Number(values.get("delay-ms") || (saveMode === "url" && sourceMode !== "pricecharting-storage" ? 1100 : 0))),
    sleepMs: Math.max(0, Number(values.get("sleep-ms") || 1000))
  };
}

function showHelp() {
  console.log(`
UltimoTurno PriceCharting image worker

Uso:
  Traer URLs Imagenes PriceCharting.cmd
  npx tsx tools\\pricecharting-image-worker.ts --save=url --source=external-index --batch=1000 --loop
  npx tsx tools\\pricecharting-image-worker.ts --save=url --source=pricecharting-url --batch=200 --concurrency=1 --delay-ms=1100 --loop
  npx tsx tools\\pricecharting-image-worker.ts --save=local --source=auto --batch=50 --concurrency=4 --loop

Opciones:
  --source=external-index     Usa catalogo masivo PokemonTCG/TCGdex y no toca PriceCharting.
  --save=url                  Guarda solo la URL real de Google/PriceCharting. Rapido, ideal primera pasada.
  --save=local                Descarga archivos locales usando URLs ya encontradas cuando existan.
  --source=pricecharting-url  Lee la pagina canonica y extrae el 1600.jpg, igual que legacy.
  --source=pricecharting-storage Prueba directo Google Storage por PriceCharting ID.
  --source=auto               Prueba Storage y despues la pagina de PriceCharting.
  --stock-only                Prioriza solo cartas cargadas en stock.
  --rebuild-index             Reconstruye el indice externo aunque exista cache local.
  --batch=500                 Tamanio de tanda.
  --concurrency=8             Pedidos simultaneos.
  --delay-ms=1100             Pausa entre cartas cuando se usa PriceCharting HTML.
  --api=http://localhost:4000 API local.
  --loop                      Sigue corriendo hasta que no haya mas pendientes.
`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15 * 60 * 1000)
  });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return payload;
}

function endpoint(options: WorkerOptions): string {
  if (options.saveMode === "url" && options.sourceMode === "external-index") return "/pricecharting-images/external-index";
  return options.saveMode === "url" ? "/pricecharting-images/discover" : "/pricecharting-images/process";
}

function requestBody(options: WorkerOptions) {
  if (options.saveMode === "url" && options.sourceMode === "external-index") {
    return {
      batchSize: options.batchSize,
      includeAll: options.includeAll,
      rebuild: options.rebuildIndex
    };
  }
  if (options.saveMode === "url") {
    return {
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      delayMs: options.delayMs,
      includeAll: options.includeAll,
      sourceMode: options.sourceMode
    };
  }
  return {
    batchSize: options.batchSize,
    concurrency: options.concurrency,
    includeAll: options.includeAll,
    mode: "auto"
  };
}

function printProgress(result: WorkerResult, elapsedMs: number) {
  const status = result.status;
  const found = Math.max(status.urlEntries, status.downloadedEntries);
  const saved = result.urlFound ?? result.downloaded ?? 0;
  const label = result.urlFound !== undefined ? "urls" : "local";
  const stamp = new Date().toLocaleTimeString("es-AR", { hour12: false });
  console.log(
    `[${stamp}] tanda=${result.processed} ${label}=${saved} omitidas=${result.skipped || 0} fallidas=${result.failed || 0} ` +
    `total-url=${status.urlEntries}/${status.totalEntries} locales=${status.downloadedEntries} ` +
    `pendientes=${status.pendingEntries} disco=${formatBytes(status.bytesStored)} ` +
    `avance=${status.totalEntries ? Math.round((found / status.totalEntries) * 100) : 0}% ` +
    `tiempo=${(elapsedMs / 1000).toFixed(1)}s`
  );
  if (result.rateLimited && result.cooldownUntil) {
    console.log(`PriceCharting pidio pausa hasta ${result.cooldownUntil}. El worker va a esperar y reintentar solo.`);
  }
  if (result.index) {
    console.log(`Indice externo: ${result.index.cards.toLocaleString("es-AR")} cartas, proveedores=${result.index.providers.join(", ") || "auto"}.`);
    for (const error of result.index.errors.slice(0, 3)) console.log(`Indice aviso: ${error}`);
  }
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function cooldownWaitMs(result: WorkerResult): number {
  if (!result.rateLimited || !result.cooldownUntil) return 0;
  const until = Date.parse(result.cooldownUntil);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now() + 1000);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    return;
  }
  const options = parseOptions(process.argv.slice(2));
  const health = await getJson<{ ok?: boolean; environment?: unknown }>(`${options.apiBaseUrl}/health`);
  if (!health) throw new Error(`La API no respondio en ${options.apiBaseUrl}.`);
  console.log(`Worker conectado a ${options.apiBaseUrl}. Modo=${options.saveMode}, fuente=${options.sourceMode}, batch=${options.batchSize}, concurrencia=${options.concurrency}.`);
  if (options.sourceMode === "external-index") {
    try {
      const status = await getJson<{ index?: ExternalIndexStatus }>(`${options.apiBaseUrl}/pricecharting-images/external-index/status`);
      const index = status.index;
      if (index?.exists) {
        console.log(`Indice externo local: ${index.cards.toLocaleString("es-AR")} cartas, creado ${index.builtAt || "sin fecha"}.`);
        if (!index.fresh) console.log("El indice existe pero es viejo; usa --rebuild-index solo si queres reconstruirlo.");
        for (const error of (index.errors || []).slice(0, 2)) console.log(`Indice aviso previo: ${error}`);
      } else {
        console.log("No hay indice externo local todavia. La primera tanda lo va a construir y puede tardar varios minutos.");
        console.log("Deja esta ventana abierta; cuando termine el indice empiezan las tandas rapidas.");
      }
    } catch {
      console.log("No pude leer el estado del indice externo. Sigo igual con el procesamiento.");
    }
  }
  do {
    const startedAt = Date.now();
    const result = await postJson<WorkerResult>(`${options.apiBaseUrl}${endpoint(options)}`, requestBody(options));
    printProgress(result, Date.now() - startedAt);
    const waitMs = cooldownWaitMs(result);
    if (waitMs > 0 && options.loop) {
      console.log(`Esperando ${(waitMs / 60000).toFixed(1)} minutos antes de la proxima tanda.`);
      await sleep(waitMs);
      continue;
    }
    if (!result.processed) break;
    if (!options.loop) break;
    await sleep(options.sleepMs);
  } while (true);
  console.log("Worker finalizado.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
