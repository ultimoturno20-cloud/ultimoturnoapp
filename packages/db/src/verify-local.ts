import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { migrationFiles, seedFiles } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

async function readSql(relativePath: string): Promise<string> {
  return readFile(path.join(packageRoot, relativePath), "utf8");
}

async function main() {
  const db = new PGlite();
  for (const file of migrationFiles) {
    await db.exec(await readSql(`migrations/${file}`));
  }
  for (const file of seedFiles) {
    await db.exec(await readSql(`seeds/${file}`));
  }

  const checks = await db.query<{ table_name: string; rows: number }>(`
    select 'businesses' as table_name, count(*)::int as rows from businesses
    union all select 'card_products', count(*)::int from card_products
    union all select 'inventory_items', count(*)::int from inventory_items
    union all select 'inventory_movements', count(*)::int from inventory_movements
    union all select 'import_runs', count(*)::int from import_runs
    union all select 'reservations', count(*)::int from reservations
    union all select 'sales', count(*)::int from sales
    union all select 'purchases', count(*)::int from purchases
    union all select 'pricecharting_cache_entries', count(*)::int from pricecharting_cache_entries
    union all select 'pricecharting_cache_runs', count(*)::int from pricecharting_cache_runs
    union all select 'pricecharting_image_cache', count(*)::int from pricecharting_image_cache
  `);

  const expected = new Map([
    ["businesses", 1],
    ["card_products", 12],
    ["inventory_items", 12],
    ["inventory_movements", 8],
    ["import_runs", 3],
    ["reservations", 3],
    ["sales", 0],
    ["purchases", 0],
    ["pricecharting_cache_entries", 0],
    ["pricecharting_cache_runs", 0],
    ["pricecharting_image_cache", 0]
  ]);

  for (const row of checks.rows) {
    if (row.rows !== expected.get(row.table_name)) {
      throw new Error(`Conteo inesperado en ${row.table_name}: ${row.rows}`);
    }
  }

  const availability = await db.query<{ sku: string; available_quantity: number }>(`
    select sku, quantity_on_hand - quantity_reserved as available_quantity
    from inventory_items
    order by sku
  `);

  console.log("db verify ok");
  console.table(checks.rows);
  console.table(availability.rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
