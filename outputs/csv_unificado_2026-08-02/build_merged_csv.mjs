import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:\\Users\\skype\\Documents\\Stock\\outputs\\csv_unificado_2026-08-02";
const sources = [
  "C:\\Users\\skype\\Downloads\\Scanned_12-09-40_2026-08-02_(150_cards).csv",
  "C:\\Users\\skype\\Downloads\\Scanned_12-35-54_2026-08-02_(227_cards).csv",
];
const csvOutput = path.join(outputDir, "MonPrice_Unificado_2026-08-02_377_filas.csv");
const xlsxOutput = path.join(outputDir, "MonPrice_Unificado_2026-08-02.xlsx");
const previewOutput = path.join(outputDir, "preview.png");

function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/)[0] || "";
  const counts = [";", "\t", ","].map((delimiter) => [delimiter, firstLine.split(delimiter).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

function parseDelimited(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => String(value).length > 0)) rows.push(row);
  }
  return rows;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toSemicolonCsv(rows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

function columnName(index) {
  let number = index + 1;
  let label = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    number = Math.floor((number - 1) / 26);
  }
  return label;
}

await fs.mkdir(outputDir, { recursive: true });
const texts = await Promise.all(sources.map((source) => fs.readFile(source, "utf8")));

// Validate both source files with the spreadsheet runtime before merging.
for (let index = 0; index < texts.length; index += 1) {
  const sourceWorkbook = await Workbook.fromCSV(texts[index], { sheetName: `Fuente ${index + 1}` });
  const sourceCheck = await sourceWorkbook.inspect({
    kind: "table",
    range: `Fuente ${index + 1}!A1:O3`,
    include: "values",
    tableMaxRows: 3,
    tableMaxCols: 15,
    maxChars: 2500,
  });
  console.log(sourceCheck.ndjson);
}

const parsed = texts.map(parseDelimited);
const header = parsed[0][0];
if (header.length !== 15 || parsed.some((rows) => rows[0].join("|") !== header.join("|"))) {
  throw new Error("Los encabezados no coinciden exactamente entre los archivos.");
}

const dataRows = parsed.flatMap((rows) => rows.slice(1));
const mergedRows = [header, ...dataRows];
const languageIndex = header.indexOf("Language");
const countIndex = header.indexOf("Count");
const japaneseRows = dataRows.filter((row) => row[languageIndex] === "JA");
const totalUnits = dataRows.reduce((sum, row) => sum + (Number(row[countIndex]) || 0), 0);

await fs.writeFile(csvOutput, toSemicolonCsv(mergedRows), "utf8");

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("MonPrice Unificado");
sheet.showGridLines = false;
sheet.freezePanes.freezeRows(1);
const workbookRows = mergedRows.map((row, rowIndex) => row.map((value, columnIndex) => {
  if (rowIndex === 0) return value;
  if (columnIndex === 6 || columnIndex === 11) {
    if (String(value).trim() === "") return "";
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  if (columnIndex === 10) {
    const numeric = Number(String(value).replace(",", "."));
    return Number.isFinite(numeric) ? numeric : value;
  }
  return value;
}));
sheet.getRangeByIndexes(0, 0, workbookRows.length, header.length).values = workbookRows;

const lastColumn = columnName(header.length - 1);
const usedRange = sheet.getRange(`A1:${lastColumn}${mergedRows.length}`);
usedRange.format = {
  font: { name: "Aptos", size: 10, color: "#18181B" },
  verticalAlignment: "center",
};
sheet.getRange(`A1:${lastColumn}1`).format = {
  fill: "#18181B",
  font: { name: "Aptos", size: 10, bold: true, color: "#FFFFFF" },
  rowHeight: 26,
  verticalAlignment: "center",
};
sheet.getRange(`A2:${lastColumn}${mergedRows.length}`).format.borders = {
  insideHorizontal: { style: "thin", color: "#E4E4E7" },
};
sheet.getRange(`A2:${lastColumn}${mergedRows.length}`).format.rowHeight = 21;
sheet.getRange(`J2:J${mergedRows.length}`).format.numberFormat = "yyyy-mm-dd";
sheet.getRange(`K2:K${mergedRows.length}`).format.numberFormat = "0.00";
sheet.getRange(`L2:L${mergedRows.length}`).format.numberFormat = "0";
sheet.getRange(`A1:A${mergedRows.length}`).format.columnWidth = 16;
sheet.getRange(`B1:B${mergedRows.length}`).format.columnWidth = 25;
sheet.getRange(`C1:C${mergedRows.length}`).format.columnWidth = 14;
sheet.getRange(`D1:E${mergedRows.length}`).format.columnWidth = 24;
sheet.getRange(`F1:F${mergedRows.length}`).format.columnWidth = 22;
sheet.getRange(`G1:I${mergedRows.length}`).format.columnWidth = 15;
sheet.getRange(`J1:J${mergedRows.length}`).format.columnWidth = 20;
sheet.getRange(`K1:O${mergedRows.length}`).format.columnWidth = 14;
sheet.tables.add(`A1:${lastColumn}${mergedRows.length}`, true, "MonPriceUnificado").style = "TableStyleMedium2";

const inspect = await workbook.inspect({
  kind: "table",
  range: "MonPrice Unificado!A1:O8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 15,
  maxChars: 5000,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "MonPrice Unificado",
  range: "A1:O18",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewOutput, new Uint8Array(await preview.arrayBuffer()));
const japanesePreview = await workbook.render({
  sheetName: "MonPrice Unificado",
  range: "A84:O92",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(path.join(outputDir, "preview-japanese.png"), new Uint8Array(await japanesePreview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(xlsxOutput);

const outputBytes = await fs.readFile(csvOutput);
const outputText = outputBytes.toString("utf8");
const roundTripRows = parseDelimited(outputText);
const outputJapaneseRows = roundTripRows.slice(1).filter((row) => row[languageIndex] === "JA");
const missingJapaneseNames = japaneseRows.filter((row) => !outputJapaneseRows.some((candidate) => candidate[0] === row[0] && candidate[1] === row[1]));
if (outputBytes[0] !== 0xef || outputBytes[1] !== 0xbb || outputBytes[2] !== 0xbf) {
  throw new Error("El CSV final no tiene BOM UTF-8.");
}
if (roundTripRows.length !== mergedRows.length || missingJapaneseNames.length || outputText.includes("�")) {
  throw new Error("Fallo la validacion Unicode o de cantidad de filas.");
}

console.log(JSON.stringify({
  sourceRows: parsed.map((rows) => rows.length - 1),
  mergedRows: dataRows.length,
  totalUnits,
  japaneseRows: japaneseRows.length,
  utf8Bom: true,
  csvOutput,
  xlsxOutput,
}, null, 2));
