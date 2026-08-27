import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createOperationalDatabase } from "@ultimoturno/db";

type ImageCandidate = {
  id: string;
  pricecharting_id: string;
  canonical_name: string;
  canonical_expansion: string;
  card_number: string;
  source_url: string;
  source_label: string;
};

type WorkerOptions = {
  dataDir: string;
  imageDir: string;
  progressPath: string;
  batchSize: number;
  concurrency: number;
  loop: boolean;
  sleepMs: number;
};

type Progress = {
  running: boolean;
  startedAt: string;
  updatedAt: string;
  scanned: number;
  downloaded: number;
  skipped: number;
  failed: number;
  bytes: number;
  lastError: string;
};

function parseOptions(argv: string[]): WorkerOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    const value = rest.join("=");
    if (value) values.set(key, value);
    else flags.add(key);
  }
  const defaultDataDir = path.resolve(process.cwd(), "apps", "api", ".data", "ultimoturno-pilot-real");
  const dataDir = path.resolve(values.get("data-dir") || process.env.PGLITE_DATA_DIR || defaultDataDir);
  const defaultImageDir = process.env.PRICECHARTING_IMAGE_DIR || (process.platform === "win32" ? "D:\\UltimoTurno\\pricecharting-images" : path.join(path.dirname(dataDir), "pricecharting-images"));
  return {
    dataDir,
    imageDir: path.resolve(values.get("image-dir") || defaultImageDir),
    progressPath: path.resolve(values.get("progress") || path.join(process.cwd(), "outputs", "card-index-image-progress.json")),
    batchSize: Math.max(1, Math.min(1000, Math.floor(Number(values.get("batch") || 250)))),
    concurrency: Math.max(1, Math.min(20, Math.floor(Number(values.get("concurrency") || 6)))),
    loop: flags.has("loop"),
    sleepMs: Math.max(0, Math.floor(Number(values.get("sleep-ms") || 500)))
  };
}

async function loadCandidates(db: PGlite, limit: number): Promise<ImageCandidate[]> {
  const result = await db.query<Record<string, unknown>>(`
    select id, pricecharting_id, canonical_name, canonical_expansion, card_number,
      coalesce(nullif(tcgplayer_image_url, ''), nullif(pricecharting_image_url, ''), nullif(image_url, '')) as source_url,
      case
        when coalesce(tcgplayer_image_url, '') <> '' then 'tcgplayer'
        when coalesce(pricecharting_image_url, '') <> '' then 'pricecharting'
        else image_source
      end as source_label
    from card_index_entries
    where coalesce(image_url, '') <> ''
      and image_url not like '/pricecharting-images/files/%'
      and coalesce(nullif(tcgplayer_image_url, ''), nullif(pricecharting_image_url, ''), nullif(image_url, '')) like 'http%'
    order by
      case when match_status = 'matched' then 0 when match_status = 'weak_match' then 1 else 2 end,
      case when coalesce(tcgplayer_image_url, '') <> '' then 0 else 1 end,
      match_confidence desc,
      canonical_name
    limit $1
  `, [limit]);
  return result.rows.map((row) => ({
    id: String(row.id || ""),
    pricecharting_id: String(row.pricecharting_id || ""),
    canonical_name: String(row.canonical_name || ""),
    canonical_expansion: String(row.canonical_expansion || ""),
    card_number: String(row.card_number || ""),
    source_url: String(row.source_url || ""),
    source_label: String(row.source_label || "external")
  }));
}

async function downloadImage(candidate: ImageCandidate, imageDir: string) {
  const response = await fetch(candidate.source_url, {
    headers: { "User-Agent": "UltimoTurnoCardIndexImageWorker/0.1.0" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) throw new Error(`No es imagen: ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("Imagen vacia");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const fileName = `${safeFilePart(candidate.pricecharting_id || candidate.id)}.${ext}`;
  const localPath = path.join(imageDir, fileName);
  await mkdir(imageDir, { recursive: true });
  await writeFile(localPath, bytes);
  const contentHash = crypto.createHash("sha256").update(bytes).digest("hex");
  return {
    localPath,
    publicUrl: `/pricecharting-images/files/${fileName}`,
    contentType,
    byteSize: bytes.length,
    contentHash
  };
}

async function recordSuccess(db: PGlite, candidate: ImageCandidate, result: Awaited<ReturnType<typeof downloadImage>>) {
  await db.query(`
    update card_index_entries
    set image_url = $2,
      image_source = $3,
      updated_at = now(),
      last_verified_at = now()
    where id = $1
  `, [candidate.id, result.publicUrl, `${candidate.source_label}-local`]);

  await db.query(`
    insert into pricecharting_image_cache (
      pricecharting_id, status, priority, source_page_url, source_image_url,
      local_path, public_url, content_type, byte_size, content_hash,
      attempts, last_attempt_at, next_attempt_at, downloaded_at, created_at, updated_at
    ) values ($1, 'downloaded', 50, '', $2, $3, $4, $5, $6, $7, 1, now(), now(), now(), now(), now())
    on conflict (pricecharting_id) do update set
      status = 'downloaded',
      source_image_url = excluded.source_image_url,
      local_path = excluded.local_path,
      public_url = excluded.public_url,
      content_type = excluded.content_type,
      byte_size = excluded.byte_size,
      content_hash = excluded.content_hash,
      attempts = pricecharting_image_cache.attempts + 1,
      error_message = '',
      last_attempt_at = now(),
      next_attempt_at = now(),
      downloaded_at = now(),
      updated_at = now()
  `, [
    candidate.pricecharting_id,
    `${candidate.source_label}:${candidate.source_url}`,
    result.localPath,
    result.publicUrl,
    result.contentType,
    result.byteSize,
    result.contentHash
  ]);
}

async function recordFailure(db: PGlite, candidate: ImageCandidate, error: string) {
  await db.query(`
    insert into pricecharting_image_cache (
      pricecharting_id, status, priority, source_page_url, source_image_url,
      attempts, error_message, last_attempt_at, next_attempt_at, created_at, updated_at
    ) values ($1, 'failed', 200, '', $2, 1, $3, now(), now() + interval '1 day', now(), now())
    on conflict (pricecharting_id) do update set
      status = case when pricecharting_image_cache.status = 'downloaded' then 'downloaded' else 'failed' end,
      attempts = pricecharting_image_cache.attempts + 1,
      error_message = $3,
      last_attempt_at = now(),
      next_attempt_at = now() + interval '1 day',
      updated_at = now()
  `, [candidate.pricecharting_id, `${candidate.source_label}:${candidate.source_url}`, error.slice(0, 1000)]);
}

async function writeProgress(progressPath: string, progress: Progress) {
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeFile(progressPath, JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }, null, 2), "utf8");
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

function safeFilePart(value: string): string {
  return String(value || crypto.randomUUID()).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const db = await createOperationalDatabase({ dataDir: options.dataDir });
  const startedAt = new Date().toISOString();
  const progress: Progress = {
    running: true,
    startedAt,
    updatedAt: startedAt,
    scanned: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    bytes: 0,
    lastError: ""
  };
  await writeProgress(options.progressPath, progress);
  try {
    do {
      const candidates = await loadCandidates(db, options.batchSize);
      if (!candidates.length) break;
      await mapConcurrent(candidates, options.concurrency, async (candidate) => {
        progress.scanned++;
        try {
          const result = await downloadImage(candidate, options.imageDir);
          await recordSuccess(db, candidate, result);
          progress.downloaded++;
          progress.bytes += result.byteSize;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          progress.failed++;
          progress.lastError = `${candidate.pricecharting_id}: ${message}`;
          await recordFailure(db, candidate, message).catch(() => {});
        }
      });
      await writeProgress(options.progressPath, progress);
      console.log(`[${new Date().toLocaleTimeString("es-AR", { hour12: false })}] descargadas=${progress.downloaded} fallidas=${progress.failed} bytes=${progress.bytes}`);
      if (!options.loop) break;
      await sleep(options.sleepMs);
    } while (true);
    progress.running = false;
    await writeProgress(options.progressPath, progress);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
