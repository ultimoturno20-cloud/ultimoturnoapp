import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createOperationalDatabase } from "@ultimoturno/db";

type TcgCsvGroup = {
  groupId: number | string;
  name: string;
  abbreviation?: string;
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

type CardIndexRow = {
  id: string;
  pricecharting_id: string;
  canonical_name: string;
  canonical_expansion: string;
  card_number: string;
  tcgplayer_product_id: string;
  match_confidence: number;
};

type WorkerOptions = {
  dataDir: string;
  groupOffset: number;
  groupLimit: number;
  loop: boolean;
  progressPath: string;
  sleepMs: number;
};

type Progress = {
  running: boolean;
  startedAt: string;
  updatedAt: string;
  groupOffset: number;
  nextGroupOffset: number | null;
  totalGroups: number;
  groupsProcessed: number;
  productsSeen: number;
  matched: number;
  weak: number;
  conflicts: number;
  skipped: number;
  error: string;
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
  return {
    dataDir: path.resolve(values.get("data-dir") || process.env.PGLITE_DATA_DIR || defaultDataDir),
    groupOffset: Math.max(0, Math.floor(Number(values.get("group-offset") || 0))),
    groupLimit: Math.max(1, Math.min(25, Math.floor(Number(values.get("group-limit") || 5)))),
    loop: flags.has("loop"),
    progressPath: path.resolve(values.get("progress") || path.join(process.cwd(), "outputs", "tcgcsv-card-index-progress.json")),
    sleepMs: Math.max(0, Math.floor(Number(values.get("sleep-ms") || 500)))
  };
}

async function fetchTcgCsvJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UltimoTurnoCardIndexWorker/0.1.0"
    },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`TCGCSV HTTP ${response.status}: ${url}`);
  const payload = await response.json() as { success?: boolean; errors?: unknown[]; results?: T };
  if (payload && payload.success === false) throw new Error(`TCGCSV error: ${(payload.errors || []).join(", ")}`);
  return (payload && "results" in payload ? payload.results : payload) as T;
}

async function loadIndex(db: PGlite): Promise<Map<string, CardIndexRow[]>> {
  const result = await db.query<CardIndexRow>(`
    select id, pricecharting_id, canonical_name, canonical_expansion, card_number,
      tcgplayer_product_id, match_confidence
    from card_index_entries
  `);
  const byNumber = new Map<string, CardIndexRow[]>();
  for (const row of result.rows) {
    const number = normalizeNumber(row.card_number);
    if (!number) continue;
    const bucket = byNumber.get(number) || [];
    bucket.push(row);
    byNumber.set(number, bucket);
  }
  return byNumber;
}

async function upsertTcgplayerLink(db: PGlite, entry: CardIndexRow, product: TcgCsvProduct, group: TcgCsvGroup, number: string, confidence: number, status: "matched" | "weak_match" | "conflict", reasons: string[]) {
  const productId = String(product.productId || "").trim();
  const productUrl = String(product.url || "").trim();
  const imageUrl = upgradeTcgplayerImageUrl(String(product.imageUrl || "").trim());
  const evidence = {
    source: "tcgcsv-worker",
    groupId: String(group.groupId || ""),
    groupName: group.name,
    groupAbbreviation: group.abbreviation || "",
    reasons,
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
  `, [entry.id, productId, productUrl, imageUrl, confidence, JSON.stringify(evidence), status]);

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
    entry.id,
    productId,
    productUrl,
    String(product.name || product.cleanName || ""),
    String(group.name || ""),
    number,
    extendedValue(product, "Printing", "Variant", "Finish"),
    imageUrl,
    confidence,
    JSON.stringify(evidence)
  ]);
}

async function recordRun(db: PGlite, progress: Progress, status: "completed" | "failed", errorMessage = "") {
  await db.query(`
    insert into card_index_sync_runs (
      id, source, status, rows_seen, rows_matched, rows_weak, rows_conflict,
      error_message, started_at, completed_at
    ) values ($1, 'tcgcsv-worker', $2, $3, $4, $5, $6, $7, $8, now())
  `, [
    crypto.randomUUID(),
    status,
    progress.productsSeen,
    progress.matched,
    progress.weak,
    progress.conflicts,
    errorMessage.slice(0, 1000),
    progress.startedAt
  ]);
}

async function writeProgress(progressPath: string, progress: Progress) {
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeFile(progressPath, JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function bestMatch(candidates: CardIndexRow[], product: TcgCsvProduct, group: TcgCsvGroup, number: string): { entry: CardIndexRow; score: number; reasons: string[] } | null {
  const groupExpansion = normalizeExpansion(group.name);
  let best: { entry: CardIndexRow; score: number; reasons: string[] } | null = null;
  for (const entry of candidates) {
    const entryExpansion = normalizeExpansion(entry.canonical_expansion);
    const expansionClose = entryExpansion === groupExpansion
      || entryExpansion.endsWith(groupExpansion)
      || groupExpansion.endsWith(entryExpansion)
      || tokenOverlap(entryExpansion, groupExpansion) >= 0.6;
    if (!expansionClose) continue;
    const scored = scoreMatch(entry, product, group, number);
    if (!best || scored.score > best.score) best = { entry, ...scored };
  }
  return best;
}

function scoreMatch(entry: CardIndexRow, product: TcgCsvProduct, group: TcgCsvGroup, number: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (normalizeNumber(entry.card_number) === normalizeNumber(number)) {
    score += 38;
    reasons.push("numero");
  }
  const entryName = normalizeName(entry.canonical_name);
  const productName = normalizeName(String(product.cleanName || product.name || ""));
  if (entryName === productName) {
    score += 34;
    reasons.push("nombre exacto");
  } else if (entryName.includes(productName) || productName.includes(entryName)) {
    score += 24;
    reasons.push("nombre contenido");
  } else if (tokenOverlap(entryName, productName) >= 0.72) {
    score += 18;
    reasons.push("nombre similar");
  } else {
    score -= 20;
  }
  const entryExpansion = normalizeExpansion(entry.canonical_expansion);
  const groupExpansion = normalizeExpansion(group.name);
  if (entryExpansion === groupExpansion || entryExpansion.endsWith(groupExpansion) || groupExpansion.endsWith(entryExpansion)) {
    score += 26;
    reasons.push("set");
  } else if (tokenOverlap(entryExpansion, groupExpansion) >= 0.6) {
    score += 12;
    reasons.push("set similar");
  } else {
    score -= 16;
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function extendedValue(product: TcgCsvProduct, ...names: string[]): string {
  const wanted = new Set(names.map(normalizeText));
  for (const item of product.extendedData || []) {
    if (wanted.has(normalizeText(String(item.name || ""))) || wanted.has(normalizeText(String(item.displayName || "")))) {
      return String(item.value || "").trim();
    }
  }
  return "";
}

function normalizeNumber(value: string): string {
  return normalizeText(String(value || "").split("/")[0] || "").replace(/\s+/g, "").replace(/^0+([0-9])/, "$1");
}

function normalizeName(value: string): string {
  return normalizeText(value)
    .replace(/\b(reverse holo|reverse|holofoil|holo|foil|normal|unlimited|1st edition|first edition|cosmos|master ball|poke ball|pokeball|masterball)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExpansion(value: string): string {
  return normalizeText(value)
    .replace(/^pokemon\s+/, "")
    .replace(/^[a-z]{1,5}\d{0,4}\s*:\s*/, "")
    .replace(/^[a-z]{1,5}\d{0,4}\s+/, "")
    .replace(/\b(scarlet violet|sword shield|sun moon|xy|black white)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string): string {
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

function tokenOverlap(left: string, right: string): number {
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const db = await createOperationalDatabase({ dataDir: options.dataDir });
  const groups = (await fetchTcgCsvJson<TcgCsvGroup[]>("https://tcgcsv.com/tcgplayer/3/groups"))
    .filter((group) => group && group.groupId && group.name);
  const index = await loadIndex(db);
  let offset: number | null = options.groupOffset;
  const progress: Progress = {
    running: true,
    startedAt,
    updatedAt: startedAt,
    groupOffset: options.groupOffset,
    nextGroupOffset: offset,
    totalGroups: groups.length,
    groupsProcessed: 0,
    productsSeen: 0,
    matched: 0,
    weak: 0,
    conflicts: 0,
    skipped: 0,
    error: ""
  };
  await writeProgress(options.progressPath, progress);
  try {
    while (offset !== null) {
      const selected = groups.slice(offset, offset + options.groupLimit);
      if (!selected.length) break;
      for (let groupIndex = 0; groupIndex < selected.length; groupIndex++) {
        const group = selected[groupIndex];
        console.log(`[${new Date().toLocaleTimeString("es-AR", { hour12: false })}] Grupo ${offset + groupIndex + 1}/${groups.length}: ${group.name}`);
        const products = await fetchTcgCsvJson<TcgCsvProduct[]>(`https://tcgcsv.com/tcgplayer/3/${encodeURIComponent(String(group.groupId))}/products`);
        for (const product of products) {
          progress.productsSeen++;
          const number = normalizeNumber(extendedValue(product, "Number", "Card Number"));
          if (!number) {
            progress.skipped++;
            continue;
          }
          const match = bestMatch(index.get(number) || [], product, group, number);
          if (!match || match.score < 72) {
            progress.skipped++;
            continue;
          }
          const externalId = String(product.productId || "").trim();
          const conflict = !!match.entry.tcgplayer_product_id && match.entry.tcgplayer_product_id !== externalId;
          const status = conflict ? "conflict" : match.score >= 86 ? "matched" : "weak_match";
          if (status === "conflict") progress.conflicts++;
          else if (status === "matched") progress.matched++;
          else progress.weak++;
          await upsertTcgplayerLink(db, match.entry, product, group, number, match.score, status, match.reasons);
          match.entry.tcgplayer_product_id = externalId;
          match.entry.match_confidence = Math.max(match.entry.match_confidence, match.score);
        }
        progress.groupsProcessed++;
        progress.nextGroupOffset = offset + groupIndex + 1 < groups.length ? offset + groupIndex + 1 : null;
        await writeProgress(options.progressPath, progress);
        await sleep(options.sleepMs);
      }
      offset = progress.nextGroupOffset;
      if (!options.loop) break;
    }
    progress.running = false;
    await recordRun(db, progress, "completed");
    await writeProgress(options.progressPath, progress);
    console.log(`Listo. Productos=${progress.productsSeen}, fuertes=${progress.matched}, debiles=${progress.weak}, conflictos=${progress.conflicts}, omitidos=${progress.skipped}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress.running = false;
    progress.error = message;
    await recordRun(db, progress, "failed", message).catch(() => {});
    await writeProgress(options.progressPath, progress).catch(() => {});
    throw error;
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
