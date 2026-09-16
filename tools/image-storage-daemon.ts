import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type ImageQuality = {
  summary: {
    stockItemsMissingImage: number;
    openClaimCardsMissingImage: number;
    catalogEntries: number;
    catalogEntriesWithAnyImage: number;
    imageCacheFailed: number;
  };
};

type Candidate = {
  priceChartingId: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
  sourceImageUrl: string;
  status: string;
};

type Options = {
  apiBaseUrl: string;
  accessKey: string;
  loop: boolean;
  includeAll: boolean;
  candidateBatch: number;
  urlBatch: number;
  concurrency: number;
  sleepMs: number;
  imageDir: string;
  supabaseUrl: string;
  serviceKey: string;
  bucket: string;
  skipUpload: boolean;
};

type DownloadedImage = {
  fileName: string;
  fullPath: string;
  sourceImageUrl: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
  contentHash: string;
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
    apiBaseUrl: (values.get("api") || process.env.ULTIMOTURNO_API_URL || "https://ultimoturnoapp-api.vercel.app/api").replace(/\/+$/g, ""),
    accessKey: values.get("access-key") || process.env.ULTIMOTURNO_ACCESS_KEY || "",
    loop: flags.has("loop") || flags.has("continuous"),
    includeAll: flags.has("all") || flags.has("catalog"),
    candidateBatch: clampNumber(values.get("batch"), 1, 500, 80),
    urlBatch: clampNumber(values.get("url-batch"), 1, 5000, 1000),
    concurrency: clampNumber(values.get("concurrency"), 1, 12, 4),
    sleepMs: clampNumber(values.get("sleep-ms"), 1000, 60 * 60 * 1000, 60000),
    imageDir: path.resolve(values.get("image-dir") || process.env.PRICECHARTING_IMAGE_DIR || "D:/UltimoTurno/pricecharting-images"),
    supabaseUrl: normalizeSupabaseUrl(env("SUPABASE_URL")),
    serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || "ultimoturno-images",
    skipUpload: flags.has("no-upload")
  };
}

function showHelp() {
  console.log(`
UltimoTurno image storage daemon

Uso recomendado:
  npm run images:storage:daemon -- --loop

Que hace:
  1. Pide a la API online que descubra URLs de imagen.
  2. Descarga esas imagenes a tu PC.
  3. Las sube a Supabase Storage.
  4. Enlaza la URL publica en cache, stock y claims.
  5. Repite mientras la ventana queda abierta.

Opciones:
  --loop                       Dejar corriendo.
  --all                        Procesar catalogo completo, no solo stock/claims.
  --api=https://.../api
  --batch=80                   Imagenes locales por ciclo.
  --url-batch=1000             URLs a descubrir por ciclo.
  --concurrency=4              Descargas/subidas simultaneas.
  --sleep-ms=60000             Pausa entre ciclos.
  --no-upload                  Descargar local sin subir/enlazar.

Variables requeridas:
  ULTIMOTURNO_ACCESS_KEY
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

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function normalizeSupabaseUrl(value: string) {
  return value.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function authHeaders(options: Options) {
  return {
    "Content-Type": "application/json",
    ...(options.accessKey ? { "X-UltimoTurno-Access-Key": options.accessKey } : {})
  };
}

async function getJson<T>(options: Options, route: string): Promise<T> {
  const response = await fetch(`${options.apiBaseUrl}${route}`, {
    headers: authHeaders(options),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`GET ${route} -> HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function postJson<T>(options: Options, route: string, body: unknown): Promise<T> {
  const response = await fetch(`${options.apiBaseUrl}${route}`, {
    method: "POST",
    headers: authHeaders(options),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20 * 60 * 1000)
  });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`POST ${route} -> HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function supabaseHeaders(options: Options) {
  return {
    apikey: options.serviceKey,
    Authorization: `Bearer ${options.serviceKey}`
  };
}

function unwrapImageSourceUrl(value: string): string {
  const tagged = value.match(/^(?:pokemontcg|tcgdex):[^:]+:(https?:\/\/.+)$/i);
  return tagged ? tagged[1] : value;
}

function safeFilePart(value: string): string {
  return String(value || crypto.randomUUID()).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80);
}

function extensionFor(contentType: string) {
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  return "jpg";
}

async function downloadCandidate(options: Options, candidate: Candidate): Promise<DownloadedImage> {
  const sourceUrl = unwrapImageSourceUrl(candidate.sourceImageUrl);
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "UltimoTurnoImageStorageDaemon/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`${candidate.priceChartingId}: imagen HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) throw new Error(`${candidate.priceChartingId}: no es imagen (${contentType})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`${candidate.priceChartingId}: imagen vacia`);
  const fileName = `${safeFilePart(candidate.priceChartingId)}.${extensionFor(contentType)}`;
  await mkdir(options.imageDir, { recursive: true });
  const fullPath = path.join(options.imageDir, fileName);
  await writeFile(fullPath, bytes);
  const publicUrl = `${options.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(options.bucket)}/${encodeURIComponent(fileName)}`;
  return {
    fileName,
    fullPath,
    sourceImageUrl: candidate.sourceImageUrl,
    publicUrl,
    contentType,
    byteSize: bytes.length,
    contentHash: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

async function uploadToSupabase(options: Options, image: DownloadedImage) {
  if (options.skipUpload) return false;
  const infoUrl = `${options.supabaseUrl}/storage/v1/object/info/${encodeURIComponent(options.bucket)}/${encodeURIComponent(image.fileName)}`;
  const existing = await fetch(infoUrl, {
    method: "HEAD",
    headers: supabaseHeaders(options)
  });
  if (existing.ok) return false;

  const uploadUrl = `${options.supabaseUrl}/storage/v1/object/${encodeURIComponent(options.bucket)}/${encodeURIComponent(image.fileName)}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      ...supabaseHeaders(options),
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "false"
    },
    body: createReadStream(image.fullPath) as unknown as BodyInit,
    ...({ duplex: "half" } as RequestInit)
  } as RequestInit);
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 409 || text.includes("KeyAlreadyExists")) return false;
    throw new Error(`${image.fileName}: Supabase HTTP ${response.status}: ${text}`);
  }
  return true;
}

async function linkPublicUrl(options: Options, candidate: Candidate, image: DownloadedImage) {
  if (options.skipUpload) return;
  await postJson(options, `/pricecharting-images/${encodeURIComponent(candidate.priceChartingId)}/link-public`, {
    publicUrl: image.publicUrl,
    sourceImageUrl: candidate.sourceImageUrl,
    localPath: image.fullPath,
    contentType: image.contentType,
    byteSize: image.byteSize,
    contentHash: image.contentHash
  });
}

async function mapConcurrent<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const current = index++;
      if (current >= items.length) return;
      await fn(items[current]);
    }
  });
  await Promise.all(workers);
}

function formatQuality(quality: ImageQuality) {
  const coverage = quality.summary.catalogEntries
    ? Math.round((quality.summary.catalogEntriesWithAnyImage / quality.summary.catalogEntries) * 100)
    : 0;
  return `stock-sin-img=${quality.summary.stockItemsMissingImage} claim-sin-img=${quality.summary.openClaimCardsMissingImage} catalogo-img=${coverage}% fallidas=${quality.summary.imageCacheFailed}`;
}

async function runCycle(options: Options) {
  const quality = await getJson<ImageQuality>(options, "/database-quality/images");
  console.log(`[${new Date().toLocaleTimeString("es-AR", { hour12: false })}] ${formatQuality(quality)}`);

  const discover = await postJson<{ processed: number; urlFound?: number; skipped?: number; failed: number }>(options, "/pricecharting-images/external-index", {
    batchSize: options.urlBatch,
    includeAll: options.includeAll
  });
  console.log(`URLs: procesadas=${discover.processed} encontradas=${discover.urlFound || 0} omitidas=${discover.skipped || 0} fallidas=${discover.failed}`);

  const candidates = await getJson<{ entries: Candidate[] }>(options, `/pricecharting-images/download-candidates?limit=${options.candidateBatch}`);
  let downloaded = 0;
  let uploaded = 0;
  let linked = 0;
  let failed = 0;
  await mapConcurrent(candidates.entries, options.concurrency, async (candidate) => {
    try {
      const image = await downloadCandidate(options, candidate);
      downloaded++;
      if (await uploadToSupabase(options, image)) uploaded++;
      await linkPublicUrl(options, candidate, image);
      linked++;
    } catch (error) {
      failed++;
      console.error(`${candidate.priceChartingId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  console.log(`Storage: candidatas=${candidates.entries.length} descargadas=${downloaded} subidas=${uploaded} enlazadas=${linked} fallidas=${failed}`);
  return discover.processed + candidates.entries.length;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    return;
  }
  const options = parseOptions(process.argv.slice(2));
  await getJson(options, "/health");
  console.log(`Daemon conectado a ${options.apiBaseUrl}. Prioridad=${options.includeAll ? "catalogo completo" : "stock/claims primero"}.`);
  console.log(`Imagenes locales: ${options.imageDir}. Supabase: ${options.skipUpload ? "desactivado" : options.bucket}.`);
  do {
    const processed = await runCycle(options);
    if (!options.loop) break;
    if (!processed) console.log(`Sin trabajo nuevo. Vuelvo a revisar en ${(options.sleepMs / 1000).toFixed(0)}s.`);
    await sleep(options.sleepMs);
  } while (true);
  console.log("Daemon finalizado.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
