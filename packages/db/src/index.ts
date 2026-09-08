import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import type { PGlite } from "@electric-sql/pglite";
import { parse } from "csv-parse/sync";

export type DatabaseCheck = {
  table: string;
  count: number;
};

export type DbStockRow = {
  purchaseCost: number | null;
  purchaseCurrency: string;
  id: string;
  businessId: string;
  sku: string;
  location: string;
  intakeBatch: string;
  inventoryStatus: string;
  tags: string;
  quantityOnHand: number;
  quantityReserved: number;
  active: boolean;
  priceArs: number;
  priceUsd: number | null;
  priceReferences: {
    sale: { ars: number; usd: number | null };
    priceCharting: { usd: number | null; priceChartingId: string; url: string };
    tcgplayer: {
      usd: number | null;
      productId: string;
      url: string;
      subTypeName: string;
      lowPriceUsd: number | null;
      midPriceUsd: number | null;
      highPriceUsd: number | null;
      marketPriceUsd: number | null;
      directLowPriceUsd: number | null;
    };
    coolstuff: { usd: number | null; url: string };
  };
  lastPurchaseArs: number | null;
  lastPurchaseAt?: string;
  availableQuantity: number;
  product: {
    id: string;
    businessId: string;
    name: string;
    expansion: string;
    number?: string;
    imageUrl?: string;
    identifiers: Array<{ source: string; externalId: string; url?: string }>;
  };
  variant: {
    id: string;
    productId: string;
    language: string;
    condition: string;
    finish: string;
    gradingCompany?: string;
    grade?: string;
    gradingCert?: string;
  };
};

export type DbStockSummary = {
  totalSkus: number;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  stockValueArs: number;
};

export type DbMovementRow = {
  id: string;
  businessId: string;
  inventoryItemId: string;
  type: string;
  quantityDelta: number;
  unitCostUsd?: number;
  note?: string;
  createdAt: string;
  itemName?: string;
  sku?: string;
};

export type DbImportRunRow = {
  id: string;
  businessId: string;
  source: string;
  status: string;
  fileName: string;
  totalRows: number;
  reviewRows: number;
  appliedRows: number;
  createdAt: string;
  note?: string;
};

export type DbImportReviewRow = {
  id: string;
  importId: string;
  rowNumber: number;
  status: string;
  rawPayload: Record<string, unknown>;
  reviewReason: string;
  matchedInventoryItemId?: string;
};

export type MobileInventoryEntry = {
  id: string;
  businessId: string;
  status: "pending" | "reviewed" | "rejected";
  helperName: string;
  source: string;
  matchType: "inventory" | "card_index" | "manual";
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
  location: string;
  intakeBatch: string;
  quantityOnHand: number;
  priceArs: number;
  priceUsd: number | null;
  imageUrl: string;
  notes: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedByName?: string;
};

export type MobileInventoryInput = {
  helperName?: string;
  matchType?: "inventory" | "card_index" | "manual";
  inventoryItemId?: string;
  priceChartingId?: string;
  sku?: string;
  name?: string;
  expansion?: string;
  number?: string;
  language?: string;
  condition?: string;
  finish?: string;
  gradingCompany?: string;
  grade?: string;
  location?: string;
  intakeBatch?: string;
  quantityOnHand?: number;
  priceArs?: number;
  priceUsd?: number | null;
  imageUrl?: string;
  notes?: string;
};

export type DbReservationRow = {
  id: string;
  inventoryItemId: string;
  quantity: number;
  status: string;
  channel: string;
  externalCartId?: string;
  expiresAt?: string;
  createdAt: string;
};

export const migrationFiles = ["0001_initial_stock_readonly.sql", "0002_operational_inventory.sql", "0003_operational_commerce.sql", "0004_pricecharting_cache.sql", "0005_pricecharting_image_cache.sql", "0006_claims.sql", "0007_pricecharting_image_url_found.sql", "0008_card_index.sql", "0009_card_index_review.sql", "0010_claim_sessions_allow_reused_names.sql", "0011_claim_sections.sql", "0012_claim_card_quantity.sql", "0013_order_packing_payments.sql", "0014_claim_order_payment_due.sql", "0015_sale_delivered_status.sql", "0016_sales_usd_lines.sql", "0017_sale_notes.sql", "0018_sale_message_sent.sql", "0019_card_variant_grading.sql", "0020_card_variant_grading_cert.sql", "0021_inventory_intake_control.sql", "0022_tcgplayer_price_cache.sql", "0023_mobile_inventory_staging.sql", "0024_inventory_item_tags.sql", "0025_inventory_intake_safety.sql", "0026_order_boards.sql", "0027_language_groups.sql", "0028_refine_language_groups.sql", "0029_recalculate_language_groups.sql"];
export const seedFiles = ["0001_demo_seed.sql", "0002_extended_demo_seed.sql"];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const demoBusinessId = "11111111-1111-4111-8111-111111111111";
const localBusinessName = "UltimoTurno";
const localBusinessSlug = "ultimoturno";
const require = createRequire(import.meta.url);
const databaseDrivers = new WeakMap<object, "pglite" | "postgres">();

type QueryLikeResult<T> = { rows: T[] };
type PgClientLike = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryLikeResult<T>>;
  release?: () => void;
};
type PgPoolLike = PgClientLike & {
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
};
type PgModule = {
  Pool: new (config: Record<string, unknown>) => PgPoolLike;
  types?: { setTypeParser: (oid: number, parser: (value: string) => string) => void };
};
const pgModule = require("pg") as PgModule;

class PostgresOperationalDatabase {
  private readonly pool: PgPoolLike;
  private manualTransactionClient: PgClientLike | null = null;

  constructor(options: { databaseUrl: string; ssl?: boolean; poolMax?: number }) {
    const { Pool, types } = pgModule;
    types?.setTypeParser(1082, (value) => value); // date
    types?.setTypeParser(1114, (value) => value); // timestamp
    types?.setTypeParser(1184, (value) => value); // timestamptz
    this.pool = new Pool({
      connectionString: options.databaseUrl,
      max: options.poolMax || 10,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 10000,
      maxUses: 100,
      ssl: options.ssl ? { rejectUnauthorized: false } : undefined
    });
    databaseDrivers.set(this, "postgres");
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryLikeResult<T>> {
    return (this.manualTransactionClient || this.pool).query<T>(sql, params);
  }

  async exec(sql: string): Promise<void> {
    const command = sql.trim().replace(/;+$/, "").toLowerCase();
    if (command === "begin") {
      if (this.manualTransactionClient) throw new Error("Ya hay una transaccion manual activa.");
      this.manualTransactionClient = await this.pool.connect();
      await this.manualTransactionClient.query("begin");
      return;
    }
    if (command === "commit" || command === "rollback") {
      const client = this.manualTransactionClient;
      if (!client) throw new Error(`No hay una transaccion manual activa para ${command}.`);
      try {
        await client.query(command);
      } finally {
        this.manualTransactionClient = null;
        client.release?.();
      }
      return;
    }
    await this.query(sql);
  }

  async transaction<T>(work: (connection: PGlite) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const connection = {
      query: <Row = Record<string, unknown>>(sql: string, params?: unknown[]) => client.query<Row>(sql, params),
      exec: async (sql: string) => { await client.query(sql); }
    } as unknown as PGlite;
    databaseDrivers.set(connection, "postgres");
    await client.query("begin");
    try {
      const result = await work(connection);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release?.();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function markDatabaseDriver<T extends object>(db: T, driver: "pglite" | "postgres"): T {
  databaseDrivers.set(db, driver);
  return db;
}

export function getOperationalDatabaseDriver(db: PGlite): "pglite" | "postgres" {
  return databaseDrivers.get(db) || "pglite";
}

async function readSql(relativePath: string): Promise<string> {
  return readFile(path.join(packageRoot, relativePath), "utf8");
}

export async function createDemoDatabase(): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = markDatabaseDriver(new PGlite(), "pglite");
  for (const file of migrationFiles) {
    await db.exec(await readSql(`migrations/${file}`));
  }
  for (const file of seedFiles) {
    await db.exec(await readSql(`seeds/${file}`));
  }
  return db;
}

export type OperationalDatabaseOptions = {
  dataDir?: string;
  databaseUrl?: string;
  driver?: "pglite" | "postgres";
  ssl?: boolean;
  poolMax?: number;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
};

export async function checkPostgresConnection(options: Pick<OperationalDatabaseOptions, "databaseUrl" | "ssl" | "poolMax">): Promise<void> {
  const databaseUrl = String(options.databaseUrl || "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio para revisar PostgreSQL.");
  const { Pool } = pgModule;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: options.poolMax || 1,
    ssl: options.ssl ? { rejectUnauthorized: false } : undefined
  });
  try {
    await pool.query("select 1");
  } finally {
    await pool.end();
  }
}

export type AuthenticatedUser = {
  id: string;
  businessId: string;
  displayName: string;
  email: string;
};

export type UpsertInventoryInput = {
  mobileEntryId?: string;
  purchaseCost?: number | null;
  purchaseCurrency?: string;
  sku?: string;
  name: string;
  expansion: string;
  number?: string;
  imageUrl?: string;
  priceChartingId?: string;
  priceChartingUrl?: string;
  monPriceId?: string;
  language: string;
  condition: string;
  finish: string;
  gradingCompany?: string;
  grade?: string;
  gradingCert?: string;
  location?: string;
  intakeBatch?: string;
  inventoryStatus?: string;
  tags?: string;
  quantityOnHand: number;
  quantityReserved?: number;
  priceArs?: number;
  priceUsd?: number | null;
  notes?: string;
  stockMovementNote?: string;
  stockMovementReferenceType?: string;
};

export type InventoryAdjustmentInput = {
  inventoryItemId: string;
  quantityDelta: number;
  note: string;
  unitCostArs?: number;
  unitCostUsd?: number;
};

export type ExampleInventoryResult = {
  created: number;
  skipped: number;
};

export type InventoryResetResult = {
  touchedSkus: number;
  unitsCleared: number;
  reservationsCleared: number;
};

export type SnapshotPreviewRow = UpsertInventoryInput & {
  rowNumber: number;
  action: "create" | "update" | "review" | "invalid";
  warnings: string[];
  existingSku?: string;
  translatedName?: string;
  candidates: Array<{
    inventoryItemId: string;
    sku: string;
    name: string;
    expansion: string;
    number?: string;
    language: string;
    condition: string;
    gradingCompany?: string;
    grade?: string;
    gradingCert?: string;
    imageUrl?: string;
    confidence: number;
    reasons: string[];
  }>;
  priceChartingCandidates: Array<{
    priceChartingId: string;
    canonicalUrl: string;
    productName: string;
    expansionName: string;
    cardNumber: string;
    loosePriceUsd: number | null;
    imageUrl?: string;
    confidence: number;
    reasons: string[];
  }>;
};

export type CommerceLineInput = {
  inventoryItemId: string;
  quantity: number;
  unitPriceArs: number;
};

export type CreateSaleInput = {
  customerName: string;
  saleType: "sale" | "reservation";
  channel: string;
  lines: CommerceLineInput[];
};

export type SaleRecord = {
  id: string;
  customerName: string;
  saleType: "sale" | "reservation";
  status: "pending" | "packed" | "paid" | "delivered" | "cancelled";
  channel: string;
  totalArs: number;
  totalUsd: number;
  amountPaidArs: number;
  paymentDueAt?: string;
  internalNote: string;
  messageSentAt?: string;
  createdAt: string;
  completedAt?: string;
  lines: Array<CommerceLineInput & { name: string; sku: string; imageUrl: string; unitPriceUsd: number; lineTotalArs: number; lineTotalUsd: number; priceCurrency: "ARS" | "USD" | "FREE"; packed: boolean; packedAt?: string; saleItemId: string }>;
};

export type CreatePurchaseInput = {
  sellerName: string;
  note?: string;
  lines: Array<{
    inventoryItemId?: string;
    priceChartingId?: string;
    quantity: number;
    unitCostArs: number;
  }>;
};

export type PurchaseRecord = {
  id: string;
  sellerName: string;
  status: "received" | "cancelled";
  totalArs: number;
  note: string;
  createdAt: string;
  lines: Array<{ inventoryItemId: string; quantity: number; unitCostArs: number; lineTotalArs: number; name: string; sku: string }>;
};

export type ClaimSession = {
  id: string;
  name: string;
  status: "open" | "closed" | "archived";
  sourceNote: string;
  paymentDueAt?: string;
  createdAt: string;
  closedAt?: string;
  closedSaleIds: string[];
};

export type ClaimCard = {
  id: string;
  claimId: string;
  sectionId: string;
  priceChartingId: string;
  canonicalUrl: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
  imageUrl: string;
  pcPriceUsd: number | null;
  suggestedArs: number;
  finalPriceArs: number;
  finalPriceUsd: number;
  finalName: string;
  buyer: string;
  quantity: number;
  tags: string;
  status: "draft" | "ready" | "sold" | "ignored";
  gridBatch: string;
  sortOrder: number;
};

export type ClaimSection = {
  id: string;
  claimId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export type ClaimFree = {
  id: string;
  claimId: string;
  buyer: string;
  finalName: string;
  productName: string;
  expansionName: string;
  quantity: number;
  priceChartingId: string;
  canonicalUrl: string;
  tags: string;
  notes: string;
};

export type ClaimSummary = {
  cards: number;
  cardsWithBuyer: number;
  buyers: number;
  missingPrices: number;
  missingImages: number;
  totalArs: number;
  totalUsd: number;
  claimTotalArs: number;
  claimTotalUsd: number;
  frees: number;
};

export type ClaimsWorkspace = {
  activeClaim: ClaimSession | null;
  sections: ClaimSection[];
  cards: ClaimCard[];
  frees: ClaimFree[];
  history: Array<ClaimSession & { cards: number; buyers: number; totalArs: number; totalUsd: number }>;
  summary: ClaimSummary;
};

export type ClaimPriceRefreshResult = {
  workspace: ClaimsWorkspace;
  updated: number;
  unchanged: number;
  missing: number;
};

export type ClaimOrderPreviewLine = {
  kind: "card" | "free";
  claimCardId: string;
  claimFreeId: string;
  displayName: string;
  productName: string;
  expansionName: string;
  priceChartingId: string;
  quantity: number;
  unitPriceArs: number;
  unitPriceUsd: number;
  lineTotalArs: number;
  lineTotalUsd: number;
  tags: string;
  sourceReference: string;
};

export type ClaimOrderPreviewBuyer = {
  buyer: string;
  totalArs: number;
  totalUsd: number;
  units: number;
  lines: ClaimOrderPreviewLine[];
};

export type ClaimOrderPreviewIssue = {
  message: string;
  claimCardId: string;
  claimFreeId: string;
  displayName: string;
  buyer: string;
  quantity: number;
};

export type ClaimOrderPreview = {
  claimId: string;
  claimName: string;
  issues: ClaimOrderPreviewIssue[];
  buyers: ClaimOrderPreviewBuyer[];
  totals: {
    buyers: number;
    lines: number;
    units: number;
    totalArs: number;
    totalUsd: number;
  };
};

export type ClaimCreateInput = {
  name?: string;
  sourceNote?: string;
  paymentDueAt?: string;
};

export type ClaimCardPatchInput = {
  sectionId?: string;
  finalPriceArs?: number;
  finalPriceUsd?: number;
  finalName?: string;
  imageUrl?: string;
  buyer?: string;
  quantity?: number;
  tags?: string;
  status?: ClaimCard["status"];
};

export type ClaimFreeInput = {
  buyer: string;
  finalName: string;
  productName?: string;
  expansionName?: string;
  quantity?: number;
  priceChartingId?: string;
  canonicalUrl?: string;
  tags?: string;
  notes?: string;
};

export type PriceChartingCacheInput = {
  priceChartingId: string;
  canonicalUrl: string;
  sourceUrl: string;
  productName: string;
  normalizedName: string;
  expansionName: string;
  normalizedExpansion: string;
  cardNumber: string;
  loosePriceUsd: number | null;
  imageUrl: string;
  languageGroup?: LanguageGroup;
  searchKey: string;
};

export type PriceChartingCacheEntry = PriceChartingCacheInput & {
  finish: string;
  tcgplayerPriceUsd: number | null;
  tcgplayerSubtype: string;
  importedAt: string;
};

export type PriceChartingCacheStatus = {
  totalEntries: number;
  pricedEntries: number;
  lastRun: null | {
    id: string;
    category: string;
    status: "completed" | "failed";
    rowsReceived: number;
    rowsImported: number;
    rowsSkipped: number;
    errorMessage: string;
    completedAt: string;
  };
};

export type TcgplayerPriceCacheInput = {
  tcgplayerProductId: string;
  subTypeName: string;
  lowPriceUsd: number | null;
  midPriceUsd: number | null;
  highPriceUsd: number | null;
  marketPriceUsd: number | null;
  directLowPriceUsd: number | null;
  sourceGroupId: string;
};

export type TcgplayerPriceCacheStatus = {
  totalEntries: number;
  pricedEntries: number;
  productEntries: number;
  linkedProductEntries: number;
  linkedCardIndexEntries: number;
  lastRun: null | {
    id: string;
    source: string;
    categoryId: string;
    sourceVersion: string;
    status: "completed" | "failed" | "skipped";
    groupsSeen: number;
    rowsReceived: number;
    rowsImported: number;
    rowsSkipped: number;
    errorMessage: string;
    completedAt: string;
  };
};

export type PriceChartingImageCacheStatus = {
  totalEntries: number;
  pendingEntries: number;
  urlEntries: number;
  downloadedEntries: number;
  failedEntries: number;
  bytesStored: number;
  stockLinkedEntries: number;
};

export type CardIndexStatus = {
  totalEntries: number;
  priceChartingEntries: number;
  tcgplayerLinkedEntries: number;
  coolstuffLinkedEntries: number;
  imageLinkedEntries: number;
  matchedEntries: number;
  weakMatchEntries: number;
  conflictEntries: number;
  priceChartingOnlyEntries: number;
  lastRun: null | {
    source: string;
    status: "completed" | "failed";
    rowsSeen: number;
    rowsMatched: number;
    rowsWeak: number;
    rowsConflict: number;
    errorMessage: string;
    completedAt: string;
  };
};

export type CardIndexPriceChartingBatchResult = {
  processed: number;
  nextAfterId: string;
  complete: boolean;
  status: CardIndexStatus;
};

export type CardIndexEntry = {
  id: string;
  priceChartingId: string;
  canonicalName: string;
  canonicalExpansion: string;
  cardNumber: string;
  languageGroup: LanguageGroup;
  priceChartingUrl: string;
  tcgplayerProductId: string;
  tcgplayerUrl: string;
  tcgplayerImageUrl: string;
  coolstuffUrl: string;
  imageUrl: string;
  imageSource: string;
  matchConfidence: number;
  matchStatus: "pricecharting_only" | "matched" | "weak_match" | "conflict" | "manual";
  reviewStatus: "pending" | "approved" | "rejected" | "manual";
  reviewNote: string;
  evidence: Record<string, unknown>;
  updatedAt: string;
  reviewedAt?: string;
};

export type LanguageGroup = "english" | "chinese" | "japanese";

export type TcgCsvGroupInput = {
  groupId: number | string;
  name: string;
  abbreviation?: string;
};

export type TcgCsvProductInput = {
  productId: number | string;
  name: string;
  cleanName?: string;
  imageUrl?: string;
  url?: string;
  groupId: number | string;
  extendedData?: Array<{ name?: string; displayName?: string; value?: string }>;
};

export type CardIndexTcgCsvResult = {
  status: CardIndexStatus;
  rowsSeen: number;
  rowsMatched: number;
  rowsWeak: number;
  rowsConflict: number;
  rowsSkipped: number;
};

export type PriceChartingImageQueueEntry = {
  priceChartingId: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
  canonicalUrl: string;
  sourceImageUrl: string;
  attempts: number;
  priority: number;
};

export type PriceChartingImageDownloadSuccess = {
  priceChartingId: string;
  sourceImageUrl: string;
  localPath: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
  contentHash: string;
};

export async function createOperationalDatabase(options: OperationalDatabaseOptions): Promise<PGlite> {
  const driver = options.driver || "pglite";
  let db: PGlite;
  if (driver === "postgres") {
    const databaseUrl = String(options.databaseUrl || "").trim();
    if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio cuando ULTIMOTURNO_DB_DRIVER=postgres.");
    db = new PostgresOperationalDatabase({
      databaseUrl,
      ssl: options.ssl,
      poolMax: options.poolMax
    }) as unknown as PGlite;
  } else {
    const dataDir = options.dataDir || path.resolve(process.cwd(), ".data", "ultimoturno-pglite");
    await mkdir(dataDir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    db = markDatabaseDriver(new PGlite(dataDir), "pglite");
  }
  await runOperationalMigrations(db);
  await ensureOperationalBootstrap(db, options);
  return db;
}

export async function loginUser(db: PGlite, email: string, password: string): Promise<{ token: string; user: AuthenticatedUser }> {
  const result = await db.query<Record<string, unknown>>(`
    select id, business_id, display_name, email, password_hash
    from app_users
    where lower(email) = lower($1) and active = true
    limit 1
  `, [email]);
  const row = result.rows[0];
  if (!row || !verifyPassword(password, String(row.password_hash || ""))) {
    throw new Error("Email o password incorrectos");
  }
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await db.query("delete from app_sessions where expires_at < now()");
  await db.query(`
    insert into app_sessions (token_hash, business_id, user_id, expires_at)
    values ($1, $2, $3, now() + interval '14 days')
  `, [tokenHash, row.business_id, row.id]);
  await db.query("update app_users set last_login_at = now() where id = $1", [row.id]);
  return {
    token,
    user: {
      id: String(row.id),
      businessId: String(row.business_id),
      displayName: String(row.display_name),
      email: String(row.email || "")
    }
  };
}

export async function getUserByToken(db: PGlite, token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const result = await db.query<Record<string, unknown>>(`
    select u.id, u.business_id, u.display_name, u.email
    from app_sessions s
    join app_users u on u.id = s.user_id
    where s.token_hash = $1 and s.expires_at > now() and u.active = true
    limit 1
  `, [hashToken(token)]);
  const row = result.rows[0];
  return row ? {
    id: String(row.id),
    businessId: String(row.business_id),
    displayName: String(row.display_name),
    email: String(row.email || "")
  } : null;
}

export async function logoutUser(db: PGlite, token: string): Promise<void> {
  await db.query("delete from app_sessions where token_hash = $1", [hashToken(token)]);
}

export async function getDefaultOperationalUser(db: PGlite): Promise<AuthenticatedUser> {
  const result = await db.query<Record<string, unknown>>(`
    select id, business_id, display_name, email
    from app_users
    where business_id = $1 and display_name = 'Sistema local'
    limit 1
  `, [demoBusinessId]);
  const row = result.rows[0];
  if (!row) throw new Error("No se encontro el usuario operativo local");
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    displayName: String(row.display_name),
    email: String(row.email || "")
  };
}

export async function getHealth(db: PGlite) {
  const result = await db.query<{ slug: string; name: string }>("select slug, name from businesses limit 1");
  const driver = getOperationalDatabaseDriver(db);
  return {
    ok: true,
    service: "ultimoturno-new-api",
    mode: driver === "postgres" ? "postgresql" : "pglite-postgresql",
    business: result.rows[0]?.slug || "sin-negocio",
    businessName: result.rows[0]?.name || "Sin negocio"
  };
}

export async function replacePriceChartingCache(db: PGlite, input: {
  category: string;
  sourceHash: string;
  rowsReceived: number;
  rowsSkipped: number;
  rows: PriceChartingCacheInput[];
  pruneMissing?: boolean;
}): Promise<PriceChartingCacheStatus> {
  if (!input.rows.length) throw new Error("El cache de PriceCharting no contiene filas validas.");
  const runId = crypto.randomUUID();
  const uniqueRows = [...new Map(input.rows.map((row) => [row.priceChartingId, row])).values()];
  const duplicateRows = input.rows.length - uniqueRows.length;

  await db.exec("begin");
  try {
    await db.query(`
      insert into pricecharting_cache_runs (
        id, category, status, rows_received, rows_imported, rows_skipped,
        source_hash, started_at, completed_at
      ) values ($1, $2, 'completed', $3, $4, $5, $6, now(), now())
    `, [runId, input.category, input.rowsReceived, uniqueRows.length, input.rowsSkipped + duplicateRows, input.sourceHash]);

    for (let offset = 0; offset < uniqueRows.length; offset += 200) {
      const chunk = uniqueRows.slice(offset, offset + 200);
      const params: unknown[] = [];
      const values = chunk.map((row, index) => {
        const base = index * 13;
        const languageGroup = row.languageGroup || inferLanguageGroup(row.expansionName, row.productName, row.canonicalUrl);
        params.push(
          row.priceChartingId, row.canonicalUrl, row.sourceUrl, row.productName,
          row.normalizedName, row.expansionName, row.normalizedExpansion,
          row.cardNumber, row.loosePriceUsd, row.imageUrl, languageGroup, row.searchKey, runId
        );
        return `(${Array.from({ length: 13 }, (_, parameter) => `$${base + parameter + 1}`).join(", ")}, now())`;
      }).join(",\n");
      await db.query(`
        insert into pricecharting_cache_entries (
          pricecharting_id, canonical_url, source_url, product_name,
          normalized_name, expansion_name, normalized_expansion, card_number,
          loose_price_usd, image_url, language_group, search_key, sync_run_id, imported_at
        ) values ${values}
        on conflict (pricecharting_id) do update set
          canonical_url = excluded.canonical_url,
          source_url = excluded.source_url,
          product_name = excluded.product_name,
          normalized_name = excluded.normalized_name,
          expansion_name = excluded.expansion_name,
          normalized_expansion = excluded.normalized_expansion,
          card_number = excluded.card_number,
          loose_price_usd = excluded.loose_price_usd,
          image_url = excluded.image_url,
          language_group = excluded.language_group,
          search_key = excluded.search_key,
          sync_run_id = excluded.sync_run_id,
          imported_at = now()
      `, params);
    }

    if (input.pruneMissing !== false) {
      await db.query("delete from pricecharting_cache_entries where sync_run_id <> $1", [runId]);
    }
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }

  return getPriceChartingCacheStatus(db);
}

export async function recordPriceChartingCacheFailure(db: PGlite, input: {
  category: string;
  errorMessage: string;
}): Promise<void> {
  await db.query(`
    insert into pricecharting_cache_runs (
      id, category, status, error_message, started_at, completed_at
    ) values ($1, $2, 'failed', $3, now(), now())
  `, [crypto.randomUUID(), input.category, input.errorMessage.slice(0, 1000)]);
}

export async function getPriceChartingCacheStatus(db: PGlite): Promise<PriceChartingCacheStatus> {
  const counts = await db.query<{ total_entries: number; priced_entries: number }>(`
    select count(*)::integer as total_entries,
      count(*) filter (where loose_price_usd is not null)::integer as priced_entries
    from pricecharting_cache_entries
  `);
  const runs = await db.query<Record<string, unknown>>(`
    select id, category, status, rows_received, rows_imported, rows_skipped,
      error_message, completed_at
    from pricecharting_cache_runs
    order by completed_at desc
    limit 1
  `);
  const row = runs.rows[0];
  return {
    totalEntries: Number(counts.rows[0]?.total_entries || 0),
    pricedEntries: Number(counts.rows[0]?.priced_entries || 0),
    lastRun: row ? {
      id: String(row.id),
      category: String(row.category),
      status: String(row.status) as "completed" | "failed",
      rowsReceived: Number(row.rows_received || 0),
      rowsImported: Number(row.rows_imported || 0),
      rowsSkipped: Number(row.rows_skipped || 0),
      errorMessage: String(row.error_message || ""),
      completedAt: String(row.completed_at)
    } : null
  };
}

export async function replaceTcgplayerPriceCache(db: PGlite, input: {
  source: string;
  categoryId: string;
  sourceVersion: string;
  groupsSeen: number;
  rowsReceived: number;
  rowsSkipped: number;
  rows: TcgplayerPriceCacheInput[];
}): Promise<TcgplayerPriceCacheStatus> {
  const runId = crypto.randomUUID();
  const validRows = input.rows
    .map((row) => ({
      ...row,
      tcgplayerProductId: String(row.tcgplayerProductId || "").trim(),
      subTypeName: String(row.subTypeName || "").trim()
    }))
    .filter((row) => row.tcgplayerProductId && row.subTypeName);
  const uniqueRows = [...new Map(validRows.map((row) => [`${row.tcgplayerProductId}\u0000${row.subTypeName.toLowerCase()}`, row])).values()];
  const duplicateRows = validRows.length - uniqueRows.length;
  const invalidRows = input.rows.length - validRows.length;

  await db.exec("begin");
  try {
    await db.query(`
      insert into tcgplayer_price_cache_runs (
        id, source, category_id, source_version, status, groups_seen,
        rows_received, rows_imported, rows_skipped, started_at, completed_at
      ) values ($1, $2, $3, $4, 'completed', $5, $6, $7, $8, now(), now())
    `, [
      runId,
      input.source,
      input.categoryId,
      input.sourceVersion,
      input.groupsSeen,
      input.rowsReceived,
      uniqueRows.length,
      input.rowsSkipped + duplicateRows + invalidRows
    ]);

    for (let offset = 0; offset < uniqueRows.length; offset += 250) {
      const chunk = uniqueRows.slice(offset, offset + 250);
      const params: unknown[] = [];
      const values = chunk.map((row, index) => {
        const base = index * 9;
        params.push(
          row.tcgplayerProductId,
          row.subTypeName,
          row.lowPriceUsd,
          row.midPriceUsd,
          row.highPriceUsd,
          row.marketPriceUsd,
          row.directLowPriceUsd,
          row.sourceGroupId,
          runId
        );
        return `(${Array.from({ length: 9 }, (_, parameter) => `$${base + parameter + 1}`).join(", ")}, now())`;
      }).join(",\n");
      await db.query(`
        insert into tcgplayer_price_cache_entries (
          tcgplayer_product_id, sub_type_name, low_price_usd, mid_price_usd,
          high_price_usd, market_price_usd, direct_low_price_usd,
          source_group_id, sync_run_id, imported_at
        ) values ${values}
        on conflict (tcgplayer_product_id, sub_type_name) do update set
          low_price_usd = excluded.low_price_usd,
          mid_price_usd = excluded.mid_price_usd,
          high_price_usd = excluded.high_price_usd,
          market_price_usd = excluded.market_price_usd,
          direct_low_price_usd = excluded.direct_low_price_usd,
          source_group_id = excluded.source_group_id,
          sync_run_id = excluded.sync_run_id,
          imported_at = now()
      `, params);
    }

    await db.query("delete from tcgplayer_price_cache_entries where sync_run_id <> $1", [runId]);
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }

  return getTcgplayerPriceCacheStatus(db);
}

export async function recordTcgplayerPriceCacheFailure(db: PGlite, input: {
  source: string;
  categoryId: string;
  sourceVersion?: string;
  errorMessage: string;
}): Promise<void> {
  await db.query(`
    insert into tcgplayer_price_cache_runs (
      id, source, category_id, source_version, status, error_message, started_at, completed_at
    ) values ($1, $2, $3, $4, 'failed', $5, now(), now())
  `, [crypto.randomUUID(), input.source, input.categoryId, input.sourceVersion || "", input.errorMessage.slice(0, 1000)]);
}

export async function recordTcgplayerPriceCacheSkipped(db: PGlite, input: {
  source: string;
  categoryId: string;
  sourceVersion: string;
  reason: string;
}): Promise<TcgplayerPriceCacheStatus> {
  await db.query(`
    insert into tcgplayer_price_cache_runs (
      id, source, category_id, source_version, status, error_message, started_at, completed_at
    ) values ($1, $2, $3, $4, 'skipped', $5, now(), now())
  `, [crypto.randomUUID(), input.source, input.categoryId, input.sourceVersion, input.reason.slice(0, 1000)]);
  return getTcgplayerPriceCacheStatus(db);
}

export async function getLatestTcgplayerPriceSourceVersion(db: PGlite, source = "tcgcsv", categoryId = "3"): Promise<string> {
  const result = await db.query<{ source_version: string }>(`
    select source_version
    from tcgplayer_price_cache_runs
    where source = $1 and category_id = $2 and status = 'completed' and coalesce(source_version, '') <> ''
    order by completed_at desc
    limit 1
  `, [source, categoryId]);
  return String(result.rows[0]?.source_version || "");
}

export async function getTcgplayerPriceCacheStatus(db: PGlite): Promise<TcgplayerPriceCacheStatus> {
  const counts = await db.query<Record<string, unknown>>(`
    select
      count(*)::integer as total_entries,
      count(*) filter (
        where low_price_usd is not null
          or mid_price_usd is not null
          or high_price_usd is not null
          or market_price_usd is not null
          or direct_low_price_usd is not null
      )::integer as priced_entries,
      count(distinct tcgplayer_product_id)::integer as product_entries,
      count(distinct tcgplayer_product_id) filter (
        where exists (
          select 1 from card_index_entries cie
          where cie.tcgplayer_product_id = tcgplayer_price_cache_entries.tcgplayer_product_id
        )
      )::integer as linked_product_entries
    from tcgplayer_price_cache_entries
  `);
  const linkedCards = await db.query<{ linked_card_index_entries: number }>(`
    select count(*)::integer as linked_card_index_entries
    from card_index_entries cie
    where coalesce(cie.tcgplayer_product_id, '') <> ''
      and exists (
        select 1 from tcgplayer_price_cache_entries tpce
        where tpce.tcgplayer_product_id = cie.tcgplayer_product_id
      )
  `);
  const runs = await db.query<Record<string, unknown>>(`
    select id, source, category_id, source_version, status, groups_seen,
      rows_received, rows_imported, rows_skipped, error_message, completed_at
    from tcgplayer_price_cache_runs
    order by completed_at desc
    limit 1
  `);
  const row = counts.rows[0] || {};
  const run = runs.rows[0];
  return {
    totalEntries: Number(row.total_entries || 0),
    pricedEntries: Number(row.priced_entries || 0),
    productEntries: Number(row.product_entries || 0),
    linkedProductEntries: Number(row.linked_product_entries || 0),
    linkedCardIndexEntries: Number(linkedCards.rows[0]?.linked_card_index_entries || 0),
    lastRun: run ? {
      id: String(run.id),
      source: String(run.source || ""),
      categoryId: String(run.category_id || ""),
      sourceVersion: String(run.source_version || ""),
      status: String(run.status || "failed") as "completed" | "failed" | "skipped",
      groupsSeen: Number(run.groups_seen || 0),
      rowsReceived: Number(run.rows_received || 0),
      rowsImported: Number(run.rows_imported || 0),
      rowsSkipped: Number(run.rows_skipped || 0),
      errorMessage: String(run.error_message || ""),
      completedAt: String(run.completed_at)
    } : null
  };
}

export async function refreshCardIndexFromPriceChartingBatch(db: PGlite, options: {
  afterId?: string;
  limit?: number;
} = {}): Promise<CardIndexPriceChartingBatchResult> {
  let lastId = String(options.afterId || "");
  const limit = Math.max(1, Math.min(5000, Math.floor(options.limit || 1000)));
  let processed = 0;
  let complete = false;
  while (processed < limit) {
    const chunkLimit = Math.min(500, limit - processed);
    const rows = await db.query<Record<string, unknown>>(`
      select
        pce.pricecharting_id,
        pce.product_name,
        pce.normalized_name,
        pce.expansion_name,
        pce.normalized_expansion,
        pce.card_number,
        pce.language_group,
        pce.canonical_url,
        coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), nullif(pce.image_url, ''), nullif(tcg_image.image_url, '')) as image_url
      from pricecharting_cache_entries pce
      left join pricecharting_image_cache pic using (pricecharting_id)
      left join lateral (
        select cie.image_url
        from card_index_entries cie
        where cie.pricecharting_id like 'tcgcsv-%'
          and coalesce(cie.image_url, '') <> ''
          and cie.language_group = pce.language_group
          and cie.normalized_expansion = pce.normalized_expansion
          and regexp_replace(lower(split_part(coalesce(cie.card_number, ''), '/', 1)), '^0+', '') =
              regexp_replace(lower(split_part(coalesce(pce.card_number, ''), '/', 1)), '^0+', '')
        order by cie.updated_at desc
        limit 1
      ) tcg_image on true
      where pce.pricecharting_id > $1
      order by pce.pricecharting_id
      limit $2
    `, [lastId, chunkLimit]);
    const chunk = rows.rows;
    if (!chunk.length) {
      complete = true;
      break;
    }
    const params: unknown[] = [];
    const values = chunk.map((row, index) => {
      const base = index * 12;
      const imageUrl = String(row.image_url || "");
      const languageGroup = inferLanguageGroup(String(row.expansion_name || ""), String(row.product_name || ""), String(row.canonical_url || ""), String(row.language_group || ""));
      params.push(
        crypto.randomUUID(),
        String(row.pricecharting_id || ""),
        String(row.product_name || ""),
        String(row.expansion_name || ""),
        String(row.card_number || ""),
        languageGroup,
        String(row.normalized_name || normalizeImportText(String(row.product_name || ""))),
        String(row.normalized_expansion || normalizeImportText(String(row.expansion_name || ""))),
        String(row.canonical_url || ""),
        imageUrl,
        imageUrl,
        imageUrl ? imageSourceForIndex(imageUrl) : ""
      );
      return `(${Array.from({ length: 12 }, (_, parameter) => `$${base + parameter + 1}`).join(", ")}, now(), now())`;
    }).join(",\n");
    await db.query(`
      insert into card_index_entries (
        id, pricecharting_id, canonical_name, canonical_expansion, card_number,
        language_group, normalized_name, normalized_expansion, pricecharting_url, pricecharting_image_url,
        image_url, image_source, created_at, updated_at
      ) values ${values}
      on conflict (pricecharting_id) do update set
        canonical_name = excluded.canonical_name,
        canonical_expansion = excluded.canonical_expansion,
        card_number = excluded.card_number,
        language_group = excluded.language_group,
        normalized_name = excluded.normalized_name,
        normalized_expansion = excluded.normalized_expansion,
        pricecharting_url = excluded.pricecharting_url,
        pricecharting_image_url = excluded.pricecharting_image_url,
        image_url = coalesce(nullif(card_index_entries.image_url, ''), nullif(excluded.image_url, ''), ''),
        image_source = case
          when coalesce(card_index_entries.image_url, '') <> '' then card_index_entries.image_source
          else excluded.image_source
        end,
        updated_at = now()
    `, params);
    await upsertPriceChartingSourceLinks(db, chunk);
    lastId = String(chunk[chunk.length - 1].pricecharting_id || lastId);
    processed += chunk.length;
    if (chunk.length < chunkLimit) {
      complete = true;
      break;
    }
  }

  return {
    processed,
    nextAfterId: complete ? "" : lastId,
    complete,
    status: await getCardIndexStatus(db)
  };
}

export async function refreshCardIndexFromPriceCharting(db: PGlite): Promise<CardIndexStatus> {
  let afterId = "";
  for (;;) {
    const batch = await refreshCardIndexFromPriceChartingBatch(db, { afterId, limit: 5000 });
    if (batch.complete || !batch.nextAfterId) return batch.status;
    afterId = batch.nextAfterId;
  }
}

export async function getCardIndexStatus(db: PGlite): Promise<CardIndexStatus> {
  const counts = await db.query<Record<string, unknown>>(`
    select
      count(*)::integer as total_entries,
      count(*) filter (where coalesce(pricecharting_id, '') <> '')::integer as pricecharting_entries,
      count(*) filter (where coalesce(tcgplayer_product_id, '') <> '')::integer as tcgplayer_linked_entries,
      count(*) filter (where coalesce(coolstuff_url, '') <> '')::integer as coolstuff_linked_entries,
      count(*) filter (where coalesce(image_url, '') <> '')::integer as image_linked_entries,
      count(*) filter (where match_status = 'matched')::integer as matched_entries,
      count(*) filter (where match_status = 'weak_match')::integer as weak_match_entries,
      count(*) filter (where match_status = 'conflict')::integer as conflict_entries,
      count(*) filter (where match_status = 'pricecharting_only')::integer as pricecharting_only_entries
    from card_index_entries
  `);
  const runs = await db.query<Record<string, unknown>>(`
    select source, status, rows_seen, rows_matched, rows_weak, rows_conflict, error_message, completed_at
    from card_index_sync_runs
    order by completed_at desc
    limit 1
  `);
  const row = counts.rows[0] || {};
  const run = runs.rows[0];
  return {
    totalEntries: Number(row.total_entries || 0),
    priceChartingEntries: Number(row.pricecharting_entries || 0),
    tcgplayerLinkedEntries: Number(row.tcgplayer_linked_entries || 0),
    coolstuffLinkedEntries: Number(row.coolstuff_linked_entries || 0),
    imageLinkedEntries: Number(row.image_linked_entries || 0),
    matchedEntries: Number(row.matched_entries || 0),
    weakMatchEntries: Number(row.weak_match_entries || 0),
    conflictEntries: Number(row.conflict_entries || 0),
    priceChartingOnlyEntries: Number(row.pricecharting_only_entries || 0),
    lastRun: run ? {
      source: String(run.source || ""),
      status: String(run.status || "failed") as "completed" | "failed",
      rowsSeen: Number(run.rows_seen || 0),
      rowsMatched: Number(run.rows_matched || 0),
      rowsWeak: Number(run.rows_weak || 0),
      rowsConflict: Number(run.rows_conflict || 0),
      errorMessage: String(run.error_message || ""),
      completedAt: String(run.completed_at)
    } : null
  };
}

export async function listCardIndex(db: PGlite, query = "", limit = 50, filter = "all", languageGroup = "all"): Promise<{ entries: CardIndexEntry[]; status: CardIndexStatus }> {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const parsedQuery = parseSearchQuery(query);
  const safeLanguageGroup = normalizeLanguageGroupFilter(languageGroup);
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (safeLanguageGroup !== "all") {
    params.push(safeLanguageGroup);
    clauses.push(`language_group = $${params.length}`);
  }
  if (filter === "matched") clauses.push("match_status = 'matched'");
  else if (filter === "weak_match") clauses.push("match_status = 'weak_match'");
  else if (filter === "conflict") clauses.push("match_status = 'conflict'");
  else if (filter === "pricecharting_only") clauses.push("match_status = 'pricecharting_only'");
  else if (filter === "missing_tcg") clauses.push("coalesce(tcgplayer_url, '') = ''");
  else if (filter === "missing_image") clauses.push("coalesce(image_url, '') = ''");
  else if (filter === "approved") clauses.push("review_status = 'approved'");
  else if (filter === "rejected") clauses.push("review_status = 'rejected'");
  else if (filter === "manual") clauses.push("review_status = 'manual'");
  else if (filter === "pending_review") clauses.push("(review_status = 'pending' and match_status in ('weak_match', 'conflict'))");
  for (const token of parsedQuery.textTokens) {
    const variantClauses = searchTokenVariants(token).map((variant) => {
      params.push(`%${variant}%`);
      const placeholder = `$${params.length}`;
      return `(normalized_name like ${placeholder} or normalized_expansion like ${placeholder} or lower(pricecharting_id) like ${placeholder} or lower(tcgplayer_product_id) like ${placeholder})`;
    });
    clauses.push(`(${variantClauses.join(" or ")})`);
  }
  for (const token of parsedQuery.numberTokens) {
    params.push(token, `%${token}%`);
    const exact = `$${params.length - 1}`;
    const fuzzy = `$${params.length}`;
    clauses.push(`(regexp_replace(lower(split_part(card_number, '/', 1)), '^0+', '') = ${exact} or lower(regexp_replace(card_number, '[^a-z0-9]+', '', 'g')) like ${fuzzy})`);
  }
  const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
  params.push(safeLimit);
  const result = await db.query<Record<string, unknown>>(`
    select *
    from card_index_entries
    ${whereSql}
    order by
      case
        when match_status = 'conflict' then 0
        when match_status = 'weak_match' then 1
        when coalesce(tcgplayer_url, '') = '' then 2
        when coalesce(image_url, '') = '' then 3
        else 4
      end,
      match_confidence desc, canonical_name, canonical_expansion, card_number
    limit $${params.length}
  `, params);
  return {
    entries: result.rows.map(mapCardIndexRow),
    status: await getCardIndexStatus(db)
  };
}

export async function recordCardIndexFailure(db: PGlite, source: string, errorMessage: string): Promise<void> {
  await db.query(`
    insert into card_index_sync_runs (
      id, source, status, error_message, started_at, completed_at
    ) values ($1, $2, 'failed', $3, now(), now())
  `, [crypto.randomUUID(), source, errorMessage.slice(0, 1000)]);
}

export async function reviewCardIndexEntry(db: PGlite, cardIndexId: string, input: {
  action: "approve" | "reject" | "manual";
  tcgplayerProductId?: string;
  tcgplayerUrl?: string;
  imageUrl?: string;
  note?: string;
}): Promise<CardIndexEntry> {
  const current = await db.query<Record<string, unknown>>("select * from card_index_entries where id = $1 limit 1", [cardIndexId]);
  if (!current.rows[0]) throw new Error("Entrada de indice no encontrada.");
  const action = input.action;
  const note = String(input.note || "").trim().slice(0, 1000);
  if (action === "approve") {
    await db.query(`
      update card_index_entries
      set review_status = 'approved',
        review_note = $2,
        reviewed_at = now(),
        updated_at = now()
      where id = $1
    `, [cardIndexId, note]);
  } else if (action === "reject") {
    await db.query(`
      update card_index_entries
      set review_status = 'rejected',
        review_note = $2,
        reviewed_at = now(),
        updated_at = now()
      where id = $1
    `, [cardIndexId, note]);
  } else {
    const tcgplayerProductId = String(input.tcgplayerProductId || "").trim();
    const tcgplayerUrl = String(input.tcgplayerUrl || "").trim();
    const imageUrl = String(input.imageUrl || "").trim();
    await db.query(`
      update card_index_entries
      set review_status = 'manual',
        review_note = $2,
        reviewed_at = now(),
        updated_at = now(),
        match_status = 'manual',
        match_confidence = 100,
        tcgplayer_product_id = case when $3 <> '' then $3 else tcgplayer_product_id end,
        tcgplayer_url = case when $4 <> '' then $4 else tcgplayer_url end,
        tcgplayer_image_url = case when $5 <> '' then $5 else tcgplayer_image_url end,
        image_url = case when $5 <> '' then $5 else image_url end,
        image_source = case when $5 <> '' then 'manual' else image_source end,
        evidence_json = jsonb_set(
          coalesce(evidence_json, '{}'::jsonb),
          '{manual}',
          $6::jsonb,
          true
        )
      where id = $1
    `, [
      cardIndexId,
      note,
      tcgplayerProductId,
      tcgplayerUrl,
      imageUrl,
      JSON.stringify({ tcgplayerProductId, tcgplayerUrl, imageUrl, note, reviewedAt: new Date().toISOString() })
    ]);
    if (tcgplayerProductId || tcgplayerUrl || imageUrl) {
      await db.query(`
        insert into card_source_links (
          id, card_index_id, source, external_id, url, raw_name, raw_expansion,
          raw_number, raw_variant, image_url, confidence, evidence_json, created_at, updated_at
        )
        select $1, id, 'manual', $3, $4, canonical_name, canonical_expansion,
          card_number, '', $5, 100, $6::jsonb, now(), now()
        from card_index_entries
        where id = $2
        on conflict (card_index_id, source) do update set
          external_id = excluded.external_id,
          url = excluded.url,
          image_url = excluded.image_url,
          confidence = excluded.confidence,
          evidence_json = excluded.evidence_json,
          updated_at = now()
      `, [
        crypto.randomUUID(),
        cardIndexId,
        tcgplayerProductId,
        tcgplayerUrl,
        imageUrl,
        JSON.stringify({ note, reviewedAt: new Date().toISOString() })
      ]);
    }
  }
  const updated = await db.query<Record<string, unknown>>("select * from card_index_entries where id = $1 limit 1", [cardIndexId]);
  return mapCardIndexRow(updated.rows[0]);
}

export async function approveCardIndexEntriesByConfidence(db: PGlite, input: {
  minimumConfidence: number;
  note?: string;
}): Promise<{ approved: number; status: CardIndexStatus }> {
  const minimumConfidence = Math.max(0, Math.min(100, Math.floor(Number(input.minimumConfidence || 0))));
  const note = String(input.note || `Aprobado automaticamente por confianza >= ${minimumConfidence}%`).trim().slice(0, 1000);
  const result = await db.query<Record<string, unknown>>(`
    update card_index_entries
    set review_status = 'approved',
      review_note = $2,
      reviewed_at = now(),
      updated_at = now()
    where review_status = 'pending'
      and match_status in ('matched', 'weak_match')
      and match_confidence >= $1
      and coalesce(tcgplayer_url, '') <> ''
      and coalesce(pricecharting_url, '') <> ''
    returning id
  `, [minimumConfidence, note]);
  return {
    approved: result.rows.length,
    status: await getCardIndexStatus(db)
  };
}

export async function enrichCardIndexFromTcgCsv(db: PGlite, input: {
  groups: TcgCsvGroupInput[];
  products: TcgCsvProductInput[];
}): Promise<CardIndexTcgCsvResult> {
  const startedAt = new Date();
  const groupsById = new Map(input.groups.map((group) => [String(group.groupId), group]));
  const rows = await db.query<Record<string, unknown>>("select * from card_index_entries");
  const entries = rows.rows.map(mapCardIndexRow);
  const indexes = buildCardIndexLookup(entries);
  let rowsMatched = 0;
  let rowsWeak = 0;
  let rowsConflict = 0;
  let rowsSkipped = 0;

  for (const product of input.products) {
    const group = groupsById.get(String(product.groupId));
    if (!group) {
      rowsSkipped++;
      continue;
    }
    const number = primaryImportCardNumber(tcgCsvExtendedValue(product, "Number", "Card Number"));
    if (!number) {
      rowsSkipped++;
      continue;
    }
    const rawName = String(product.name || product.cleanName || "").trim();
    const rawExpansion = String(group.name || "").trim();
    if (!rawName || !rawExpansion) {
      rowsSkipped++;
      continue;
    }
    const groupExpansion = normalizeCardIndexExpansion(rawExpansion);
    const candidates = (indexes.byNumber.get(normalizeCardIndexNumber(number)) || [])
      .filter((entry) => {
        const entryExpansion = normalizeCardIndexExpansion(entry.canonicalExpansion);
        return entryExpansion === groupExpansion
          || entryExpansion.endsWith(groupExpansion)
          || groupExpansion.endsWith(entryExpansion)
          || nameTokenOverlap(entryExpansion, groupExpansion) >= 0.6;
      })
      .slice(0, 250);
    let best: { entry: CardIndexEntry; score: number; reasons: string[] } | null = null;
    for (const entry of candidates) {
      const scored = scoreTcgCsvCardIndexMatch(entry, product, group, number);
      if (!best || scored.score > best.score) best = { entry, ...scored };
    }
    if (!best || best.score < 72) {
      rowsSkipped++;
      continue;
    }
    const externalId = String(product.productId || "").trim();
    const currentTcgId = best.entry.tcgplayerProductId;
    const isConflict = !!currentTcgId && currentTcgId !== externalId;
    const matchStatus = isConflict ? "conflict" : best.score >= 86 ? "matched" : "weak_match";
    if (isConflict) rowsConflict++;
    else if (matchStatus === "matched") rowsMatched++;
    else rowsWeak++;
    await upsertCardIndexTcgplayerLink(db, best.entry.id, {
      product,
      group,
      number,
      confidence: best.score,
      matchStatus,
      reasons: best.reasons
    });
  }

  await db.query(`
    insert into card_index_sync_runs (
      id, source, status, rows_seen, rows_matched, rows_weak, rows_conflict,
      started_at, completed_at
    ) values ($1, 'tcgcsv', 'completed', $2, $3, $4, $5, $6, now())
  `, [crypto.randomUUID(), input.products.length, rowsMatched, rowsWeak, rowsConflict, startedAt.toISOString()]);

  return {
    status: await getCardIndexStatus(db),
    rowsSeen: input.products.length,
    rowsMatched,
    rowsWeak,
    rowsConflict,
    rowsSkipped
  };
}

export async function listPriceChartingCache(db: PGlite, query = "", limit = 50, languageGroup = "all"): Promise<{
  entries: PriceChartingCacheEntry[];
  status: PriceChartingCacheStatus;
}> {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const parsedQuery = parseSearchQuery(query);
  const safeLanguageGroup = normalizeLanguageGroupFilter(languageGroup);
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (safeLanguageGroup !== "all") {
    params.push(safeLanguageGroup);
    clauses.push(`pce.language_group = $${params.length}`);
  }
  for (const token of parsedQuery.textTokens) {
    const variantClauses = searchTokenVariants(token).map((variant) => {
      params.push(`%${variant}%`);
      const placeholder = `$${params.length}`;
      return `(pce.search_key like ${placeholder} or lower(pce.pricecharting_id) like ${placeholder})`;
    });
    clauses.push(`(${variantClauses.join(" or ")})`);
  }
  if (parsedQuery.numberTokens.length) {
    const numberClauses = parsedQuery.numberTokens.map((token) => {
      params.push(token, `%${token}%`);
      const exact = `$${params.length - 1}`;
      const fuzzy = `$${params.length}`;
      return `(regexp_replace(lower(split_part(pce.card_number, '/', 1)), '^0+', '') = ${exact} or lower(regexp_replace(pce.card_number, '[^a-z0-9]+', '', 'g')) like ${fuzzy} or lower(pce.pricecharting_id) like ${fuzzy})`;
    });
    clauses.push(`(${numberClauses.join(" or ")})`);
  }
  const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
  params.push(safeLimit);
  const limitPlaceholder = `$${params.length}`;
  const result = await db.query<Record<string, unknown>>(`
    select pricecharting_id, canonical_url, source_url, product_name,
      normalized_name, expansion_name, normalized_expansion, card_number,
      pce.language_group, loose_price_usd,
      coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), nullif(pce.image_url, ''), nullif(tcg_match.image_url, '')) as image_url,
      tcg_price.tcgplayer_price_usd,
      tcg_price.tcgplayer_subtype,
      search_key, imported_at
    from pricecharting_cache_entries pce
    left join pricecharting_image_cache pic using (pricecharting_id)
    left join card_index_entries direct_cie on direct_cie.pricecharting_id = pce.pricecharting_id
    left join lateral (
      select cie.image_url, cie.tcgplayer_product_id
      from card_index_entries cie
      where cie.pricecharting_id like 'tcgcsv-%'
        and (coalesce(cie.image_url, '') <> '' or coalesce(cie.tcgplayer_product_id, '') <> '')
        and cie.language_group = pce.language_group
        and cie.normalized_expansion = pce.normalized_expansion
        and regexp_replace(lower(split_part(coalesce(cie.card_number, ''), '/', 1)), '^0+', '') =
            regexp_replace(lower(split_part(coalesce(pce.card_number, ''), '/', 1)), '^0+', '')
      order by case when coalesce(cie.image_url, '') <> '' then 0 else 1 end, cie.updated_at desc
      limit 1
    ) tcg_match on true
    left join lateral (
      select coalesce(tpce.market_price_usd, tpce.mid_price_usd, tpce.low_price_usd, tpce.direct_low_price_usd, tpce.high_price_usd) as tcgplayer_price_usd,
        tpce.sub_type_name as tcgplayer_subtype
      from tcgplayer_price_cache_entries tpce
      where tpce.tcgplayer_product_id = coalesce(nullif(direct_cie.tcgplayer_product_id, ''), nullif(tcg_match.tcgplayer_product_id, ''))
        and coalesce(tpce.market_price_usd, tpce.mid_price_usd, tpce.low_price_usd, tpce.direct_low_price_usd, tpce.high_price_usd) is not null
      order by case when lower(tpce.sub_type_name) in ('', 'normal') then 0 else 1 end,
        tpce.market_price_usd desc nulls last
      limit 1
    ) tcg_price on true
    ${whereSql}
    order by pce.product_name, pce.expansion_name, pce.card_number
    limit ${limitPlaceholder}
  `, params);
  const rows = result.rows
    .map((row) => ({ row, score: scorePriceChartingSearchRow(row, parsedQuery) }))
    .filter((entry) => !parsedQuery.tokens.length || entry.score > 0)
    .sort((left, right) => right.score - left.score || String(left.row.product_name).localeCompare(String(right.row.product_name), "es", { numeric: true }))
    .slice(0, safeLimit)
    .map((entry) => entry.row);
  return {
    entries: rows.map((row) => ({
      priceChartingId: String(row.pricecharting_id),
      canonicalUrl: String(row.canonical_url || ""),
      sourceUrl: String(row.source_url || ""),
      productName: String(row.product_name),
      normalizedName: String(row.normalized_name),
      expansionName: String(row.expansion_name || ""),
      normalizedExpansion: String(row.normalized_expansion || ""),
      cardNumber: String(row.card_number || ""),
      finish: inferFinishFromPriceChartingName(String(row.product_name || ""), String(row.canonical_url || "")),
      loosePriceUsd: optionalNumber(row.loose_price_usd) ?? null,
      tcgplayerPriceUsd: optionalNumber(row.tcgplayer_price_usd) ?? null,
      tcgplayerSubtype: String(row.tcgplayer_subtype || ""),
      imageUrl: String(row.image_url || ""),
      languageGroup: inferLanguageGroup(String(row.expansion_name || ""), String(row.product_name || ""), String(row.canonical_url || ""), String(row.language_group || "")),
      searchKey: String(row.search_key),
      importedAt: String(row.imported_at)
    })),
    status: await getPriceChartingCacheStatus(db)
  };
}

export async function ensurePriceChartingImageQueueForAll(db: PGlite, limit = 1000): Promise<{ queued: number }> {
  const safeLimit = Math.max(1, Math.min(5000, Math.floor(limit)));
  const result = await db.query<{ queued: number }>(`
    with candidates as (
      select pce.pricecharting_id, pce.canonical_url
      from pricecharting_cache_entries pce
      left join pricecharting_image_cache pic using (pricecharting_id)
      where pic.pricecharting_id is null or pic.status = 'failed'
      order by pce.imported_at desc, pce.pricecharting_id
      limit $1
    ),
    upserted as (
      insert into pricecharting_image_cache (
        pricecharting_id, status, priority, source_page_url, next_attempt_at, created_at, updated_at
      )
      select pricecharting_id, 'pending', 100, canonical_url, now(), now(), now()
      from candidates
      on conflict (pricecharting_id) do update set
        status = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.status else 'pending' end,
        priority = least(pricecharting_image_cache.priority, excluded.priority),
        source_page_url = coalesce(nullif(pricecharting_image_cache.source_page_url, ''), excluded.source_page_url),
        error_message = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.error_message else '' end,
        next_attempt_at = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.next_attempt_at else now() end,
        updated_at = now()
      returning pricecharting_id
    )
    select count(*)::integer as queued from upserted
  `, [safeLimit]);
  return { queued: Number(result.rows[0]?.queued || 0) };
}

export async function ensurePriceChartingImageQueueForStock(db: PGlite, businessId: string): Promise<{ queued: number }> {
  const result = await db.query<{ queued: number }>(`
    with stock_matches as (
      select distinct on (pce.pricecharting_id)
        pce.pricecharting_id,
        pce.canonical_url
      from inventory_items ii
      join card_products p on p.id = ii.product_id
      left join external_identifiers ei on ei.product_id = p.id
      left join external_sources es on es.id = ei.source_id
      join pricecharting_cache_entries pce on
        pce.pricecharting_id = ei.external_id
        or pce.canonical_url = ei.external_url
        or (
          pce.normalized_name = lower(p.name)
          and pce.normalized_expansion = lower(p.expansion)
          and coalesce(nullif(pce.card_number, ''), '') = coalesce(p.card_number, '')
        )
      where ii.business_id = $1
        and ii.active = true
    ),
    upserted as (
      insert into pricecharting_image_cache (
        pricecharting_id, status, priority, source_page_url, next_attempt_at, created_at, updated_at
      )
      select pricecharting_id, 'pending', 10, canonical_url, now(), now(), now()
      from stock_matches
      on conflict (pricecharting_id) do update set
        status = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.status else 'pending' end,
        priority = least(pricecharting_image_cache.priority, excluded.priority),
        source_page_url = coalesce(nullif(pricecharting_image_cache.source_page_url, ''), excluded.source_page_url),
        error_message = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.error_message else '' end,
        next_attempt_at = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.next_attempt_at else now() end,
        updated_at = now()
      returning pricecharting_id
    )
    select count(*)::integer as queued from upserted
  `, [businessId]);
  return { queued: Number(result.rows[0]?.queued || 0) };
}

export async function ensurePriceChartingImageQueueForActiveClaim(db: PGlite, businessId: string): Promise<{ queued: number; missing: number }> {
  const result = await db.query<{ queued: number; missing: number }>(`
    with active_claim as (
      select id
      from claim_sessions
      where business_id = $1 and status = 'open'
      order by created_at desc
      limit 1
    ),
    claim_matches as (
      select distinct cc.pricecharting_id, coalesce(nullif(cc.canonical_url, ''), pce.canonical_url) as canonical_url
      from claim_cards cc
      join active_claim ac on ac.id = cc.claim_id
      join pricecharting_cache_entries pce on pce.pricecharting_id = cc.pricecharting_id
      left join pricecharting_image_cache pic on pic.pricecharting_id = cc.pricecharting_id
      where cc.business_id = $1
        and cc.status <> 'ignored'
        and coalesce(cc.pricecharting_id, '') <> ''
        and (
          pic.pricecharting_id is null
          or pic.status = 'failed'
          or coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), nullif(cc.image_url, ''), '') = ''
        )
    ),
    upserted as (
      insert into pricecharting_image_cache (
        pricecharting_id, status, priority, source_page_url, next_attempt_at, created_at, updated_at
      )
      select pricecharting_id, 'pending', 1, canonical_url, now(), now(), now()
      from claim_matches
      on conflict (pricecharting_id) do update set
        status = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.status else 'pending' end,
        priority = least(pricecharting_image_cache.priority, excluded.priority),
        source_page_url = coalesce(nullif(pricecharting_image_cache.source_page_url, ''), excluded.source_page_url),
        error_message = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.error_message else '' end,
        next_attempt_at = case when pricecharting_image_cache.status = 'downloaded' then pricecharting_image_cache.next_attempt_at else now() end,
        updated_at = now()
      returning pricecharting_id
    )
    select
      (select count(*)::integer from upserted) as queued,
      (select count(*)::integer from claim_matches) as missing
  `, [businessId]);
  return {
    queued: Number(result.rows[0]?.queued || 0),
    missing: Number(result.rows[0]?.missing || 0)
  };
}

export async function getPriceChartingImageCacheStatus(db: PGlite, businessId = demoBusinessId): Promise<PriceChartingImageCacheStatus> {
  const counts = await db.query<Record<string, unknown>>(`
    select
      count(pic.pricecharting_id)::integer as total_entries,
      count(*) filter (where pic.status = 'pending')::integer as pending_entries,
      count(*) filter (where coalesce(pic.source_image_url, '') <> '')::integer as url_entries,
      count(*) filter (where pic.status = 'downloaded')::integer as downloaded_entries,
      count(*) filter (where pic.status = 'failed')::integer as failed_entries,
      coalesce(sum(pic.byte_size), 0)::bigint as bytes_stored
    from pricecharting_image_cache pic
  `);
  const stockLinked = await db.query<{ stock_linked_entries: number }>(`
    with stock_products as (
      select distinct
        p.id as product_id,
        p.name,
        p.expansion,
        coalesce(p.card_number, '') as card_number
      from inventory_items ii
      join card_products p on p.id = ii.product_id
      where ii.business_id = $1 and ii.active = true
    ),
    direct_matches as (
      select distinct ei.external_id as pricecharting_id
      from stock_products sp
      join external_identifiers ei on ei.product_id = sp.product_id
      where ei.business_id = $1 and coalesce(ei.external_id, '') <> ''
    ),
    catalog_matches as (
      select distinct pce.pricecharting_id
      from stock_products sp
      join pricecharting_cache_entries pce on
        pce.normalized_expansion = lower(sp.expansion)
        and coalesce(nullif(pce.card_number, ''), '') = sp.card_number
        and pce.normalized_name = lower(sp.name)
    ),
    stock_matches as (
      select pricecharting_id from direct_matches
      union
      select pricecharting_id from catalog_matches
    )
    select count(distinct pic.pricecharting_id)::integer as stock_linked_entries
    from pricecharting_image_cache pic
    join stock_matches sm on sm.pricecharting_id = pic.pricecharting_id
  `, [businessId]);
  const row = counts.rows[0] || {};
  return {
    totalEntries: Number(row.total_entries || 0),
    pendingEntries: Number(row.pending_entries || 0),
    urlEntries: Number(row.url_entries || 0),
    downloadedEntries: Number(row.downloaded_entries || 0),
    failedEntries: Number(row.failed_entries || 0),
    bytesStored: Number(row.bytes_stored || 0),
    stockLinkedEntries: Number(stockLinked.rows[0]?.stock_linked_entries || 0)
  };
}

export async function claimPriceChartingImageQueue(db: PGlite, limit = 5, options: {
  includeUrlFound?: boolean;
  onlyMissingSourceImageUrl?: boolean;
  onlyWithSourceImageUrl?: boolean;
  activeClaimBusinessId?: string;
} = {}): Promise<PriceChartingImageQueueEntry[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const statusSql = options.includeUrlFound ? "pic.status in ('pending', 'url_found')" : "pic.status = 'pending'";
  const sourceSql = options.onlyMissingSourceImageUrl
    ? "and coalesce(pic.source_image_url, '') = ''"
    : options.onlyWithSourceImageUrl
      ? "and coalesce(pic.source_image_url, '') <> ''"
      : "";
  const params: unknown[] = [safeLimit];
  const activeClaimSql = options.activeClaimBusinessId
    ? `and exists (
        select 1
        from claim_sessions cs
        join claim_cards cc on cc.claim_id = cs.id
        where cs.business_id = $2
          and cs.status = 'open'
          and cc.business_id = $2
          and cc.status <> 'ignored'
          and cc.pricecharting_id = pce.pricecharting_id
          and coalesce(cc.pricecharting_id, '') <> ''
          and coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), nullif(cc.image_url, ''), '') = ''
      )`
    : "";
  if (options.activeClaimBusinessId) params.push(options.activeClaimBusinessId);
  const result = await db.query<Record<string, unknown>>(`
    select
      pce.pricecharting_id,
      pce.product_name,
      pce.expansion_name,
      pce.card_number,
      coalesce(nullif(pic.source_page_url, ''), pce.canonical_url) as canonical_url,
      pic.source_image_url,
      pic.attempts,
      pic.priority
    from pricecharting_image_cache pic
    join pricecharting_cache_entries pce using (pricecharting_id)
    where ${statusSql}
      and pic.next_attempt_at <= now()
      ${sourceSql}
      ${activeClaimSql}
    order by pic.priority, pic.updated_at, pce.product_name
    limit $1
  `, params);
  return result.rows.map((row) => ({
    priceChartingId: String(row.pricecharting_id),
    productName: String(row.product_name),
    expansionName: String(row.expansion_name || ""),
    cardNumber: String(row.card_number || ""),
    canonicalUrl: String(row.canonical_url || ""),
    sourceImageUrl: String(row.source_image_url || ""),
    attempts: Number(row.attempts || 0),
    priority: Number(row.priority || 100)
  }));
}

export async function listActiveClaimMissingPriceChartingImages(db: PGlite, businessId: string, limit = 250): Promise<PriceChartingImageQueueEntry[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const result = await db.query<Record<string, unknown>>(`
    with active_claim as (
      select id
      from claim_sessions
      where business_id = $1 and status = 'open'
      order by created_at desc
      limit 1
    )
    select distinct on (cc.pricecharting_id)
      cc.pricecharting_id,
      coalesce(nullif(cc.product_name, ''), pce.product_name) as product_name,
      coalesce(nullif(cc.expansion_name, ''), pce.expansion_name) as expansion_name,
      coalesce(nullif(cc.card_number, ''), pce.card_number) as card_number,
      coalesce(nullif(cc.canonical_url, ''), pce.canonical_url) as canonical_url,
      coalesce(pic.source_image_url, '') as source_image_url,
      coalesce(pic.attempts, 0)::integer as attempts,
      coalesce(pic.priority, 1)::integer as priority,
      coalesce(cs.sort_order, 999999)::integer as section_sort_order,
      cc.sort_order
    from claim_cards cc
    join active_claim ac on ac.id = cc.claim_id
    join pricecharting_cache_entries pce on pce.pricecharting_id = cc.pricecharting_id
    left join claim_sections cs on cs.id = cc.section_id
    left join pricecharting_image_cache pic on pic.pricecharting_id = cc.pricecharting_id
    where cc.business_id = $1
      and cc.status <> 'ignored'
      and coalesce(cc.pricecharting_id, '') <> ''
      and coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), nullif(cc.image_url, ''), '') = ''
    order by cc.pricecharting_id, section_sort_order, cc.sort_order, cc.created_at
    limit $2
  `, [businessId, safeLimit]);
  return result.rows.map((row) => ({
    priceChartingId: String(row.pricecharting_id),
    productName: String(row.product_name || ""),
    expansionName: String(row.expansion_name || ""),
    cardNumber: String(row.card_number || ""),
    canonicalUrl: String(row.canonical_url || ""),
    sourceImageUrl: String(row.source_image_url || ""),
    attempts: Number(row.attempts || 0),
    priority: Number(row.priority || 1)
  }));
}

export async function recordPriceChartingImageUrlDiscovered(db: PGlite, input: {
  priceChartingId: string;
  sourceImageUrl: string;
  publicUrl?: string;
}): Promise<void> {
  const publicUrl = input.publicUrl || input.sourceImageUrl;
  await db.query(`
    update pricecharting_image_cache
    set status = case when status = 'downloaded' then status else 'url_found' end,
      source_image_url = $2,
      public_url = case when status = 'downloaded' then public_url else $3 end,
      attempts = attempts + 1,
      error_message = '',
      last_attempt_at = now(),
      next_attempt_at = now(),
      updated_at = now()
    where pricecharting_id = $1
  `, [input.priceChartingId, input.sourceImageUrl, publicUrl]);

  await db.query(`
    update pricecharting_cache_entries
    set image_url = $2
    where pricecharting_id = $1
      and coalesce(image_url, '') = ''
  `, [input.priceChartingId, publicUrl]);

  await db.query(`
    update card_products p
    set image_url = $2,
      updated_at = now()
    from pricecharting_cache_entries pce
    where pce.pricecharting_id = $1
      and coalesce(p.image_url, '') = ''
      and (
        exists (
          select 1
          from external_identifiers ei
          where ei.product_id = p.id
            and (pce.pricecharting_id = ei.external_id or pce.canonical_url = ei.external_url)
        )
        or (
          pce.normalized_name = lower(p.name)
          and pce.normalized_expansion = lower(p.expansion)
          and coalesce(nullif(pce.card_number, ''), '') = coalesce(p.card_number, '')
        )
      )
  `, [input.priceChartingId, publicUrl]);
}

export async function deferPriceChartingImageQueueEntry(db: PGlite, input: {
  priceChartingId: string;
  errorMessage: string;
  retryAfterMinutes?: number;
}): Promise<void> {
  const retryAfterMinutes = Math.max(1, Math.min(24 * 60, Math.floor(input.retryAfterMinutes || 10)));
  await db.query(`
    update pricecharting_image_cache
    set status = case when status = 'downloaded' then status else 'pending' end,
      error_message = $2,
      last_attempt_at = now(),
      next_attempt_at = now() + ($3::text || ' minutes')::interval,
      updated_at = now()
    where pricecharting_id = $1
      and coalesce(source_image_url, '') = ''
  `, [input.priceChartingId, input.errorMessage.slice(0, 1000), retryAfterMinutes]);
}

export async function recordPriceChartingImageSuccess(db: PGlite, input: PriceChartingImageDownloadSuccess): Promise<void> {
  await db.query(`
    insert into pricecharting_image_cache (
      pricecharting_id, status, source_image_url, local_path, public_url,
      content_type, byte_size, content_hash, attempts, error_message,
      last_attempt_at, next_attempt_at, downloaded_at, created_at, updated_at
    )
    values ($1, 'downloaded', $2, $3, $4, $5, $6, $7, 1, '', now(), now(), now(), now(), now())
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
  `, [input.priceChartingId, input.sourceImageUrl, input.localPath, input.publicUrl, input.contentType, input.byteSize, input.contentHash]);

  await db.query(`
    update pricecharting_cache_entries
    set image_url = $2
    where pricecharting_id = $1
  `, [input.priceChartingId, input.publicUrl]);

  await db.query(`
    update card_products p
    set image_url = $2,
      updated_at = now()
    from pricecharting_cache_entries pce
    where pce.pricecharting_id = $1
      and coalesce(p.image_url, '') = ''
      and (
        exists (
          select 1
          from external_identifiers ei
          where ei.product_id = p.id
            and (pce.pricecharting_id = ei.external_id or pce.canonical_url = ei.external_url)
        )
        or (
          pce.normalized_name = lower(p.name)
          and pce.normalized_expansion = lower(p.expansion)
          and coalesce(nullif(pce.card_number, ''), '') = coalesce(p.card_number, '')
        )
      )
  `, [input.priceChartingId, input.publicUrl]);
}

export async function recordPriceChartingImageFailure(db: PGlite, input: {
  priceChartingId: string;
  errorMessage: string;
  retryAfterMinutes?: number;
}): Promise<void> {
  const retryAfterMinutes = Math.max(15, Math.min(24 * 60, Math.floor(input.retryAfterMinutes || 60)));
  await db.query(`
    insert into pricecharting_image_cache (
      pricecharting_id, status, attempts, error_message,
      last_attempt_at, next_attempt_at, created_at, updated_at
    )
    values ($1, 'pending', 1, $2, now(), now() + ($3::text || ' minutes')::interval, now(), now())
    on conflict (pricecharting_id) do update set
      status = case when pricecharting_image_cache.attempts >= 4 then 'failed' else 'pending' end,
      attempts = pricecharting_image_cache.attempts + 1,
      error_message = excluded.error_message,
      last_attempt_at = now(),
      next_attempt_at = excluded.next_attempt_at,
      updated_at = now()
  `, [input.priceChartingId, input.errorMessage.slice(0, 1000), retryAfterMinutes]);
}

export async function getAuditLog(db: PGlite, businessId = demoBusinessId) {
  const result = await db.query<Record<string, unknown>>(`
    select a.id, a.action, a.entity_type, a.entity_id, a.before_data, a.after_data, a.created_at, u.display_name as actor_name
    from audit_log a
    left join app_users u on u.id = a.actor_user_id
    where a.business_id = $1
    order by a.created_at desc
    limit 100
  `, [businessId]);
  return {
    audit: result.rows.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      beforeData: parseJsonObject(row.before_data),
      afterData: parseJsonObject(row.after_data),
      createdAt: String(row.created_at),
      actorName: String(row.actor_name || "")
    }))
  };
}

export async function listStock(db: PGlite): Promise<{ summary: DbStockSummary; items: DbStockRow[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select
      ii.id,
      ii.business_id,
      ii.sku,
      ii.location,
      ii.intake_batch,
      ii.inventory_status,
      ii.tags, ii.purchase_cost, ii.purchase_currency,
      ii.quantity_on_hand,
      ii.quantity_reserved,
      ii.active,
      greatest(0, ii.quantity_on_hand - ii.quantity_reserved) as available_quantity,
      coalesce(cp.price_ars, 0) as price_ars,
      cp.price_usd,
      coalesce(pc_identifier.external_id, '') as pricecharting_id,
      coalesce(pc_identifier.external_url, pce.canonical_url, '') as pricecharting_url,
      pce.loose_price_usd as pricecharting_loose_price_usd,
      coalesce(cie.tcgplayer_product_id, '') as tcgplayer_product_id,
      coalesce(cie.tcgplayer_url, '') as tcgplayer_url,
      coalesce(tpce.sub_type_name, '') as tcgplayer_sub_type_name,
      tpce.low_price_usd as tcgplayer_low_price_usd,
      tpce.mid_price_usd as tcgplayer_mid_price_usd,
      tpce.high_price_usd as tcgplayer_high_price_usd,
      tpce.market_price_usd as tcgplayer_market_price_usd,
      tpce.direct_low_price_usd as tcgplayer_direct_low_price_usd,
      (
        select pi.unit_cost_ars
        from purchase_items pi
        join purchases pu on pu.id = pi.purchase_id
        where pi.inventory_item_id = ii.id and pu.status = 'received'
        order by pu.created_at desc
        limit 1
      ) as last_purchase_ars,
      (
        select pu.created_at
        from purchase_items pi
        join purchases pu on pu.id = pi.purchase_id
        where pi.inventory_item_id = ii.id and pu.status = 'received'
        order by pu.created_at desc
        limit 1
      ) as last_purchase_at,
      p.id as product_id,
      p.name as product_name,
      p.expansion,
      p.card_number,
      p.image_url,
      v.id as variant_id,
      v.language,
      v.condition,
      v.finish,
      v.grading_company,
      v.grade,
      v.grading_cert,
      coalesce(json_agg(json_build_object(
        'source', es.name,
        'externalId', ei.external_id,
        'url', ei.external_url
      )) filter (where ei.id is not null), '[]'::json) as identifiers
    from inventory_items ii
    join card_products p on p.id = ii.product_id
    join card_variants v on v.id = ii.variant_id
    left join current_prices cp on cp.inventory_item_id = ii.id
    left join lateral (
      select ei.external_id, ei.external_url
      from external_identifiers ei
      join external_sources es on es.id = ei.source_id
      where ei.business_id = ii.business_id
        and es.name = 'pricecharting'
        and (ei.product_id = p.id or ei.variant_id = v.id)
      order by case when ei.variant_id = v.id then 0 else 1 end, ei.id
      limit 1
    ) pc_identifier on true
    left join pricecharting_cache_entries pce on pce.pricecharting_id = pc_identifier.external_id
    left join card_index_entries cie on cie.pricecharting_id = pc_identifier.external_id
    left join lateral (
      select *
      from tcgplayer_price_cache_entries candidate_price
      where candidate_price.tcgplayer_product_id = cie.tcgplayer_product_id
      order by case
        when lower(v.finish) like '%reverse%' and lower(candidate_price.sub_type_name) like '%reverse%' then 0
        when lower(v.finish) like '%holo%' and lower(v.finish) not like '%reverse%' and lower(candidate_price.sub_type_name) like '%holo%' and lower(candidate_price.sub_type_name) not like '%reverse%' then 0
        when lower(v.finish) not like '%reverse%' and lower(v.finish) not like '%holo%' and lower(candidate_price.sub_type_name) = 'normal' then 0
        when lower(candidate_price.sub_type_name) = 'normal' then 1
        else 2
      end, candidate_price.market_price_usd desc nulls last
      limit 1
    ) tpce on true
    left join external_identifiers ei on ei.product_id = p.id
    left join external_sources es on es.id = ei.source_id
    where ii.business_id = $1
    group by ii.id, cp.price_ars, cp.price_usd, p.id, v.id,
      pc_identifier.external_id, pc_identifier.external_url, pce.canonical_url, pce.loose_price_usd,
      cie.tcgplayer_product_id, cie.tcgplayer_url, tpce.sub_type_name, tpce.low_price_usd,
      tpce.mid_price_usd, tpce.high_price_usd, tpce.market_price_usd, tpce.direct_low_price_usd
    order by p.name, v.language, v.condition
  `, [demoBusinessId]);

  const items = result.rows.map((row) => toStockRow(row));
  return { summary: summarizeDbStock(items), items };
}

export async function getInventoryItem(db: PGlite, id: string, businessId = demoBusinessId): Promise<DbStockRow | null> {
  const stock = await listStockForBusiness(db, businessId);
  return stock.items.find((item) => item.id === id) || null;
}

export async function listStockForBusiness(db: PGlite, businessId: string): Promise<{ summary: DbStockSummary; items: DbStockRow[] }> {
  const previousBusinessId = demoBusinessId;
  void previousBusinessId;
  return listStockInternal(db, businessId);
}

async function listStockInternal(db: PGlite, businessId: string): Promise<{ summary: DbStockSummary; items: DbStockRow[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select
      ii.id,
      ii.business_id,
      ii.sku,
      ii.location,
      ii.intake_batch,
      ii.inventory_status,
      ii.tags, ii.purchase_cost, ii.purchase_currency,
      ii.quantity_on_hand,
      ii.quantity_reserved,
      ii.active,
      greatest(0, ii.quantity_on_hand - ii.quantity_reserved) as available_quantity,
      coalesce(cp.price_ars, 0) as price_ars,
      cp.price_usd,
      coalesce(pc_identifier.external_id, '') as pricecharting_id,
      coalesce(pc_identifier.external_url, pce.canonical_url, '') as pricecharting_url,
      pce.loose_price_usd as pricecharting_loose_price_usd,
      coalesce(cie.tcgplayer_product_id, '') as tcgplayer_product_id,
      coalesce(cie.tcgplayer_url, '') as tcgplayer_url,
      coalesce(tpce.sub_type_name, '') as tcgplayer_sub_type_name,
      tpce.low_price_usd as tcgplayer_low_price_usd,
      tpce.mid_price_usd as tcgplayer_mid_price_usd,
      tpce.high_price_usd as tcgplayer_high_price_usd,
      tpce.market_price_usd as tcgplayer_market_price_usd,
      tpce.direct_low_price_usd as tcgplayer_direct_low_price_usd,
      (
        select pi.unit_cost_ars
        from purchase_items pi
        join purchases pu on pu.id = pi.purchase_id
        where pi.inventory_item_id = ii.id and pu.status = 'received'
        order by pu.created_at desc
        limit 1
      ) as last_purchase_ars,
      (
        select pu.created_at
        from purchase_items pi
        join purchases pu on pu.id = pi.purchase_id
        where pi.inventory_item_id = ii.id and pu.status = 'received'
        order by pu.created_at desc
        limit 1
      ) as last_purchase_at,
      p.id as product_id,
      p.name as product_name,
      p.expansion,
      p.card_number,
      p.image_url,
      v.id as variant_id,
      v.language,
      v.condition,
      v.finish,
      v.grading_company,
      v.grade,
      v.grading_cert,
      coalesce(json_agg(json_build_object(
        'source', es.name,
        'externalId', ei.external_id,
        'url', ei.external_url
      )) filter (where ei.id is not null), '[]'::json) as identifiers
    from inventory_items ii
    join card_products p on p.id = ii.product_id
    join card_variants v on v.id = ii.variant_id
    left join current_prices cp on cp.inventory_item_id = ii.id
    left join lateral (
      select ei.external_id, ei.external_url
      from external_identifiers ei
      join external_sources es on es.id = ei.source_id
      where ei.business_id = ii.business_id
        and es.name = 'pricecharting'
        and (ei.product_id = p.id or ei.variant_id = v.id)
      order by case when ei.variant_id = v.id then 0 else 1 end, ei.id
      limit 1
    ) pc_identifier on true
    left join pricecharting_cache_entries pce on pce.pricecharting_id = pc_identifier.external_id
    left join card_index_entries cie on cie.pricecharting_id = pc_identifier.external_id
    left join lateral (
      select *
      from tcgplayer_price_cache_entries candidate_price
      where candidate_price.tcgplayer_product_id = cie.tcgplayer_product_id
      order by case
        when lower(v.finish) like '%reverse%' and lower(candidate_price.sub_type_name) like '%reverse%' then 0
        when lower(v.finish) like '%holo%' and lower(v.finish) not like '%reverse%' and lower(candidate_price.sub_type_name) like '%holo%' and lower(candidate_price.sub_type_name) not like '%reverse%' then 0
        when lower(v.finish) not like '%reverse%' and lower(v.finish) not like '%holo%' and lower(candidate_price.sub_type_name) = 'normal' then 0
        when lower(candidate_price.sub_type_name) = 'normal' then 1
        else 2
      end, candidate_price.market_price_usd desc nulls last
      limit 1
    ) tpce on true
    left join external_identifiers ei on ei.product_id = p.id
    left join external_sources es on es.id = ei.source_id
    where ii.business_id = $1
    group by ii.id, cp.price_ars, cp.price_usd, p.id, v.id,
      pc_identifier.external_id, pc_identifier.external_url, pce.canonical_url, pce.loose_price_usd,
      cie.tcgplayer_product_id, cie.tcgplayer_url, tpce.sub_type_name, tpce.low_price_usd,
      tpce.mid_price_usd, tpce.high_price_usd, tpce.market_price_usd, tpce.direct_low_price_usd
    order by p.name, v.language, v.condition
  `, [businessId]);
  const items = result.rows.map((row) => toStockRow(row));
  return { summary: summarizeDbStock(items), items };
}

export async function listProducts(db: PGlite) {
  const stock = await listStock(db);
  const products = new Map<string, DbStockRow["product"]>();
  const variants = new Map<string, DbStockRow["variant"]>();
  for (const item of stock.items) {
    products.set(item.product.id, item.product);
    variants.set(item.variant.id, item.variant);
  }
  return { products: [...products.values()], variants: [...variants.values()] };
}

export async function listMovements(db: PGlite, businessId = demoBusinessId): Promise<{ movements: DbMovementRow[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select
      m.id,
      m.business_id,
      m.inventory_item_id,
      m.movement_type,
      m.quantity_delta,
      m.unit_cost_usd,
      m.note,
      m.created_at,
      ii.sku,
      p.name as item_name
    from inventory_movements m
    join inventory_items ii on ii.id = m.inventory_item_id
    join card_products p on p.id = ii.product_id
    where m.business_id = $1
    order by m.created_at desc
    limit 100
  `, [businessId]);

  return {
    movements: result.rows.map((row) => ({
      id: String(row.id),
      businessId: String(row.business_id),
      inventoryItemId: String(row.inventory_item_id),
      type: String(row.movement_type),
      quantityDelta: Number(row.quantity_delta),
      unitCostUsd: optionalNumber(row.unit_cost_usd),
      note: String(row.note || ""),
      createdAt: String(row.created_at),
      itemName: String(row.item_name || ""),
      sku: String(row.sku || "")
    }))
  };
}

export async function listImports(db: PGlite, businessId = demoBusinessId): Promise<{ imports: DbImportRunRow[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select id, business_id, source, status, file_name, total_rows, review_rows, applied_rows, created_at, note
    from import_runs
    where business_id = $1
    order by created_at desc
  `, [businessId]);
  return {
    imports: result.rows.map((row) => ({
      id: String(row.id),
      businessId: String(row.business_id),
      source: String(row.source),
      status: String(row.status),
      fileName: String(row.file_name),
      totalRows: Number(row.total_rows),
      reviewRows: Number(row.review_rows),
      appliedRows: Number(row.applied_rows),
      createdAt: String(row.created_at),
      note: String(row.note || "")
    }))
  };
}

export async function listImportRows(db: PGlite): Promise<{ rows: DbImportReviewRow[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select id, import_run_id, row_number, status, raw_payload, review_reason, matched_inventory_item_id
    from import_rows
    where business_id = $1
    order by import_run_id, row_number
  `, [demoBusinessId]);
  return {
    rows: result.rows.map((row) => ({
      id: String(row.id),
      importId: String(row.import_run_id),
      rowNumber: Number(row.row_number),
      status: String(row.status),
      rawPayload: parseJsonObject(row.raw_payload),
      reviewReason: String(row.review_reason || ""),
      matchedInventoryItemId: row.matched_inventory_item_id ? String(row.matched_inventory_item_id) : undefined
    }))
  };
}

export async function listMobileInventoryEntries(db: PGlite, businessId = demoBusinessId, status = "pending", limit = 500): Promise<{ entries: MobileInventoryEntry[] }> {
  const params: unknown[] = [businessId];
  const where = ["mie.business_id = $1"];
  if (status !== "all") {
    params.push(status);
    where.push(`mie.status = $${params.length}`);
  }
  const safeLimit = Math.max(1, Math.min(20000, Math.floor(Number(limit || 500))));
  params.push(safeLimit);
  const limitParam = `$${params.length}`;
  const result = await db.query<Record<string, unknown>>(`
    select mie.*, u.display_name as reviewed_by_name
    from mobile_inventory_entries mie
    left join app_users u on u.id = mie.reviewed_by
    where ${where.join(" and ")}
    order by mie.created_at desc
    limit ${limitParam}
  `, params);
  return { entries: result.rows.map(toMobileInventoryEntry) };
}

export async function createMobileInventoryEntry(db: PGlite, input: MobileInventoryInput, actor: AuthenticatedUser): Promise<MobileInventoryEntry> {
  const quantity = Math.max(1, Math.floor(Number(input.quantityOnHand || 1)));
  const name = String(input.name || "").trim();
  const inventoryItemId = String(input.inventoryItemId || "").trim();
  const priceChartingId = String(input.priceChartingId || "").trim();
  if (!name && !inventoryItemId && !priceChartingId) throw new Error("Busca o identifica una carta antes de guardarla.");
  if (inventoryItemId && !(await getInventoryItem(db, inventoryItemId, actor.businessId))) throw new Error("La carta elegida ya no existe en inventario.");
  const id = crypto.randomUUID();
  const matchType = input.matchType === "inventory" || input.matchType === "card_index" ? input.matchType : "manual";
  await db.query(`
    insert into mobile_inventory_entries (
      id, business_id, helper_name, source, match_type, inventory_item_id, pricecharting_id,
      sku, name, expansion, card_number, language, condition, finish, grading_company,
      grade, location, intake_batch, quantity_on_hand, price_ars, price_usd, image_url, notes
    ) values (
      $1, $2, $3, 'mobile', $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, $21, $22
    )
  `, [
    id,
    actor.businessId,
    String(input.helperName || "").trim().slice(0, 80),
    matchType,
    inventoryItemId || null,
    priceChartingId,
    String(input.sku || "").trim(),
    name,
    String(input.expansion || "").trim(),
    String(input.number || "").trim(),
    String(input.language || "EN").trim().toUpperCase().slice(0, 12),
    String(input.condition || "NM").trim().toUpperCase().slice(0, 24),
    String(input.finish || "normal").trim() || "normal",
    String(input.gradingCompany || "").trim().toUpperCase().slice(0, 24),
    String(input.grade || "").trim().slice(0, 24),
    String(input.location || "").trim().slice(0, 120),
    String(input.intakeBatch || "").trim().slice(0, 160),
    quantity,
    Math.max(0, Number(input.priceArs || 0)),
    input.priceUsd === null || input.priceUsd === undefined ? null : Math.max(0, Number(input.priceUsd || 0)),
    String(input.imageUrl || "").trim(),
    String(input.notes || "").trim().slice(0, 1000)
  ]);
  const saved = await db.query<Record<string, unknown>>("select * from mobile_inventory_entries where id = $1", [id]);
  await writeAudit(db, actor, "mobile_inventory.create", "mobile_inventory_entry", id, null, input);
  return toMobileInventoryEntry(saved.rows[0]);
}

export async function updateMobileInventoryEntryStatus(db: PGlite, id: string, status: "pending" | "reviewed" | "rejected", actor: AuthenticatedUser): Promise<MobileInventoryEntry> {
  const result = await db.query<Record<string, unknown>>(`
    update mobile_inventory_entries
    set status = $3,
      reviewed_at = case when $3 = 'pending' then null else now() end,
      reviewed_by = case when $3 = 'pending' then null else $2::uuid end,
      updated_at = now()
    where id = $1 and business_id = $4
    returning *
  `, [id, actor.id, status, actor.businessId]);
  if (!result.rows[0]) throw new Error("Entrada movil no encontrada.");
  await writeAudit(db, actor, "mobile_inventory.status", "mobile_inventory_entry", id, null, { status });
  return toMobileInventoryEntry(result.rows[0]);
}

export async function deleteMobileInventoryEntry(db: PGlite, id: string, actor: AuthenticatedUser): Promise<{ deleted: boolean; entry?: MobileInventoryEntry }> {
  const result = await db.query<Record<string, unknown>>(`
    delete from mobile_inventory_entries
    where id = $1 and business_id = $2
    returning *
  `, [id, actor.businessId]);
  if (!result.rows[0]) return { deleted: false };
  const entry = toMobileInventoryEntry(result.rows[0]);
  await writeAudit(db, actor, "mobile_inventory.delete", "mobile_inventory_entry", id, entry, null);
  return { deleted: true, entry };
}

export async function listReservations(db: PGlite): Promise<{ reservations: DbReservationRow[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select id, inventory_item_id, quantity, status, channel, external_cart_id, expires_at, created_at
    from reservations
    where business_id = $1
    order by created_at desc
  `, [demoBusinessId]);
  return {
    reservations: result.rows.map((row) => ({
      id: String(row.id),
      inventoryItemId: String(row.inventory_item_id),
      quantity: Number(row.quantity),
      status: String(row.status),
      channel: String(row.channel),
      externalCartId: row.external_cart_id ? String(row.external_cart_id) : undefined,
      expiresAt: row.expires_at ? String(row.expires_at) : undefined,
      createdAt: String(row.created_at)
    }))
  };
}

// PGlite serializes callback transactions. Pass the transaction connection to every
// nested operation so stock and its intake receipt commit or roll back together.
const inventoryTransactions = new WeakSet<object>();
export async function inventoryTransaction<T>(db: PGlite, work: (connection: PGlite) => Promise<T>): Promise<T> {
  if (inventoryTransactions.has(db)) return work(db);
  return db.transaction(async (tx) => {
    const connection = tx as unknown as PGlite;
    inventoryTransactions.add(connection);
    try { return await work(connection); }
    finally { inventoryTransactions.delete(connection); }
  });
}

export async function addInventoryStock(db: PGlite, input: UpsertInventoryInput, actor: AuthenticatedUser): Promise<DbStockRow> {
  return inventoryTransaction(db, async (connection) => {
    if (!Number.isInteger(input.quantityOnHand) || input.quantityOnHand <= 0) throw new Error("Indica una cantidad mayor a cero.");
    const stock = await listStockForBusiness(connection, actor.businessId);
    const same = (a: unknown, b: unknown) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
    const existing = stock.items.find((item) =>
      same(item.product.name, input.name) && same(item.product.expansion, input.expansion) && same(item.product.number, input.number)
      && same(item.variant.language, input.language) && same(item.variant.condition, input.gradingCompany || input.grade ? "GRADED" : input.condition)
      && same(item.variant.finish, input.finish) && same(item.variant.gradingCompany, input.gradingCompany)
      && same(item.variant.grade, input.grade) && same(item.variant.gradingCert, input.gradingCert)
      && (!input.location || same(item.location, input.location)));
    const existingNotes = existing ? await connection.query<{ notes: string }>("select notes from card_products where id = $1 and business_id = $2", [existing.product.id, actor.businessId]) : null;
    return upsertInventoryItem(connection, {
      ...input,
      sku: existing?.sku || `INTAKE-${crypto.randomUUID()}`,
      quantityOnHand: (existing?.quantityOnHand || 0) + input.quantityOnHand,
      quantityReserved: existing?.quantityReserved || 0,
      location: input.location || existing?.location,
      intakeBatch: input.intakeBatch || existing?.intakeBatch,
      tags: input.tags || existing?.tags,
      notes: input.notes || existingNotes?.rows[0]?.notes || "",
      inventoryStatus: existing?.inventoryStatus || input.inventoryStatus,
      stockMovementReferenceType: "intake",
      stockMovementNote: "Ingreso rapido de stock"
    }, actor);
  });
}

export async function upsertInventoryItem(
  db: PGlite,
  input: UpsertInventoryInput,
  actor: AuthenticatedUser
): Promise<DbStockRow> {
  if (!inventoryTransactions.has(db)) return inventoryTransaction(db, (connection) => upsertInventoryItem(connection, input, actor));
  validateInventoryInput(input);
  const before = await findStockBySku(db, actor.businessId, input.sku?.trim() || buildSku(input));
  const productId = before?.product.id || crypto.randomUUID();
  const variantId = before?.variant.id || crypto.randomUUID();
  const itemId = before?.id || crypto.randomUUID();
  const sku = input.sku?.trim() || buildSku(input);
  const gradingCompany = input.gradingCompany?.trim().toUpperCase() || null;
  const grade = input.grade?.trim().toUpperCase() || null;
  const gradingCert = input.gradingCert?.trim() || null;
  const isGraded = Boolean(gradingCompany || grade);
  const condition = isGraded ? "GRADED" : input.condition.trim();
  const finish = input.finish.trim();
  const intakeBatch = input.intakeBatch?.trim() || "";
  const inventoryStatus = normalizeInventoryStatus(input.inventoryStatus);
  const tags = input.tags === undefined ? before?.tags || "" : normalizeInventoryTags(input.tags);
  const quantityDelta = input.quantityOnHand - (before?.quantityOnHand || 0);

  {
    if (before) {
      await db.query(`
        update card_products
        set name = $1, expansion = $2, card_number = $3, image_url = $4, notes = $5, updated_at = now()
        where id = $6 and business_id = $7
      `, [input.name.trim(), input.expansion.trim(), input.number || null, input.imageUrl || null, input.notes || "", productId, actor.businessId]);
      await db.query(`
        update card_variants
        set language = $1, condition = $2, finish = $3, grading_company = $4, grade = $5, grading_cert = $6
        where id = $7 and business_id = $8
      `, [input.language.trim(), condition, finish, gradingCompany, grade, gradingCert, variantId, actor.businessId]);
      await db.query(`
        update inventory_items
        set sku = $1, location = $2, intake_batch = $3, inventory_status = $4, tags = $5, quantity_on_hand = $6, quantity_reserved = $7, active = true, updated_at = now()
        where id = $8 and business_id = $9
      `, [sku, input.location || "", intakeBatch, inventoryStatus, tags, input.quantityOnHand, input.quantityReserved || 0, itemId, actor.businessId]);
    } else {
      await db.query(`
        insert into card_products (id, business_id, name, expansion, card_number, image_url, notes)
        values ($1, $2, $3, $4, $5, $6, $7)
      `, [productId, actor.businessId, input.name.trim(), input.expansion.trim(), input.number || null, input.imageUrl || null, input.notes || ""]);
      await db.query(`
        insert into card_variants (id, business_id, product_id, language, condition, finish, grading_company, grade, grading_cert)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [variantId, actor.businessId, productId, input.language.trim(), condition, finish, gradingCompany, grade, gradingCert]);
      await db.query(`
        insert into inventory_items (id, business_id, sku, product_id, variant_id, location, intake_batch, inventory_status, tags, quantity_on_hand, quantity_reserved, active)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      `, [itemId, actor.businessId, sku, productId, variantId, input.location || "", intakeBatch, inventoryStatus, tags, input.quantityOnHand, input.quantityReserved || 0]);
    }

    if (quantityDelta !== 0) {
      const stockMovementReferenceType = input.stockMovementReferenceType?.trim() || "admin";
      const stockMovementNote = input.stockMovementNote?.trim()
        || (before ? "Ajuste desde edicion manual de inventario" : "Carga manual inicial de inventario");
      await db.query(`
        insert into inventory_movements (
          id, business_id, inventory_item_id, movement_type, quantity_delta,
          reference_type, reference_id, idempotency_key, note, created_by
        )
        values ($1, $2, $3, 'manual_adjustment', $4, $5, $6, $7, $8, $9)
      `, [
        crypto.randomUUID(),
        actor.businessId,
        itemId,
        quantityDelta,
        stockMovementReferenceType,
        itemId,
        `movement-manual-upsert-${itemId}-${crypto.randomUUID()}`,
        stockMovementNote,
        actor.id
      ]);
    }

    if (input.purchaseCost !== undefined) {
      await db.query("update inventory_items set purchase_cost = $1, purchase_currency = $2 where id = $3 and business_id = $4", [input.purchaseCost, input.purchaseCurrency || "ARS", itemId, actor.businessId]);
    }
    await db.query(`
      insert into current_prices (inventory_item_id, business_id, price_ars, price_usd, manual_override)
      values ($1, $2, $3, $4, true)
      on conflict (inventory_item_id) do update
        set price_ars = excluded.price_ars,
            price_usd = excluded.price_usd,
            manual_override = true,
            updated_at = now()
    `, [itemId, actor.businessId, input.priceArs || 0, input.priceUsd ?? null]);

    await upsertExternalIdentifier(db, actor.businessId, productId, variantId, "pricecharting", input.priceChartingId || input.priceChartingUrl || "", input.priceChartingUrl || undefined);
    await upsertExternalIdentifier(db, actor.businessId, productId, variantId, "monprice", input.monPriceId || "", undefined);

    await writeAudit(db, actor, before ? "inventory.update" : "inventory.create", "inventory_item", itemId, before, { ...input, sku });
  }

  const created = await getInventoryItem(db, itemId, actor.businessId);
  if (!created) throw new Error("No se pudo leer el item guardado");
  return created;
}

export async function updateInventoryItemTags(
  db: PGlite,
  inventoryItemId: string,
  tags: string,
  actor: AuthenticatedUser
): Promise<DbStockRow> {
  const before = await getInventoryItem(db, inventoryItemId, actor.businessId);
  if (!before) throw new Error("No se encontro el item de inventario");
  const normalizedTags = normalizeInventoryTags(tags);
  await db.exec("begin");
  try {
    await db.query(`
      update inventory_items
      set tags = $1, updated_at = now()
      where id = $2 and business_id = $3
    `, [normalizedTags, inventoryItemId, actor.businessId]);
    await writeAudit(db, actor, "inventory.tags.update", "inventory_item", inventoryItemId, { tags: before.tags }, { tags: normalizedTags });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  const updated = await getInventoryItem(db, inventoryItemId, actor.businessId);
  if (!updated) throw new Error("No se pudo leer el item actualizado");
  return updated;
}

async function upsertExternalIdentifier(
  db: PGlite,
  businessId: string,
  productId: string,
  variantId: string,
  sourceName: string,
  externalId: string,
  externalUrl?: string
): Promise<void> {
  const cleanExternalId = externalId.trim();
  if (!cleanExternalId) return;
  const source = await db.query<{ id: string }>("select id from external_sources where name = $1 limit 1", [sourceName]);
  const sourceId = source.rows[0]?.id || crypto.randomUUID();
  if (!source.rows[0]) {
    await db.query(`
      insert into external_sources (id, name, kind, base_url, active)
      values ($1, $2, $3, $4, true)
      on conflict (name) do nothing
    `, [sourceId, sourceName, sourceName === "pricecharting" ? "price_reference" : "scanner_import", sourceName === "pricecharting" ? "https://www.pricecharting.com" : ""]);
  }
  await db.query(`
    insert into external_identifiers (id, business_id, source_id, product_id, variant_id, external_id, external_url)
    values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (business_id, source_id, external_id) do update set
      product_id = excluded.product_id,
      variant_id = excluded.variant_id,
      external_url = excluded.external_url
  `, [crypto.randomUUID(), businessId, sourceId, productId, variantId, cleanExternalId, externalUrl || null]);
}

export async function adjustInventoryQuantity(
  db: PGlite,
  input: InventoryAdjustmentInput,
  actor: AuthenticatedUser
): Promise<DbStockRow> {
  if (!inventoryTransactions.has(db)) return inventoryTransaction(db, (connection) => adjustInventoryQuantity(connection, input, actor));
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) throw new Error("El ajuste debe ser un numero entero distinto de cero");
  const before = await getInventoryItem(db, input.inventoryItemId, actor.businessId);
  if (!before) throw new Error("No se encontro el item de inventario");
  const nextQuantity = before.quantityOnHand + input.quantityDelta;
  if (nextQuantity < before.quantityReserved) throw new Error("El ajuste dejaria menos stock que unidades reservadas");

  {
    await db.query(`
      update inventory_items
      set quantity_on_hand = $1, updated_at = now()
      where id = $2 and business_id = $3
    `, [nextQuantity, input.inventoryItemId, actor.businessId]);
    await db.query(`
      insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, unit_cost_ars, unit_cost_usd, reference_type, idempotency_key, note, created_by)
      values ($1, $2, $3, 'manual_adjustment', $4, $5, $6, 'admin', $7, $8, $9)
    `, [crypto.randomUUID(), actor.businessId, input.inventoryItemId, input.quantityDelta, input.unitCostArs || null, input.unitCostUsd || null, crypto.randomUUID(), input.note.trim(), actor.id]);
    await writeAudit(db, actor, "inventory.adjust", "inventory_item", input.inventoryItemId, before, { quantityOnHand: nextQuantity, ...input });
  }

  const updated = await getInventoryItem(db, input.inventoryItemId, actor.businessId);
  if (!updated) throw new Error("No se pudo leer el item ajustado");
  return updated;
}

export async function resetInventoryStock(db: PGlite, actor: AuthenticatedUser): Promise<InventoryResetResult> {
  const rows = await db.query<Record<string, unknown>>(`
    select id, sku, quantity_on_hand, quantity_reserved
    from inventory_items
    where business_id = $1
      and active = true
      and (quantity_on_hand <> 0 or quantity_reserved <> 0)
  `, [actor.businessId]);
  const touchedSkus = rows.rows.length;
  const unitsCleared = rows.rows.reduce((sum, row) => sum + Number(row.quantity_on_hand || 0), 0);
  const reservationsCleared = rows.rows.reduce((sum, row) => sum + Number(row.quantity_reserved || 0), 0);
  if (!touchedSkus) return { touchedSkus, unitsCleared, reservationsCleared };

  const runId = crypto.randomUUID();
  await db.exec("begin");
  try {
    for (const row of rows.rows) {
      const quantity = Number(row.quantity_on_hand || 0);
      if (!quantity) continue;
      await db.query(`
        insert into inventory_movements (
          id, business_id, inventory_item_id, movement_type, quantity_delta,
          reference_type, reference_id, idempotency_key, note, created_by
        )
        values ($1, $2, $3, 'manual_adjustment', $4, 'admin_reset', $5, $6, $7, $8)
      `, [
        crypto.randomUUID(),
        actor.businessId,
        String(row.id),
        -quantity,
        runId,
        `movement-inventory-reset-${runId}-${String(row.id)}`,
        `Reset de inventario a cero desde Admin${String(row.sku || "") ? ` (${String(row.sku)})` : ""}`,
        actor.id
      ]);
    }
    await db.query(`
      update inventory_items
      set quantity_on_hand = 0,
          quantity_reserved = 0,
          updated_at = now()
      where business_id = $1
        and active = true
        and (quantity_on_hand <> 0 or quantity_reserved <> 0)
    `, [actor.businessId]);
    await writeAudit(db, actor, "inventory.reset_stock", "inventory", runId, { touchedSkus, unitsCleared, reservationsCleared }, { touchedSkus, totalUnits: 0, reservedUnits: 0 });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  return { touchedSkus, unitsCleared, reservationsCleared };
}

export async function listSales(db: PGlite, businessId = demoBusinessId): Promise<{ sales: SaleRecord[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select s.id, s.customer_name, s.sale_type, s.status, s.channel, s.total_ars, s.total_usd, s.amount_paid_ars, s.payment_due_at, s.internal_note, s.message_sent_at,
      s.created_at, s.completed_at, si.id as sale_item_id, si.inventory_item_id, si.quantity,
      si.unit_price_ars, si.unit_price_usd, si.line_total_ars, si.line_total_usd, si.price_currency, si.packed_at, ii.sku, p.name,
      coalesce(
        nullif(p.image_url, ''),
        nullif(sale_pic.public_url, ''),
        nullif(sale_pic.source_image_url, ''),
        nullif(sale_index.image_url, ''),
        nullif(sale_index.tcgplayer_image_url, ''),
        nullif(sale_index.pricecharting_image_url, ''),
        ''
      ) as image_url,
      si.display_name, si.sku_snapshot,
      v.language, v.condition, v.finish, v.grading_company, v.grade, v.grading_cert
    from sales s
    left join sale_items si on si.sale_id = s.id
    left join inventory_items ii on ii.id = si.inventory_item_id
    left join card_products p on p.id = ii.product_id
    left join card_variants v on v.id = ii.variant_id
    left join pricecharting_image_cache sale_pic on sale_pic.pricecharting_id = substring(coalesce(si.sku_snapshot, '') from 8)
    left join card_index_entries sale_index on sale_index.pricecharting_id = substring(coalesce(si.sku_snapshot, '') from 8)
    where s.business_id = $1
    order by s.created_at desc, si.id
  `, [businessId]);
  const records = new Map<string, SaleRecord>();
  for (const row of result.rows) {
    const id = String(row.id);
    const record = records.get(id) || {
      id,
      customerName: String(row.customer_name || ""),
      saleType: String(row.sale_type) as SaleRecord["saleType"],
      status: String(row.status) as SaleRecord["status"],
      channel: String(row.channel || ""),
      totalArs: Number(row.total_ars || 0),
      totalUsd: Number(row.total_usd || 0),
      amountPaidArs: Number(row.amount_paid_ars || 0),
      paymentDueAt: row.payment_due_at ? String(row.payment_due_at) : undefined,
      internalNote: String(row.internal_note || ""),
      messageSentAt: row.message_sent_at ? String(row.message_sent_at) : undefined,
      createdAt: String(row.created_at),
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      lines: []
    };
    if (row.quantity || row.display_name) {
      record.lines.push({
        inventoryItemId: row.inventory_item_id ? String(row.inventory_item_id) : "",
        saleItemId: String(row.sale_item_id || ""),
        quantity: Number(row.quantity),
        unitPriceArs: Number(row.unit_price_ars),
        unitPriceUsd: Number(row.unit_price_usd || 0),
        lineTotalArs: Number(row.line_total_ars),
        lineTotalUsd: Number(row.line_total_usd || 0),
        priceCurrency: String(row.price_currency || "ARS") as "ARS" | "USD" | "FREE",
        name: String(row.display_name || saleLineNameFromRow(row)),
        sku: String(row.sku || row.sku_snapshot || ""),
        imageUrl: String(row.image_url || ""),
        packed: Boolean(row.packed_at),
        packedAt: row.packed_at ? String(row.packed_at) : undefined
      });
    }
    records.set(id, record);
  }
  return { sales: [...records.values()] };
}

function stockDisplayName(item: DbStockRow): string {
  const grading = [item.variant.gradingCompany, item.variant.grade].filter(Boolean).join(" ");
  const rawVariant = [item.variant.language, item.variant.condition === "GRADED" ? "" : item.variant.condition].filter(Boolean).join(" / ");
  const suffix = grading || rawVariant;
  return suffix ? `${item.product.name} - ${suffix}` : item.product.name;
}

function saleLineNameFromRow(row: Record<string, unknown>): string {
  const name = String(row.name || "");
  const grading = [row.grading_company, row.grade].filter(Boolean).map(String).join(" ");
  const rawVariant = [row.language, row.condition === "GRADED" ? "" : row.condition].filter(Boolean).map(String).join(" / ");
  const suffix = grading || rawVariant;
  return suffix ? `${name} - ${suffix}` : name;
}

export async function createSale(db: PGlite, input: CreateSaleInput, actor: AuthenticatedUser): Promise<SaleRecord> {
  const lines = normalizeCommerceLines(input.lines);
  if (!lines.length) throw new Error("Agrega al menos una carta al carrito");
  const saleId = crypto.randomUUID();
  const status = input.saleType === "reservation" ? "pending" : "paid";
  let totalArs = 0;
  const stockById = new Map<string, DbStockRow>();
  for (const line of lines) {
    const item = await getInventoryItem(db, line.inventoryItemId, actor.businessId);
    if (!item) throw new Error("Una carta del carrito ya no existe");
    if (line.quantity > item.availableQuantity) throw new Error(`${item.product.name}: solo quedan ${item.availableQuantity} unidades disponibles`);
    stockById.set(item.id, item);
    totalArs += line.quantity * line.unitPriceArs;
  }

  await db.exec("begin");
  try {
    await db.query(`
      insert into sales (id, business_id, customer_name, sale_type, status, channel, total_ars, total_usd, created_by, completed_at)
      values ($1, $2, $3, $4, $5, $6, $7, 0, $8, case when $5 = 'paid' then now() else null end)
    `, [saleId, actor.businessId, input.customerName.trim() || "Venta sin nombre", input.saleType, status, input.channel.trim() || "mostrador", totalArs, actor.id]);

    for (const line of lines) {
      const item = stockById.get(line.inventoryItemId)!;
      await db.query(`
        insert into sale_items (id, business_id, sale_id, inventory_item_id, quantity, unit_price_ars, line_total_ars, display_name, sku_snapshot)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [crypto.randomUUID(), actor.businessId, saleId, line.inventoryItemId, line.quantity, line.unitPriceArs, line.quantity * line.unitPriceArs, stockDisplayName(item), item.sku]);

      if (input.saleType === "reservation") {
        await db.query("update inventory_items set quantity_reserved = quantity_reserved + $1, updated_at = now() where id = $2 and business_id = $3", [line.quantity, line.inventoryItemId, actor.businessId]);
        await db.query(`
          insert into reservations (id, business_id, inventory_item_id, quantity, status, channel, external_cart_id, idempotency_key)
          values ($1, $2, $3, $4, 'active', $5, $6, $7)
        `, [crypto.randomUUID(), actor.businessId, line.inventoryItemId, line.quantity, input.channel.trim() || "mostrador", saleId, `sale-reservation-${saleId}-${line.inventoryItemId}`]);
        await db.query(`
          insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by)
          values ($1, $2, $3, 'reservation', 0, 'sale', $4, $5, $6, $7)
        `, [crypto.randomUUID(), actor.businessId, line.inventoryItemId, saleId, `movement-reservation-${saleId}-${line.inventoryItemId}`, `Reserva para ${input.customerName.trim() || "cliente"}`, actor.id]);
      } else {
        await db.query("update inventory_items set quantity_on_hand = quantity_on_hand - $1, updated_at = now() where id = $2 and business_id = $3", [line.quantity, line.inventoryItemId, actor.businessId]);
        await db.query(`
          insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by)
          values ($1, $2, $3, 'sale', $4, 'sale', $5, $6, $7, $8)
        `, [crypto.randomUUID(), actor.businessId, line.inventoryItemId, -line.quantity, saleId, `movement-sale-${saleId}-${line.inventoryItemId}`, `Venta a ${input.customerName.trim() || "cliente"} por $${line.quantity * line.unitPriceArs}`, actor.id]);
      }
      void item;
    }
    await writeAudit(db, actor, input.saleType === "reservation" ? "sale.reserve" : "sale.create", "sale", saleId, null, { ...input, totalArs, status });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  if (input.saleType === "reservation") await moveSaleToRuleColumn(db, actor.businessId, saleId, true);
  const created = (await listSales(db, actor.businessId)).sales.find((sale) => sale.id === saleId);
  if (!created) throw new Error("No se pudo leer la operacion guardada");
  return created;
}

export async function completeReservationSale(db: PGlite, saleId: string, actor: AuthenticatedUser): Promise<SaleRecord> {
  const sale = (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId);
  if (!sale || sale.saleType !== "reservation" || !["pending", "packed"].includes(sale.status)) throw new Error("La reserva ya no esta pendiente");
  await db.exec("begin");
  try {
    for (const line of sale.lines) {
      if (!line.inventoryItemId) continue;
      const item = await getInventoryItem(db, line.inventoryItemId, actor.businessId);
      if (!item || item.quantityReserved < line.quantity || item.quantityOnHand < line.quantity) throw new Error(`${line.name}: la reserva no coincide con el stock actual`);
      await db.query("update inventory_items set quantity_on_hand = quantity_on_hand - $1, quantity_reserved = quantity_reserved - $1, updated_at = now() where id = $2 and business_id = $3", [line.quantity, line.inventoryItemId, actor.businessId]);
      await db.query("update reservations set status = 'confirmed', confirmed_at = now() where business_id = $1 and external_cart_id = $2 and inventory_item_id = $3 and status = 'active'", [actor.businessId, saleId, line.inventoryItemId]);
      await db.query(`
        insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by)
        values ($1, $2, $3, 'reservation_sale', $4, 'sale', $5, $6, $7, $8)
      `, [crypto.randomUUID(), actor.businessId, line.inventoryItemId, -line.quantity, saleId, `movement-complete-${saleId}-${line.inventoryItemId}`, `Reserva cobrada a ${sale.customerName}`, actor.id]);
    }
    await db.query("update sales set status = 'paid', amount_paid_ars = total_ars, completed_at = now() where id = $1 and business_id = $2", [saleId, actor.businessId]);
    await moveSaleToRuleColumn(db, actor.businessId, saleId, true);
    await writeAudit(db, actor, "sale.complete", "sale", saleId, sale, { status: "paid" });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  return (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId)!;
}

export async function updateSalePayment(db: PGlite, saleId: string, amountPaidArs: number | undefined, actor: AuthenticatedUser, paymentDueAt?: string): Promise<SaleRecord> {
  const amount = amountPaidArs === undefined ? null : Math.max(0, Number(amountPaidArs) || 0);
  await db.query(`
    update sales
    set
      amount_paid_ars = coalesce($1::numeric, amount_paid_ars),
      payment_due_at = case when $2::text is null then payment_due_at else nullif($2, '')::date end
    where id = $3 and business_id = $4
  `, [amount, paymentDueAt === undefined ? null : paymentDueAt, saleId, actor.businessId]);
  await writeAudit(db, actor, "sale.payment.update", "sale", saleId, null, { amountPaidArs: amount, paymentDueAt });
  await moveSaleToRuleColumn(db, actor.businessId, saleId, true);
  const sale = (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId);
  if (!sale) throw new Error("La orden ya no existe.");
  return sale;
}

export async function updateSaleInternalNote(db: PGlite, saleId: string, internalNote: string, actor: AuthenticatedUser): Promise<SaleRecord> {
  const note = String(internalNote || "").trim();
  await db.query("update sales set internal_note = $1 where id = $2 and business_id = $3", [note, saleId, actor.businessId]);
  await writeAudit(db, actor, "sale.note.update", "sale", saleId, null, { internalNote: note });
  const sale = (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId);
  if (!sale) throw new Error("La orden ya no existe.");
  return sale;
}

export async function updateSaleMessageSent(db: PGlite, saleId: string, sent: boolean, actor: AuthenticatedUser): Promise<SaleRecord> {
  await db.query("update sales set message_sent_at = case when $1 then coalesce(message_sent_at, now()) else null end where id = $2 and business_id = $3", [sent, saleId, actor.businessId]);
  await writeAudit(db, actor, "sale.message_sent.update", "sale", saleId, null, { messageSent: sent });
  const sale = (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId);
  if (!sale) throw new Error("La orden ya no existe.");
  return sale;
}

export async function updateSaleItemPacked(db: PGlite, saleItemId: string, packed: boolean, actor: AuthenticatedUser): Promise<SaleRecord> {
  const row = await db.query<{ sale_id: string }>("select sale_id from sale_items where id = $1 and business_id = $2 limit 1", [saleItemId, actor.businessId]);
  const saleId = row.rows[0]?.sale_id;
  if (!saleId) throw new Error("La linea de orden ya no existe.");
  await db.query("update sale_items set packed_at = case when $1 then coalesce(packed_at, now()) else null end where id = $2 and business_id = $3", [packed, saleItemId, actor.businessId]);
  await syncSalePackedStatus(db, actor.businessId, saleId);
  await writeAudit(db, actor, "sale.item.pack", "sale_item", saleItemId, null, { packed });
  await moveSaleToRuleColumn(db, actor.businessId, saleId, true);
  const sale = (await listSales(db, actor.businessId)).sales.find((item) => item.id === saleId);
  if (!sale) throw new Error("La orden ya no existe.");
  return sale;
}

export async function markSalePacked(db: PGlite, saleId: string, actor: AuthenticatedUser): Promise<SaleRecord> {
  const sale = (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId);
  if (!sale || sale.saleType !== "reservation" || !["pending", "packed", "paid"].includes(sale.status)) throw new Error("La orden no esta pendiente.");
  await db.query("update sale_items set packed_at = coalesce(packed_at, now()) where sale_id = $1 and business_id = $2", [saleId, actor.businessId]);
  await db.query("update sales set status = case when status = 'paid' then status else 'packed' end where id = $1 and business_id = $2", [saleId, actor.businessId]);
  await writeAudit(db, actor, "sale.pack", "sale", saleId, sale, { status: "packed" });
  await moveSaleToRuleColumn(db, actor.businessId, saleId, true);
  return (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId)!;
}

export async function markSaleDelivered(db: PGlite, saleId: string, actor: AuthenticatedUser): Promise<SaleRecord> {
  const sale = (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId);
  if (!sale || sale.saleType !== "reservation" || sale.status !== "paid") throw new Error("La orden tiene que estar pagada antes de entregarla.");
  await db.query("update sales set status = 'delivered' where id = $1 and business_id = $2", [saleId, actor.businessId]);
  await writeAudit(db, actor, "sale.deliver", "sale", saleId, sale, { status: "delivered" });
  await moveSaleToRuleColumn(db, actor.businessId, saleId, true);
  return (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId)!;
}

export async function mergeDuplicateCustomerOrders(db: PGlite, actor: AuthenticatedUser): Promise<{ merged: number; groups: Array<{ customerName: string; mergedOrders: number }> }> {
  const rows = await db.query<Record<string, unknown>>(`
    select id, customer_name, channel, total_ars, total_usd, amount_paid_ars, payment_due_at, message_sent_at, created_at
    from sales
    where business_id = $1
      and sale_type = 'reservation'
      and status in ('pending', 'packed')
    order by created_at asc
  `, [actor.businessId]);
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows.rows) {
    const key = normalizeBuyerKey(`${row.channel || ""}:${row.customer_name || ""}`);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  const mergedGroups: Array<{ customerName: string; mergedOrders: number }> = [];
  await db.exec("begin");
  try {
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const keeper = group[0];
      const duplicateIds = group.slice(1).map((row) => String(row.id));
      const allIds = group.map((row) => String(row.id));
      const totalArs = group.reduce((sum, row) => sum + Number(row.total_ars || 0), 0);
      const totalUsd = group.reduce((sum, row) => sum + Number(row.total_usd || 0), 0);
      const amountPaidArs = group.reduce((sum, row) => sum + Number(row.amount_paid_ars || 0), 0);
      const paymentDueAt = group.map((row) => row.payment_due_at ? String(row.payment_due_at).slice(0, 10) : "").filter(Boolean).sort()[0] || "";
      const messageSentAt = group.map((row) => row.message_sent_at ? String(row.message_sent_at) : "").filter(Boolean).sort()[0] || "";

      await db.query("update sale_items set sale_id = $1 where business_id = $2 and sale_id = any($3::uuid[])", [keeper.id, actor.businessId, duplicateIds]);
      await db.query("update reservations set external_cart_id = $1 where business_id = $2 and external_cart_id = any($3::text[])", [String(keeper.id), actor.businessId, duplicateIds]);
      await db.query("delete from sales where business_id = $1 and id = any($2::uuid[])", [actor.businessId, duplicateIds]);
      const packed = await db.query<{ total: number; packed: number }>(`
        select count(*)::integer as total, count(packed_at)::integer as packed
        from sale_items
        where business_id = $1 and sale_id = $2
      `, [actor.businessId, keeper.id]);
      const packedRow = packed.rows[0];
      const nextStatus = Number(packedRow?.total || 0) > 0 && Number(packedRow?.total || 0) === Number(packedRow?.packed || 0) ? "packed" : "pending";
      await db.query(`
        update sales
        set total_ars = $1,
            total_usd = $2,
            amount_paid_ars = $3,
            payment_due_at = nullif($4, '')::date,
            message_sent_at = nullif($5, '')::timestamptz,
            status = $6
        where id = $7 and business_id = $8
      `, [totalArs, totalUsd, amountPaidArs, paymentDueAt, messageSentAt, nextStatus, keeper.id, actor.businessId]);
      await writeAudit(db, actor, "sale.merge_duplicates", "sale", String(keeper.id), { saleIds: allIds }, { keptSaleId: String(keeper.id), mergedSaleIds: duplicateIds });
      mergedGroups.push({ customerName: String(keeper.customer_name || ""), mergedOrders: duplicateIds.length });
    }
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  return { merged: mergedGroups.reduce((sum, group) => sum + group.mergedOrders, 0), groups: mergedGroups };
}

export async function cancelReservationSale(db: PGlite, saleId: string, actor: AuthenticatedUser): Promise<SaleRecord> {
  const sale = (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId);
  if (!sale || sale.saleType !== "reservation" || !["pending", "packed"].includes(sale.status)) throw new Error("La reserva ya no esta pendiente");
  await db.exec("begin");
  try {
    for (const line of sale.lines) {
      if (!line.inventoryItemId) continue;
      await db.query("update inventory_items set quantity_reserved = greatest(0, quantity_reserved - $1), updated_at = now() where id = $2 and business_id = $3", [line.quantity, line.inventoryItemId, actor.businessId]);
      await db.query("update reservations set status = 'released', released_at = now() where business_id = $1 and external_cart_id = $2 and inventory_item_id = $3 and status = 'active'", [actor.businessId, saleId, line.inventoryItemId]);
      await db.query(`
        insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by)
        values ($1, $2, $3, 'reservation_release', 0, 'sale', $4, $5, $6, $7)
      `, [crypto.randomUUID(), actor.businessId, line.inventoryItemId, saleId, `movement-cancel-${saleId}-${line.inventoryItemId}`, `Reserva cancelada de ${sale.customerName}`, actor.id]);
    }
    await db.query("update sales set status = 'cancelled', cancelled_at = now() where id = $1 and business_id = $2", [saleId, actor.businessId]);
    await moveSaleToRuleColumn(db, actor.businessId, saleId, true);
    await writeAudit(db, actor, "sale.cancel", "sale", saleId, sale, { status: "cancelled" });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  return (await listSales(db, actor.businessId)).sales.find((row) => row.id === saleId)!;
}

export async function listPurchases(db: PGlite, businessId = demoBusinessId): Promise<{ purchases: PurchaseRecord[] }> {
  const result = await db.query<Record<string, unknown>>(`
    select pu.id, pu.seller_name, pu.status, pu.total_ars, pu.note, pu.created_at,
      pi.inventory_item_id, pi.quantity, pi.unit_cost_ars, pi.line_total_ars, ii.sku, p.name
    from purchases pu
    left join purchase_items pi on pi.purchase_id = pu.id
    left join inventory_items ii on ii.id = pi.inventory_item_id
    left join card_products p on p.id = ii.product_id
    where pu.business_id = $1
    order by pu.created_at desc, pi.id
  `, [businessId]);
  const records = new Map<string, PurchaseRecord>();
  for (const row of result.rows) {
    const id = String(row.id);
    const record = records.get(id) || {
      id,
      sellerName: String(row.seller_name || ""),
      status: String(row.status) as PurchaseRecord["status"],
      totalArs: Number(row.total_ars || 0),
      note: String(row.note || ""),
      createdAt: String(row.created_at),
      lines: []
    };
    if (row.inventory_item_id) record.lines.push({
      inventoryItemId: String(row.inventory_item_id),
      quantity: Number(row.quantity),
      unitCostArs: Number(row.unit_cost_ars),
      lineTotalArs: Number(row.line_total_ars),
      name: String(row.name || ""),
      sku: String(row.sku || "")
    });
    records.set(id, record);
  }
  return { purchases: [...records.values()] };
}

export async function createPurchase(db: PGlite, input: CreatePurchaseInput, actor: AuthenticatedUser): Promise<PurchaseRecord> {
  if (!input.lines?.length) throw new Error("Agrega al menos una carta a la compra");
  const lines = input.lines.map((line) => ({ ...line, inventoryItemId: line.inventoryItemId ? String(line.inventoryItemId) : "", priceChartingId: line.priceChartingId ? String(line.priceChartingId) : "", quantity: Number(line.quantity), unitCostArs: Number(line.unitCostArs) }));
  for (const line of lines) {
    if (!line.inventoryItemId && !line.priceChartingId) throw new Error("Falta identificar una carta de la compra");
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error("Las cantidades de compra deben ser enteros positivos");
    if (!Number.isFinite(line.unitCostArs) || line.unitCostArs < 0) throw new Error("El costo de compra no es valido");
    if (line.inventoryItemId && !(await getInventoryItem(db, line.inventoryItemId, actor.businessId))) throw new Error("Una carta de la compra ya no existe");
    if (line.priceChartingId && !(await getPriceChartingCacheEntry(db, line.priceChartingId))) throw new Error(`PriceCharting ID ${line.priceChartingId} no existe en el cache local`);
  }
  const purchaseId = crypto.randomUUID();
  const totalArs = lines.reduce((sum, line) => sum + line.quantity * line.unitCostArs, 0);
  await db.exec("begin");
  try {
    await db.query(`
      insert into purchases (id, business_id, seller_name, total_ars, note, created_by)
      values ($1, $2, $3, $4, $5, $6)
    `, [purchaseId, actor.businessId, input.sellerName.trim() || "Compra sin nombre", totalArs, input.note || "", actor.id]);
    for (const line of lines) {
      const inventoryItemId = line.inventoryItemId || await resolveInventoryItemForPriceChartingPurchase(db, line.priceChartingId, actor);
      await db.query(`
        insert into purchase_items (id, business_id, purchase_id, inventory_item_id, quantity, unit_cost_ars, line_total_ars)
        values ($1, $2, $3, $4, $5, $6, $7)
      `, [crypto.randomUUID(), actor.businessId, purchaseId, inventoryItemId, line.quantity, line.unitCostArs, line.quantity * line.unitCostArs]);
      await db.query("update inventory_items set quantity_on_hand = quantity_on_hand + $1, updated_at = now() where id = $2 and business_id = $3", [line.quantity, inventoryItemId, actor.businessId]);
      await db.query(`
        insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, unit_cost_ars, reference_type, reference_id, idempotency_key, note, created_by)
        values ($1, $2, $3, 'purchase', $4, $5, 'purchase', $6, $7, $8, $9)
      `, [crypto.randomUUID(), actor.businessId, inventoryItemId, line.quantity, line.unitCostArs, purchaseId, `movement-purchase-${purchaseId}-${inventoryItemId}`, `Compra a ${input.sellerName.trim() || "proveedor"}`, actor.id]);
    }
    await writeAudit(db, actor, "purchase.create", "purchase", purchaseId, null, { ...input, totalArs });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  return (await listPurchases(db, actor.businessId)).purchases.find((row) => row.id === purchaseId)!;
}

async function getPriceChartingCacheEntry(db: PGlite, priceChartingId: string): Promise<PriceChartingCacheEntry | null> {
  const result = await db.query<Record<string, unknown>>(`
    select pce.pricecharting_id, pce.canonical_url, pce.source_url, pce.product_name,
      pce.normalized_name, pce.expansion_name, pce.normalized_expansion, pce.card_number,
      pce.language_group, pce.loose_price_usd,
      coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), nullif(pce.image_url, ''), nullif(tcg_match.image_url, ''), '') as image_url,
      tcg_price.tcgplayer_price_usd,
      tcg_price.tcgplayer_subtype,
      pce.search_key, pce.imported_at
    from pricecharting_cache_entries pce
    left join pricecharting_image_cache pic using (pricecharting_id)
    left join card_index_entries direct_cie on direct_cie.pricecharting_id = pce.pricecharting_id
    left join lateral (
      select cie.image_url, cie.tcgplayer_product_id
      from card_index_entries cie
      where cie.pricecharting_id like 'tcgcsv-%'
        and (coalesce(cie.image_url, '') <> '' or coalesce(cie.tcgplayer_product_id, '') <> '')
        and cie.language_group = pce.language_group
        and cie.normalized_expansion = pce.normalized_expansion
        and regexp_replace(lower(split_part(coalesce(cie.card_number, ''), '/', 1)), '^0+', '') =
            regexp_replace(lower(split_part(coalesce(pce.card_number, ''), '/', 1)), '^0+', '')
      order by case when coalesce(cie.image_url, '') <> '' then 0 else 1 end, cie.updated_at desc
      limit 1
    ) tcg_match on true
    left join lateral (
      select coalesce(tpce.market_price_usd, tpce.mid_price_usd, tpce.low_price_usd, tpce.direct_low_price_usd, tpce.high_price_usd) as tcgplayer_price_usd,
        tpce.sub_type_name as tcgplayer_subtype
      from tcgplayer_price_cache_entries tpce
      where tpce.tcgplayer_product_id = coalesce(nullif(direct_cie.tcgplayer_product_id, ''), nullif(tcg_match.tcgplayer_product_id, ''))
        and coalesce(tpce.market_price_usd, tpce.mid_price_usd, tpce.low_price_usd, tpce.direct_low_price_usd, tpce.high_price_usd) is not null
      order by case when lower(tpce.sub_type_name) in ('', 'normal') then 0 else 1 end,
        tpce.market_price_usd desc nulls last
      limit 1
    ) tcg_price on true
    where pce.pricecharting_id = $1
    limit 1
  `, [priceChartingId]);
  const row = result.rows[0];
  return row ? {
    priceChartingId: String(row.pricecharting_id),
    canonicalUrl: String(row.canonical_url || ""),
    sourceUrl: String(row.source_url || ""),
    productName: String(row.product_name || ""),
    normalizedName: String(row.normalized_name || ""),
    expansionName: String(row.expansion_name || ""),
    normalizedExpansion: String(row.normalized_expansion || ""),
    cardNumber: String(row.card_number || ""),
    finish: inferFinishFromPriceChartingName(String(row.product_name || ""), String(row.canonical_url || "")),
    loosePriceUsd: optionalNumber(row.loose_price_usd) ?? null,
    tcgplayerPriceUsd: optionalNumber(row.tcgplayer_price_usd) ?? null,
    tcgplayerSubtype: String(row.tcgplayer_subtype || ""),
    imageUrl: String(row.image_url || ""),
    languageGroup: inferLanguageGroup(String(row.expansion_name || ""), String(row.product_name || ""), String(row.canonical_url || ""), String(row.language_group || "")),
    searchKey: String(row.search_key || ""),
    importedAt: String(row.imported_at)
  } : null;
}

async function resolveInventoryItemForPriceChartingPurchase(db: PGlite, priceChartingId: string, actor: AuthenticatedUser): Promise<string> {
  const existing = await db.query<{ inventory_item_id: string }>(`
    select ii.id as inventory_item_id
    from external_identifiers ei
    join external_sources es on es.id = ei.source_id
    join inventory_items ii on ii.product_id = ei.product_id
      and (ei.variant_id is null or ii.variant_id = ei.variant_id)
    where ei.business_id = $1 and es.name = 'pricecharting' and ei.external_id = $2
    order by ii.created_at desc
    limit 1
  `, [actor.businessId, priceChartingId]);
  if (existing.rows[0]) return String(existing.rows[0].inventory_item_id);

  const entry = await getPriceChartingCacheEntry(db, priceChartingId);
  if (!entry) throw new Error(`PriceCharting ID ${priceChartingId} no existe en el cache local`);
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const sku = `PKM-PC-${entry.priceChartingId}`;
  const finish = inferFinishFromPriceChartingName(entry.productName);
  await db.query(`
    insert into card_products (id, business_id, name, expansion, card_number, image_url, notes)
    values ($1, $2, $3, $4, $5, $6, $7)
  `, [productId, actor.businessId, cleanPriceChartingProductName(entry.productName), entry.expansionName, entry.cardNumber || null, entry.imageUrl || null, "Creado desde compra PriceCharting"]);
  await db.query(`
    insert into card_variants (id, business_id, product_id, language, condition, finish)
    values ($1, $2, $3, 'EN', 'NM', $4)
  `, [variantId, actor.businessId, productId, finish]);
  await db.query(`
    insert into inventory_items (id, business_id, sku, product_id, variant_id, location, quantity_on_hand, quantity_reserved, active)
    values ($1, $2, $3, $4, $5, '', 0, 0, true)
  `, [itemId, actor.businessId, sku, productId, variantId]);
  await db.query(`
    insert into current_prices (inventory_item_id, business_id, price_ars, price_usd, manual_override)
    values ($1, $2, 0, $3, true)
  `, [itemId, actor.businessId, entry.loosePriceUsd]);
  await upsertExternalIdentifier(db, actor.businessId, productId, variantId, "pricecharting", entry.priceChartingId, entry.canonicalUrl);
  await writeAudit(db, actor, "inventory.create_from_purchase", "inventory_item", itemId, null, { priceChartingId: entry.priceChartingId, sku });
  return itemId;
}

function inferFinishFromPriceChartingName(...values: string[]): string {
  const normalizedName = normalizeImportText(values.filter(Boolean).join(" "));
  if (normalizedName.includes("reverse holo")) return "reverse holo";
  if (normalizedName.includes("cosmos holo")) return "cosmos holo";
  if (normalizedName.includes("holo")) return "holo";
  if (normalizedName.includes("master ball")) return "master ball";
  if (normalizedName.includes("poke ball")) return "poke ball";
  return "normal";
}

function cleanPriceChartingProductName(name: string): string {
  return String(name || "")
    .replace(/\s*\[(?:reverse holo|cosmos holo|holo|master ball|poke ball|pokemon center)\]\s*/ig, " ")
    .replace(/\s+(?:reverse holo|cosmos holo|holo)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferLanguageGroup(...values: string[]): LanguageGroup {
  const text = normalizeImportText(values.filter(Boolean).join(" "));
  const tokens = new Set(text.split(" ").filter(Boolean));
  const chineseSignals = [
    "chinese", "simplified", "traditional", "taiwan", "hong kong",
    "zh cn", "zh tw"
  ];
  if (chineseSignals.some((signal) => text.includes(signal))) return "chinese";
  if (["zh", "cn", "chs", "cht", "china"].some((signal) => tokens.has(signal))) return "chinese";

  const japaneseBucketSignals = [
    "japanese", "japan",
    "korean", "korea",
    "indonesia", "indonesian",
    "thai", "thailand",
    "vietnam", "vietnamese", "asia", "asian"
  ];
  if (japaneseBucketSignals.some((signal) => text.includes(signal))) return "japanese";
  if (["jp", "ja", "kr", "ko"].some((signal) => tokens.has(signal))) return "japanese";

  return "english";
}

export async function listClaimsWorkspace(db: PGlite, businessId = demoBusinessId): Promise<ClaimsWorkspace> {
  const active = await db.query<Record<string, unknown>>(`
    select id, name, status, source_note, created_at, closed_at, closed_sale_ids
    from claim_sessions
    where business_id = $1 and status = 'open'
    order by created_at desc
    limit 1
  `, [businessId]);
  const activeClaim = active.rows[0] ? toClaimSession(active.rows[0]) : null;
  const sections = activeClaim ? await listClaimSections(db, activeClaim.id, businessId) : [];
  const cards = activeClaim ? await listClaimCards(db, activeClaim.id, businessId) : [];
  const frees = activeClaim ? await listClaimFrees(db, activeClaim.id, businessId) : [];
  const historyRows = await db.query<Record<string, unknown>>(`
    select cs.id, cs.name, cs.status, cs.source_note, cs.payment_due_at, cs.created_at, cs.closed_at, cs.closed_sale_ids,
      coalesce(sum(si.quantity) filter (where coalesce(si.price_currency, 'ARS') <> 'FREE'), 0)::integer as cards,
      count(distinct nullif(s.customer_name, ''))::integer as buyers,
      coalesce(sum(si.line_total_ars), 0)::numeric as total_ars,
      coalesce(sum(si.line_total_usd), 0)::numeric as total_usd
    from claim_sessions cs
    left join lateral jsonb_array_elements_text(coalesce(cs.closed_sale_ids, '[]'::jsonb)) sale_ids(id) on true
    left join sales s on s.id::text = sale_ids.id and s.business_id = cs.business_id
    left join sale_items si on si.sale_id = s.id and si.business_id = cs.business_id
    where cs.business_id = $1 and cs.status <> 'open'
    group by cs.id
    order by cs.closed_at desc nulls last, cs.created_at desc
  `, [businessId]);
  return {
    activeClaim,
    sections,
    cards,
    frees,
    history: historyRows.rows.map((row) => ({
      ...toClaimSession(row),
      cards: Number(row.cards || 0),
      buyers: Number(row.buyers || 0),
      totalArs: Number(row.total_ars || 0),
      totalUsd: Number(row.total_usd || 0)
    })),
    summary: summarizeClaim(cards, frees)
  };
}

export async function createClaimSession(db: PGlite, input: ClaimCreateInput, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const existing = await db.query<{ id: string }>("select id from claim_sessions where business_id = $1 and status = 'open' limit 1", [actor.businessId]);
  if (existing.rows[0]) throw new Error("Ya hay un claim activo. Cerralo o resetealo antes de crear otro.");
  const claimId = crypto.randomUUID();
  const name = input.name?.trim() || buildClaimName();
  await db.query(`
      insert into claim_sessions (id, business_id, name, source_note, payment_due_at, created_by)
    values ($1, $2, $3, $4, nullif($5, '')::date, $6)
  `, [claimId, actor.businessId, name, input.sourceNote?.trim() || "", input.paymentDueAt?.trim() || "", actor.id]);
  await writeAudit(db, actor, "claim.create", "claim", claimId, null, { name, sourceNote: input.sourceNote || "" });
  return listClaimsWorkspace(db, actor.businessId);
}

export async function updateActiveClaimSettings(db: PGlite, input: { paymentDueAt?: string }, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const claim = (await listClaimsWorkspace(db, actor.businessId)).activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  await db.query("update claim_sessions set payment_due_at = case when $1::text is null then payment_due_at else nullif($1, '')::date end, updated_at = now() where id = $2 and business_id = $3", [input.paymentDueAt === undefined ? null : String(input.paymentDueAt || "").trim(), claim.id, actor.businessId]);
  await writeAudit(db, actor, "claim.settings.update", "claim", claim.id, claim, input);
  return listClaimsWorkspace(db, actor.businessId);
}

export async function createClaimSection(db: PGlite, input: { name: string }, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const claim = (await listClaimsWorkspace(db, actor.businessId)).activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("La seccion necesita nombre.");
  const next = await db.query<{ next_order: number }>("select coalesce(max(sort_order), 0)::integer + 1 as next_order from claim_sections where claim_id = $1", [claim.id]);
  const sectionId = crypto.randomUUID();
  await db.query(`
    insert into claim_sections (id, business_id, claim_id, name, sort_order)
    values ($1, $2, $3, $4, $5)
    on conflict (claim_id, name) do update set updated_at = now()
  `, [sectionId, actor.businessId, claim.id, name, Number(next.rows[0]?.next_order || 1)]);
  await writeAudit(db, actor, "claim.section.create", "claim", claim.id, null, { name });
  return listClaimsWorkspace(db, actor.businessId);
}

export async function updateClaimSection(db: PGlite, sectionId: string, input: { name?: string; direction?: "up" | "down" }, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const section = await db.query<Record<string, unknown>>("select * from claim_sections where id = $1 and business_id = $2 limit 1", [sectionId, actor.businessId]);
  const current = section.rows[0];
  if (!current) throw new Error("La seccion no existe.");
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("La seccion necesita nombre.");
    await db.query("update claim_sections set name = $1, updated_at = now() where id = $2 and business_id = $3", [name, sectionId, actor.businessId]);
  }
  if (input.direction === "up" || input.direction === "down") {
    const claimId = String(current.claim_id || "");
    const sortOrder = Number(current.sort_order || 0);
    const other = await db.query<Record<string, unknown>>(`
      select id, sort_order
      from claim_sections
      where claim_id = $1 and business_id = $2 and sort_order ${input.direction === "up" ? "<" : ">"} $3
      order by sort_order ${input.direction === "up" ? "desc" : "asc"}
      limit 1
    `, [claimId, actor.businessId, sortOrder]);
    if (other.rows[0]) {
      await db.exec("begin");
      try {
        await db.query("update claim_sections set sort_order = $1, updated_at = now() where id = $2", [Number(other.rows[0].sort_order || 0), sectionId]);
        await db.query("update claim_sections set sort_order = $1, updated_at = now() where id = $2", [sortOrder, String(other.rows[0].id)]);
        await db.exec("commit");
      } catch (error) {
        await db.exec("rollback");
        throw error;
      }
    }
  }
  await writeAudit(db, actor, "claim.section.update", "claim_section", sectionId, current, input);
  return listClaimsWorkspace(db, actor.businessId);
}

export async function deleteClaimSection(db: PGlite, sectionId: string, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const section = await db.query<Record<string, unknown>>("select * from claim_sections where id = $1 and business_id = $2 limit 1", [sectionId, actor.businessId]);
  const current = section.rows[0];
  if (!current) throw new Error("La seccion no existe.");
  await db.query("delete from claim_sections where id = $1 and business_id = $2", [sectionId, actor.businessId]);
  await writeAudit(db, actor, "claim.section.delete", "claim_section", sectionId, current, null);
  return listClaimsWorkspace(db, actor.businessId);
}

export async function addPriceChartingCardsToClaim(db: PGlite, priceChartingIds: string[], actor: AuthenticatedUser, sectionId = ""): Promise<ClaimsWorkspace> {
  const claim = (await listClaimsWorkspace(db, actor.businessId)).activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  const targetSectionId = await normalizeClaimSectionId(db, claim.id, actor.businessId, sectionId);
  const ids = [...new Set((priceChartingIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) throw new Error("Elegí al menos una carta de PriceCharting.");
  const orderStart = await db.query<{ next_order: number }>("select coalesce(max(sort_order), 0)::integer + 1 as next_order from claim_cards where claim_id = $1", [claim.id]);
  let nextOrder = Number(orderStart.rows[0]?.next_order || 1);
  if (!Number.isFinite(nextOrder)) nextOrder = 1;
  await db.exec("begin");
  try {
    for (const id of ids) {
      const entry = await db.query<Record<string, unknown>>(`
        select pce.pricecharting_id, pce.canonical_url, pce.product_name, pce.expansion_name, pce.card_number,
          pce.loose_price_usd, coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), pce.image_url, '') as image_url
        from pricecharting_cache_entries pce
        left join pricecharting_image_cache pic using (pricecharting_id)
        where pce.pricecharting_id = $1
        limit 1
      `, [id]);
      const row = entry.rows[0];
      if (!row) throw new Error(`PriceCharting ID ${id} no existe en el cache local.`);
      const pcUsd = optionalNumber(row.loose_price_usd);
      const suggested = suggestClaimPriceArs(pcUsd);
      await db.query(`
        insert into claim_cards (
          id, business_id, claim_id, section_id, pricecharting_id, canonical_url, product_name,
          expansion_name, card_number, image_url, pc_price_usd, suggested_ars, sort_order
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        on conflict (claim_id, pricecharting_id) do update set
          section_id = excluded.section_id,
          canonical_url = excluded.canonical_url,
          product_name = excluded.product_name,
          expansion_name = excluded.expansion_name,
          card_number = excluded.card_number,
          image_url = excluded.image_url,
          pc_price_usd = excluded.pc_price_usd,
          suggested_ars = excluded.suggested_ars,
          updated_at = now()
      `, [
        crypto.randomUUID(),
        actor.businessId,
        claim.id,
        targetSectionId || null,
        String(row.pricecharting_id),
        String(row.canonical_url || ""),
        String(row.product_name || ""),
        String(row.expansion_name || ""),
        String(row.card_number || ""),
        String(row.image_url || ""),
        pcUsd ?? null,
        suggested,
        nextOrder++
      ]);
    }
    await writeAudit(db, actor, "claim.cards.add", "claim", claim.id, null, { priceChartingIds: ids, sectionId: targetSectionId });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  return listClaimsWorkspace(db, actor.businessId);
}

export async function refreshActiveClaimPricesFromPriceCharting(db: PGlite, actor: AuthenticatedUser): Promise<ClaimPriceRefreshResult> {
  const claim = (await listClaimsWorkspace(db, actor.businessId)).activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  const rows = await db.query<Record<string, unknown>>(`
    select cc.id, cc.pricecharting_id, cc.pc_price_usd, cc.suggested_ars, pce.loose_price_usd
    from claim_cards cc
    left join pricecharting_cache_entries pce on pce.pricecharting_id = cc.pricecharting_id
    where cc.claim_id = $1 and cc.business_id = $2
    order by cc.sort_order, cc.created_at
  `, [claim.id, actor.businessId]);

  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  await db.exec("begin");
  try {
    for (const row of rows.rows) {
      if (row.loose_price_usd === null || row.loose_price_usd === undefined) {
        missing++;
        continue;
      }
      const pcUsd = optionalNumber(row.loose_price_usd) ?? null;
      const suggested = suggestClaimPriceArs(pcUsd);
      const currentUsd = optionalNumber(row.pc_price_usd) ?? null;
      const currentSuggested = Math.round(Number(row.suggested_ars || 0));
      if (currentUsd === pcUsd && currentSuggested === suggested) {
        unchanged++;
        continue;
      }
      await db.query(`
        update claim_cards
        set pc_price_usd = $1,
            suggested_ars = $2
        where id = $3 and business_id = $4
      `, [pcUsd, suggested, String(row.id), actor.businessId]);
      updated++;
    }
    await writeAudit(db, actor, "claim.prices.refresh", "claim", claim.id, null, { updated, unchanged, missing });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }

  return {
    workspace: await listClaimsWorkspace(db, actor.businessId),
    updated,
    unchanged,
    missing
  };
}

export async function updateClaimCard(db: PGlite, cardId: string, input: ClaimCardPatchInput, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const before = await db.query<Record<string, unknown>>("select * from claim_cards where id = $1 and business_id = $2 limit 1", [cardId, actor.businessId]);
  if (!before.rows[0]) throw new Error("La carta ya no existe en el claim activo.");
  const sectionId = input.sectionId === undefined
    ? undefined
    : await normalizeClaimSectionId(db, String(before.rows[0].claim_id || ""), actor.businessId, input.sectionId);
  await db.query(`
    update claim_cards set
      section_id = case when $1::text is null then section_id else nullif($1, '')::uuid end,
      final_price_ars = coalesce($2, final_price_ars),
      final_price_usd = coalesce($3, final_price_usd),
      final_name = coalesce($4, final_name),
      image_url = coalesce($5, image_url),
      buyer = coalesce($6, buyer),
      quantity = coalesce($7, quantity),
      tags = coalesce($8, tags),
      status = coalesce($9, status),
      updated_at = now()
    where id = $10 and business_id = $11
  `, [
    input.sectionId === undefined ? null : sectionId,
    input.finalPriceArs === undefined ? null : Math.max(0, Number(input.finalPriceArs) || 0),
    input.finalPriceUsd === undefined ? null : Math.max(0, Number(input.finalPriceUsd) || 0),
    input.finalName === undefined ? null : input.finalName.trim(),
    input.imageUrl === undefined ? null : input.imageUrl.trim(),
    input.buyer === undefined ? null : input.buyer.trim(),
    input.quantity === undefined ? null : Math.max(1, Math.floor(Number(input.quantity) || 1)),
    input.tags === undefined ? null : input.tags.trim(),
    input.status === undefined ? null : input.status,
    cardId,
    actor.businessId
  ]);
  if (input.imageUrl !== undefined) {
    const imageUrl = input.imageUrl.trim();
    await db.query(`
      update card_products cp
      set image_url = $1,
          updated_at = now()
      from external_identifiers ei
      join external_sources es on es.id = ei.source_id
      where cp.id = ei.product_id
        and cp.business_id = $2
        and ei.business_id = $2
        and es.name = 'pricecharting'
        and ei.external_id = (select pricecharting_id from claim_cards where id = $3 and business_id = $2)
    `, [imageUrl, actor.businessId, cardId]);
  }
  await writeAudit(db, actor, "claim.card.update", "claim_card", cardId, before.rows[0], input);
  return listClaimsWorkspace(db, actor.businessId);
}

export async function deleteClaimCard(db: PGlite, cardId: string, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const before = await db.query<Record<string, unknown>>(`
    select cc.*
    from claim_cards cc
    join claim_sessions cs on cs.id = cc.claim_id
    where cc.id = $1 and cc.business_id = $2 and cs.status = 'open'
    limit 1
  `, [cardId, actor.businessId]);
  if (!before.rows[0]) throw new Error("La carta ya no existe en el claim activo.");
  await db.query("delete from claim_cards where id = $1 and business_id = $2", [cardId, actor.businessId]);
  await writeAudit(db, actor, "claim.card.delete", "claim_card", cardId, before.rows[0], null);
  return listClaimsWorkspace(db, actor.businessId);
}

export async function addClaimFree(db: PGlite, input: ClaimFreeInput, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const claim = (await listClaimsWorkspace(db, actor.businessId)).activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  if (!input.finalName?.trim()) throw new Error("El free necesita nombre.");
  if (!input.buyer?.trim()) throw new Error("El free necesita comprador.");
  const quantity = Math.max(1, Number(input.quantity) || 1);
  const freeId = crypto.randomUUID();
  await db.query(`
    insert into claim_frees (
      id, business_id, claim_id, buyer, final_name, product_name,
      expansion_name, quantity, pricecharting_id, canonical_url, tags, notes
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    freeId,
    actor.businessId,
    claim.id,
    input.buyer.trim(),
    input.finalName.trim(),
    input.productName?.trim() || "",
    input.expansionName?.trim() || "",
    quantity,
    input.priceChartingId?.trim() || "",
    input.canonicalUrl?.trim() || "",
    input.tags?.trim() || "",
    input.notes?.trim() || ""
  ]);
  await writeAudit(db, actor, "claim.free.add", "claim_free", freeId, null, input);
  return listClaimsWorkspace(db, actor.businessId);
}

export async function closeActiveClaim(db: PGlite, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const workspace = await listClaimsWorkspace(db, actor.businessId);
  const claim = workspace.activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  const orderPlan = buildClaimOrderPlan(workspace);
  const saleIds: string[] = [];
  await db.exec("begin");
  try {
    for (const buyerOrder of orderPlan.buyers) {
      const saleId = crypto.randomUUID();
      saleIds.push(saleId);
      await db.query(`
        insert into sales (id, business_id, customer_name, sale_type, status, channel, total_ars, total_usd, payment_due_at, created_by)
        values ($1, $2, $3, 'reservation', 'pending', 'claim', $4, $5, nullif($6, '')::date, $7)
      `, [saleId, actor.businessId, buyerOrder.buyer, buyerOrder.totalArs, buyerOrder.totalUsd, claim.paymentDueAt || "", actor.id]);
      let lineIndex = 1;
      for (const line of buyerOrder.lines.filter((item): item is ClaimOrderPlanCardLine => item.kind === "card")) {
        const inventoryItemId = await reserveInventoryForClaimCard(db, claim.id, line.card, saleId, buyerOrder.buyer, line.quantity, actor);
        const priceCurrency = line.unitPriceUsd > 0 && line.unitPriceArs <= 0 ? "USD" : "ARS";
        await db.query(`
          insert into sale_items (
            id, business_id, sale_id, inventory_item_id, quantity, unit_price_ars, unit_price_usd,
            line_total_ars, line_total_usd, price_currency, display_name, sku_snapshot, source_reference
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          crypto.randomUUID(),
          actor.businessId,
          saleId,
          inventoryItemId,
          line.quantity,
          line.unitPriceArs,
          line.unitPriceUsd,
          line.lineTotalArs,
          line.lineTotalUsd,
          priceCurrency,
          line.displayName,
          line.priceChartingId ? `PKM-PC-${line.priceChartingId}` : "",
          `claim:${claim.id}:${line.claimCardId}:${lineIndex++}`
        ]);
      }
      for (const line of buyerOrder.lines.filter((item): item is ClaimOrderPlanFreeLine => item.kind === "free")) {
        await db.query(`
          insert into sale_items (
            id, business_id, sale_id, inventory_item_id, quantity, unit_price_ars, unit_price_usd,
            line_total_ars, line_total_usd, price_currency, display_name, sku_snapshot, source_reference
          )
          values ($1, $2, $3, null, $4, 0, 0, 0, 0, 'FREE', $5, $6, $7)
        `, [
          crypto.randomUUID(),
          actor.businessId,
          saleId,
          line.quantity,
          line.displayName,
          line.priceChartingId ? `PKM-PC-${line.priceChartingId}` : "",
          `claim:${claim.id}:free:${line.claimFreeId}`
        ]);
      }
    }
    for (const card of workspace.cards.filter((item) => item.status !== "ignored")) {
      const quantity = Math.max(1, Math.floor(Number(card.quantity) || 1));
      const soldQuantity = claimCardBuyerAllocations(card).reduce((sum, allocation) => sum + allocation.quantity, 0);
      const unsoldQuantity = Math.max(0, quantity - soldQuantity);
      if (unsoldQuantity > 0) await addUnsoldClaimCardToStock(db, claim.id, card, unsoldQuantity, actor);
    }
    await db.query("update claim_cards set status = 'sold', updated_at = now() where claim_id = $1 and business_id = $2 and nullif(buyer, '') is not null and status <> 'ignored'", [claim.id, actor.businessId]);
    await db.query("update claim_sessions set status = 'closed', closed_at = now(), updated_at = now(), closed_sale_ids = $1::jsonb where id = $2 and business_id = $3", [JSON.stringify(saleIds), claim.id, actor.businessId]);
    await writeAudit(db, actor, "claim.close", "claim", claim.id, workspace, { saleIds });
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  return listClaimsWorkspace(db, actor.businessId);
}

export async function previewActiveClaimOrders(db: PGlite, actor: AuthenticatedUser): Promise<ClaimOrderPreview> {
  const workspace = await listClaimsWorkspace(db, actor.businessId);
  return toClaimOrderPreview(buildClaimOrderPlan(workspace));
}

async function reserveInventoryForClaimCard(db: PGlite, claimId: string, card: ClaimCard, saleId: string, buyer: string, quantity: number, actor: AuthenticatedUser): Promise<string> {
  const inventoryItemId = await resolveInventoryItemForClaimCard(db, card, actor);
  const item = await getInventoryItem(db, inventoryItemId, actor.businessId);
  if (!item) throw new Error(`No se pudo preparar stock para ${card.productName}.`);
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const shortage = item.availableQuantity >= safeQuantity ? 0 : safeQuantity - item.availableQuantity;
  if (shortage > 0) {
    await db.query("update inventory_items set quantity_on_hand = quantity_on_hand + $1, updated_at = now() where id = $2 and business_id = $3", [shortage, inventoryItemId, actor.businessId]);
    await db.query(`
      insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by)
      values ($1, $2, $3, 'claim_stock_in', $4, 'claim', $5, $6, $7, $8)
    `, [crypto.randomUUID(), actor.businessId, inventoryItemId, shortage, claimId, `movement-claim-stock-in-${claimId}-${card.id}-${saleId}`, `Alta automatica desde claim para ${buyer}`, actor.id]);
  }
  await db.query("update inventory_items set quantity_reserved = quantity_reserved + $1, updated_at = now() where id = $2 and business_id = $3", [safeQuantity, inventoryItemId, actor.businessId]);
  await db.query(`
    insert into reservations (id, business_id, inventory_item_id, quantity, status, channel, external_cart_id, idempotency_key)
    values ($1, $2, $3, $4, 'active', 'claim', $5, $6)
  `, [crypto.randomUUID(), actor.businessId, inventoryItemId, safeQuantity, saleId, `claim-reservation-${claimId}-${card.id}-${saleId}`]);
  await db.query(`
    insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by)
    values ($1, $2, $3, 'reservation', 0, 'sale', $4, $5, $6, $7)
  `, [crypto.randomUUID(), actor.businessId, inventoryItemId, saleId, `movement-claim-reservation-${claimId}-${card.id}-${saleId}`, `Reserva claim para ${buyer}`, actor.id]);
  return inventoryItemId;
}

async function addUnsoldClaimCardToStock(db: PGlite, claimId: string, card: ClaimCard, quantity: number, actor: AuthenticatedUser): Promise<void> {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (safeQuantity <= 0) return;
  const inventoryItemId = await resolveInventoryItemForClaimCard(db, card, actor);
  await db.query("update inventory_items set quantity_on_hand = quantity_on_hand + $1, updated_at = now() where id = $2 and business_id = $3", [safeQuantity, inventoryItemId, actor.businessId]);
  await db.query(`
    insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by)
    values ($1, $2, $3, 'claim_stock_in', $4, 'claim', $5, $6, $7, $8)
  `, [crypto.randomUUID(), actor.businessId, inventoryItemId, safeQuantity, claimId, `movement-claim-unsold-stock-in-${claimId}-${card.id}`, `Disponible desde claim no vendido: ${card.productName}`, actor.id]);
}

async function resolveInventoryItemForClaimCard(db: PGlite, card: ClaimCard, actor: AuthenticatedUser): Promise<string> {
  const existing = card.priceChartingId ? await db.query<{ inventory_item_id: string }>(`
    select ii.id as inventory_item_id
    from external_identifiers ei
    join external_sources es on es.id = ei.source_id
    join inventory_items ii on ii.product_id = ei.product_id
      and (ei.variant_id is null or ii.variant_id = ei.variant_id)
    where ei.business_id = $1 and es.name = 'pricecharting' and ei.external_id = $2
    order by ii.active desc, ii.created_at desc
    limit 1
  `, [actor.businessId, card.priceChartingId]) : { rows: [] };
  if (existing.rows[0]) return String(existing.rows[0].inventory_item_id);

  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const sku = card.priceChartingId ? `PKM-PC-${card.priceChartingId}` : buildSku({
    name: card.productName,
    expansion: card.expansionName || "Claim",
    number: card.cardNumber,
    language: "EN",
    condition: "NM",
    finish: inferFinishFromPriceChartingName(card.productName),
    quantityOnHand: 0
  });
  await db.query(`
    insert into card_products (id, business_id, name, expansion, card_number, image_url, notes)
    values ($1, $2, $3, $4, $5, $6, $7)
  `, [productId, actor.businessId, cleanPriceChartingProductName(card.productName), card.expansionName || "Claim", card.cardNumber || null, card.imageUrl || null, `Creado desde claim ${card.claimId}`]);
  await db.query(`
    insert into card_variants (id, business_id, product_id, language, condition, finish)
    values ($1, $2, $3, 'EN', 'NM', $4)
  `, [variantId, actor.businessId, productId, inferFinishFromPriceChartingName(card.productName)]);
  await db.query(`
    insert into inventory_items (id, business_id, sku, product_id, variant_id, location, quantity_on_hand, quantity_reserved, active)
    values ($1, $2, $3, $4, $5, 'Claim', 0, 0, true)
  `, [itemId, actor.businessId, sku, productId, variantId]);
  await db.query(`
    insert into current_prices (inventory_item_id, business_id, price_ars, price_usd, manual_override)
    values ($1, $2, $3, $4, true)
  `, [itemId, actor.businessId, card.finalPriceArs || card.suggestedArs || 0, card.finalPriceUsd || card.pcPriceUsd || null]);
  await upsertExternalIdentifier(db, actor.businessId, productId, variantId, "pricecharting", card.priceChartingId, card.canonicalUrl);
  await writeAudit(db, actor, "inventory.create_from_claim", "inventory_item", itemId, null, { claimId: card.claimId, claimCardId: card.id, priceChartingId: card.priceChartingId, sku });
  return itemId;
}

export async function archiveActiveClaim(db: PGlite, actor: AuthenticatedUser): Promise<ClaimsWorkspace> {
  const workspace = await listClaimsWorkspace(db, actor.businessId);
  const claim = workspace.activeClaim;
  if (!claim) throw new Error("No hay un claim activo para cancelar.");
  await db.query(`
    update claim_sessions
    set status = 'archived',
      closed_at = now(),
      updated_at = now()
    where id = $1 and business_id = $2 and status = 'open'
  `, [claim.id, actor.businessId]);
  await writeAudit(db, actor, "claim.archive", "claim", claim.id, workspace, { reason: "cancelled_by_user" });
  return listClaimsWorkspace(db, actor.businessId);
}

function normalizeCommerceLines(lines: CommerceLineInput[]): CommerceLineInput[] {
  if (!Array.isArray(lines)) return [];
  const grouped = new Map<string, CommerceLineInput>();
  for (const raw of lines) {
    const line = { inventoryItemId: String(raw.inventoryItemId || ""), quantity: Number(raw.quantity), unitPriceArs: Number(raw.unitPriceArs) };
    if (!line.inventoryItemId) throw new Error("Falta identificar una carta del carrito");
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error("Las cantidades deben ser enteros positivos");
    if (!Number.isFinite(line.unitPriceArs) || line.unitPriceArs < 0) throw new Error("El precio de venta no es valido");
    const existing = grouped.get(line.inventoryItemId);
    grouped.set(line.inventoryItemId, existing ? { ...line, quantity: existing.quantity + line.quantity } : line);
  }
  return [...grouped.values()];
}

export async function loadExampleInventory(db: PGlite, actor: AuthenticatedUser): Promise<ExampleInventoryResult> {
  const examples: UpsertInventoryInput[] = [
    {
      sku: "UT-EX-FLAREON-RC28-EN-NM",
      name: "Flareon EX",
      expansion: "Generations",
      number: "RC28",
      imageUrl: "https://images.pokemontcg.io/g1/rc28_hires.png",
      language: "EN",
      condition: "NM",
      finish: "holo",
      location: "Carpeta vitrina A",
      quantityOnHand: 1,
      quantityReserved: 0,
      priceArs: 183500,
      priceUsd: 117.05,
      notes: "Ejemplo local para validar inventario"
    },
    {
      sku: "UT-EX-SYLVEON-RC32-EN-NM",
      name: "Sylveon EX",
      expansion: "Generations",
      number: "RC32",
      imageUrl: "https://images.pokemontcg.io/g1/rc32_hires.png",
      language: "EN",
      condition: "NM",
      finish: "holo",
      location: "Carpeta vitrina A",
      quantityOnHand: 2,
      quantityReserved: 1,
      priceArs: 179000,
      priceUsd: 114.35,
      notes: "Ejemplo con una unidad reservada"
    },
    {
      sku: "UT-EX-ODDISH-DB-JA-NM",
      name: "Oddish",
      expansion: "Japanese Double Blaze",
      number: "001",
      imageUrl: "",
      language: "JA",
      condition: "NM",
      finish: "normal",
      location: "Caja japonesas B",
      quantityOnHand: 4,
      quantityReserved: 0,
      priceArs: 3000,
      priceUsd: 2.4,
      notes: "Ejemplo de carta japonesa"
    },
    {
      sku: "UT-EX-WIGGLY-SK-JA-LP",
      name: "Wigglytuff",
      expansion: "Japanese Skyscraping Perfection",
      number: "040",
      imageUrl: "",
      language: "JA",
      condition: "LP",
      finish: "normal",
      location: "Caja japonesas B",
      quantityOnHand: 3,
      quantityReserved: 0,
      priceArs: 3000,
      priceUsd: 2.4,
      notes: "Ejemplo de condicion LP"
    },
    {
      sku: "UT-EX-PIKACHU-PROMO-ES-MP",
      name: "Pikachu Promo",
      expansion: "Destellos Iniciales",
      number: "025",
      imageUrl: "https://images.pokemontcg.io/sv3pt5/25_hires.png",
      language: "ES",
      condition: "MP",
      finish: "reverse",
      location: "Caja ofertas",
      quantityOnHand: 0,
      quantityReserved: 0,
      priceArs: 2900,
      priceUsd: 2.25,
      notes: "Ejemplo sin disponible"
    }
  ];

  let created = 0;
  let skipped = 0;
  for (const example of examples) {
    const existing = example.sku ? await findStockBySku(db, actor.businessId, example.sku) : null;
    if (existing) {
      skipped += 1;
      continue;
    }
    const item = await upsertInventoryItem(db, example, actor);
    await db.query(`
      insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, idempotency_key, note, created_by)
      values ($1, $2, $3, 'import', $4, 'example_data', $5, $6, $7)
      on conflict (business_id, idempotency_key) do nothing
    `, [
      crypto.randomUUID(),
      actor.businessId,
      item.id,
      example.quantityOnHand,
      `example-initial-${example.sku}`,
      "Carga inicial de ejemplos locales",
      actor.id
    ]);
    created += 1;
  }
  return { created, skipped };
}

export async function previewInventorySnapshot(db: PGlite, csvText: string, businessId = demoBusinessId): Promise<{ rows: SnapshotPreviewRow[]; summary: { creates: number; updates: number; review: number; invalid: number } }> {
  const rows = parseSnapshotCsv(csvText);
  const stock = await listStockInternal(db, businessId);
  const seen = new Set<string>();
  const preview: SnapshotPreviewRow[] = [];
  for (const row of rows) {
    const translatedName = translateImportName(row.name);
    const warnings = validateSnapshotRow(row);
    const duplicatedSku = Boolean(row.sku && seen.has(row.sku));
    if (duplicatedSku) warnings.push("SKU duplicado dentro del archivo");
    if (row.sku) seen.add(row.sku);
    const existing = row.sku ? await findStockBySku(db, businessId, row.sku) : null;
    const existingPriceCharting = existing?.product.identifiers.find((identifier) => identifier.source === "pricecharting");
    const candidates = existing ? [] : findImportCandidates(row, stock.items);
    const rowWithExistingIdentifier = existingPriceCharting
      ? { ...row, priceChartingId: row.priceChartingId || existingPriceCharting.externalId, priceChartingUrl: row.priceChartingUrl || existingPriceCharting.url || "" }
      : row;
    const priceChartingCandidates = await findPriceChartingImportCandidates(db, rowWithExistingIdentifier);
    const matchedPriceCharting = priceChartingCandidates.length === 1 ? priceChartingCandidates[0] : undefined;
    if (!row.sku) warnings.push("No tiene SKU: se generara al crear la carta");
    if (candidates.length > 1) warnings.push("Se encontraron varias coincidencias posibles");
    else if (candidates.length === 1) warnings.push("Existe una carta similar: confirma si corresponde actualizarla");
    if (translatedName !== row.name.trim()) warnings.push(`Nombre traducido para busqueda: ${translatedName}`);
    if (!rowWithExistingIdentifier.priceChartingId && !matchedPriceCharting) {
      if (priceChartingCandidates.length > 1) warnings.push("Elegir coincidencia PriceCharting antes de importar");
      else warnings.push("No se encontro coincidencia en PriceCharting");
    }
    const invalid = duplicatedSku || hasFatalImportWarning(warnings);
    const action = invalid
      ? "invalid"
      : candidates.length || priceChartingCandidates.length > 1
        ? "review"
        : existing
          ? "update"
          : "create";
    preview.push({
      ...rowWithExistingIdentifier,
      name: translatedName || row.name,
      imageUrl: row.imageUrl || matchedPriceCharting?.imageUrl || "",
      priceChartingId: rowWithExistingIdentifier.priceChartingId || matchedPriceCharting?.priceChartingId || "",
      priceChartingUrl: rowWithExistingIdentifier.priceChartingUrl || matchedPriceCharting?.canonicalUrl || "",
      action,
      warnings,
      existingSku: existing?.sku,
      translatedName: translatedName !== row.name.trim() ? translatedName : undefined,
      candidates,
      priceChartingCandidates
    });
  }
  return {
    rows: preview,
    summary: {
      creates: preview.filter((row) => row.action === "create").length,
      updates: preview.filter((row) => row.action === "update").length,
      review: preview.filter((row) => row.action === "review").length,
      invalid: preview.filter((row) => row.action === "invalid").length
    }
  };
}

export async function applyInventorySnapshot(
  db: PGlite,
  csvText: string,
  actor: AuthenticatedUser,
  resolutions: Array<{ rowNumber: number; resolution: "create" | "update" | "ignore"; matchedInventoryItemId?: string; priceChartingId?: string }> = [],
  options: { batchName?: string; defaultLocation?: string; defaultInventoryStatus?: string; note?: string } = {}
): Promise<{ applied: number; skipped: number; importRunId: string; alreadyApplied?: boolean }> {
  if (!inventoryTransactions.has(db)) return inventoryTransaction(db, (connection) => applyInventorySnapshot(connection, csvText, actor, resolutions, options));
  const requestKey = crypto.createHash("sha256").update(JSON.stringify({csvText: csvText.trim(), options, resolutions: [...resolutions].sort((a, b) => a.rowNumber - b.rowNumber)})).digest("hex");
  const previous = await db.query<{ id: string; applied_rows: number; summary_json: { skipped?: number } }>(
    "select id, applied_rows, summary_json from import_runs where business_id = $1 and source = 'stock_csv' and status = 'completed' and summary_json->>'requestKey' = $2 limit 1", [actor.businessId, requestKey]);
  if (previous.rows[0]) return { applied: Number(previous.rows[0].applied_rows), skipped: Number(previous.rows[0].summary_json.skipped || 0), importRunId: previous.rows[0].id, alreadyApplied: true };
  const preview = await previewInventorySnapshot(db, csvText, actor.businessId);
  if (preview.summary.invalid > 0) throw new Error("La importacion tiene filas invalidas. Corregilas antes de aplicar.");
  const mobileReceipts = await db.query<{ id: string; status: string; applied_at: string | null }>("select id, status, applied_at from mobile_inventory_entries where business_id = $1", [actor.businessId]);
  const mobileById = new Map(mobileReceipts.rows.map((row) => [row.id, row]));
  const alreadyLoadedMobile = (row: SnapshotPreviewRow) => Boolean(row.mobileEntryId && mobileById.get(row.mobileEntryId)?.applied_at);
  const resolutionByRow = new Map(resolutions.map((item) => [item.rowNumber, item]));
  const unresolved = preview.rows.filter((row) => row.action === "review" && !alreadyLoadedMobile(row) && !resolutionByRow.has(row.rowNumber));
  if (unresolved.length) throw new Error(`Quedan ${unresolved.length} filas con coincidencias por revisar.`);
  const importRunId = crypto.randomUUID();
  const batchName = String(options.batchName || "").trim();
  const defaultLocation = String(options.defaultLocation || "").trim();
  const defaultInventoryStatus = normalizeInventoryStatus(options.defaultInventoryStatus || "available");
  const summary = {
    requestKey,
    ...preview.summary,
    units: preview.rows.reduce((sum, row) => sum + (row.quantityOnHand || 0), 0),
    valueArs: preview.rows.reduce((sum, row) => sum + (row.quantityOnHand || 0) * (row.priceArs || 0), 0),
    withPriceCharting: preview.rows.filter((row) => row.priceChartingId || row.priceChartingCandidates.length === 1 || resolutionByRow.get(row.rowNumber)?.priceChartingId).length,
    batchName,
    defaultLocation,
    defaultInventoryStatus
  };
  await db.query(`
    insert into import_runs (
      id, business_id, source, status, file_name, total_rows, review_rows,
      applied_rows, batch_name, default_location, note, summary_json, created_by
    ) values ($1, $2, 'stock_csv', 'running', $3, $4, $5, 0, $6, $7, $8, $9::jsonb, $10)
  `, [
    importRunId,
    actor.businessId,
    batchName || "Carga stock",
    preview.rows.length,
    preview.summary.review,
    batchName,
    defaultLocation,
    String(options.note || "").trim(),
    JSON.stringify(summary),
    actor.id
  ]);
  let applied = 0;
  let skipped = 0;
  try {
    for (const row of preview.rows) {
      if (alreadyLoadedMobile(row)) {
        skipped += 1;
        await recordImportRow(db, actor.businessId, importRunId, row, "ignored", "Captura ya cargada al inventario");
        continue;
      }
      if (row.mobileEntryId && mobileById.get(row.mobileEntryId)?.status !== "pending") throw new Error("La captura movil ya no esta pendiente. Actualiza la pre-base.");
      const resolution = resolutionByRow.get(row.rowNumber);
      if (resolution?.resolution === "ignore") {
        skipped += 1;
        await recordImportRow(db, actor.businessId, importRunId, row, "ignored", "Ignorada por decision del usuario");
        continue;
      }
      let resolvedRow: UpsertInventoryInput = {
        ...row,
        intakeBatch: row.intakeBatch || batchName,
        location: row.location || defaultLocation,
        inventoryStatus: row.inventoryStatus || defaultInventoryStatus
      };
      const selectedPriceCharting = resolution?.priceChartingId
        ? row.priceChartingCandidates.find((candidate) => candidate.priceChartingId === resolution.priceChartingId)
        : row.priceChartingCandidates.length === 1 ? row.priceChartingCandidates[0] : undefined;
      if (selectedPriceCharting) {
        resolvedRow = {
          ...resolvedRow,
          priceChartingId: selectedPriceCharting.priceChartingId,
          priceChartingUrl: selectedPriceCharting.canonicalUrl,
          imageUrl: resolvedRow.imageUrl || selectedPriceCharting.imageUrl || "",
          priceUsd: resolvedRow.priceUsd ?? selectedPriceCharting.loosePriceUsd
        };
      }
      if (resolution?.resolution === "update") {
        const selected = row.candidates.find((candidate) => candidate.inventoryItemId === resolution.matchedInventoryItemId);
        if (!selected) throw new Error(`Fila ${row.rowNumber}: elegi una coincidencia valida para actualizar.`);
        resolvedRow = { ...resolvedRow, sku: selected.sku };
      }
      resolvedRow = {
        ...resolvedRow,
        stockMovementReferenceType: "import",
        stockMovementNote: `Importacion de stock${batchName ? ` - ${batchName}` : ""}, fila ${row.rowNumber}`
      };
      const saved = row.mobileEntryId ? await addInventoryStock(db, resolvedRow, actor) : await upsertInventoryItem(db, resolvedRow, actor);
      if (row.mobileEntryId) {
        await updateMobileInventoryEntryStatus(db, row.mobileEntryId, "reviewed", actor);
        await db.query("update mobile_inventory_entries set applied_at = now() where id = $1 and business_id = $2", [row.mobileEntryId, actor.businessId]);
        mobileById.set(row.mobileEntryId, { id: row.mobileEntryId, status: "reviewed", applied_at: "loaded" });
      }
      await recordImportRow(db, actor.businessId, importRunId, row, resolution?.resolution || row.action, "", saved.id);
      applied += 1;
    }
    await db.query("update import_runs set status = 'completed', applied_rows = $1, summary_json = summary_json || $3::jsonb, updated_at = now() where id = $2", [applied, importRunId, JSON.stringify({ skipped })]);
  } catch (error) {
    // The outer transaction rolls back both the run and every stock write.
    // Preserve the original error; PostgreSQL rejects writes after a SQL failure.
    throw error;
  }
  return { applied, skipped, importRunId };
}

async function recordImportRow(
  db: PGlite,
  businessId: string,
  importRunId: string,
  row: SnapshotPreviewRow,
  status: string,
  reviewReason = "",
  matchedInventoryItemId?: string
): Promise<void> {
  await db.query(`
    insert into import_rows (
      id, business_id, import_run_id, row_number, status, raw_payload,
      matched_inventory_item_id, review_reason
    ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    on conflict (import_run_id, row_number) do update set
      status = excluded.status,
      raw_payload = excluded.raw_payload,
      matched_inventory_item_id = excluded.matched_inventory_item_id,
      review_reason = excluded.review_reason
  `, [
    crypto.randomUUID(),
    businessId,
    importRunId,
    row.rowNumber,
    status,
    JSON.stringify(row),
    matchedInventoryItemId || null,
    reviewReason || row.warnings.join("; ")
  ]);
}

async function findPriceChartingImportCandidates(db: PGlite, row: UpsertInventoryInput): Promise<SnapshotPreviewRow["priceChartingCandidates"]> {
  if (row.priceChartingId) {
    const selected = await db.query<Record<string, unknown>>(`
      select pce.pricecharting_id, pce.canonical_url, pce.product_name, pce.normalized_name,
        pce.expansion_name, pce.normalized_expansion, pce.card_number, pce.loose_price_usd,
        coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), pce.image_url) as image_url, pce.search_key
      from pricecharting_cache_entries pce
      left join pricecharting_image_cache pic using (pricecharting_id)
      where pce.pricecharting_id = $1
      limit 1
    `, [row.priceChartingId.trim()]);
    return selected.rows.map((candidate) => toPriceChartingImportCandidate(candidate, row, ["ID PriceCharting del CSV"]));
  }

  const translatedName = translateImportName(row.name);
  const queryName = normalizeImportText(translatedName);
  const queryExpansion = normalizeImportText(row.expansion);
  const queryNumber = normalizeImportCardNumber(row.number || "");
  const queryNumberPrimary = primaryImportCardNumber(row.number || "");
  if (!queryName && !queryExpansion && !queryNumber) return [];

  const result = await db.query<Record<string, unknown>>(`
    select pce.pricecharting_id, pce.canonical_url, pce.product_name, pce.normalized_name,
      pce.expansion_name, pce.normalized_expansion, pce.card_number, pce.loose_price_usd,
      coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), pce.image_url) as image_url, pce.search_key
    from pricecharting_cache_entries pce
    left join pricecharting_image_cache pic using (pricecharting_id)
    where
      (
        $3 <> ''
        and (
          lower(pce.card_number) = lower($3)
          or lower(pce.card_number) = lower($4)
          or lower(split_part(pce.card_number, '/', 1)) = lower($4)
        )
        and (
          $2 = ''
          or pce.normalized_expansion = $2
          or pce.normalized_expansion like '%' || $2 || '%'
          or $2 like '%' || pce.normalized_expansion || '%'
        )
      )
      or (
        $1 <> ''
        and pce.search_key like '%' || $1 || '%'
        and (
          $2 = ''
          or pce.normalized_expansion like '%' || $2 || '%'
          or $2 like '%' || pce.normalized_expansion || '%'
          or pce.search_key like '%' || $2 || '%'
        )
      )
      or (
        $1 <> '' and $3 <> ''
        and pce.search_key like '%' || $1 || '%'
        and (
          lower(pce.card_number) = lower($3)
          or lower(pce.card_number) = lower($4)
          or lower(split_part(pce.card_number, '/', 1)) = lower($4)
        )
      )
    limit 40
  `, [queryName, queryExpansion, row.number || "", queryNumberPrimary]);

  let candidates = result.rows
    .map((candidate) => toPriceChartingImportCandidate(candidate, row))
    .filter((candidate) => !queryName || areImportNamesCompatible(translatedName, candidate.productName))
    .filter((candidate) => !queryNumber || areImportCardNumbersCompatible(row.number || "", candidate.cardNumber))
    .filter((candidate) => !queryExpansion || areImportExpansionsCompatible(row.expansion, candidate.expansionName))
    .filter((candidate) => candidate.confidence >= 50)
    .sort((left, right) => right.confidence - left.confidence || left.productName.localeCompare(right.productName));
  const explicitFinish = explicitImportFinish(row);
  const explicitVariantDetail = explicitImportVariantDetail(row);
  if (explicitFinish) {
    const finishMatches = candidates.filter((candidate) => doesProductNameMatchFinish(explicitFinish, candidate.productName));
    if (finishMatches.length) candidates = finishMatches;
  } else if (explicitVariantDetail) {
    const detailMatches = candidates.filter((candidate) => normalizeImportText(candidate.productName).includes(explicitVariantDetail));
    if (detailMatches.length) candidates = detailMatches;
  } else {
    const normalMatches = candidates.filter((candidate) => !isSpecialPriceChartingVariant(candidate.productName));
    if (normalMatches.length) candidates = normalMatches;
  }
  return dedupePriceChartingCandidates(candidates).slice(0, 6);
}

function toPriceChartingImportCandidate(row: Record<string, unknown>, input: UpsertInventoryInput, forcedReasons: string[] = []): SnapshotPreviewRow["priceChartingCandidates"][number] {
  const translatedName = translateImportName(input.name);
  const queryName = normalizeImportText(translatedName);
  const queryExpansion = normalizeImportText(input.expansion);
  const queryNumber = normalizeImportCardNumber(input.number || "");
  const candidateName = normalizeImportText(String(row.normalized_name || row.product_name || ""));
  const candidateExpansion = normalizeImportText(String(row.normalized_expansion || row.expansion_name || ""));
  const candidateNumber = normalizeImportCardNumber(String(row.card_number || ""));
  const reasons = [...forcedReasons];
  let confidence = forcedReasons.length ? 100 : 0;

  if (queryName && candidateName === queryName) { confidence += 36; reasons.push("mismo nombre"); }
  else if (queryName && areImportNamesCompatible(translatedName, String(row.product_name || ""))) { confidence += 32; reasons.push("mismo nombre base"); }
  if (queryExpansion && candidateExpansion === queryExpansion) { confidence += 32; reasons.push("misma expansion"); }
  else if (queryExpansion && areImportExpansionsCompatible(input.expansion, String(row.expansion_name || ""))) { confidence += 28; reasons.push("misma expansion"); }
  if (queryNumber && candidateNumber === queryNumber) { confidence += 38; reasons.push("mismo numero"); }
  else if (queryNumber && areImportCardNumbersCompatible(input.number || "", String(row.card_number || ""))) {
    confidence += 34;
    reasons.push("numero de carta equivalente");
  }
  const explicitFinish = explicitImportFinish(input);
  if (explicitFinish && doesProductNameMatchFinish(explicitFinish, String(row.product_name || ""))) {
    confidence += 12;
    reasons.push("acabado compatible");
  } else if (explicitFinish) {
    confidence -= 35;
  } else if (isSpecialPriceChartingVariant(String(row.product_name || ""))) {
    confidence -= 18;
    reasons.push("variante especial no pedida");
  }

  return {
    priceChartingId: String(row.pricecharting_id || ""),
    canonicalUrl: String(row.canonical_url || ""),
    productName: String(row.product_name || ""),
    expansionName: String(row.expansion_name || ""),
    cardNumber: String(row.card_number || ""),
    loosePriceUsd: optionalNumber(row.loose_price_usd) ?? null,
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    confidence: Math.min(99, confidence),
    reasons: [...new Set(reasons)]
  };
}

function dedupePriceChartingCandidates(candidates: SnapshotPreviewRow["priceChartingCandidates"]): SnapshotPreviewRow["priceChartingCandidates"] {
  const seen = new Set<string>();
  const next: SnapshotPreviewRow["priceChartingCandidates"] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.priceChartingId)) continue;
    seen.add(candidate.priceChartingId);
    next.push(candidate);
  }
  return next;
}

function findImportCandidates(row: UpsertInventoryInput, items: DbStockRow[]): SnapshotPreviewRow["candidates"] {
  const translatedName = translateImportName(row.name);
  const queryName = normalizeImportText(translatedName);
  return items.map((item) => {
    const name = normalizeImportText(item.product.name);
    let confidence = 0;
    const reasons: string[] = [];
    if (queryName && name === queryName) { confidence += 48; reasons.push("mismo nombre"); }
    else if (queryName && (name.includes(queryName) || queryName.includes(name))) { confidence += 30; reasons.push("nombre similar"); }
    if (row.expansion && normalizeImportText(item.product.expansion) === normalizeImportText(row.expansion)) { confidence += 24; reasons.push("misma expansion"); }
    if (row.number && item.product.number && normalizeImportText(item.product.number) === normalizeImportText(row.number)) { confidence += 22; reasons.push("mismo numero"); }
    if (row.language && item.variant.language === row.language) { confidence += 8; reasons.push("mismo idioma"); }
    if (row.condition && item.variant.condition === row.condition) { confidence += 4; reasons.push("misma condicion"); }
    if ((row.gradingCompany || row.grade || item.variant.gradingCompany || item.variant.grade) && row.gradingCompany === item.variant.gradingCompany && row.grade === item.variant.grade) {
      confidence += 12;
      reasons.push("mismo grading");
    } else if ((row.gradingCompany || row.grade) && (item.variant.gradingCompany !== row.gradingCompany || item.variant.grade !== row.grade)) {
      confidence -= 18;
      reasons.push("distinto grading");
    }
    return {
      inventoryItemId: item.id,
      sku: item.sku,
      name: item.product.name,
      expansion: item.product.expansion,
      number: item.product.number,
      language: item.variant.language,
      condition: item.variant.condition,
      gradingCompany: item.variant.gradingCompany,
      grade: item.variant.grade,
      imageUrl: item.product.imageUrl,
      confidence: Math.min(99, confidence),
      reasons
    };
  }).filter((candidate) => candidate.confidence >= 30).sort((left, right) => right.confidence - left.confidence).slice(0, 3);
}

function hasFatalImportWarning(warnings: string[]): boolean {
  return warnings.some((warning) => !warning.startsWith("No tiene SKU")
    && !warning.startsWith("Se encontraron")
    && !warning.startsWith("Existe una carta similar")
    && !warning.startsWith("Elegir coincidencia PriceCharting")
    && !warning.startsWith("No se encontro coincidencia en PriceCharting")
    && !warning.startsWith("Nombre traducido")
    && !warning.startsWith("Precio no informado"));
}

function translateImportName(value: string): string {
  const names: Record<string, string> = {
    "ナゾノクサ": "Oddish",
    "プクリン": "Wigglytuff",
    "ミミッキュ": "Mimikyu",
    "ゼニガメ": "Squirtle",
    "ヒトカゲ": "Charmander",
    "フシギダネ": "Bulbasaur",
    "走路草": "Oddish",
    "胖可丁": "Wigglytuff",
    "超梦": "Mewtwo",
    "耿鬼": "Gengar",
    "谜拟丘": "Mimikyu",
    "ピカチュウ": "Pikachu",
    "リザードン": "Charizard",
    "イーブイ": "Eevee",
    "ミュウツー": "Mewtwo",
    "ゲンガー": "Gengar",
    "レックウザ": "Rayquaza",
    "杰尼龟": "Squirtle",
    "皮卡丘": "Pikachu",
    "伊布": "Eevee",
    "喷火龙": "Charizard"
  };
  return names[value.trim()] || value;
}

function normalizeImportText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImportCardNumber(value: string): string {
  return normalizeImportText(value).replace(/\s+/g, "");
}

function primaryImportCardNumber(value: string): string {
  const raw = String(value || "").trim();
  const primary = raw.split("/")[0] || raw;
  return normalizeImportCardNumber(primary).replace(/^0+([0-9])/, "$1");
}

function areImportCardNumbersCompatible(inputNumber: string, candidateNumber: string): boolean {
  const input = normalizeImportCardNumber(inputNumber);
  const candidate = normalizeImportCardNumber(candidateNumber);
  if (!input || !candidate) return false;
  if (input === candidate) return true;
  return primaryImportCardNumber(inputNumber) === primaryImportCardNumber(candidateNumber);
}

function areImportNamesCompatible(inputName: string, candidateName: string): boolean {
  const input = normalizeImportBaseProductName(inputName);
  const candidate = normalizeImportBaseProductName(candidateName);
  return Boolean(input && candidate && input === candidate);
}

function areImportExpansionsCompatible(inputExpansion: string, candidateExpansion: string): boolean {
  const input = normalizeImportExpansionName(inputExpansion);
  const candidate = normalizeImportExpansionName(candidateExpansion);
  if (!input || !candidate) return false;
  if (input === candidate) return true;
  return false;
}

function normalizeImportExpansionName(value: string): string {
  const removablePrefixes = new Set(["pokemon", "japanese", "chinese", "korean", "spanish", "french", "german", "italian", "portuguese"]);
  const words = normalizeImportText(value).split(" ").filter(Boolean);
  while (words.length && removablePrefixes.has(words[0])) words.shift();
  const normalized = words.join(" ");
  if (normalized === "wotc promo" || normalized === "wotc promos" || normalized === "black star promo" || normalized === "black star promos") return "promo";
  if (normalized === "promos" || normalized.endsWith(" promos")) return "promo";
  return normalized;
}

function normalizeImportBaseProductName(value: string): string {
  let text = normalizeImportText(value.replace(/\[[^\]]+\]/g, " ").replace(/:.+$/, " "));
  const specialPhrases = [
    "reverse holo",
    "cosmos holo",
    "master ball",
    "masterball",
    "poke ball",
    "pokeball",
    "pokemon center",
    "1st edition",
    "first edition",
    "holofoil",
    "holo foil",
    "holo",
    "foil",
    "reverse",
    "cosmos"
  ];
  for (const phrase of specialPhrases) {
    text = text.replace(new RegExp(`(^| )${phrase.replace(/ /g, " ")}($| )`, "g"), " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

function normalizeFinishText(value: string): string {
  const text = normalizeImportText(value);
  if (text.includes("cosmos")) return "cosmos";
  if (text.includes("reverse")) return "reverse";
  if (text.includes("master ball") || text.includes("masterball")) return "masterball";
  if (text.includes("poke ball") || text.includes("pokeball")) return "pokeball";
  if (text.includes("holo") || text.includes("foil")) return "holo";
  return text;
}

function explicitImportFinish(input: Pick<UpsertInventoryInput, "name" | "finish">): string | null {
  const bracketDetail = String(input.name || "").match(/\[([^\]]+)\]/)?.[1] || "";
  if (isSpecificFinish(bracketDetail)) return bracketDetail;
  return isSpecificFinish(input.finish) ? input.finish : null;
}

function explicitImportVariantDetail(input: Pick<UpsertInventoryInput, "name">): string {
  const bracketDetail = String(input.name || "").match(/\[([^\]]+)\]/)?.[1] || "";
  return normalizeImportText(bracketDetail);
}

function isSpecificFinish(value: string): boolean {
  return ["cosmos", "reverse", "masterball", "pokeball", "holo"].includes(normalizeFinishText(value));
}

function isSpecialPriceChartingVariant(productName: string): boolean {
  const product = normalizeImportText(productName);
  return product.includes("holo")
    || product.includes("foil")
    || product.includes("reverse")
    || product.includes("cosmos")
    || product.includes("master ball")
    || product.includes("masterball")
    || product.includes("poke ball")
    || product.includes("pokeball")
    || product.includes("pokemon center")
    || product.includes("1st edition")
    || product.includes("first edition");
}

function doesProductNameMatchFinish(finish: string, productName: string): boolean {
  const expected = normalizeFinishText(finish);
  const product = normalizeImportText(productName);
  if (expected === "cosmos") return product.includes("cosmos");
  if (expected === "reverse") return product.includes("reverse");
  if (expected === "masterball") return product.includes("master ball") || product.includes("masterball");
  if (expected === "pokeball") return product.includes("poke ball") || product.includes("pokeball");
  if (expected === "holo") return product.includes("holo") || product.includes("foil");
  return false;
}

function toStockRow(row: Record<string, unknown>): DbStockRow {
  return {
    purchaseCost: optionalNumber(row.purchase_cost) ?? null,
    purchaseCurrency: String(row.purchase_currency || "ARS"),
    id: String(row.id),
    businessId: String(row.business_id),
    sku: String(row.sku),
    location: String(row.location || ""),
    intakeBatch: String(row.intake_batch || ""),
    inventoryStatus: normalizeInventoryStatus(String(row.inventory_status || "")),
    tags: String(row.tags || ""),
    quantityOnHand: Number(row.quantity_on_hand),
    quantityReserved: Number(row.quantity_reserved),
    active: Boolean(row.active),
    priceArs: Number(row.price_ars || 0),
    priceUsd: optionalNumber(row.price_usd) ?? null,
    priceReferences: {
      sale: {
        ars: Number(row.price_ars || 0),
        usd: optionalNumber(row.price_usd) ?? null
      },
      priceCharting: {
        usd: optionalNumber(row.pricecharting_loose_price_usd) ?? null,
        priceChartingId: String(row.pricecharting_id || ""),
        url: String(row.pricecharting_url || "")
      },
      tcgplayer: {
        usd: optionalNumber(row.tcgplayer_market_price_usd) ?? null,
        productId: String(row.tcgplayer_product_id || ""),
        url: String(row.tcgplayer_url || ""),
        subTypeName: String(row.tcgplayer_sub_type_name || ""),
        lowPriceUsd: optionalNumber(row.tcgplayer_low_price_usd) ?? null,
        midPriceUsd: optionalNumber(row.tcgplayer_mid_price_usd) ?? null,
        highPriceUsd: optionalNumber(row.tcgplayer_high_price_usd) ?? null,
        marketPriceUsd: optionalNumber(row.tcgplayer_market_price_usd) ?? null,
        directLowPriceUsd: optionalNumber(row.tcgplayer_direct_low_price_usd) ?? null
      },
      coolstuff: {
        usd: null,
        url: ""
      }
    },
    lastPurchaseArs: optionalNumber(row.last_purchase_ars) ?? null,
    lastPurchaseAt: row.last_purchase_at ? String(row.last_purchase_at) : undefined,
    availableQuantity: Number(row.available_quantity),
    product: {
      id: String(row.product_id),
      businessId: String(row.business_id),
      name: String(row.product_name),
      expansion: String(row.expansion),
      number: row.card_number ? String(row.card_number) : undefined,
      imageUrl: row.image_url ? String(row.image_url) : undefined,
      identifiers: parseIdentifiers(row.identifiers)
    },
    variant: {
      id: String(row.variant_id),
      productId: String(row.product_id),
      language: String(row.language),
      condition: String(row.condition),
      finish: String(row.finish),
      gradingCompany: row.grading_company ? String(row.grading_company) : undefined,
      grade: row.grade ? String(row.grade) : undefined,
      gradingCert: row.grading_cert ? String(row.grading_cert) : undefined
    }
  };
}

function toMobileInventoryEntry(row: Record<string, unknown>): MobileInventoryEntry {
  return {
    id: String(row.id || ""),
    businessId: String(row.business_id || ""),
    status: String(row.status || "pending") as MobileInventoryEntry["status"],
    helperName: String(row.helper_name || ""),
    source: String(row.source || "mobile"),
    matchType: String(row.match_type || "manual") as MobileInventoryEntry["matchType"],
    inventoryItemId: row.inventory_item_id ? String(row.inventory_item_id) : undefined,
    priceChartingId: String(row.pricecharting_id || ""),
    sku: String(row.sku || ""),
    name: String(row.name || ""),
    expansion: String(row.expansion || ""),
    number: String(row.card_number || ""),
    language: String(row.language || "EN"),
    condition: String(row.condition || "NM"),
    finish: String(row.finish || "normal"),
    gradingCompany: String(row.grading_company || ""),
    grade: String(row.grade || ""),
    location: String(row.location || ""),
    intakeBatch: String(row.intake_batch || ""),
    quantityOnHand: Number(row.quantity_on_hand || 0),
    priceArs: Number(row.price_ars || 0),
    priceUsd: optionalNumber(row.price_usd) ?? null,
    imageUrl: String(row.image_url || ""),
    notes: String(row.notes || ""),
    createdAt: String(row.created_at || ""),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewedByName: row.reviewed_by_name ? String(row.reviewed_by_name) : undefined
  };
}

function summarizeDbStock(items: DbStockRow[]): DbStockSummary {
  return items.reduce<DbStockSummary>((summary, item) => {
    summary.totalSkus += 1;
    summary.totalUnits += item.quantityOnHand;
    summary.reservedUnits += item.quantityReserved;
    summary.availableUnits += item.availableQuantity;
    summary.stockValueArs += item.availableQuantity * item.priceArs;
    return summary;
  }, { totalSkus: 0, totalUnits: 0, reservedUnits: 0, availableUnits: 0, stockValueArs: 0 });
}

async function listClaimCards(db: PGlite, claimId: string, businessId: string): Promise<ClaimCard[]> {
  const result = await db.query<Record<string, unknown>>(`
    select cc.id, cc.claim_id, cc.section_id, cc.pricecharting_id, cc.canonical_url, cc.product_name, cc.expansion_name,
      cc.card_number, coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), cc.image_url) as image_url,
      cc.pc_price_usd, cc.suggested_ars, cc.final_price_ars,
      cc.final_price_usd, cc.final_name, cc.buyer, cc.quantity, cc.tags, cc.status, cc.grid_batch, cc.sort_order
    from claim_cards cc
    left join claim_sections cs on cs.id = cc.section_id
    left join pricecharting_image_cache pic on pic.pricecharting_id = cc.pricecharting_id
    where cc.claim_id = $1 and cc.business_id = $2
    order by coalesce(cs.sort_order, 999999), cc.sort_order, cc.created_at
  `, [claimId, businessId]);
  return result.rows.map((row) => ({
    id: String(row.id),
    claimId: String(row.claim_id),
    sectionId: String(row.section_id || ""),
    priceChartingId: String(row.pricecharting_id || ""),
    canonicalUrl: String(row.canonical_url || ""),
    productName: String(row.product_name || ""),
    expansionName: String(row.expansion_name || ""),
    cardNumber: String(row.card_number || ""),
    imageUrl: String(row.image_url || ""),
    pcPriceUsd: optionalNumber(row.pc_price_usd) ?? null,
    suggestedArs: Number(row.suggested_ars || 0),
    finalPriceArs: Number(row.final_price_ars || 0),
    finalPriceUsd: Number(row.final_price_usd || 0),
    finalName: String(row.final_name || ""),
    buyer: String(row.buyer || ""),
    quantity: Math.max(1, Number(row.quantity || 1)),
    tags: String(row.tags || ""),
    status: String(row.status || "draft") as ClaimCard["status"],
    gridBatch: String(row.grid_batch || ""),
    sortOrder: Number(row.sort_order || 0)
  }));
}

async function listClaimSections(db: PGlite, claimId: string, businessId: string): Promise<ClaimSection[]> {
  const result = await db.query<Record<string, unknown>>(`
    select id, claim_id, name, sort_order, created_at
    from claim_sections
    where claim_id = $1 and business_id = $2
    order by sort_order, created_at
  `, [claimId, businessId]);
  return result.rows.map((row) => ({
    id: String(row.id),
    claimId: String(row.claim_id),
    name: String(row.name || ""),
    sortOrder: Number(row.sort_order || 0),
    createdAt: String(row.created_at || "")
  }));
}

async function normalizeClaimSectionId(db: PGlite, claimId: string, businessId: string, sectionId: string): Promise<string> {
  const clean = String(sectionId || "").trim();
  if (!clean) return "";
  const result = await db.query<{ id: string }>("select id from claim_sections where id = $1 and claim_id = $2 and business_id = $3 limit 1", [clean, claimId, businessId]);
  if (!result.rows[0]) throw new Error("La seccion elegida no existe en este claim.");
  return clean;
}

async function listClaimFrees(db: PGlite, claimId: string, businessId: string): Promise<ClaimFree[]> {
  const result = await db.query<Record<string, unknown>>(`
    select id, claim_id, buyer, final_name, product_name, expansion_name, quantity,
      pricecharting_id, canonical_url, tags, notes
    from claim_frees
    where claim_id = $1 and business_id = $2
    order by created_at
  `, [claimId, businessId]);
  return result.rows.map((row) => ({
    id: String(row.id),
    claimId: String(row.claim_id),
    buyer: String(row.buyer || ""),
    finalName: String(row.final_name || ""),
    productName: String(row.product_name || ""),
    expansionName: String(row.expansion_name || ""),
    quantity: Number(row.quantity || 1),
    priceChartingId: String(row.pricecharting_id || ""),
    canonicalUrl: String(row.canonical_url || ""),
    tags: String(row.tags || ""),
    notes: String(row.notes || "")
  }));
}

function toClaimSession(row: Record<string, unknown>): ClaimSession {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    status: String(row.status || "open") as ClaimSession["status"],
    sourceNote: String(row.source_note || ""),
    paymentDueAt: row.payment_due_at ? String(row.payment_due_at) : undefined,
    createdAt: String(row.created_at),
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
    closedSaleIds: parseStringArray(row.closed_sale_ids)
  };
}

function splitClaimBuyers(value: string): string[] {
  return String(value || "").split(",").map((buyer) => buyer.trim()).filter(Boolean);
}

function splitClaimBuyerSlots(value: string, quantity: number): string[] {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const text = String(value || "");
  if (!text.trim()) return [];
  const raw = text.split(",").map((buyer) => buyer.trim());
  if (!text.includes(",") && raw[0]) return Array.from({ length: safeQuantity }, () => raw[0]);
  if (raw.length > safeQuantity) {
    throw new Error(`Hay ${raw.length} compradores cargados pero la cantidad es ${safeQuantity}. Revisá los campos por unidad.`);
  }
  return [...raw, ...Array.from({ length: Math.max(0, safeQuantity - raw.length) }, () => "")];
}

function normalizeBuyerKey(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
}

type ClaimOrderPlanCardLine = ClaimOrderPreviewLine & {
  kind: "card";
  card: ClaimCard;
};

type ClaimOrderPlanFreeLine = ClaimOrderPreviewLine & {
  kind: "free";
  free: ClaimFree;
};

type ClaimOrderPlanLine = ClaimOrderPlanCardLine | ClaimOrderPlanFreeLine;

type ClaimOrderPlanBuyer = Omit<ClaimOrderPreviewBuyer, "lines"> & {
  lines: ClaimOrderPlanLine[];
};

type ClaimOrderPlan = Omit<ClaimOrderPreview, "buyers"> & {
  buyers: ClaimOrderPlanBuyer[];
};

function claimCardBuyerAllocations(card: ClaimCard): Array<{ buyer: string; quantity: number }> {
  const quantity = Math.max(1, Math.floor(Number(card.quantity) || 1));
  const buyers = splitClaimBuyerSlots(card.buyer, quantity).filter(Boolean);
  if (!buyers.length) return [];
  const grouped = new Map<string, { buyer: string; quantity: number }>();
  for (const buyer of buyers) {
    const key = normalizeBuyerKey(buyer);
    const current = grouped.get(key);
    grouped.set(key, { buyer: current?.buyer || buyer, quantity: (current?.quantity || 0) + 1 });
  }
  return [...grouped.values()];
}

function claimFreeBuyerAllocations(free: ClaimFree): Array<{ buyer: string; quantity: number }> {
  const quantity = Math.max(1, Math.floor(Number(free.quantity) || 1));
  const buyers = splitClaimBuyerSlots(free.buyer, quantity).filter(Boolean);
  if (!buyers.length) return [];
  const grouped = new Map<string, { buyer: string; quantity: number }>();
  for (const buyer of buyers) {
    const key = normalizeBuyerKey(buyer);
    const current = grouped.get(key);
    grouped.set(key, { buyer: current?.buyer || buyer, quantity: (current?.quantity || 0) + 1 });
  }
  return [...grouped.values()];
}

function buildClaimOrderPlan(workspace: ClaimsWorkspace): ClaimOrderPlan {
  const claim = workspace.activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  const cards = workspace.cards.filter((card) => card.status !== "ignored" && card.buyer.trim());
  const missingPrices = cards.filter((card) => card.finalPriceArs <= 0 && card.finalPriceUsd <= 0);
  if (missingPrices.length) throw new Error(`${missingPrices.length} cartas con comprador no tienen precio final.`);

  const groups = new Map<string, { buyer: string; lines: ClaimOrderPlanLine[] }>();
  const addLine = (buyer: string, line: ClaimOrderPlanLine) => {
    const key = normalizeBuyerKey(buyer);
    const current = groups.get(key);
    groups.set(key, { buyer: current?.buyer || buyer, lines: [...(current?.lines || []), line] });
  };

  for (const card of cards) {
    const displayName = card.finalName.trim() || buildClaimFinalName(card.productName, card.expansionName, card.finalPriceArs, card.finalPriceUsd);
    for (const allocation of claimCardBuyerAllocations(card)) {
      addLine(allocation.buyer, {
        kind: "card",
        card,
        claimCardId: card.id,
        claimFreeId: "",
        displayName,
        productName: card.productName,
        expansionName: card.expansionName,
        priceChartingId: card.priceChartingId,
        quantity: allocation.quantity,
        unitPriceArs: card.finalPriceArs,
        unitPriceUsd: card.finalPriceUsd,
        lineTotalArs: card.finalPriceArs * allocation.quantity,
        lineTotalUsd: card.finalPriceUsd * allocation.quantity,
        tags: card.tags,
        sourceReference: `claim:${claim.id}:${card.id}`
      });
    }
  }

  for (const free of workspace.frees) {
    for (const allocation of claimFreeBuyerAllocations(free)) {
      addLine(allocation.buyer, {
        kind: "free",
        free,
        claimCardId: "",
        claimFreeId: free.id,
        displayName: `FREE - ${free.finalName}`,
        productName: free.productName,
        expansionName: free.expansionName,
        priceChartingId: free.priceChartingId,
        quantity: allocation.quantity,
        unitPriceArs: 0,
        unitPriceUsd: 0,
        lineTotalArs: 0,
        lineTotalUsd: 0,
        tags: free.tags,
        sourceReference: `claim:${claim.id}:free:${free.id}`
      });
    }
  }

  if (!groups.size) throw new Error("El claim no tiene compradores para cerrar.");
  const buyers = [...groups.values()].map((group) => ({
    buyer: group.buyer,
    lines: group.lines,
    totalArs: group.lines.reduce((sum, line) => sum + line.lineTotalArs, 0),
    totalUsd: group.lines.reduce((sum, line) => sum + line.lineTotalUsd, 0),
    units: group.lines.reduce((sum, line) => sum + line.quantity, 0)
  }));

  return {
    claimId: claim.id,
    claimName: claim.name,
    issues: [],
    buyers,
    totals: {
      buyers: buyers.length,
      lines: buyers.reduce((sum, buyer) => sum + buyer.lines.length, 0),
      units: buyers.reduce((sum, buyer) => sum + buyer.units, 0),
      totalArs: buyers.reduce((sum, buyer) => sum + buyer.totalArs, 0),
      totalUsd: buyers.reduce((sum, buyer) => sum + buyer.totalUsd, 0)
    }
  };
}

function toClaimOrderPreview(plan: ClaimOrderPlan): ClaimOrderPreview {
  return {
    claimId: plan.claimId,
    claimName: plan.claimName,
    issues: plan.issues,
    totals: plan.totals,
    buyers: plan.buyers.map((buyer) => ({
      buyer: buyer.buyer,
      totalArs: buyer.totalArs,
      totalUsd: buyer.totalUsd,
      units: buyer.units,
      lines: buyer.lines.map((line) => toClaimOrderPreviewLine(line))
    }))
  };
}

function toClaimOrderPreviewLine(line: ClaimOrderPlanLine): ClaimOrderPreviewLine {
  return {
    kind: line.kind,
    claimCardId: line.claimCardId,
    claimFreeId: line.claimFreeId,
    displayName: line.displayName,
    productName: line.productName,
    expansionName: line.expansionName,
    priceChartingId: line.priceChartingId,
    quantity: line.quantity,
    unitPriceArs: line.unitPriceArs,
    unitPriceUsd: line.unitPriceUsd,
    lineTotalArs: line.lineTotalArs,
    lineTotalUsd: line.lineTotalUsd,
    tags: line.tags,
    sourceReference: line.sourceReference
  };
}

function summarizeClaim(cards: ClaimCard[], frees: ClaimFree[]): ClaimSummary {
  const activeCards = cards.filter((card) => card.status !== "ignored");
  const cardAllocations = activeCards.flatMap((card) => {
    try {
      return claimCardBuyerAllocations(card).map((allocation) => ({
        ...allocation,
        finalPriceArs: card.finalPriceArs,
        finalPriceUsd: card.finalPriceUsd
      }));
    } catch {
      return splitClaimBuyers(card.buyer).map((buyer) => ({
        buyer,
        quantity: 1,
        finalPriceArs: card.finalPriceArs,
        finalPriceUsd: card.finalPriceUsd
      }));
    }
  });
  const freeAllocations = frees.flatMap((free) => {
    try {
      return claimFreeBuyerAllocations(free);
    } catch {
      return splitClaimBuyers(free.buyer).map((buyer) => ({ buyer, quantity: 1 }));
    }
  });
  const buyers = new Set([...cardAllocations.map((allocation) => allocation.buyer), ...freeAllocations.map((allocation) => allocation.buyer)].filter(Boolean));
  return {
    cards: activeCards.reduce((sum, card) => sum + Math.max(1, Math.floor(Number(card.quantity) || 1)), 0),
    cardsWithBuyer: cardAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
    buyers: buyers.size,
    missingPrices: activeCards.filter((card) => card.buyer.trim() && card.finalPriceArs <= 0 && card.finalPriceUsd <= 0).length,
    missingImages: activeCards.reduce((sum, card) => sum + (!card.imageUrl ? Math.max(1, Math.floor(Number(card.quantity) || 1)) : 0), 0),
    totalArs: cardAllocations.reduce((sum, allocation) => sum + allocation.finalPriceArs * allocation.quantity, 0),
    totalUsd: cardAllocations.reduce((sum, allocation) => sum + allocation.finalPriceUsd * allocation.quantity, 0),
    claimTotalArs: activeCards.reduce((sum, card) => sum + card.finalPriceArs * Math.max(1, Math.floor(Number(card.quantity) || 1)), 0),
    claimTotalUsd: activeCards.reduce((sum, card) => sum + card.finalPriceUsd * Math.max(1, Math.floor(Number(card.quantity) || 1)), 0),
    frees: frees.reduce((sum, free) => sum + free.quantity, 0)
  };
}

function buildClaimName(date = new Date()): string {
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `Claim ${date.getDate()} de ${months[date.getMonth()]}`;
}

function suggestClaimPriceArs(priceUsd: number | null | undefined): number {
  if (!priceUsd || priceUsd <= 0) return 0;
  const converted = priceUsd * 1510;
  const rounded = Math.ceil(converted / 500) * 500;
  return Math.max(800, rounded);
}

function buildClaimFinalName(name: string, expansion: string, priceArs: number, priceUsd: number): string {
  const base = [name, expansion].filter(Boolean).join(" - ");
  const prices = [];
  if (priceArs > 0) prices.push(formatClaimNameArsPrice(priceArs));
  if (priceUsd > 0) prices.push(`$${priceUsd}usd`);
  return prices.length ? `${base} - ${prices.join(" + ")}` : base;
}

function formatClaimNameArsPrice(priceArs: number): string {
  const roundedPrice = Math.round(priceArs);
  if (roundedPrice >= 10000) {
    const thousands = roundedPrice / 1000;
    const display = Number.isInteger(thousands)
      ? String(thousands)
      : thousands.toLocaleString("es-AR", { maximumFractionDigits: 1 });
    return `$${display}mil`;
  }
  return `$${roundedPrice}`;
}

async function ensureOperationalBootstrap(db: PGlite, options: OperationalDatabaseOptions): Promise<void> {
  const business = await db.query<{ id: string }>("select id from businesses where slug = $1 limit 1", [localBusinessSlug]);
  const businessId = business.rows[0]?.id || demoBusinessId;
  if (!business.rows[0]) {
    await db.query("insert into businesses (id, name, slug) values ($1, $2, $3)", [businessId, localBusinessName, localBusinessSlug]);
  }
  const role = await db.query<{ id: string }>("select id from roles where business_id = $1 and name = 'admin' limit 1", [businessId]);
  const roleId = role.rows[0]?.id || crypto.randomUUID();
  if (!role.rows[0]) {
    await db.query("insert into roles (id, business_id, name, description) values ($1, $2, 'admin', 'Administrador interno')", [roleId, businessId]);
  }
  const systemUser = await db.query<{ id: string }>("select id from app_users where business_id = $1 and display_name = 'Sistema local' limit 1", [businessId]);
  if (!systemUser.rows[0]) {
    const systemUserId = crypto.randomUUID();
    await db.query(`
      insert into app_users (id, business_id, display_name, email, active)
      values ($1, $2, 'Sistema local', 'sistema@local', true)
    `, [systemUserId, businessId]);
    await db.query("insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing", [systemUserId, roleId]);
  }
  if (options.adminEmail && options.adminPassword) {
    const existing = await db.query<{ id: string }>("select id from app_users where business_id = $1 and lower(email) = lower($2) limit 1", [businessId, options.adminEmail]);
    const userId = existing.rows[0]?.id || crypto.randomUUID();
    const passwordHash = hashPassword(options.adminPassword);
    if (existing.rows[0]) {
      await db.query("update app_users set password_hash = $1, active = true where id = $2", [passwordHash, userId]);
    } else {
      await db.query(`
        insert into app_users (id, business_id, display_name, email, password_hash)
        values ($1, $2, $3, $4, $5)
      `, [userId, businessId, options.adminName || "Admin UltimoTurno", options.adminEmail, passwordHash]);
      await db.query("insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing", [userId, roleId]);
    }
  }
}

async function runOperationalMigrations(db: PGlite): Promise<void> {
  await db.exec(`
    create table if not exists schema_migrations (
      file_name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  for (const file of migrationFiles) {
    const applied = await db.query<{ file_name: string }>("select file_name from schema_migrations where file_name = $1", [file]);
    if (applied.rows[0]) continue;
    await db.exec(await readSql(`migrations/${file}`));
    await db.query("insert into schema_migrations (file_name) values ($1)", [file]);
  }
}

async function findStockBySku(db: PGlite, businessId: string, sku: string): Promise<DbStockRow | null> {
  const stock = await listStockInternal(db, businessId);
  return stock.items.find((item) => item.sku.toLowerCase() === sku.trim().toLowerCase()) || null;
}

function validateInventoryInput(input: UpsertInventoryInput): void {
  if (input.purchaseCost != null && (!Number.isFinite(input.purchaseCost) || input.purchaseCost < 0)) throw new Error("El costo debe ser positivo o quedar vacio.");
  if (input.purchaseCurrency && !["ARS", "USD"].includes(input.purchaseCurrency)) throw new Error("Moneda de compra invalida.");
  if (!input.name?.trim()) throw new Error("El nombre es obligatorio");
  if (!input.expansion?.trim()) throw new Error("La expansion es obligatoria");
  if (!input.language?.trim()) throw new Error("El idioma es obligatorio");
  if (!input.condition?.trim() && !input.gradingCompany?.trim() && !input.grade?.trim()) throw new Error("La condicion es obligatoria");
  if (!input.finish?.trim()) throw new Error("El acabado es obligatorio");
  if (!Number.isInteger(input.quantityOnHand) || input.quantityOnHand < 0) throw new Error("La cantidad total debe ser un entero mayor o igual a cero");
  if ((input.quantityReserved || 0) > input.quantityOnHand) throw new Error("La cantidad reservada no puede superar el total");
}

function buildSku(input: UpsertInventoryInput): string {
  return [input.name, input.expansion, input.number, input.language, input.gradingCompany || input.condition, input.grade, input.finish]
    .map((part) => String(part || "").trim().slice(0, 12).replace(/[^a-z0-9]+/gi, "").toUpperCase())
    .filter(Boolean)
    .join("-");
}

async function writeAudit(db: PGlite, actor: AuthenticatedUser, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown): Promise<void> {
  await db.query(`
    insert into audit_log (id, business_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
    values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
  `, [crypto.randomUUID(), actor.businessId, actor.id, action, entityType, entityId, JSON.stringify(beforeData || null), JSON.stringify(afterData || null)]);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, iterationsText, salt, hash] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !salt || !hash) return false;
  const next = crypto.pbkdf2Sync(password, salt, Number(iterationsText), 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseSnapshotCsv(csvText: string): Array<UpsertInventoryInput & { rowNumber: number }> {
  const records = parse(csvText, {
    bom: true,
    delimiter: [",", ";"],
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true
  }) as string[][];
  if (records.length < 2) throw new Error("El archivo debe tener encabezados y al menos una fila");
  const headers = records[0].map(normalizeSnapshotHeader);
  const index = new Map(headers.map((header, position) => [header, position]));
  return records.slice(1).map((cells, indexInFile) => {
    const get = (...names: string[]) => getSnapshotCell(cells, index, names);
    const quantity = parseImportNumber(get("quantityonhand", "quantity", "cantidad", "count", "stock", "qty", "cantidadobservada"));
    const reserved = parseImportNumber(get("quantityreserved", "reserved", "reservadas", "reservado", "cantidadreservada"));
    const priceArs = parseImportNumber(get("pricears", "price_ars", "precioars", "precio", "precioarsfinal", "preciofinalars", "preciofinal"));
    const presentation = get("type", "tipo", "presentation", "presentacion", "varianttype", "tipoproducto");
    const gradingText = [
      get("gradingcompany", "grading_company", "grader", "empresa_grading", "empresagrading", "empresa_certificadora"),
      get("grade", "gradinggrade", "grading_grade", "nota_grading", "notagrading", "calificacion"),
      presentation
    ].join(" ");
    const inferredGrading = inferSnapshotGrading(gradingText);
    const gradingCompany = get("gradingcompany", "grading_company", "grader", "empresa_grading", "empresagrading", "empresa_certificadora") || inferredGrading.company;
    const grade = get("grade", "gradinggrade", "grading_grade", "nota_grading", "notagrading", "calificacion") || inferredGrading.grade;
    const gradingCert = get("gradingcert", "grading_cert", "cert", "certificado", "certificacion", "certnumber", "certificadonumero");
    const tags = get("tags", "categorias", "categoria", "category", "categories");
    return {
      rowNumber: indexInFile + 2,
      mobileEntryId: get("mobileEntryId"),
      sku: get("sku", "identificador", "idlocal"),
      name: get("name", "nombre", "cardname", "nombrecarta", "productname", "nombrepc"),
      expansion: get("expansion", "set", "edition", "edicion", "coleccion", "expansionpc"),
      number: get("number", "numero", "cardnumber", "numerocarta", "#", "numeropc"),
      imageUrl: get("imageurl", "image_url", "imagen", "imagenurl", "photo", "photourl"),
      priceChartingId: get("pricechartingid", "pricecharting_id", "pcid", "idpricecharting", "pricechartingproductid"),
      priceChartingUrl: get("pricechartingurl", "pricecharting_url", "pcurl", "linkpricecharting", "pricechartinglink"),
      monPriceId: get("monpriceid", "monprice_id", "scannerid", "scanid"),
      language: get("language", "idioma") || "EN",
      condition: gradingCompany || grade ? "GRADED" : get("condition", "condicion") || "NM",
      finish: get("finish", "acabado") || "normal",
      gradingCompany,
      grade,
      gradingCert,
      location: get("location", "ubicacion"),
      intakeBatch: get("intakebatch", "batch", "lote", "loteingreso", "loteinventario"),
      inventoryStatus: get("inventorystatus", "status", "estado", "estadoinventario"),
      quantityOnHand: quantity ?? 0,
      quantityReserved: reserved ?? 0,
      priceArs: priceArs ?? 0,
      priceUsd: parseImportNumber(get("priceusd", "price_usd", "preciousd", "averageprice", "scanneraverageusd", "scanneravgusd")) ?? null,
      notes: get("notes", "notas"),
      ...(tags ? { tags } : {})
    };
  });
}

function getSnapshotCell(row: string[], index: Map<string, number>, names: string[]): string {
  for (const name of names) {
    const position = index.get(normalizeSnapshotHeader(name));
    if (position !== undefined) return String(row[position] || "").trim();
  }
  return "";
}

function normalizeSnapshotHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#]+/g, "");
}

function parseImportNumber(value: string): number | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  let clean = raw.replace(/[^\d,.-]/g, "");
  if (!clean) return undefined;
  if (clean.includes(",") && clean.includes(".")) clean = clean.replace(/\./g, "").replace(",", ".");
  else if (clean.includes(",")) clean = clean.replace(",", ".");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferSnapshotGrading(value: string): { company: string; grade: string } {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return { company: "", grade: "" };
  const company = raw.match(/\b(PSA|BGS|CGC|SGC)\b/)?.[1] || "";
  const grade = raw.match(/\b(?:PSA|BGS|CGC|SGC)?\s*(10|9(?:\.5)?|8(?:\.5)?|7(?:\.5)?|6(?:\.5)?|5(?:\.5)?|4(?:\.5)?|3(?:\.5)?|2(?:\.5)?|1(?:\.5)?)\b/)?.[1] || "";
  if (!company && !/\bGRADED\b|\bGRADING\b|\bCERTIFICAD[AO]\b/.test(raw)) return { company: "", grade: "" };
  return { company, grade };
}

function validateSnapshotRow(row: UpsertInventoryInput): string[] {
  const warnings: string[] = [];
  try {
    validateInventoryInput(row);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }
  if (row.priceArs !== undefined && row.priceArs < 0) warnings.push("Precio ARS invalido");
  return warnings;
}

function normalizeInventoryStatus(value: string | undefined): string {
  const normalized = normalizeImportText(String(value || ""));
  if (["no venta", "noventa", "not for sale", "nfs"].includes(normalized)) return "not_for_sale";
  if (["para revisar", "revision", "revisar", "review", "pending_review"].includes(normalized)) return "review";
  if (["sin precio", "sinprecio", "missing price", "missing_price"].includes(normalized)) return "missing_price";
  if (["sin imagen", "sinimagen", "missing image", "missing_image"].includes(normalized)) return "missing_image";
  if (["lote pendiente", "pendiente", "pending", "pending_intake"].includes(normalized)) return "pending_intake";
  if (["reservada", "reservado", "reserved"].includes(normalized)) return "reserved";
  return "available";
}

function normalizeInventoryTags(value: string): string {
  const seen = new Set<string>();
  return String(value || "")
    .split(/[,;|]/)
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .join(", ");
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function parseSearchQuery(value: string): { raw: string; rawLike: string; tokens: string[]; textTokens: string[]; numberTokens: string[] } {
  const raw = normalizeImportText(value);
  const tokens = raw.split(" ").filter((token) => token && token !== "s");
  const numberTokens = [...new Set(tokens
    .map((token) => token.replace(/^#/, ""))
    .filter((token) => /^[0-9]+[a-z]?$/i.test(token))
    .map((token) => token.replace(/^0+([0-9])/, "$1")))].slice(0, 1);
  const textTokens = [...new Set(tokens.filter((token) => !/^[0-9]+[a-z]?$/i.test(token.replace(/^#/, ""))))];
  return { raw, rawLike: `%${raw}%`, tokens, textTokens, numberTokens };
}

function searchTokenVariants(token: string): string[] {
  const variants = new Set([token]);
  if (token.endsWith("ies") && token.length > 4) variants.add(`${token.slice(0, -3)}y`);
  if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
  return [...variants];
}

function textIncludesSearchToken(value: string, token: string): boolean {
  return searchTokenVariants(token).some((variant) => value.includes(variant));
}

function wordsIncludeSearchToken(value: string, token: string): boolean {
  const words = new Set(value.split(" ").filter(Boolean));
  return searchTokenVariants(token).some((variant) => words.has(variant));
}

function scorePriceChartingSearchRow(row: Record<string, unknown>, query: ReturnType<typeof parseSearchQuery>): number {
  if (!query.tokens.length) return 1;
  const name = normalizeImportText(String(row.product_name || row.normalized_name || ""));
  const expansion = normalizeImportText(String(row.expansion_name || row.normalized_expansion || ""));
  const searchKey = normalizeImportText(String(row.search_key || ""));
  const id = normalizeImportText(String(row.pricecharting_id || ""));
  const cardNumber = primaryImportCardNumber(String(row.card_number || ""));
  let score = 0;
  for (const token of query.textTokens) {
    if (wordsIncludeSearchToken(name, token)) score += 45;
    else if (textIncludesSearchToken(name, token)) score += 32;
    else if (wordsIncludeSearchToken(expansion, token)) score += 18;
    else if (textIncludesSearchToken(expansion, token)) score += 12;
    else if (textIncludesSearchToken(searchKey, token) || id.includes(token)) score += 6;
    else return 0;
  }
  for (const token of query.numberTokens) {
    if (cardNumber === token) score += 70;
    else if (cardNumber.includes(token)) score += 12;
    else if (id.includes(token)) score += 4;
    else return 0;
  }
  if (query.raw && searchKey.includes(query.raw)) score += 8;
  return score;
}

function parseIdentifiers(value: unknown): Array<{ source: string; externalId: string; url?: string }> {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(raw) ? raw.map((item) => ({
    source: String(item.source || ""),
    externalId: String(item.externalId || ""),
    url: item.url ? String(item.url) : undefined
  })).filter((item) => item.externalId) : [];
}

function mapCardIndexRow(row: Record<string, unknown>): CardIndexEntry {
  return {
    id: String(row.id || ""),
    priceChartingId: String(row.pricecharting_id || ""),
    canonicalName: String(row.canonical_name || ""),
    canonicalExpansion: String(row.canonical_expansion || ""),
    cardNumber: String(row.card_number || ""),
    languageGroup: inferLanguageGroup(String(row.canonical_expansion || ""), String(row.canonical_name || ""), String(row.pricecharting_url || ""), String(row.language_group || "")),
    priceChartingUrl: String(row.pricecharting_url || ""),
    tcgplayerProductId: String(row.tcgplayer_product_id || ""),
    tcgplayerUrl: String(row.tcgplayer_url || ""),
    tcgplayerImageUrl: String(row.tcgplayer_image_url || ""),
    coolstuffUrl: String(row.coolstuff_url || ""),
    imageUrl: String(row.image_url || ""),
    imageSource: String(row.image_source || ""),
    matchConfidence: Number(row.match_confidence || 0),
    matchStatus: String(row.match_status || "pricecharting_only") as CardIndexEntry["matchStatus"],
    reviewStatus: String(row.review_status || "pending") as CardIndexEntry["reviewStatus"],
    reviewNote: String(row.review_note || ""),
    evidence: parseJsonObject(row.evidence_json),
    updatedAt: String(row.updated_at || ""),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined
  };
}

function normalizeLanguageGroupFilter(value: string): LanguageGroup | "all" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "english" || normalized === "chinese" || normalized === "japanese") return normalized;
  return "all";
}

function buildCardIndexLookup(entries: CardIndexEntry[]): { byNumber: Map<string, CardIndexEntry[]> } {
  const byNumber = new Map<string, CardIndexEntry[]>();
  for (const entry of entries) {
    const number = normalizeCardIndexNumber(entry.cardNumber);
    if (!number) continue;
    const current = byNumber.get(number) || [];
    current.push(entry);
    byNumber.set(number, current);
  }
  return { byNumber };
}

function scoreTcgCsvCardIndexMatch(
  entry: CardIndexEntry,
  product: TcgCsvProductInput,
  group: TcgCsvGroupInput,
  number: string
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (normalizeCardIndexNumber(entry.cardNumber) === normalizeCardIndexNumber(number)) {
    score += 38;
    reasons.push("numero");
  }

  const entryName = normalizeCardIndexName(entry.canonicalName);
  const productName = normalizeCardIndexName(String(product.cleanName || product.name || ""));
  if (entryName && productName) {
    if (entryName === productName) {
      score += 34;
      reasons.push("nombre exacto");
    } else if (entryName.includes(productName) || productName.includes(entryName)) {
      score += 24;
      reasons.push("nombre contenido");
    } else if (nameTokenOverlap(entryName, productName) >= 0.72) {
      score += 18;
      reasons.push("nombre similar");
    } else {
      score -= 20;
    }
  }

  const entryExpansion = normalizeCardIndexExpansion(entry.canonicalExpansion);
  const groupName = normalizeCardIndexExpansion(String(group.name || ""));
  const groupAbbreviation = normalizeCardIndexExpansion(String(group.abbreviation || ""));
  if (entryExpansion && groupName) {
    if (entryExpansion === groupName || groupName.endsWith(entryExpansion) || entryExpansion.endsWith(groupName)) {
      score += 26;
      reasons.push("set");
    } else if (groupAbbreviation && (entryExpansion === groupAbbreviation || groupName.includes(entryExpansion))) {
      score += 18;
      reasons.push("set abreviado");
    } else if (nameTokenOverlap(entryExpansion, groupName) >= 0.6) {
      score += 12;
      reasons.push("set similar");
    } else {
      score -= 16;
    }
  }

  const entryVariant = detectIndexVariant(entry.canonicalName);
  const tcgVariant = normalizeImportText(tcgCsvExtendedValue(product, "Printing", "Variant", "Finish", "Rarity"));
  if (entryVariant && tcgVariant && tcgVariant.includes(entryVariant)) {
    score += 6;
    reasons.push("variante");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

async function upsertCardIndexTcgplayerLink(db: PGlite, cardIndexId: string, input: {
  product: TcgCsvProductInput;
  group: TcgCsvGroupInput;
  number: string;
  confidence: number;
  matchStatus: CardIndexEntry["matchStatus"];
  reasons: string[];
}): Promise<void> {
  const productId = String(input.product.productId || "").trim();
  const productUrl = String(input.product.url || "").trim();
  const imageUrl = upgradeTcgplayerImageUrl(String(input.product.imageUrl || "").trim());
  const rawName = String(input.product.name || input.product.cleanName || "").trim();
  const rawExpansion = String(input.group.name || "").trim();
  const evidence = {
    source: "tcgcsv",
    groupId: String(input.group.groupId || ""),
    groupName: rawExpansion,
    groupAbbreviation: String(input.group.abbreviation || ""),
    reasons: input.reasons,
    extendedData: input.product.extendedData || []
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
  `, [cardIndexId, productId, productUrl, imageUrl, input.confidence, JSON.stringify(evidence), input.matchStatus]);

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
    cardIndexId,
    productId,
    productUrl,
    rawName,
    rawExpansion,
    input.number,
    tcgCsvExtendedValue(input.product, "Printing", "Variant", "Finish"),
    imageUrl,
    input.confidence,
    JSON.stringify(evidence)
  ]);
}

async function upsertPriceChartingSourceLinks(db: PGlite, rows: Record<string, unknown>[]): Promise<void> {
  const ids = rows.map((row) => String(row.pricecharting_id || "")).filter(Boolean);
  if (!ids.length) return;
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
  const existing = await db.query<Record<string, unknown>>(`
    select id, pricecharting_id, pricecharting_url, canonical_name, canonical_expansion,
      card_number, pricecharting_image_url
    from card_index_entries
    where pricecharting_id in (${placeholders})
  `, ids);
  for (const row of existing.rows) {
    await db.query(`
      insert into card_source_links (
        id, card_index_id, source, external_id, url, raw_name, raw_expansion, raw_number,
        image_url, confidence, evidence_json, created_at, updated_at
      ) values ($1, $2, 'pricecharting', $3, $4, $5, $6, $7, $8, 100, $9::jsonb, now(), now())
      on conflict (card_index_id, source) do update set
        external_id = excluded.external_id,
        url = excluded.url,
        raw_name = excluded.raw_name,
        raw_expansion = excluded.raw_expansion,
        raw_number = excluded.raw_number,
        image_url = excluded.image_url,
        confidence = excluded.confidence,
        evidence_json = excluded.evidence_json,
        updated_at = now()
    `, [
      crypto.randomUUID(),
      String(row.id || ""),
      String(row.pricecharting_id || ""),
      String(row.pricecharting_url || ""),
      String(row.canonical_name || ""),
      String(row.canonical_expansion || ""),
      String(row.card_number || ""),
      String(row.pricecharting_image_url || ""),
      JSON.stringify({ source: "pricecharting_cache" })
    ]);
  }
}

function tcgCsvExtendedValue(product: TcgCsvProductInput, ...names: string[]): string {
  const wanted = new Set(names.map((name) => normalizeImportText(name)));
  for (const item of product.extendedData || []) {
    const keys = [item.name, item.displayName].map((value) => normalizeImportText(String(value || "")));
    if (keys.some((key) => wanted.has(key))) return String(item.value || "").trim();
  }
  return "";
}

function normalizeCardIndexNumber(value: string): string {
  return primaryImportCardNumber(value).replace(/^0+([0-9])/, "$1");
}

function normalizeCardIndexName(value: string): string {
  return normalizeImportText(value)
    .replace(/\b(reverse holo|reverse|holofoil|holo|foil|normal|unlimited|1st edition|first edition|cosmos|master ball|poke ball|pokeball|masterball)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCardIndexExpansion(value: string): string {
  return normalizeImportText(value)
    .replace(/^pokemon\s+/, "")
    .replace(/^[a-z]{1,4}\d{0,3}\s+/, "")
    .replace(/^[a-z]{1,4}\d{0,3}\s*:\s*/, "")
    .replace(/\b(scarlet violet|sword shield|sun moon|xy|black white)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared++;
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function detectIndexVariant(value: string): string {
  const text = normalizeImportText(value);
  if (text.includes("reverse holo")) return "reverse";
  if (text.includes("holofoil") || text.includes("holo")) return "holo";
  if (text.includes("1st edition") || text.includes("first edition")) return "1st edition";
  if (text.includes("master ball")) return "master ball";
  if (text.includes("poke ball") || text.includes("pokeball")) return "poke ball";
  return "";
}

function upgradeTcgplayerImageUrl(value: string): string {
  return value.replace(/_200w(?=\.(?:jpg|jpeg|png|webp)(?:$|\?))/i, "_in_1000x1000");
}

function imageSourceForIndex(value: string): string {
  if (value.startsWith("/pricecharting-images/")) return "local";
  if (value.includes("tcgplayer")) return "tcgplayer";
  if (value.includes("pokemontcg")) return "pokemontcg";
  if (value.includes("tcgdex")) return "tcgdex";
  if (value.includes("pricecharting") || value.includes("storage.googleapis.com")) return "pricecharting";
  return value ? "external" : "";
}

function parseStringArray(value: unknown): string[] {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(raw) ? raw.map((item) => String(item)).filter(Boolean) : [];
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  if (typeof value === "object") return value as Record<string, unknown>;
  return {};
}

export type StockImageReviewItem = {
  inventoryItemId: string;
  productName: string;
  expansion: string;
  cardNumber: string;
  language: string;
  condition: string;
  productId: string;
  hasProductImage: boolean;
  priceChartingId: string;
  priceChartingName: string;
  priceChartingExpansion: string;
  priceChartingNumber: string;
  pcPublicUrl: string;
  pcSourceUrl: string;
  pcCanonicalUrl: string;
  pcImageUrl: string;
  imageSource: string;
  matchCriteria: string;
  quantityOnHand: number;
  availableQuantity: number;
  sku: string;
};

export async function listStockImageReview(db: PGlite, businessId: string): Promise<StockImageReviewItem[]> {
  const result = await db.query<Record<string, unknown>>(`
    select
      ii.id as inventory_item_id,
      cp.id as product_id,
      cp.name as product_name,
      cp.expansion,
      cp.card_number,
      v.language,
      v.condition,
      ii.quantity_on_hand,
      (ii.quantity_on_hand - ii.quantity_reserved) as available_quantity,
      ii.sku,
      cp.image_url as product_image_url,
      coalesce(exi.external_id, '') as pricecharting_id,
      pce.product_name as pc_product_name,
      pce.expansion_name as pc_expansion_name,
      pce.card_number as pc_card_number,
      coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), '') as pc_public_url,
      coalesce(pic.source_image_url, pce.image_url, '') as pc_image_url,
      pic.status as pic_status,
      pic.source_image_url as pic_source_url
    from inventory_items ii
    join card_products cp on cp.id = ii.product_id
    join card_variants v on v.id = ii.variant_id
    left join external_identifiers exi on exi.product_id = cp.id and exi.source_id in (
      select id from external_sources where name = 'pricecharting'
    )
    left join pricecharting_cache_entries pce on pce.pricecharting_id = coalesce(exi.external_id, '')
    left join pricecharting_image_cache pic on pic.pricecharting_id = coalesce(exi.external_id, '')
    where ii.business_id = $1 and ii.active = true
    order by cp.name, v.language, v.condition
  `, [businessId]);

  return result.rows.map((row) => {
    const productName = String(row.product_name || "");
    const language = String(row.language || "");
    const condition = String(row.condition || "");
    const expansion = String(row.expansion || "");
    const cardNumber = String(row.card_number || "");
    const pcPriceChartingId = String(row.pricecharting_id || "");
    const pcName = String(row.pc_product_name || "");
    const pcExpansion = String(row.pc_expansion_name || "");
    const pcNumber = String(row.pc_card_number || "");
    const pcPublicUrl = String(row.pc_public_url || "");
    const pcImageUrl = String(row.pc_image_url || "");
    const picStatus = String(row.pic_status || "");
    const picSourceUrl = String(row.pic_source_url || "");

    const hasProductImage = !!String(row.product_image_url || "").trim();
    const pcHasPublic = !!pcPublicUrl;
    const pcHasSource = !!picSourceUrl;
    const pcHasCache = !!pcImageUrl;

    let imageSource = "Sin imagen";
    let matchCriteria = "Sin match PC";

    if (picStatus === "downloaded") {
      matchCriteria = "Match por PC ID";
      if (picSourceUrl.startsWith("pokemontcg:")) {
        imageSource = "PokemonTCG (via PC)";
      } else if (picSourceUrl.startsWith("tcgdex:")) {
        imageSource = "TCGdex (via PC)";
      } else if (picSourceUrl.includes("pricecharting.com") || picSourceUrl.includes("pricecharting-storage")) {
        imageSource = "PriceCharting direct/HTML";
      } else if (picSourceUrl) {
        imageSource = "Fuente externa";
      } else {
        imageSource = "PrecioCharting local";
      }
    } else if (pcHasPublic && !picSourceUrl) {
      imageSource = "PC cache URL";
      if (pcPriceChartingId) matchCriteria = "Match por ID";
    } else if (pcHasSource) {
      if (picSourceUrl.startsWith("pokemontcg:")) {
        imageSource = "PokemonTCG URL";
        matchCriteria = "Match por PC ID";
      } else if (picSourceUrl.startsWith("tcgdex:")) {
        imageSource = "TCGdex URL";
        matchCriteria = "Match por PC ID";
      } else {
        imageSource = "Fuente externa URL";
        if (pcPriceChartingId) matchCriteria = "Match por PC ID";
      }
    } else if (hasProductImage) {
      imageSource = "Imagen manual/upload";
    } else if (pcHasCache) {
      imageSource = "PC cache fallback";
      if (pcPriceChartingId) matchCriteria = "Match por PC ID";
    }

    if (picStatus === "downloaded" && !!picSourceUrl && pcPriceChartingId && !matchCriteria.includes("PC ID")) {
      matchCriteria = "Match por PC ID";
    }
    if (picStatus === "url_found" && matchCriteria === "Sin match PC") {
      matchCriteria = "Match por PC ID";
    }

    return {
      inventoryItemId: String(row.inventory_item_id),
      productName,
      expansion,
      cardNumber: cardNumber || undefined,
      language,
      condition,
      productId: String(row.product_id),
      hasProductImage,
      priceChartingId: pcPriceChartingId || "",
      priceChartingName: pcName || productName,
      priceChartingExpansion: pcExpansion || expansion,
      priceChartingNumber: pcNumber || cardNumber,
      pcPublicUrl,
      pcSourceUrl: picSourceUrl || pcImageUrl || "",
      pcCanonicalUrl: pcPublicUrl || picSourceUrl || "",
      pcImageUrl: pcPublicUrl || picSourceUrl || pcImageUrl || "",
      imageSource,
      matchCriteria,
      quantityOnHand: Number(row.quantity_on_hand) || 0,
      availableQuantity: Number(row.available_quantity) || 0,
      sku: String(row.sku || "")
    } as StockImageReviewItem;
  }).filter((item) => {
    return item.hasProductImage || item.pcPublicUrl || item.pcSourceUrl || item.pcImageUrl || item.priceChartingId;
  });
}

export type ImageCatalogEntry = {
  priceChartingId: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
  loosePriceUsd: number | null;
  canonicalUrl: string;
  imageUrl: string;
  sourceImageUrl: string;
  publicUrl: string;
  status: string;
  sourceImageFound: boolean;
  downloadedLocally: boolean;
  bytesDownloaded: number;
  imageBytes: number | null;
  attempts: number;
  errorMessage: string;
  lastAttemptAt?: string;
  downloadedAt?: string;
  importedAt: string;
  lastAttemptRelative: string;
  statusColor: string;
  sourceLabel: string;
};

export async function listPriceChartingImageCatalog(db: PGlite): Promise<ImageCatalogEntry[]> {
  const result = await db.query<Record<string, unknown>>(`
    select
      pic.pricecharting_id,
      pce.product_name,
      pce.expansion_name,
      pce.card_number,
      pce.loose_price_usd,
      pce.canonical_url,
      pce.image_url,
      pic.source_image_url,
      pic.public_url,
      pic.status,
      pic.byte_size,
      pic.attempts,
      pic.error_message,
      pic.last_attempt_at,
      pic.downloaded_at,
      pic.created_at as imported_at
    from pricecharting_image_cache pic
    join pricecharting_cache_entries pce using (pricecharting_id)
    order by pic.status, pce.product_name, pce.card_number
  `, [] as unknown[]);

  return result.rows.map((row: Record<string, unknown>) => {
    const status = String(row.status);
    const sourceImageUrl = String(row.source_image_url || "");
    const publicUrl = String(row.public_url || "");
    const cachedImageUrl = String(row.image_url || "");
    const downloadedAt = row.downloaded_at ? String(row.downloaded_at) : undefined;
    const lastAttemptAt = row.last_attempt_at ? String(row.last_attempt_at) : undefined;
    const byteSize = row.byte_size ? Number(row.byte_size) : 0;

    const sourceLabel = sourceImageUrl.startsWith("pokemontcg:") || sourceImageUrl.includes("pokemontcg.io")
      ? "PokemonTCG"
      : sourceImageUrl.startsWith("tcgdex:") || sourceImageUrl.includes("tcgdex.net")
        ? "TCGdex"
      : sourceImageUrl.includes("pricecharting") || sourceImageUrl.includes("storage.googleapis.com")
        ? "PriceCharting"
        : sourceImageUrl
          ? "Externa"
          : "Sin fuente";

    const statusColor = status === "downloaded" ? "#2f9e44" : status === "url_found" ? "#c1121f" : status === "failed" ? "#7f1d1d" : "#444";

    const lastAttemptRelative = lastAttemptAt
      ? new Date(lastAttemptAt).toLocaleString("es-AR")
      : "Nunca";

    return {
      priceChartingId: String(row.pricecharting_id),
      productName: String(row.product_name || ""),
      expansionName: String(row.expansion_name || ""),
      cardNumber: String(row.card_number || ""),
      loosePriceUsd: optionalNumber(row.loose_price_usd) ?? null,
      canonicalUrl: String(row.canonical_url || ""),
      imageUrl: publicUrl || cachedImageUrl || "",
      sourceImageUrl,
      publicUrl,
      status,
      sourceLabel,
      sourceImageFound: !!sourceImageUrl,
      downloadedLocally: status === "downloaded",
      bytesDownloaded: byteSize,
      imageBytes: byteSize || null,
      attempts: Number(row.attempts) || 0,
      errorMessage: String(row.error_message || ""),
      lastAttemptAt,
      downloadedAt,
      importedAt: String(row.imported_at),
      lastAttemptRelative,
      statusColor
    } as ImageCatalogEntry;
  });
}


export type OrderBoardWorkspace = {
  boards: Array<{ id: string; name: string }>;
  columns: Array<{ id: string; boardId: string; name: string; position: number }>;
  cards: Array<{ saleId: string; columnId: string; position: number }>;
};

const mainOrderBoardName = "Embalaje";
const completedOrderBoardName = "Completas";
const mainOrderBoardColumns = ["Pendientes de embalar", "Embaladas", "Pagadas", "A entregar", "Vencidas"];
const completedOrderBoardColumns = ["Entregadas", "Canceladas"];
const ruleColumnNames = new Set([...mainOrderBoardColumns, "A enviar", ...completedOrderBoardColumns].map((name) => name.toLowerCase()));

async function insertOrderBoard(db: PGlite, businessId: string, name: string, columns = mainOrderBoardColumns) {
  const id = crypto.randomUUID();
  await db.query("insert into order_boards (id,business_id,name) values ($1,$2,$3)", [id,businessId,name]);
  for (const [position, label] of columns.entries()) {
    await db.query("insert into order_board_columns (id,business_id,board_id,name,position) values ($1,$2,$3,$4,$5)", [crypto.randomUUID(),businessId,id,label,position]);
  }
  return id;
}

async function ensureOrderBoard(db: PGlite, businessId: string, name: string, columns: string[]) {
  let board = await db.query<{id:string}>("select id from order_boards where business_id=$1 and lower(name)=lower($2) order by created_at,id limit 1", [businessId,name]);
  const boardId = board.rows[0]?.id || await insertOrderBoard(db,businessId,name,columns);
  for (const label of columns) await ensureOrderBoardColumn(db,businessId,boardId,label);
  return boardId;
}

async function ensureOrderBoardColumn(db: PGlite, businessId: string, boardId: string, name: string) {
  const existing = await db.query<{id:string}>("select id from order_board_columns where business_id=$1 and board_id=$2 and lower(name)=lower($3) order by position,id limit 1", [businessId,boardId,name]);
  if (existing.rows[0]?.id) return existing.rows[0].id;
  if (name === "A entregar") {
    const legacy = await db.query<{id:string}>("select id from order_board_columns where business_id=$1 and board_id=$2 and lower(name)=lower('A enviar') order by position,id limit 1", [businessId,boardId]);
    if (legacy.rows[0]?.id) {
      await db.query("update order_board_columns set name=$1 where id=$2 and business_id=$3", [name,legacy.rows[0].id,businessId]);
      return legacy.rows[0].id;
    }
  }
  const id = crypto.randomUUID();
  await db.query("insert into order_board_columns(id,business_id,board_id,name,position) select $1,$2,$3,$4,coalesce(max(position),-1)+1 from order_board_columns where board_id=$3 and business_id=$2", [id,businessId,boardId,name]);
  return id;
}

async function ensureOrderBoardBasics(db: PGlite, businessId: string) {
  const mainBoardId = await ensureOrderBoard(db,businessId,mainOrderBoardName,mainOrderBoardColumns);
  const completedBoardId = await ensureOrderBoard(db,businessId,completedOrderBoardName,completedOrderBoardColumns);
  return {mainBoardId, completedBoardId};
}

async function getRuleTargetColumn(db: PGlite, businessId: string, saleId: string) {
  const {mainBoardId, completedBoardId} = await ensureOrderBoardBasics(db,businessId);
  const sale = await db.query<{status:string;total:number;packed:number;overdue:boolean|string;amountPaidArs:number;totalArs:number}>(`
    select s.status,
      count(si.id)::integer as total,
      count(si.packed_at)::integer as packed,
      (s.payment_due_at is not null and s.payment_due_at < current_date) as overdue,
      coalesce(s.amount_paid_ars,0)::numeric as "amountPaidArs",
      coalesce(s.total_ars,0)::numeric as "totalArs"
    from sales s
    left join sale_items si on si.sale_id=s.id and si.business_id=s.business_id
    where s.id=$1 and s.business_id=$2 and s.sale_type='reservation'
    group by s.id,s.status,s.payment_due_at,s.amount_paid_ars,s.total_ars
  `, [saleId,businessId]);
  const row = sale.rows[0];
  if (!row) return "";
  const allPacked = Number(row.total || 0) > 0 && Number(row.total || 0) === Number(row.packed || 0);
  const overdue = row.overdue === true || row.overdue === "true" || row.overdue === "t";
  const debtArs = Math.max(0, Number(row.totalArs || 0) - Number(row.amountPaidArs || 0));
  let boardId = mainBoardId;
  let columnName = "Pendientes de embalar";
  if (row.status === "delivered") {
    boardId = completedBoardId;
    columnName = "Entregadas";
  } else if (row.status === "cancelled") {
    boardId = completedBoardId;
    columnName = "Canceladas";
  } else if (row.status === "paid" && allPacked) {
    columnName = "A entregar";
  } else if (row.status === "paid") {
    columnName = "Pagadas";
  } else if (overdue && debtArs > 0) {
    columnName = "Vencidas";
  } else if (allPacked || row.status === "packed") {
    columnName = "Embaladas";
  }
  return ensureOrderBoardColumn(db,businessId,boardId,columnName);
}

async function moveSaleToRuleColumn(db: PGlite, businessId: string, saleId: string, force = false) {
  const columnId = await getRuleTargetColumn(db,businessId,saleId);
  if (!columnId) return;
  const current = await db.query<{column_id:string;name:string}>("select c.column_id,bc.name from order_board_cards c join order_board_columns bc on bc.id=c.column_id and bc.business_id=c.business_id where c.sale_id=$1 and c.business_id=$2 limit 1", [saleId,businessId]);
  if (current.rows[0]?.column_id === columnId) return;
  if (current.rows[0] && !force && !ruleColumnNames.has(String(current.rows[0].name || "").toLowerCase())) return;
  const position = await db.query<{next:number}>("select coalesce(max(position)+1,0)::integer as next from order_board_cards where business_id=$1 and column_id=$2", [businessId,columnId]);
  await db.query(`
    insert into order_board_cards (sale_id,business_id,column_id,position)
    values($1,$2,$3,$4)
    on conflict(sale_id) do update set column_id=excluded.column_id,position=excluded.position
    where order_board_cards.business_id=excluded.business_id
  `, [saleId,businessId,columnId,Number(position.rows[0]?.next || 0)]);
}

async function syncOrderBoardRules(db: PGlite, businessId: string) {
  const {mainBoardId, completedBoardId} = await ensureOrderBoardBasics(db,businessId);
  const pendingColumnId = await ensureOrderBoardColumn(db,businessId,mainBoardId,"Pendientes de embalar");
  const packedColumnId = await ensureOrderBoardColumn(db,businessId,mainBoardId,"Embaladas");
  const paidColumnId = await ensureOrderBoardColumn(db,businessId,mainBoardId,"Pagadas");
  const readyColumnId = await ensureOrderBoardColumn(db,businessId,mainBoardId,"A entregar");
  const overdueColumnId = await ensureOrderBoardColumn(db,businessId,mainBoardId,"Vencidas");
  const deliveredColumnId = await ensureOrderBoardColumn(db,businessId,completedBoardId,"Entregadas");
  const cancelledColumnId = await ensureOrderBoardColumn(db,businessId,completedBoardId,"Canceladas");
  const standardNames = [...ruleColumnNames];
  const standardPlaceholders = standardNames.map((_, index) => `$${index + 9}`).join(",");
  await db.query(`
    with sale_state as (
      select s.id as sale_id,
        s.status,
        count(si.id)::integer as total,
        count(si.packed_at)::integer as packed,
        (s.payment_due_at is not null and s.payment_due_at < current_date) as overdue,
        greatest(0, coalesce(s.total_ars,0) - coalesce(s.amount_paid_ars,0)) as debt_ars
      from sales s
      left join sale_items si on si.sale_id=s.id and si.business_id=s.business_id
      where s.business_id=$1 and s.sale_type='reservation'
      group by s.id,s.status,s.payment_due_at,s.total_ars,s.amount_paid_ars
    ),
    targets as (
      select sale_id,
        case
          when status='delivered' then $2::uuid
          when status='cancelled' then $3::uuid
          when status='paid' and total > 0 and total = packed then $4::uuid
          when status='paid' then $5::uuid
          when overdue and debt_ars > 0 then $6::uuid
          when (total > 0 and total = packed) or status='packed' then $7::uuid
          else $8::uuid
        end as column_id
      from sale_state
    ),
    eligible as (
      select t.sale_id,t.column_id
      from targets t
      left join order_board_cards obc on obc.sale_id=t.sale_id and obc.business_id=$1
      left join order_board_columns occ on occ.id=obc.column_id and occ.business_id=obc.business_id
      where (obc.sale_id is null or obc.column_id <> t.column_id)
        and (obc.sale_id is null or lower(occ.name) in (${standardPlaceholders}))
    ),
    numbered as (
      select e.sale_id,e.column_id,
        coalesce((select max(position)+1 from order_board_cards where business_id=$1 and column_id=e.column_id),0)
          + row_number() over (partition by e.column_id order by e.sale_id) - 1 as position
      from eligible e
    )
    insert into order_board_cards (sale_id,business_id,column_id,position)
    select sale_id,$1,column_id,position from numbered
    on conflict(sale_id) do update set column_id=excluded.column_id,position=excluded.position
    where order_board_cards.business_id=excluded.business_id
  `, [businessId, deliveredColumnId, cancelledColumnId, readyColumnId, paidColumnId, overdueColumnId, packedColumnId, pendingColumnId, ...standardNames]);
}

async function syncSalePackedStatus(db: PGlite, businessId: string, saleId: string) {
  const packed = await db.query<{total:number;packed:number}>("select count(*)::integer as total,count(packed_at)::integer as packed from sale_items where business_id=$1 and sale_id=$2", [businessId,saleId]);
  const row = packed.rows[0];
  const allPacked = Number(row?.total || 0) > 0 && Number(row?.total || 0) === Number(row?.packed || 0);
  await db.query("update sales set status = case when $3 and status='pending' then 'packed' when not $3 and status='packed' then 'pending' else status end where id=$1 and business_id=$2 and status in ('pending','packed')", [saleId,businessId,allPacked]);
}

async function readOrderBoards(db: PGlite, businessId: string): Promise<OrderBoardWorkspace> {
  const boards = await db.query<{id:string;name:string}>(`
      select id,name from order_boards
      where business_id=$1
      order by case
        when lower(name)=lower($2) then 0
        when lower(name)=lower($3) then 1
        else 2
      end, created_at,id
    `, [businessId,mainOrderBoardName,completedOrderBoardName]);
  const columns = await db.query<{id:string;boardId:string;name:string;position:number}>('select id,board_id as "boardId",name,position from order_board_columns where business_id=$1 order by position,id',[businessId]);
  const cards = await db.query<{saleId:string;columnId:string;position:number}>('select sale_id as "saleId",column_id as "columnId",position from order_board_cards where business_id=$1 order by position,sale_id',[businessId]);
  return {boards:boards.rows,columns:columns.rows,cards:cards.rows};
}

export async function getOrderBoards(db: PGlite, businessId: string): Promise<OrderBoardWorkspace> {
  return inventoryTransaction(db, async tx => {
    if (getOperationalDatabaseDriver(tx) === "pglite") {
      await syncOrderBoardRules(tx,businessId);
    } else {
      await ensureOrderBoardBasics(tx,businessId);
      const missing = await tx.query<{missing:string}>(
        "select s.id as missing from sales s left join order_board_cards c on c.sale_id=s.id and c.business_id=s.business_id where s.business_id=$1 and s.sale_type='reservation' and c.sale_id is null limit 1",
        [businessId]
      );
      if (missing.rows[0]) await syncOrderBoardRules(tx,businessId);
    }
    return readOrderBoards(tx,businessId);
  });
}

export async function changeOrderBoard(db: PGlite, input: {action:string; name?:string; boardId?:string; columnId?:string; saleId?:string; beforeSaleId?:string}, actor: AuthenticatedUser) {
  await inventoryTransaction(db, async tx => {
    const name = String(input.name || "").trim();
    if (["createBoard","createColumn","renameBoard","renameColumn"].includes(input.action) && (!name || name.length > 80)) throw new Error("El nombre debe tener entre 1 y 80 caracteres.");
    const businessId = actor.businessId;
    if (input.action === "createBoard") {
      await insertOrderBoard(tx,businessId,name);
    } else if (input.action === "createColumn" || input.action === "renameBoard") {
      const board = await tx.query("select id from order_boards where id=$1 and business_id=$2",[input.boardId,businessId]);
      if (!board.rows.length) throw new Error("El tablero ya no existe.");
      if (input.action === "renameBoard") await tx.query("update order_boards set name=$1 where id=$2 and business_id=$3",[name,input.boardId,businessId]);
      else await tx.query("insert into order_board_columns(id,business_id,board_id,name,position) select $1,$2,$3,$4,coalesce(max(position),-1)+1 from order_board_columns where board_id=$3 and business_id=$2",[crypto.randomUUID(),businessId,input.boardId,name]);
    } else if (input.action === "renameColumn" || input.action === "move") {
      const column = await tx.query("select id from order_board_columns where id=$1 and business_id=$2",[input.columnId,businessId]);
      if (!column.rows.length) throw new Error("La columna ya no existe.");
      if (input.action === "renameColumn") await tx.query("update order_board_columns set name=$1 where id=$2 and business_id=$3",[name,input.columnId,businessId]);
      else {
        const sale = await tx.query("select id from sales where id=$1 and business_id=$2 and sale_type='reservation'",[input.saleId,businessId]);
        if (!sale.rows.length) throw new Error("La orden ya no esta disponible.");
        const rows = await tx.query<{sale_id:string}>("select sale_id from order_board_cards where column_id=$1 and business_id=$2 and sale_id<>$3 order by position,sale_id",[input.columnId,businessId,input.saleId]);
        const ids = rows.rows.map(row=>row.sale_id);
        const before = input.beforeSaleId ? ids.indexOf(input.beforeSaleId) : -1;
        ids.splice(before < 0 ? ids.length : before,0,input.saleId!);
        await tx.query("insert into order_board_cards (sale_id,business_id,column_id,position) values($1,$2,$3,0) on conflict(sale_id) do update set column_id=excluded.column_id,position=0 where order_board_cards.business_id=excluded.business_id",[input.saleId,businessId,input.columnId]);
        for (const [position,id] of ids.entries()) await tx.query("update order_board_cards set position=$1 where sale_id=$2 and business_id=$3",[position,id,businessId]);
      }
    } else throw new Error("Accion de tablero desconocida.");
    await writeAudit(tx,actor,"order.board."+input.action,"order_board",input.boardId || input.columnId || actor.businessId,null,input);
  });
  return input.action === "move" ? readOrderBoards(db,actor.businessId) : getOrderBoards(db,actor.businessId);
}


