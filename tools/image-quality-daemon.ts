import { spawn } from "node:child_process";

type ImageStatus = {
  totalEntries: number;
  pendingEntries: number;
  urlEntries: number;
  downloadedEntries: number;
  failedEntries: number;
  bytesStored: number;
  stockLinkedEntries: number;
};

type ImageQuality = {
  summary: {
    stockItemsMissingImage: number;
    stockItemsMissingImageWithPriceCharting: number;
    productsUsingLocalImageUrls: number;
    openClaimCardsMissingImage: number;
    catalogEntries: number;
    catalogEntriesWithAnyImage: number;
    imageCacheFailed: number;
  };
};

type BatchResult = {
  ok: boolean;
  processed: number;
  urlFound?: number;
  downloaded?: number;
  skipped?: number;
  failed: number;
  status: ImageStatus;
  rateLimited?: boolean;
  cooldownUntil?: string;
};

type Options = {
  apiBaseUrl: string;
  accessKey: string;
  loop: boolean;
  includeAll: boolean;
  skipUpload: boolean;
  urlBatch: number;
  localBatch: number;
  concurrency: number;
  sleepMs: number;
  uploadEvery: number;
  uploadLimit: number;
  uploadConcurrency: number;
};

function parseOptions(argv: string[]): Options {
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
  return {
    apiBaseUrl: (values.get("api") || process.env.ULTIMOTURNO_API_URL || "http://localhost:4000").replace(/\/+$/g, ""),
    accessKey: values.get("access-key") || process.env.ULTIMOTURNO_ACCESS_KEY || "",
    loop: flags.has("loop") || flags.has("continuous"),
    includeAll: flags.has("all") || flags.has("catalog"),
    skipUpload: flags.has("no-upload") || flags.has("local-only"),
    urlBatch: clampNumber(values.get("url-batch"), 1, 5000, 1000),
    localBatch: clampNumber(values.get("local-batch"), 1, 500, 80),
    concurrency: clampNumber(values.get("concurrency"), 1, 12, 4),
    sleepMs: clampNumber(values.get("sleep-ms"), 1000, 60 * 60 * 1000, 30000),
    uploadEvery: clampNumber(values.get("upload-every"), 1, 1000, 3),
    uploadLimit: clampNumber(values.get("upload-limit"), 0, 1000000, 1000),
    uploadConcurrency: clampNumber(values.get("upload-concurrency"), 1, 16, 4)
  };
}

function showHelp() {
  console.log(`
UltimoTurno image quality daemon

Uso recomendado:
  npm run images:quality:daemon -- --loop

Que hace:
  1. Busca URLs de imagen para cartas prioritarias usando el indice externo.
  2. Descarga imagenes a tu PC en PRICECHARTING_IMAGE_DIR.
  3. Cada algunos ciclos sube a Supabase Storage si las variables estan configuradas.
  4. Repite mientras la ventana queda abierta.

Opciones:
  --loop                    Dejar corriendo.
  --all                     Procesar catalogo completo, no solo stock/claims.
  --local-only              Descargar local pero no subir a Supabase.
  --api=http://localhost:4000
  --url-batch=1000          Tanda para descubrir URLs.
  --local-batch=80          Tanda para descargar archivos locales.
  --concurrency=4           Descargas simultaneas.
  --upload-every=3          Subir a Supabase cada N ciclos.
  --upload-limit=1000       Maximo de archivos por subida, 0 sin limite.
  --sleep-ms=30000          Pausa entre ciclos en modo loop.

Variables Supabase opcionales para subir:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_STORAGE_BUCKET=ultimoturno-images
  PRICECHARTING_IMAGE_DIR=D:\\UltimoTurno\\pricecharting-images
`);
}

function clampNumber(raw: string | undefined, min: number, max: number, fallback: number) {
  const parsed = Number(raw || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function authHeaders(options: Options) {
  return {
    "Content-Type": "application/json",
    ...(options.accessKey ? { "X-UltimoTurno-Access-Key": options.accessKey } : {})
  };
}

async function getJson<T>(options: Options, path: string): Promise<T> {
  const response = await fetch(`${options.apiBaseUrl}${path}`, {
    headers: authHeaders(options),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`GET ${path} -> HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function postJson<T>(options: Options, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${options.apiBaseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(options),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20 * 60 * 1000)
  });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`POST ${path} -> HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function hasSupabaseEnv() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

async function runSupabaseUpload(options: Options) {
  if (options.skipUpload) {
    console.log("Supabase: omitido por --local-only.");
    return;
  }
  if (!hasSupabaseEnv()) {
    console.log("Supabase: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY; dejo las imagenes solo en la PC.");
    return;
  }
  const env = {
    ...process.env,
    SUPABASE_UPLOAD_DRY_RUN: "false",
    SUPABASE_UPDATE_IMAGE_URLS: "true",
    SUPABASE_UPDATE_REFERENCED_ONLY: options.includeAll ? "false" : "true",
    SUPABASE_UPLOAD_LIMIT: String(options.uploadLimit),
    SUPABASE_UPLOAD_CONCURRENCY: String(options.uploadConcurrency)
  };
  console.log(`Supabase: subiendo imagenes (${options.includeAll ? "catalogo completo" : "solo referenciadas"}, limite=${options.uploadLimit || "sin limite"})...`);
  await new Promise<void>((resolve, reject) => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npm, ["run", "images:supabase:upload"], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      windowsHide: true
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Uploader Supabase termino con codigo ${code}`));
    });
  });
}

function printQuality(quality: ImageQuality, status: ImageStatus) {
  const summary = quality.summary;
  const coverage = summary.catalogEntries ? Math.round((summary.catalogEntriesWithAnyImage / summary.catalogEntries) * 100) : 0;
  const stamp = new Date().toLocaleTimeString("es-AR", { hour12: false });
  console.log(
    `[${stamp}] stock-sin-img=${summary.stockItemsMissingImage} ` +
    `stock-con-PC=${summary.stockItemsMissingImageWithPriceCharting} ` +
    `claim-sin-img=${summary.openClaimCardsMissingImage} ` +
    `locales-riesgo=${summary.productsUsingLocalImageUrls} ` +
    `catalogo-img=${coverage}% fallidas=${summary.imageCacheFailed} ` +
    `cache-url=${status.urlEntries} local=${status.downloadedEntries} disco=${formatBytes(status.bytesStored)}`
  );
}

function printBatch(label: string, result: BatchResult) {
  const solved = result.urlFound ?? result.downloaded ?? 0;
  console.log(`${label}: procesadas=${result.processed} resueltas=${solved} omitidas=${result.skipped || 0} fallidas=${result.failed}`);
}

function cooldownWaitMs(result: BatchResult): number {
  if (!result.rateLimited || !result.cooldownUntil) return 0;
  const until = Date.parse(result.cooldownUntil);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now() + 1000);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle(options: Options, cycle: number) {
  const quality = await getJson<ImageQuality>(options, "/database-quality/images");
  const status = await getJson<ImageStatus>(options, "/pricecharting-images/status");
  printQuality(quality, status);

  const discover = await postJson<BatchResult>(options, "/pricecharting-images/external-index", {
    batchSize: options.urlBatch,
    includeAll: options.includeAll
  });
  printBatch("URLs", discover);

  const local = await postJson<BatchResult>(options, "/pricecharting-images/process", {
    batchSize: options.localBatch,
    concurrency: options.concurrency,
    includeAll: options.includeAll,
    mode: "auto",
    onlyWithSourceImageUrl: true
  });
  printBatch("Local", local);

  if (cycle % options.uploadEvery === 0 || (local.downloaded || 0) > 0) {
    await runSupabaseUpload(options);
  }

  const waitMs = Math.max(cooldownWaitMs(discover), cooldownWaitMs(local));
  if (waitMs > 0) {
    console.log(`Pausa por limite externo: ${(waitMs / 60000).toFixed(1)} minutos.`);
    await sleep(waitMs);
  }
  return discover.processed + local.processed;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    return;
  }
  const options = parseOptions(process.argv.slice(2));
  await getJson(options, "/health");
  console.log(`Daemon conectado a ${options.apiBaseUrl}. Prioridad=${options.includeAll ? "catalogo completo" : "stock/claims primero"}.`);
  console.log(`Local: ${process.env.PRICECHARTING_IMAGE_DIR || "D:/UltimoTurno/pricecharting-images"}. Supabase: ${options.skipUpload ? "desactivado" : hasSupabaseEnv() ? "activado" : "sin credenciales"}.`);
  let cycle = 1;
  do {
    console.log(`\nCiclo ${cycle}`);
    const processed = await runCycle(options, cycle);
    if (!options.loop) break;
    if (processed === 0) console.log(`Sin trabajo nuevo. Vuelvo a revisar en ${(options.sleepMs / 1000).toFixed(0)}s.`);
    await sleep(options.sleepMs);
    cycle += 1;
  } while (true);
  console.log("Daemon finalizado.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
