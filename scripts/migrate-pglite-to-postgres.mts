import { createOperationalDatabase } from "@ultimoturno/db";

const sourceDataDir = process.env.SOURCE_PGLITE_DATA_DIR || process.env.PGLITE_DATA_DIR || "";
const databaseUrl = process.env.DATABASE_URL || "";
const confirm = process.env.ULTIMOTURNO_MIGRATION_CONFIRM || "";
const runtimeEnv = String(process.env.ULTIMOTURNO_ENV || "staging").toLowerCase();
const sslValue = String(process.env.ULTIMOTURNO_DATABASE_SSL || "true").toLowerCase();
const skipCaches = String(process.env.ULTIMOTURNO_MIGRATION_SKIP_CACHES || "false").toLowerCase() === "true";

const tables = [
  "businesses",
  "external_sources",
  "app_users",
  "roles",
  "user_roles",
  "card_products",
  "card_variants",
  "external_identifiers",
  "inventory_items",
  "price_snapshots",
  "current_prices",
  "inventory_movements",
  "import_runs",
  "import_rows",
  "reservations",
  "sales",
  "sale_items",
  "purchases",
  "purchase_items",
  "audit_log",
  "idempotency_keys",
  "app_sessions",
  "pricecharting_cache_runs",
  "pricecharting_cache_entries",
  "pricecharting_image_cache",
  "card_index_entries",
  "card_source_links",
  "card_index_sync_runs",
  "claim_sessions",
  "claim_sections",
  "claim_cards",
  "claim_frees",
  "claim_grids",
  "tcgplayer_price_cache_runs",
  "tcgplayer_price_cache_entries",
  "mobile_inventory_entries",
  "order_boards",
  "order_board_columns",
  "order_board_cards"
];
const numericTextColumnsByTable = new Map<string, Set<string>>([
  ["pricecharting_cache_entries", new Set(["loose_price_usd"])],
  ["tcgplayer_price_cache_entries", new Set(["low_price_usd", "mid_price_usd", "high_price_usd", "market_price_usd", "direct_low_price_usd"])]
]);
const jsonColumnsByTable = new Map<string, Set<string>>([
  ["external_identifiers", new Set(["raw_payload"])],
  ["import_rows", new Set(["raw_payload"])],
  ["audit_log", new Set(["before_data", "after_data"])],
  ["idempotency_keys", new Set(["response_payload"])],
  ["claim_sessions", new Set(["closed_sale_ids"])],
  ["claim_grids", new Set(["card_ids"])],
  ["card_index_entries", new Set(["evidence_json"])],
  ["card_source_links", new Set(["evidence_json"])],
  ["import_runs", new Set(["summary_json"])]
]);
const cacheTables = new Set([
  "pricecharting_cache_runs",
  "pricecharting_cache_entries",
  "pricecharting_image_cache",
  "card_index_entries",
  "card_source_links",
  "card_index_sync_runs",
  "tcgplayer_price_cache_runs",
  "tcgplayer_price_cache_entries"
]);

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function sanitizeValue(table: string, column: string, value: unknown): unknown {
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (typeof value === "string" && ["infinity", "-infinity", "nan"].includes(value.trim().toLowerCase())) return null;
  if (jsonColumnsByTable.get(table)?.has(column)) {
    if (value === null || value === undefined) return value;
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

async function tableColumns(db: Awaited<ReturnType<typeof createOperationalDatabase>>, table: string) {
  const result = await db.query<{ column_name: string }>(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = $1
    order by ordinal_position
  `, [table]);
  return result.rows.map((row) => row.column_name);
}

async function copyTable(
  source: Awaited<ReturnType<typeof createOperationalDatabase>>,
  target: Awaited<ReturnType<typeof createOperationalDatabase>>,
  table: string
) {
  try {
    const columns = await tableColumns(source, table);
    if (!columns.length) return 0;
    const numericTextColumns = numericTextColumnsByTable.get(table) || new Set<string>();
    const selectSql = columns.map((column) =>
      numericTextColumns.has(column)
        ? `${quoteIdentifier(column)}::text as ${quoteIdentifier(column)}`
        : quoteIdentifier(column)
    );
    const rows = await source.query<Record<string, unknown>>(`select ${selectSql.join(", ")} from ${quoteIdentifier(table)}`);
    if (!rows.rows.length) return 0;
    const columnSql = columns.map(quoteIdentifier).join(", ");
    const maxParams = 60000;
    const batchSize = Math.max(1, Math.min(500, Math.floor(maxParams / Math.max(1, columns.length))));
    for (let offset = 0; offset < rows.rows.length; offset += batchSize) {
      const batch = rows.rows.slice(offset, offset + batchSize);
      const values: unknown[] = [];
      const rowSql = batch.map((row, rowIndex) => {
        const params = columns.map((column, columnIndex) => {
          values.push(sanitizeValue(table, column, row[column]));
          return `$${rowIndex * columns.length + columnIndex + 1}`;
        });
        return `(${params.join(", ")})`;
      });
      await target.query(`insert into ${quoteIdentifier(table)} (${columnSql}) values ${rowSql.join(", ")}`, values);
    }
    return rows.rows.length;
  } catch (error) {
    throw new Error(`Error copiando ${table}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!sourceDataDir) {
  throw new Error("Falta SOURCE_PGLITE_DATA_DIR o PGLITE_DATA_DIR.");
}

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL de destino PostgreSQL.");
}

if (confirm !== "COPY_PGLITE_TO_POSTGRES") {
  throw new Error("Operacion protegida. Defini ULTIMOTURNO_MIGRATION_CONFIRM=COPY_PGLITE_TO_POSTGRES para copiar datos.");
}

if (runtimeEnv === "production" || runtimeEnv === "prod") {
  throw new Error("Este script esta pensado para staging y se niega a copiar sobre produccion.");
}

const source = await createOperationalDatabase({ driver: "pglite", dataDir: sourceDataDir });
const target = await createOperationalDatabase({
  driver: "postgres",
  databaseUrl,
  ssl: ["1", "true", "yes", "require"].includes(sslValue),
  poolMax: Number(process.env.ULTIMOTURNO_DATABASE_POOL_MAX || 10)
});

try {
  await target.exec("begin");
  await target.query(`truncate table ${tables.map(quoteIdentifier).join(", ")} cascade`);
  const copied: Array<{ table: string; rows: number }> = [];
  const selectedTables = skipCaches ? tables.filter((table) => !cacheTables.has(table)) : tables;
  for (const table of selectedTables) {
    const rows = await copyTable(source, target, table);
    copied.push({ table, rows });
    console.error(`${table}: ${rows}`);
  }
  await target.exec("commit");
  console.log(JSON.stringify({
    ok: true,
    sourceDataDir,
    skippedCaches: skipCaches,
    copied,
    totalRows: copied.reduce((sum, item) => sum + item.rows, 0)
  }, null, 2));
} catch (error) {
  await target.exec("rollback").catch(() => undefined);
  throw error;
} finally {
  await source.close();
  await target.close();
}
