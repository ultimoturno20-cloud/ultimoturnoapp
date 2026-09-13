import { createReadStream, existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

type ClaimSessionRow = { id: string; name?: string };
type ClaimCardRow = {
  id: string;
  pricecharting_id?: string;
  product_name?: string;
  card_number?: string;
  image_url?: string;
};

type ImageFile = {
  fileName: string;
  fullPath?: string;
  sourceUrl?: string;
  contentType: string;
  size: number;
};

const supabaseUrl = normalizeSupabaseUrl(env("SUPABASE_URL"));
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "ultimoturno-images";
const imageDir = path.resolve(process.env.PRICECHARTING_IMAGE_DIR || "D:/UltimoTurno/pricecharting-images");
const dryRun = flag("REPAIR_CLAIM_IMAGES_DRY_RUN", true);
const allowExternal = flag("REPAIR_CLAIM_IMAGES_ALLOW_EXTERNAL", false);
const limit = numberEnv("REPAIR_CLAIM_IMAGES_LIMIT", 0);
const storageBaseUrl = `${supabaseUrl}/storage/v1`;
const restBaseUrl = `${supabaseUrl}/rest/v1`;
const publicBase = `${storageBaseUrl}/object/public/${encodeURIComponent(bucket)}`;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  if (!existsSync(imageDir)) throw new Error(`No existe PRICECHARTING_IMAGE_DIR: ${imageDir}`);
  await assertSupabaseReachable();
  const activeClaim = await getActiveClaim();
  if (!activeClaim) throw new Error("No hay claim activo en Supabase.");

  const cards = await listActiveClaimCards(activeClaim.id);
  const missing = cards.filter((card) => String(card.pricecharting_id || "").trim() && !String(card.image_url || "").trim());
  const files = await mapLocalImages(imageDir);
  const cardsToRepair = limit > 0 ? missing.slice(0, limit) : missing;
  const selected: Array<{ card: ClaimCardRow; file: ImageFile }> = [];
  let localMatches = 0;
  let externalMatches = 0;
  for (const card of cardsToRepair) {
    const priceChartingId = String(card.pricecharting_id || "").trim();
    const local = files.get(priceChartingId);
    if (local) {
      selected.push({ card, file: local });
      localMatches += 1;
      continue;
    }
    if (!allowExternal) continue;
    const external = await resolveExternalImage(card);
    if (external) {
      selected.push({ card, file: external });
      externalMatches += 1;
    }
  }
  const withoutImageSource = cardsToRepair.length - selected.length;

  console.log(JSON.stringify({
    mode: dryRun ? "dry-run" : "apply",
    activeClaimId: activeClaim.id,
    activeClaimName: activeClaim.name || "",
    totalCards: cards.length,
    missingImages: missing.length,
    localMatches,
    externalMatches,
    withoutImageSource,
    allowExternal,
    bucket,
    imageDir
  }, null, 2));

  const summary = { uploaded: 0, existed: 0, claimCardsUpdated: 0, cacheUpdated: 0, catalogUpdated: 0, failed: 0 };
  for (const { card, file } of selected) {
    const priceChartingId = String(card.pricecharting_id || "").trim();
    const publicUrl = `${publicBase}/${encodeURIComponent(file.fileName)}`;
    try {
      if (!dryRun) {
        const uploaded = await uploadImageIfNeeded(file);
        if (uploaded) summary.uploaded += 1;
        else summary.existed += 1;
        summary.claimCardsUpdated += await patchRows("claim_cards", `id=eq.${encodeURIComponent(card.id)}`, { image_url: publicUrl });
        summary.cacheUpdated += await upsertImageCache(priceChartingId, file, publicUrl);
        summary.catalogUpdated += await patchRows("pricecharting_cache_entries", `pricecharting_id=eq.${encodeURIComponent(priceChartingId)}&image_url=is.null`, { image_url: publicUrl });
      }
      console.log(`${dryRun ? "DRY" : "OK"} ${priceChartingId} ${String(card.product_name || "")} -> ${file.fileName}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`Fallo ${priceChartingId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

async function getActiveClaim() {
  const rows = await getJson<ClaimSessionRow[]>("claim_sessions?select=id,name&status=eq.open&order=created_at.desc&limit=1");
  return rows[0] || null;
}

async function listActiveClaimCards(claimId: string) {
  const rows: ClaimCardRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await getJson<ClaimCardRow[]>(`claim_cards?select=id,pricecharting_id,product_name,card_number,image_url&claim_id=eq.${encodeURIComponent(claimId)}&status=neq.ignored&limit=1000&offset=${offset}`);
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function mapLocalImages(dir: string) {
  const map = new Map<string, ImageFile>();
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) continue;
    const id = entry.name.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    if (map.has(id)) continue;
    const fullPath = path.join(dir, entry.name);
    const info = await stat(fullPath);
    if (info.size <= 0) continue;
    map.set(id, { fileName: entry.name, fullPath, contentType: contentTypeFor(entry.name), size: info.size });
  }
  return map;
}

async function assertSupabaseReachable() {
  const response = await fetch(`${storageBaseUrl}/bucket`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Supabase Storage no respondio OK (${response.status}): ${await response.text()}`);
}

async function uploadImageIfNeeded(file: ImageFile) {
  const info = await fetch(`${storageBaseUrl}/object/info/${encodeURIComponent(bucket)}/${encodeURIComponent(file.fileName)}`, {
    method: "HEAD",
    headers: authHeaders()
  });
  if (info.ok) return false;
  const body = file.fullPath
    ? createReadStream(file.fullPath) as unknown as BodyInit
    : Buffer.from(await (await fetch(file.sourceUrl || "", {
        headers: { "User-Agent": "Mozilla/5.0 UltimoTurnoClaimImageRepair/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000)
      })).arrayBuffer()) as unknown as BodyInit;
  const response = await fetch(`${storageBaseUrl}/object/${encodeURIComponent(bucket)}/${encodeURIComponent(file.fileName)}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "false"
    },
    body,
    ...({ duplex: "half" } as RequestInit)
  } as RequestInit);
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 409 || text.includes("KeyAlreadyExists")) return false;
    throw new Error(`upload HTTP ${response.status}: ${text}`);
  }
  return true;
}

async function upsertImageCache(priceChartingId: string, file: ImageFile, publicUrl: string) {
  const payload = {
    pricecharting_id: priceChartingId,
    status: "downloaded",
    source_image_url: file.sourceUrl || `local-repair:${file.fullPath}`,
    local_path: `/pricecharting-images/files/${file.fileName}`,
    public_url: publicUrl,
    content_type: file.contentType,
    byte_size: file.size,
    error_message: "",
    last_attempt_at: new Date().toISOString(),
    next_attempt_at: new Date().toISOString(),
    downloaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const response = await fetch(`${restBaseUrl}/pricecharting_image_cache?on_conflict=pricecharting_id`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`UPSERT pricecharting_image_cache HTTP ${response.status}: ${await response.text()}`);
  const rows = await response.json() as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function resolveExternalImage(card: ClaimCardRow): Promise<ImageFile | null> {
  const priceChartingId = String(card.pricecharting_id || "").trim();
  const productName = stripVariantDetail(String(card.product_name || ""));
  const number = normalizeCardNumber(String(card.card_number || ""));
  const candidates = await externalImageCandidates(productName, number);
  for (const candidate of candidates) {
    const verified = await verifyImage(candidate.url);
    if (!verified) continue;
    return {
      fileName: `${priceChartingId}.${verified.extension}`,
      sourceUrl: candidate.url,
      contentType: verified.contentType,
      size: verified.size
    };
  }
  return null;
}

async function externalImageCandidates(name: string, number: string): Promise<Array<{ url: string }>> {
  const urls: string[] = [];
  for (const locale of ["en", "ja"]) {
    try {
      const response = await fetch(`https://api.tcgdex.net/v2/${locale}/cards?name=${encodeURIComponent(name)}&pagination:itemsPerPage=40`, {
        headers: { "User-Agent": "UltimoTurnoClaimImageRepair/1.0" },
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        const rows = await response.json() as Array<{ localId?: unknown; image?: unknown }>;
        const matches = rows.filter((row) => normalizeCardNumber(String(row.localId || "")) === number && row.image);
        for (const row of matches) urls.push(`${String(row.image)}/high.png`);
      }
    } catch {
      // Try the next source.
    }
  }
  try {
    const url = new URL("https://api.pokemontcg.io/v2/cards");
    url.searchParams.set("q", [`name:${pokemonTcgQueryValue(name)}`, `number:${pokemonTcgQueryValue(number)}`].join(" "));
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("select", "images");
    const response = await fetch(url, {
      headers: { "User-Agent": "UltimoTurnoClaimImageRepair/1.0" },
      signal: AbortSignal.timeout(15000)
    });
    if (response.ok) {
      const payload = await response.json() as { data?: Array<{ images?: { large?: unknown; small?: unknown } }> };
      for (const row of payload.data || []) {
        const image = String(row.images?.large || row.images?.small || "");
        if (image) urls.push(image);
      }
    }
  } catch {
    // External fallback failed; return whatever TCGdex found.
  }
  return [...new Set(urls)].map((url) => ({ url }));
}

async function verifyImage(url: string): Promise<{ contentType: string; extension: string; size: number } | null> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 UltimoTurnoClaimImageRepair/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) return null;
    return {
      contentType,
      extension: extensionForContentType(contentType),
      size: Number(response.headers.get("content-length") || 0)
    };
  } catch {
    return null;
  }
}

function stripVariantDetail(value: string) {
  return String(value || "").replace(/\[[^\]]+\]/g, "").trim();
}

function normalizeCardNumber(value: string) {
  return String(value || "").split("/")[0].trim().toLowerCase().replace(/^0+([0-9])/, "$1");
}

function pokemonTcgQueryValue(value: string) {
  return `"${String(value || "").replace(/"/g, "\\\"")}"`;
}

function extensionForContentType(contentType: string) {
  const clean = contentType.toLowerCase();
  if (clean.includes("png")) return "png";
  if (clean.includes("webp")) return "webp";
  return "jpg";
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

async function getJson<T>(pathAndQuery: string): Promise<T> {
  const response = await fetch(`${restBaseUrl}/${pathAndQuery}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`GET ${pathAndQuery} HTTP ${response.status}: ${await response.text()}`);
  return await response.json() as T;
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
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : defaultValue;
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
