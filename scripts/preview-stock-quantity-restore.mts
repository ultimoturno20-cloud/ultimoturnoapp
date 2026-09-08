import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createOperationalDatabase, listStock } from "@ultimoturno/db";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceDataDir = process.env.SOURCE_PGLITE_DATA_DIR
  || process.env.PGLITE_DATA_DIR
  || path.resolve(projectRoot, "apps", "api", ".data", "ultimoturno-pilot-real");
const outputDir = process.env.ULTIMOTURNO_RESTORE_PREVIEW_DIR || path.resolve(projectRoot, ".work", "stock-restore-preview");

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

const db = await createOperationalDatabase({ driver: "pglite", dataDir: sourceDataDir });
try {
  const stock = await listStock(db);
  const rows = stock.items
    .filter((item) => item.active && item.sku.trim() && (item.quantityOnHand > 0 || item.quantityReserved > 0))
    .map((item) => ({
      sku: item.sku.trim(),
      quantityOnHand: item.quantityOnHand,
      quantityReserved: item.quantityReserved,
      name: item.product.name,
      expansion: item.product.expansion,
      number: item.product.number
    }))
    .sort((left, right) => left.sku.localeCompare(right.sku, "es", { numeric: true }));

  await mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `stock-quantity-restore-${stamp}.json`);
  const sqlPath = path.join(outputDir, `stock-quantity-restore-${stamp}.sql`);
  const summary = {
    sourceDataDir,
    totalSkus: stock.summary.totalSkus,
    totalUnits: stock.summary.totalUnits,
    reservedUnits: stock.summary.reservedUnits,
    restoreRows: rows.length,
    restoreUnits: rows.reduce((sum, row) => sum + row.quantityOnHand, 0),
    restoreReservedUnits: rows.reduce((sum, row) => sum + row.quantityReserved, 0)
  };

  const valuesSql = rows.map((row) => `    (${sqlString(row.sku)}, ${row.quantityOnHand}, ${row.quantityReserved})`).join(",\n");
  const sql = `-- UltimoTurno stock quantity restore preview\n-- Generated from ${sourceDataDir}\n-- Review before running in Supabase/Vercel Postgres. This updates quantities by SKU only.\n\nbegin;\n\nwith restore_values(sku, quantity_on_hand, quantity_reserved) as (\n  values\n${valuesSql}\n), updated as (\n  update inventory_items ii\n  set quantity_on_hand = rv.quantity_on_hand,\n      quantity_reserved = rv.quantity_reserved,\n      updated_at = now()\n  from restore_values rv\n  where lower(ii.sku) = lower(rv.sku)\n    and ii.active = true\n  returning ii.sku, ii.quantity_on_hand, ii.quantity_reserved\n)\nselect count(*) as updated_rows,\n       coalesce(sum(quantity_on_hand), 0) as total_units,\n       coalesce(sum(quantity_reserved), 0) as reserved_units\nfrom updated;\n\n-- commit;\nrollback;\n`;

  await writeFile(jsonPath, JSON.stringify({ summary, rows }, null, 2));
  await writeFile(sqlPath, sql);
  console.log(JSON.stringify({ ok: true, summary, jsonPath, sqlPath }, null, 2));
} finally {
  await db.close();
}