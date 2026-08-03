// ============================================================
// Scanner Stock Importer
// Separate spreadsheet/tool for bulk stock imports from scanners
// such as MonPrice. Reads PriceCharting Cache and writes to HUB Stock.
// ============================================================

var SSI = {
  SHEETS: {
    CONFIG: "Config",
    RAW: "MonPrice Raw",
    IMPORT: "Import Scanner",
    LOG: "Log"
  },
  PROP: {
    PC_CACHE_SPREADSHEET_ID: "PC_CACHE_SPREADSHEET_ID",
    HUB_SPREADSHEET_ID: "HUB_SPREADSHEET_ID"
  },
  IMPORT_COL: {
    ESTADO: 1,
    ERROR: 2,
    SCANNER: 3,
    SCANNER_ID: 4,
    NOMBRE_SCANNER: 5,
    NUMERO_SCANNER: 6,
    EXPANSION_SCANNER: 7,
    SERIE: 8,
    RAREZA: 9,
    CANTIDAD: 10,
    FINISH: 11,
    REVERSE: 12,
    LANGUAGE: 13,
    SCANNER_AVG_USD: 14,
    IDIOMA_STOCK: 15,
    CONDICION: 16,
    UBICACION: 17,
    ULTIMA_COMPRA_USD: 18,
    NOMBRE_PC: 19,
    EXPANSION_PC: 20,
    NUMERO_PC: 21,
    PC_ID: 22,
    PC_URL: 23,
    PC_USD: 24,
    MATCH_SCORE: 25,
    MATCH_KEY: 26,
    SYNC_STOCK: 27,
    NOTAS: 28
  },
  STOCK_COL: {
    SKU: 1,
    NOMBRE: 2,
    EXPANSION: 3,
    NUMERO: 4,
    IDIOMA: 5,
    CONDICION: 6,
    UBICACION: 7,
    CANTIDAD: 8,
    PC_URL: 9,
    PC_ID: 10,
    TCGPLAYER_URL: 11,
    IMAGEN_URL: 12,
    PC_USD: 13,
    DOLAR_USADO: 14,
    PRECIO_SUGERIDO_ARS: 15,
    PRECIO_MANUAL_ARS: 16,
    PRECIO_FINAL_ARS: 17,
    ULTIMA_ACTUALIZACION: 18,
    ACTIVO: 19,
    NOTAS: 20,
    ULTIMA_COMPRA_USD: 21
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Scanner Stock")
    .addItem("Crear / reparar estructura", "setupScannerStockImporter")
    .addItem("Configurar PriceCharting Cache", "promptConfigureScannerPcCache")
    .addItem("Configurar HUB destino", "promptConfigureScannerHub")
    .addSeparator()
    .addItem("Pegar CSV MonPrice", "showMonPriceCsvLoader")
    .addItem("Convertir MonPrice CSV", "convertMonPriceCsvToScannerImport")
    .addItem("Matchear con PriceCharting", "matchScannerImportWithPriceCharting")
    .addItem("Enviar a Stock del HUB", "sendScannerImportToHubStock")
    .addItem("Limpiar import", "clearScannerImport")
    .addSeparator()
    .addItem("Aplicar formato visual", "applyScannerImporterVisualPolish")
    .addToUi();
}

function setupScannerStockImporter() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSsiConfig_(ss);
  setupSsiRaw_(ss);
  setupSsiImport_(ss);
  setupSsiLog_(ss);
  applyScannerImporterVisualPolish();
  SpreadsheetApp.getUi().alert("Importador Scanner listo.");
}

function promptConfigureScannerPcCache() {
  promptSsiSpreadsheetId_(SSI.PROP.PC_CACHE_SPREADSHEET_ID, "PriceCharting Cache", "Pega el ID o URL de la planilla cache.");
}

function promptConfigureScannerHub() {
  promptSsiSpreadsheetId_(SSI.PROP.HUB_SPREADSHEET_ID, "HUB destino", "Pega el ID o URL de la planilla Ultimo Turno - HUB.");
}

function promptSsiSpreadsheetId_(prop, title, message) {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var id = extractSsiSpreadsheetId_(prompt.getResponseText());
  if (!id) {
    ui.alert("No pude leer el ID.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty(prop, id);
  ui.alert(title + " configurado.");
}

function showMonPriceCsvLoader() {
  var html = HtmlService.createHtmlOutputFromFile("ScannerCsvLoaderDialog")
    .setWidth(760)
    .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, "Pegar CSV MonPrice");
}

function importPastedMonPriceCsv(csvText, convertNow) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSsiRaw_(ss);
  if (!csvText || !String(csvText).trim()) throw new Error("Pegaste un CSV vacio.");

  var rows = parseSsiCsvText_(String(csvText));
  rows = trimSsiTableToHeader_(rows).filter(function(row) {
    return row.join("").trim() !== "";
  });
  if (!isSsiMonPriceTable_(rows)) {
    throw new Error("No reconozco headers de MonPrice. Necesito al menos ID, Name, Number, Set y Count.");
  }

  var sheet = ss.getSheetByName(SSI.SHEETS.RAW);
  var width = rows.reduce(function(max, row) { return Math.max(max, row.length); }, 1);
  rows = rows.map(function(row) {
    var copy = row.slice();
    while (copy.length < width) copy.push("");
    return copy;
  });

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, width).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, Math.min(width, 15), 140);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(7, 180);

  var imported = rows.length - 1;
  var converted = 0;
  if (convertNow) converted = convertMonPriceCsvToScannerImport();
  return {
    imported: imported,
    converted: converted,
    message: convertNow
      ? "CSV cargado y convertido. Filas nuevas: " + converted
      : "CSV cargado en MonPrice Raw. Filas detectadas: " + imported
  };
}

function convertMonPriceCsvToScannerImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSsiImport_(ss);
  var source = findSsiMonPriceSourceSheet_(ss);
  if (!source) {
    throw new Error("No encontre una hoja MonPrice. Importa el CSV como hoja nueva o pegalo en MonPrice Raw con headers ID, Name, Number, Set, Count.");
  }

  var sourceValues = readSsiMonPriceTable_(source);
  var headers = sourceValues[0].map(normalizeSsiHeader_);
  var idx = {};
  for (var h = 0; h < headers.length; h++) idx[headers[h]] = h;

  var target = ss.getSheetByName(SSI.SHEETS.IMPORT);
  var existing = buildSsiExistingImportKeys_(target);
  var config = readSsiConfig_();
  var output = [];

  for (var r = 1; r < sourceValues.length; r++) {
    var row = sourceValues[r];
    var name = getSsiRowValue_(row, idx, ["name"]);
    var number = getSsiRowValue_(row, idx, ["number"]);
    var set = getSsiRowValue_(row, idx, ["set"]);
    if (!name && !number && !set) continue;

    var scannerId = getSsiRowValue_(row, idx, ["id"]);
    var importKey = buildSsiImportUniqueKey_("MonPrice", scannerId, name, set, number);
    if (existing[importKey]) continue;
    existing[importKey] = true;

    output.push(buildSsiImportRow_({
      scanner: "MonPrice",
      scannerId: scannerId,
      name: name,
      number: number,
      set: set,
      series: getSsiRowValue_(row, idx, ["series"]),
      rarity: getSsiRowValue_(row, idx, ["rarity"]),
      count: parseSsiNumber_(getSsiRowValue_(row, idx, ["count"])) || 1,
      finish: getSsiRowValue_(row, idx, ["finish-type"]),
      reverse: getSsiRowValue_(row, idx, ["reverse-holo"]),
      language: getSsiRowValue_(row, idx, ["language"]),
      averagePrice: parseSsiNumber_(getSsiRowValue_(row, idx, ["average-price"])),
      stockLanguage: getSsiRowValue_(row, idx, ["language"]) || config.default_idioma || "EN",
      condition: config.default_condicion || "NM"
    }));
  }

  if (!output.length) throw new Error("No encontre filas nuevas validas en " + source.getName() + ".");
  appendSsiRows_(target, output);
  SpreadsheetApp.getUi().alert("Filas importadas desde MonPrice: " + output.length);
  return output.length;
}

function matchScannerImportWithPriceCharting() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { matched: 0, review: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SSI.SHEETS.IMPORT);
    if (!sheet) throw new Error("No existe hoja Import Scanner.");
    if (sheet.getLastRow() < 2) return { matched: 0, review: 0 };

    var cacheIndex = buildSsiScannerCacheIndex_();
    var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, SSI.IMPORT_COL.NOTAS);
    var values = range.getValues();
    var matched = 0;
    var review = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (String(row[SSI.IMPORT_COL.SYNC_STOCK - 1] || "").trim()) continue;

      var name = String(row[SSI.IMPORT_COL.NOMBRE_SCANNER - 1] || "").trim();
      var expansion = String(row[SSI.IMPORT_COL.EXPANSION_SCANNER - 1] || "").trim();
      var number = normalizeSsiCardNumber_(row[SSI.IMPORT_COL.NUMERO_SCANNER - 1]);
      if (!name || !expansion) continue;

      var result = findSsiScannerMatch_(cacheIndex, name, expansion, number);
      if (result && result.item) {
        row[SSI.IMPORT_COL.ESTADO - 1] = result.status;
        row[SSI.IMPORT_COL.ERROR - 1] = "";
        row[SSI.IMPORT_COL.NOMBRE_PC - 1] = result.item.nombre;
        row[SSI.IMPORT_COL.EXPANSION_PC - 1] = result.item.expansion;
        row[SSI.IMPORT_COL.NUMERO_PC - 1] = result.item.numero;
        row[SSI.IMPORT_COL.PC_ID - 1] = result.item.pcId;
        row[SSI.IMPORT_COL.PC_URL - 1] = result.item.pcUrl;
        row[SSI.IMPORT_COL.PC_USD - 1] = result.item.usd;
        row[SSI.IMPORT_COL.MATCH_SCORE - 1] = result.score;
        row[SSI.IMPORT_COL.MATCH_KEY - 1] = result.key;
        matched++;
      } else {
        row[SSI.IMPORT_COL.ESTADO - 1] = "Revisar";
        row[SSI.IMPORT_COL.ERROR - 1] = result ? result.error : "Sin match";
        row[SSI.IMPORT_COL.MATCH_SCORE - 1] = 0;
        row[SSI.IMPORT_COL.MATCH_KEY - 1] = buildSsiMatchKey_(name, expansion, number);
        review++;
      }
    }

    range.setValues(values);
    SpreadsheetApp.getUi().alert("Scanner matcheado\nOK: " + matched + "\nRevisar: " + review);
    return { matched: matched, review: review };
  } finally {
    lock.releaseLock();
  }
}

function sendScannerImportToHubStock() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { sent: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var importSheet = ss.getSheetByName(SSI.SHEETS.IMPORT);
    if (!importSheet) throw new Error("No existe hoja Import Scanner.");
    if (importSheet.getLastRow() < 2) return { sent: 0 };

    var hub = openSsiHub_();
    var stock = hub.getSheetByName("Stock");
    if (!stock) throw new Error("El HUB no tiene hoja Stock.");

    var config = readSsiConfig_();
    var stockIndex = buildSsiStockIndex_(stock);
    var range = importSheet.getRange(2, 1, importSheet.getLastRow() - 1, SSI.IMPORT_COL.NOTAS);
    var values = range.getValues();
    var sent = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var sync = String(row[SSI.IMPORT_COL.SYNC_STOCK - 1] || "").trim();
      var pcId = String(row[SSI.IMPORT_COL.PC_ID - 1] || "").trim();
      var pcUrl = normalizeSsiUrl_(row[SSI.IMPORT_COL.PC_URL - 1]);
      var quantity = Number(row[SSI.IMPORT_COL.CANTIDAD - 1]) || 0;
      if (sync || !pcId || !pcUrl || quantity <= 0) continue;

      var item = {
        sku: buildSsiSku_(pcId),
        name: row[SSI.IMPORT_COL.NOMBRE_PC - 1] || row[SSI.IMPORT_COL.NOMBRE_SCANNER - 1],
        expansion: row[SSI.IMPORT_COL.EXPANSION_PC - 1] || row[SSI.IMPORT_COL.EXPANSION_SCANNER - 1],
        number: row[SSI.IMPORT_COL.NUMERO_PC - 1],
        quantity: quantity,
        pcUrl: pcUrl,
        pcId: pcId,
        imageUrl: "",
        usd: row[SSI.IMPORT_COL.PC_USD - 1],
        language: row[SSI.IMPORT_COL.IDIOMA_STOCK - 1] || config.default_idioma || "EN",
        condition: row[SSI.IMPORT_COL.CONDICION - 1] || config.default_condicion || "NM",
        location: row[SSI.IMPORT_COL.UBICACION - 1] || config.default_ubicacion || "",
        lastPurchaseUsd: Number(row[SSI.IMPORT_COL.ULTIMA_COMPRA_USD - 1]) || "",
        note: "Importado desde scanner " + (row[SSI.IMPORT_COL.SCANNER - 1] || "")
      };

      var match = appendOrIncrementSsiStock_(stock, stockIndex, item, config);
      row[SSI.IMPORT_COL.SYNC_STOCK - 1] = "OK " + match.sku + " " + formatSsiDateTime_(new Date());
      row[SSI.IMPORT_COL.ESTADO - 1] = "Stock OK";
      sent++;
    }

    range.setValues(values);
    SpreadsheetApp.getUi().alert("Filas enviadas al Stock del HUB: " + sent);
    return { sent: sent };
  } finally {
    lock.releaseLock();
  }
}

function clearScannerImport() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSI.SHEETS.IMPORT);
  if (!sheet || sheet.getLastRow() < 2) return;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, SSI.IMPORT_COL.NOTAS).clearContent();
}

function setupSsiConfig_(ss) {
  var sheet = ss.getSheetByName(SSI.SHEETS.CONFIG) || ss.insertSheet(SSI.SHEETS.CONFIG);
  applySsiHeader_(sheet, ["Clave", "Valor"], "#263238");
  appendMissingSsiConfig_(sheet, [
    ["usd_ars", 1510],
    ["round_to", 500],
    ["min_price", 800],
    ["default_idioma", "EN"],
    ["default_condicion", "NM"],
    ["default_ubicacion", ""]
  ]);
  sheet.autoResizeColumns(1, 2);
}

function setupSsiRaw_(ss) {
  var sheet = ss.getSheetByName(SSI.SHEETS.RAW) || ss.insertSheet(SSI.SHEETS.RAW);
  sheet.getRange("A1").setNote("Pega aca el CSV de MonPrice si Google Sheets no lo importo como columnas.");
  sheet.setTabColor("#64748b");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 800);
}

function setupSsiImport_(ss) {
  var sheet = ss.getSheetByName(SSI.SHEETS.IMPORT) || ss.insertSheet(SSI.SHEETS.IMPORT);
  applySsiHeader_(sheet, [
    "Estado", "Error", "Scanner", "Scanner ID", "Nombre scanner", "Numero scanner",
    "Expansion scanner", "Serie", "Rareza", "Cantidad", "Finish", "Reverse", "Language",
    "Scanner avg USD", "Idioma stock", "Condicion", "Ubicacion", "Ultima compra USD",
    "Nombre PC", "Expansion PC", "Numero PC", "PriceCharting ID", "PriceCharting URL",
    "Precio PC USD", "Match score", "Match key", "Sync Stock", "Notas"
  ], "#0369a1");
  sheet.setFrozenColumns(5);
  sheet.getRange("J:J").setNumberFormat("#,##0");
  sheet.getRange("N:N").setNumberFormat("#,##0.00");
  sheet.getRange("R:R").setNumberFormat("#,##0.00");
  sheet.getRange("X:Y").setNumberFormat("#,##0.00");
  sheet.setColumnWidth(SSI.IMPORT_COL.NOMBRE_SCANNER, 180);
  sheet.setColumnWidth(SSI.IMPORT_COL.EXPANSION_SCANNER, 180);
  sheet.setColumnWidth(SSI.IMPORT_COL.PC_URL, 360);
  sheet.setColumnWidth(SSI.IMPORT_COL.MATCH_KEY, 260);
  sheet.setColumnWidth(SSI.IMPORT_COL.NOTAS, 280);
  setSsiImportValidations_(sheet);
}

function setupSsiLog_(ss) {
  var sheet = ss.getSheetByName(SSI.SHEETS.LOG) || ss.insertSheet(SSI.SHEETS.LOG);
  applySsiHeader_(sheet, ["Fecha", "Origen", "Mensaje"], "#7f1d1d");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
}

function applyScannerImporterVisualPolish() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSsiImport_(ss);
  var styles = {};
  styles[SSI.SHEETS.CONFIG] = { color: "#263238", frozen: 1 };
  styles[SSI.SHEETS.RAW] = { color: "#64748b", frozen: 1 };
  styles[SSI.SHEETS.IMPORT] = { color: "#0369a1", frozen: 5 };
  styles[SSI.SHEETS.LOG] = { color: "#7f1d1d", frozen: 1 };

  Object.keys(styles).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    applySsiBaseSheetStyle_(sheet, styles[name].color, styles[name].frozen);
  });
  applySsiImportConditionalFormatting_(ss.getSheetByName(SSI.SHEETS.IMPORT));
}

function applySsiBaseSheetStyle_(sheet, color, frozenColumns) {
  var lastCol = Math.max(1, sheet.getLastColumn());
  sheet.setTabColor(color);
  sheet.setFrozenRows(1);
  if (frozenColumns) sheet.setFrozenColumns(frozenColumns);
  sheet.getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground(color)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);
  sheet.getRange(1, 1, Math.max(1, sheet.getMaxRows()), lastCol)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle");
  try {
    if (!sheet.getFilter()) sheet.getRange(1, 1, Math.max(2, sheet.getMaxRows()), lastCol).createFilter();
  } catch (ignored) {}
}

function applySsiImportConditionalFormatting_(sheet) {
  if (!sheet) return;
  var range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), SSI.IMPORT_COL.NOTAS);
  sheet.setConditionalFormatRules([
    ruleSsi_(range, '=AND($A2="Stock OK",$AA2<>"")', "#dcfce7", "#166534"),
    ruleSsi_(range, '=OR($A2="Match OK",$A2="Match unico nombre+numero")', "#e0f2fe", "#075985"),
    ruleSsi_(range, '=$A2="Revisar"', "#fee2e2", "#991b1b"),
    ruleSsi_(range, '=$A2="Pendiente"', "#f8fafc", "#334155")
  ]);
}

function ruleSsi_(range, formula, background, fontColor) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground(background)
    .setFontColor(fontColor)
    .setRanges([range])
    .build();
}

function setSsiImportValidations_(sheet) {
  var estados = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pendiente", "Match OK", "Match unico nombre+numero", "Revisar", "Stock OK"], true)
    .setAllowInvalid(true)
    .build();
  var idiomas = SpreadsheetApp.newDataValidation().requireValueInList(["EN", "JP", "ES", "KR", "CN", "OTRO"], true).setAllowInvalid(true).build();
  var condiciones = SpreadsheetApp.newDataValidation().requireValueInList(["NM", "LP", "MP", "HP", "DMG"], true).setAllowInvalid(true).build();
  var rows = Math.max(999, sheet.getMaxRows() - 1);
  sheet.getRange(2, SSI.IMPORT_COL.ESTADO, rows, 1).setDataValidation(estados);
  sheet.getRange(2, SSI.IMPORT_COL.IDIOMA_STOCK, rows, 1).setDataValidation(idiomas);
  sheet.getRange(2, SSI.IMPORT_COL.CONDICION, rows, 1).setDataValidation(condiciones);
}

function findSsiMonPriceSourceSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (isSsiSystemSheetName_(sheet.getName())) continue;
    if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) continue;
    if (isSsiMonPriceTable_(readSsiMonPriceTable_(sheet))) return sheet;
  }

  var raw = ss.getSheetByName(SSI.SHEETS.RAW);
  if (raw && isSsiMonPriceTable_(readSsiMonPriceTable_(raw))) return raw;
  return null;
}

function isSsiSystemSheetName_(name) {
  var keys = Object.keys(SSI.SHEETS);
  for (var i = 0; i < keys.length; i++) {
    if (SSI.SHEETS[keys[i]] === name) return true;
  }
  return false;
}

function isSsiMonPriceTable_(table) {
  if (!table.length) return false;
  var headers = table[0].map(normalizeSsiHeader_);
  return headers.indexOf("name") >= 0 && headers.indexOf("number") >= 0 && headers.indexOf("set") >= 0;
}

function readSsiMonPriceTable_(sheet) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getDisplayValues();
  if (!values.length) return [];
  var firstRow = values[0];
  var firstCell = String(firstRow[0] || "");
  var table = values;
  if (firstRow.length === 1 && firstCell.indexOf(";") >= 0) {
    table = values.map(function(row) { return parseSsiDelimitedLine_(row[0], ";"); });
    return trimSsiTableToHeader_(table);
  }
  if (firstCell.indexOf(";") >= 0 && normalizeSsiHeader_(firstCell).indexOf("id-name-number-set") === 0) {
    table = values.map(function(row) { return parseSsiDelimitedLine_(row[0], ";"); });
    return trimSsiTableToHeader_(table);
  }
  return trimSsiTableToHeader_(table);
}

function trimSsiTableToHeader_(table) {
  for (var i = 0; i < Math.min(20, table.length); i++) {
    var headers = table[i].map(normalizeSsiHeader_);
    if (headers.indexOf("name") >= 0 && headers.indexOf("number") >= 0 && headers.indexOf("set") >= 0) {
      return table.slice(i);
    }
  }
  return table;
}

function parseSsiDelimitedLine_(line, delimiter) {
  var text = String(line || "");
  var out = [];
  var current = "";
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (ch === '"') {
      if (inQuotes && text.charAt(i + 1) === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseSsiCsvText_(text) {
  var clean = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var delimiter = detectSsiDelimiter_(clean);
  var rows = [];
  var row = [];
  var current = "";
  var inQuotes = false;

  for (var i = 0; i < clean.length; i++) {
    var ch = clean.charAt(i);
    if (ch === '"') {
      if (inQuotes && clean.charAt(i + 1) === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      row.push(current);
      current = "";
    } else if (ch === "\n" && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += ch;
    }
  }

  if (current !== "" || row.length) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

function detectSsiDelimiter_(text) {
  var firstLine = String(text || "").split(/\r?\n/)[0] || "";
  var semicolons = (firstLine.match(/;/g) || []).length;
  var tabs = (firstLine.match(/\t/g) || []).length;
  var commas = (firstLine.match(/,/g) || []).length;
  if (semicolons >= tabs && semicolons >= commas) return ";";
  if (tabs >= commas) return "\t";
  return ",";
}

function buildSsiImportRow_(data) {
  var row = new Array(SSI.IMPORT_COL.NOTAS);
  for (var i = 0; i < row.length; i++) row[i] = "";

  var name = String(data.name || "").trim();
  var expansion = String(data.set || "").trim();
  var number = String(data.number || "").trim();

  row[SSI.IMPORT_COL.ESTADO - 1] = "Pendiente";
  row[SSI.IMPORT_COL.SCANNER - 1] = data.scanner || "";
  row[SSI.IMPORT_COL.SCANNER_ID - 1] = data.scannerId || "";
  row[SSI.IMPORT_COL.NOMBRE_SCANNER - 1] = name;
  row[SSI.IMPORT_COL.NUMERO_SCANNER - 1] = number;
  row[SSI.IMPORT_COL.EXPANSION_SCANNER - 1] = expansion;
  row[SSI.IMPORT_COL.SERIE - 1] = data.series || "";
  row[SSI.IMPORT_COL.RAREZA - 1] = data.rarity || "";
  row[SSI.IMPORT_COL.CANTIDAD - 1] = Number(data.count) || 1;
  row[SSI.IMPORT_COL.FINISH - 1] = data.finish || "";
  row[SSI.IMPORT_COL.REVERSE - 1] = data.reverse || "";
  row[SSI.IMPORT_COL.LANGUAGE - 1] = data.language || "";
  row[SSI.IMPORT_COL.SCANNER_AVG_USD - 1] = Number(data.averagePrice) || "";
  row[SSI.IMPORT_COL.IDIOMA_STOCK - 1] = data.stockLanguage || "EN";
  row[SSI.IMPORT_COL.CONDICION - 1] = data.condition || "NM";
  row[SSI.IMPORT_COL.MATCH_KEY - 1] = buildSsiMatchKey_(name, expansion, normalizeSsiCardNumber_(number));
  return row;
}

function buildSsiExistingImportKeys_(sheet) {
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SSI.IMPORT_COL.NOTAS).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var key = buildSsiImportUniqueKey_(
      row[SSI.IMPORT_COL.SCANNER - 1],
      row[SSI.IMPORT_COL.SCANNER_ID - 1],
      row[SSI.IMPORT_COL.NOMBRE_SCANNER - 1],
      row[SSI.IMPORT_COL.EXPANSION_SCANNER - 1],
      row[SSI.IMPORT_COL.NUMERO_SCANNER - 1]
    );
    if (key) out[key] = true;
  }
  return out;
}

function buildSsiImportUniqueKey_(scanner, scannerId, name, expansion, number) {
  var id = String(scannerId || "").trim();
  if (id) return [String(scanner || "").trim().toLowerCase(), id].join("|");
  return [
    String(scanner || "").trim().toLowerCase(),
    normalizeSsiMatchText_(name),
    normalizeSsiMatchText_(expansion),
    normalizeSsiCardNumber_(number)
  ].join("|");
}

function buildSsiScannerCacheIndex_() {
  var cache = buildSsiCacheIndex_();
  var index = { byFull: {}, byNameNumber: {} };
  Object.keys(cache.byId || {}).forEach(function(pcId) {
    var source = cache.byId[pcId];
    var item = {
      pcId: source.pcId,
      pcUrl: source.pcUrl,
      nombre: source.nombre || source.nombrePc || "",
      expansion: source.expansion || source.expansionPc || "",
      numero: normalizeSsiCardNumber_(source.numero),
      usd: source.usd,
      imageUrl: source.imageUrl
    };
    addSsiIndexItem_(index.byFull, buildSsiMatchKey_(item.nombre, item.expansion, item.numero), item);
    addSsiIndexItem_(index.byNameNumber, buildSsiNameNumberKey_(item.nombre, item.numero), item);
  });
  return index;
}

function addSsiIndexItem_(bucket, key, item) {
  if (!key) return;
  if (!bucket[key]) bucket[key] = [];
  bucket[key].push(item);
}

function findSsiScannerMatch_(index, name, expansion, number) {
  var fullKey = buildSsiMatchKey_(name, expansion, number);
  var fullMatches = index.byFull[fullKey] || [];
  if (fullMatches.length === 1) return { item: fullMatches[0], status: "Match OK", score: 100, key: fullKey };
  if (fullMatches.length > 1) return { error: "Match exacto duplicado en cache: " + fullMatches.length };

  var nameNumberKey = buildSsiNameNumberKey_(name, number);
  var nameNumberMatches = index.byNameNumber[nameNumberKey] || [];
  if (nameNumberMatches.length === 1) {
    return { item: nameNumberMatches[0], status: "Match unico nombre+numero", score: 85, key: nameNumberKey };
  }
  if (nameNumberMatches.length > 1) return { error: "Nombre + numero ambiguo: " + nameNumberMatches.length + " matches" };

  return { error: "Sin match en cache" };
}

function buildSsiCacheIndex_() {
  var id = PropertiesService.getScriptProperties().getProperty(SSI.PROP.PC_CACHE_SPREADSHEET_ID);
  if (!id) throw new Error("Falta configurar PriceCharting Cache.");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("PriceCharting Cache");
  if (!sheet || sheet.getLastRow() < 2) return { byId: {}, byUrl: {} };

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  var index = { byId: {}, byUrl: {} };
  for (var i = 0; i < values.length; i++) {
    var item = {
      pcId: String(values[i][0] || "").trim(),
      canonicalUrl: String(values[i][1] || "").trim(),
      pcUrl: values[i][2],
      nombrePc: values[i][3],
      nombre: values[i][4],
      expansionPc: values[i][5],
      expansion: values[i][6],
      numero: values[i][7],
      usd: values[i][8],
      imageUrl: values[i][9]
    };
    if (item.pcId) index.byId[item.pcId] = item;
    if (item.canonicalUrl) index.byUrl[item.canonicalUrl] = item;
  }
  return index;
}

function openSsiHub_() {
  var id = PropertiesService.getScriptProperties().getProperty(SSI.PROP.HUB_SPREADSHEET_ID);
  if (!id) throw new Error("Falta configurar HUB destino.");
  return SpreadsheetApp.openById(id);
}

function buildSsiStockIndex_(stockSheet) {
  var values = stockSheet.getLastRow() >= 2
    ? stockSheet.getRange(2, 1, stockSheet.getLastRow() - 1, SSI.STOCK_COL.ULTIMA_COMPRA_USD).getValues()
    : [];
  var index = { bySku: {}, byPcId: {}, byUrl: {} };
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var item = {
      row: i + 2,
      sku: String(row[SSI.STOCK_COL.SKU - 1] || "").trim(),
      pcId: String(row[SSI.STOCK_COL.PC_ID - 1] || "").trim(),
      url: canonicalSsiUrl_(row[SSI.STOCK_COL.PC_URL - 1])
    };
    if (item.sku) index.bySku[item.sku] = item;
    if (item.pcId) index.byPcId[item.pcId] = item;
    if (item.url) index.byUrl[item.url] = item;
  }
  return index;
}

function appendOrIncrementSsiStock_(stock, stockIndex, item, config) {
  var match = findSsiStockMatch_(stockIndex, item);
  if (!match) return appendSsiStockRow_(stock, stockIndex, item, config);

  var qtyCell = stock.getRange(match.row, SSI.STOCK_COL.CANTIDAD);
  var current = Number(qtyCell.getValue()) || 0;
  qtyCell.setValue(current + item.quantity);
  stock.getRange(match.row, SSI.STOCK_COL.ULTIMA_ACTUALIZACION).setValue(new Date());
  if (item.lastPurchaseUsd) stock.getRange(match.row, SSI.STOCK_COL.ULTIMA_COMPRA_USD).setValue(item.lastPurchaseUsd);
  return match;
}

function findSsiStockMatch_(stockIndex, item) {
  if (item.sku && stockIndex.bySku[item.sku]) return stockIndex.bySku[item.sku];
  if (item.pcId && stockIndex.byPcId[item.pcId]) return stockIndex.byPcId[item.pcId];
  var url = canonicalSsiUrl_(item.pcUrl);
  if (url && stockIndex.byUrl[url]) return stockIndex.byUrl[url];
  return null;
}

function appendSsiStockRow_(stock, stockIndex, item, config) {
  var row = new Array(SSI.STOCK_COL.ULTIMA_COMPRA_USD);
  for (var i = 0; i < row.length; i++) row[i] = "";
  var usd = Number(item.usd) || 0;
  var usdArs = Number((config || {}).usd_ars || 1510);
  var roundTo = Number((config || {}).round_to || 500);
  var minPrice = Number((config || {}).min_price || 800);

  row[SSI.STOCK_COL.SKU - 1] = item.sku || ("PKM-MANUAL-" + Utilities.getUuid().slice(0, 8).toUpperCase());
  row[SSI.STOCK_COL.NOMBRE - 1] = item.name;
  row[SSI.STOCK_COL.EXPANSION - 1] = item.expansion;
  row[SSI.STOCK_COL.NUMERO - 1] = item.number;
  row[SSI.STOCK_COL.IDIOMA - 1] = item.language || config.default_idioma || "EN";
  row[SSI.STOCK_COL.CONDICION - 1] = item.condition || config.default_condicion || "NM";
  row[SSI.STOCK_COL.UBICACION - 1] = item.location || config.default_ubicacion || "";
  row[SSI.STOCK_COL.CANTIDAD - 1] = Number(item.quantity) || 1;
  row[SSI.STOCK_COL.PC_URL - 1] = item.pcUrl;
  row[SSI.STOCK_COL.PC_ID - 1] = item.pcId;
  row[SSI.STOCK_COL.TCGPLAYER_URL - 1] = buildSsiTcgplayerSearchUrl_(item.name, item.expansion, item.number);
  row[SSI.STOCK_COL.IMAGEN_URL - 1] = item.imageUrl || "";
  row[SSI.STOCK_COL.PC_USD - 1] = usd || "";
  row[SSI.STOCK_COL.DOLAR_USADO - 1] = usdArs;
  if (usd) {
    row[SSI.STOCK_COL.PRECIO_SUGERIDO_ARS - 1] = roundSsiPrice_(usd * usdArs, roundTo, minPrice);
    row[SSI.STOCK_COL.PRECIO_FINAL_ARS - 1] = row[SSI.STOCK_COL.PRECIO_SUGERIDO_ARS - 1];
  }
  row[SSI.STOCK_COL.ULTIMA_ACTUALIZACION - 1] = new Date();
  row[SSI.STOCK_COL.ACTIVO - 1] = true;
  row[SSI.STOCK_COL.NOTAS - 1] = item.note || "";
  row[SSI.STOCK_COL.ULTIMA_COMPRA_USD - 1] = item.lastPurchaseUsd || "";

  var targetRow = findFirstEmptySsiKeyRow_(stock, SSI.STOCK_COL.SKU);
  stock.getRange(targetRow, 1, 1, row.length).setValues([row]);

  var saved = { row: targetRow, sku: row[SSI.STOCK_COL.SKU - 1], pcId: item.pcId, url: canonicalSsiUrl_(item.pcUrl) };
  stockIndex.bySku[saved.sku] = saved;
  if (saved.pcId) stockIndex.byPcId[saved.pcId] = saved;
  if (saved.url) stockIndex.byUrl[saved.url] = saved;
  return saved;
}

function appendSsiRows_(sheet, rows) {
  if (!rows.length) return;
  var startRow = findFirstEmptySsiKeyRow_(sheet, 1);
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function findFirstEmptySsiKeyRow_(sheet, keyCol) {
  var maxRows = Math.max(2, sheet.getMaxRows());
  var values = sheet.getRange(2, keyCol, maxRows - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (isSsiEmptyAppendCell_(values[i][0])) return i + 2;
  }
  return maxRows + 1;
}

function isSsiEmptyAppendCell_(value) {
  if (value === false || value === "" || value === null || value === undefined) return true;
  var text = String(value).trim().toLowerCase();
  return text === "" || text === "false";
}

function appendMissingSsiConfig_(sheet, defaults) {
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) if (values[i][0]) existing[String(values[i][0])] = true;
  }
  var append = defaults.filter(function(row) { return !existing[row[0]]; });
  if (append.length) sheet.getRange(sheet.getLastRow() + 1, 1, append.length, 2).setValues(append);
}

function readSsiConfig_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSI.SHEETS.CONFIG);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) if (values[i][0]) out[String(values[i][0])] = values[i][1];
  return out;
}

function applySsiHeader_(sheet, headers, color) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(color).setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function getSsiRowValue_(row, idx, names) {
  for (var i = 0; i < names.length; i++) {
    var key = normalizeSsiHeader_(names[i]);
    if (idx.hasOwnProperty(key)) return row[idx[key]];
  }
  return "";
}

function normalizeSsiHeader_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSsiMatchText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bpokemon\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizeSsiCardNumber_(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  text = text.split("/")[0].trim();
  return text.toUpperCase().replace(/\s+/g, "");
}

function buildSsiMatchKey_(name, expansion, number) {
  return [normalizeSsiMatchText_(name), normalizeSsiMatchText_(expansion), normalizeSsiCardNumber_(number)].join("|");
}

function buildSsiNameNumberKey_(name, number) {
  return [normalizeSsiMatchText_(name), normalizeSsiCardNumber_(number)].join("|");
}

function parseSsiNumber_(value) {
  if (typeof value === "number") return value;
  var text = String(value || "").trim();
  if (!text) return 0;
  text = text.replace(/[^\d.,-]/g, "");
  if (text.indexOf(",") >= 0 && text.indexOf(".") >= 0) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.indexOf(",") >= 0) {
    text = text.replace(",", ".");
  }
  return Number(text) || 0;
}

function extractSsiSpreadsheetId_(input) {
  var text = String(input || "").trim();
  var match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = text.match(/^[a-zA-Z0-9-_]{20,}$/);
  return match ? match[0] : "";
}

function normalizeSsiUrl_(value) {
  var text = String(value || "").trim();
  var match = text.match(/https?:\/\/[^\s\])]+/i);
  return match ? match[0] : text;
}

function canonicalSsiUrl_(url) {
  var text = normalizeSsiUrl_(url);
  if (!text) return "";
  text = text.replace(/^http:\/\//i, "https://").split("#")[0].split("?")[0].replace(/\/+$/g, "").toLowerCase();
  var match = text.match(/^(https:\/\/www\.pricecharting\.com\/game\/)([^\/]+)\/([^\/]+)$/i);
  if (match) {
    return match[1].toLowerCase() + slugSsi_(decodeURIComponentSafeSsi_(match[2])) + "/" + slugSsi_(decodeURIComponentSafeSsi_(match[3]));
  }
  return text;
}

function decodeURIComponentSafeSsi_(text) {
  try {
    return decodeURIComponent(String(text || ""));
  } catch (err) {
    return String(text || "");
  }
}

function slugSsi_(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSsiSku_(pcId) {
  return "PKM-PC-" + pcId;
}

function buildSsiTcgplayerSearchUrl_(name, expansion, number) {
  var query = [name, expansion, number].filter(Boolean).join(" ");
  return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=" + encodeURIComponent(query);
}

function roundSsiPrice_(value, roundTo, minPrice) {
  var rounded = Math.ceil(value / roundTo) * roundTo;
  return Math.max(Number(minPrice) || 0, rounded);
}

function formatSsiDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
}

function logSsi_(origin, message) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSI.SHEETS.LOG);
  if (sheet) sheet.appendRow([new Date(), origin, message]);
}
