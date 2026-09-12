import { createReadStream, existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

type ImageFile = {
  fileName: string;
  fullPath: string;
  contentType: string;
  size: number;
};

const supabaseUrl = normalizeSupabaseUrl(env("SUPABASE_URL"));
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "ultimoturno-images";
const imageDir = path.resolve(process.env.PRICECHARTING_IMAGE_DIR || "D:/UltimoTurno/pricecharting-images");
const dryRun = flag("SUPABASE_UPLOAD_DRY_RUN", true);
const updateDatabase = flag("SUPABASE_UPDATE_IMAGE_URLS", false);
const skipUpload = flag("SUPABASE_SKIP_UPLOAD", false);
const updateReferencedOnly = flag("SUPABASE_UPDATE_REFERENCED_ONLY", true);
const createBucket = flag("SUPABASE_CREATE_BUCKET", false);
const publicBucket = flag("SUPABASE_PUBLIC_BUCKET", true);
const overwrite = flag("SUPABASE_UPLOAD_OVERWRITE", false);
const limit = numberEnv("SUPABASE_UPLOAD_LIMIT", 0);
const concurrency = Math.max(1, Math.min(16, numberEnv("SUPABASE_UPLOAD_CONCURRENCY", 4)));
const storageBaseUrl = `${supabaseUrl}/storage/v1`;
const restBaseUrl = `${supabaseUrl}/rest/v1`;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  if (!existsSync(imageDir)) throw new Error(`No existe PRICECHARTING_IMAGE_DIR: ${imageDir}`);

  const files = await listImages(imageDir);
  const referencedFileNames = updateDatabase && updateReferencedOnly
    ? await listReferencedLocalImageFileNames()
    : null;
  const uploadCandidates = referencedFileNames
    ? files.filter((file) => referencedFileNames.has(file.fileName))
    : files;
  const selected = limit > 0 ? uploadCandidates.slice(0, limit) : uploadCandidates;
  const publicBase = `${storageBaseUrl}/object/public/${encodeURIComponent(bucket)}`;

  console.log(JSON.stringify({
    mode: dryRun ? "dry-run" : "apply",
    supabaseUrl,
    bucket,
    imageDir,
    filesFound: files.length,
    referencedFiles: referencedFileNames?.size ?? null,
    filesSelected: selected.length,
    updateDatabase,
    skipUpload,
    createBucket,
    overwrite,
    concurrency
  }, null, 2));

  await assertSupabaseReachable();
  if (createBucket && !dryRun) await ensureBucket();

  if (dryRun) {
    console.log("Dry-run listo: no se subieron archivos ni se actualizo la base.");
    console.log("Ejemplo URL publica:", `${publicBase}/${encodeURIComponent(selected[0]?.fileName || "5862188.png")}`);
    return;
  }

  const summary = { uploaded: 0, existed: 0, failed: 0, databaseUpdated: 0 };
  await runPool(selected, concurrency, async (file, index) => {
    const remotePath = file.fileName;
    const publicUrl = `${publicBase}/${encodeURIComponent(remotePath)}`;
    try {
      if (skipUpload) {
        summary.existed += 1;
      } else {
        const uploaded = await uploadImage(file, remotePath);
        if (uploaded) summary.uploaded += 1;
        else summary.existed += 1;
      }
      if (updateDatabase) {
        summary.databaseUpdated += await updateImageUrls(file.fileName, publicUrl);
      }
      if ((index + 1) % 100 === 0 || index + 1 === selected.length) {
        console.log(`Progreso ${index + 1}/${selected.length}: subidas=${summary.uploaded}, existentes=${summary.existed}, db=${summary.databaseUpdated}, fallidas=${summary.failed}`);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`Fallo ${file.fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  console.log(JSON.stringify(summary, null, 2));
}

async function listReferencedLocalImageFileNames() {
  const names = new Set<string>();
  for (const table of ["card_products", "claim_cards"]) {
    for (let offset = 0; ; offset += 1000) {
      const response = await fetch(`${restBaseUrl}/${table}?select=image_url&image_url=like.${encodeURIComponent("/pricecharting-images/files/%")}&limit=1000&offset=${offset}`, {
        headers: authHeaders()
      });
      if (!response.ok) throw new Error(`No pude leer ${table} (${response.status}): ${await response.text()}`);
      const rows = await response.json() as Array<{ image_url?: string }>;
      for (const row of rows) {
        const fileName = String(row.image_url || "").replace("/pricecharting-images/files/", "").trim();
        if (/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(fileName)) names.add(fileName);
      }
      if (rows.length < 1000) break;
    }
  }
  return names;
}

async function assertSupabaseReachable() {
  const response = await fetch(`${storageBaseUrl}/bucket`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error(`Supabase Storage no respondio OK (${response.status}): ${await response.text()}`);
  }
}

async function ensureBucket() {
  const existing = await fetch(`${storageBaseUrl}/bucket/${encodeURIComponent(bucket)}`, {
    headers: authHeaders()
  });
  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new Error(`No pude verificar bucket (${existing.status}): ${await existing.text()}`);
  }
  const created = await fetch(`${storageBaseUrl}/bucket`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: publicBucket })
  });
  if (!created.ok && created.status !== 409) {
    throw new Error(`No pude crear bucket (${created.status}): ${await created.text()}`);
  }
}

async function uploadImage(file: ImageFile, remotePath: string) {
  if (!overwrite) {
    const existing = await fetch(`${storageBaseUrl}/object/info/${encodeURIComponent(bucket)}/${encodeURIComponent(remotePath)}`, {
      method: "HEAD",
      headers: authHeaders()
    });
    if (existing.ok) return false;
  }

  const response = await fetch(`${storageBaseUrl}/object/${encodeURIComponent(bucket)}/${encodeURIComponent(remotePath)}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": overwrite ? "true" : "false"
    },
    body: createReadStream(file.fullPath) as unknown as BodyInit,
    ...( { duplex: "half" } as RequestInit )
  } as RequestInit);
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 409 || text.includes("KeyAlreadyExists")) return false;
    throw new Error(`upload HTTP ${response.status}: ${text}`);
  }
  return response.ok;
}

async function updateImageUrls(fileName: string, publicUrl: string) {
  const localUrl = `/pricecharting-images/files/${fileName}`;
  const updateCardProducts = await patchRows("card_products", `image_url=eq.${encodeURIComponent(localUrl)}`, { image_url: publicUrl });
  const updateClaimCards = await patchRows("claim_cards", `image_url=eq.${encodeURIComponent(localUrl)}`, { image_url: publicUrl });
  const priceChartingId = fileName.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  const updateCache = await patchRows("pricecharting_image_cache", `pricecharting_id=eq.${encodeURIComponent(priceChartingId)}`, {
    public_url: publicUrl,
    local_path: localUrl
  });
  return updateCardProducts + updateClaimCards + updateCache;
}

async function patchRows(table: string, filter: string, payload: Record<string, string>) {
  const response = await fetch(`${restBaseUrl}/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`PATCH ${table} HTTP ${response.status}: ${await response.text()}`);
  const rows = await response.json() as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function listImages(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: ImageFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const info = await stat(fullPath);
    files.push({ fileName: entry.name, fullPath, size: info.size, contentType: contentTypeFor(entry.name) });
  }
  return files.sort((left, right) => left.fileName.localeCompare(right.fileName, "en", { numeric: true }));
}

async function runPool<T>(items: T[], workers: number, work: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index], index);
    }
  }));
}

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function normalizeSupabaseUrl(value: string) {
  return value.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function flag(name: string, defaultValue: boolean) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return ["1", "true", "yes", "si", "sí"].includes(raw.trim().toLowerCase());
}

function numberEnv(name: string, defaultValue: number) {
  const parsed = Number(process.env[name] || defaultValue);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function authHeaders() {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };
}

function contentTypeFor(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
