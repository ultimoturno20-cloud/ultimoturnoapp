import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outputDir = path.join(root, "outputs", "old_claim_import");
const inputPath = path.join(outputDir, "old_claim_import.json");
const outputPath = path.join(outputDir, "UltimoTurno_import_claims_viejos.xlsx");

const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
const workbook = Workbook.create();

function addSheet(name, headers, rows, opts = {}) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const matrix = [headers, ...rows];
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
    fill: opts.headerColor || "#111827",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).format.borders = {
    insideHorizontal: { style: "thin", color: "#2B2D33" },
    top: { style: "thin", color: "#2B2D33" },
    bottom: { style: "thin", color: "#2B2D33" },
  };
  sheet.freezePanes.freezeRows(1);
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).format.autofitColumns();
  return sheet;
}

function setColumnWidth(sheet, col, widthPx) {
  sheet.getRangeByIndexes(0, col, Math.max(1, sheet.getUsedRange(true).rowCount), 1).format.columnWidthPx = widthPx;
}

function setFormat(sheet, col, formatCode) {
  const used = sheet.getUsedRange(true);
  if (!used || used.rowCount < 2) return;
  sheet.getRangeByIndexes(1, col, used.rowCount - 1, 1).format.numberFormat = formatCode;
}

const summary = addSheet("Resumen", data.headers.summary, data.summary, { headerColor: "#F72545" });
setFormat(summary, 0, "yyyy-mm-dd");
setFormat(summary, 6, "$#,##0");
setFormat(summary, 7, "$#,##0.00");
setColumnWidth(summary, 2, 210);
setColumnWidth(summary, 3, 250);

const orders = addSheet("Ordenes", data.headers.orders, data.orders, { headerColor: "#0F766E" });
setFormat(orders, 2, "yyyy-mm-dd");
setFormat(orders, 4, "$#,##0");
setFormat(orders, 5, "$#,##0.00");
setColumnWidth(orders, 0, 260);
setColumnWidth(orders, 3, 220);
setColumnWidth(orders, 13, 360);
setColumnWidth(orders, 14, 420);

const sales = addSheet("Ventas Detalle", data.headers.sales, data.sales, { headerColor: "#4338CA" });
setFormat(sales, 3, "yyyy-mm-dd");
setFormat(sales, 4, "yyyy-mm-dd hh:mm");
setFormat(sales, 10, "#,##0");
setFormat(sales, 11, "$#,##0");
setFormat(sales, 12, "$#,##0.00");
setColumnWidth(sales, 0, 280);
setColumnWidth(sales, 1, 260);
setColumnWidth(sales, 6, 220);
setColumnWidth(sales, 7, 340);
setColumnWidth(sales, 13, 390);
setColumnWidth(sales, 21, 460);

const frees = addSheet("Frees", data.headers.frees, data.frees, { headerColor: "#B45309" });
setFormat(frees, 3, "yyyy-mm-dd");
setFormat(frees, 8, "#,##0");
setColumnWidth(frees, 0, 280);
setColumnWidth(frees, 1, 260);
setColumnWidth(frees, 4, 220);
setColumnWidth(frees, 5, 280);
setColumnWidth(frees, 15, 420);

const review = addSheet("Revision", data.headers.review, data.review, { headerColor: "#7F1D1D" });
setFormat(review, 4, "yyyy-mm-dd");
setFormat(review, 7, "$#,##0");
setFormat(review, 8, "$#,##0.00");
setColumnWidth(review, 0, 180);
setColumnWidth(review, 1, 230);
setColumnWidth(review, 5, 220);
setColumnWidth(review, 6, 340);
setColumnWidth(review, 9, 460);

const meta = workbook.worksheets.add("Fuentes");
meta.showGridLines = false;
meta.getRange("A1:B1").values = [["Dato", "Valor"]];
meta.getRange("A1:B1").format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF" },
};
meta.getRangeByIndexes(1, 0, data.metadata.sources.length + 2, 2).values = [
  ["Generado", data.metadata.generatedAt],
  ...data.metadata.sources.map((source) => ["Fuente", source]),
  ["Notas", "Archivo preparado para copiar filas hacia las hojas Ordenes, Ventas Detalle y Frees del HUB."],
];
meta.getRange("A:B").format.autofitColumns();
meta.freezePanes.freezeRows(1);

await fs.mkdir(outputDir, { recursive: true });

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Resumen",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(outputDir, "preview_resumen.png"), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath }, null, 2));
