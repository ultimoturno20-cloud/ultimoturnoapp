// ============================================================
// Ventas -> Stock Maestro connector
// Install this script in the Ventas spreadsheet.
// Sales are the only source that decrements stock.
// ============================================================

var SSC = {
  PROP: {
    STOCK_SPREADSHEET_ID: "STOCK_SPREADSHEET_ID"
  },
  SALES_SHEET: "Ventas",
  STOCK_SHEET: "Stock",
  SALES_COL: {
    FECHA: 1,
    SKU: 2,
    NOMBRE: 3,
    EXPANSION: 4,
    CANTIDAD: 5,
    PRECIO_UNITARIO: 6,
    TOTAL: 7,
    COMPRADOR: 8,
    MEDIO_PAGO: 9,
    NOTAS: 10,
    PC_URL: 11,
    PC_ID: 12,
    IMAGEN_URL: 13,
    SYNC_STOCK: 14
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
    INCLUIR_CLAIM: 19,
    NOTAS: 20
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Ventas Sync")
    .addItem("Crear / reparar estructura", "setupVentasSheet")
    .addItem("Configurar Stock Maestro", "promptConfigureStockMaster")
    .addItem("Sincronizar stock", "syncSalesToStock")
    .addSeparator()
    .addItem("Activar trigger cada 5 min", "setupSalesSyncTrigger")
    .addItem("Desactivar triggers", "removeSalesSyncTriggers")
    .addToUi();
}

function setupVentasSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SSC.SALES_SHEET) || ss.insertSheet(SSC.SALES_SHEET);
  var headers = [
    "Fecha",
    "SKU",
    "Nombre",
    "Expansion",
    "Cantidad",
    "Precio unitario",
    "Total",
    "Comprador",
    "Medio pago",
    "Notas",
    "PriceCharting URL",
    "PriceCharting ID",
    "Imagen URL",
    "Sync Stock"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#374151").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("F:G").setNumberFormat("#,##0");
  sheet.setColumnWidth(10, 260);
  sheet.setColumnWidth(11, 360);
  sheet.setColumnWidth(13, 360);
  SpreadsheetApp.getUi().alert("Ventas reparada/lista.");
}

function promptConfigureStockMaster() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt("Stock Maestro", "Pegá el ID o URL de la planilla Stock Maestro.", ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var id = extractSpreadsheetId_(prompt.getResponseText());
  if (!id) {
    ui.alert("No pude leer el ID.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty(SSC.PROP.STOCK_SPREADSHEET_ID, id);
  ui.alert("Stock Maestro configurado.");
}

function setupSalesSyncTrigger() {
  removeSalesSyncTriggers(false);
  ScriptApp.newTrigger("syncSalesToStock").timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert("Trigger activado.");
}

function removeSalesSyncTriggers(showAlert) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncSalesToStock") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  if (showAlert !== false) SpreadsheetApp.getUi().alert("Triggers desactivados.");
}

function syncSalesToStock() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { synced: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var salesSs = SpreadsheetApp.getActiveSpreadsheet();
    var salesSheet = salesSs.getSheetByName(SSC.SALES_SHEET);
    if (!salesSheet) throw new Error("No existe hoja Ventas.");

    var stockSs = openStockSpreadsheet_();
    var stockSheet = stockSs.getSheetByName(SSC.STOCK_SHEET);
    if (!stockSheet) throw new Error("No existe hoja Stock en Stock Maestro.");

    var sales = readUnsyncedSales_(salesSheet);
    var stockIndex = buildStockIndex_(stockSheet);
    var synced = 0;
    var added = 0;

    for (var i = 0; i < sales.length; i++) {
      var sale = sales[i];
      var match = findStockMatch_(stockIndex, sale);
      if (!match) {
        match = appendMissingStockRow_(stockSheet, stockIndex, sale);
        added++;
      }
      decrementStock_(stockSheet, match.row, sale.quantity);
      markSaleSynced_(salesSheet, sale.row, match.sku);
      synced++;
    }

    return { synced: synced, added: added };
  } finally {
    lock.releaseLock();
  }
}

function readUnsyncedSales_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, SSC.SALES_COL.SYNC_STOCK).getValues();
  var sales = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var synced = String(row[SSC.SALES_COL.SYNC_STOCK - 1] || "").trim();
    var quantity = Number(row[SSC.SALES_COL.CANTIDAD - 1]) || 0;
    if (synced || quantity <= 0) continue;
    sales.push({
      row: i + 2,
      sku: String(row[SSC.SALES_COL.SKU - 1] || "").trim(),
      name: String(row[SSC.SALES_COL.NOMBRE - 1] || "").trim(),
      expansion: String(row[SSC.SALES_COL.EXPANSION - 1] || "").trim(),
      quantity: quantity,
      price: Number(row[SSC.SALES_COL.PRECIO_UNITARIO - 1]) || 0,
      buyer: String(row[SSC.SALES_COL.COMPRADOR - 1] || "").trim(),
      notes: String(row[SSC.SALES_COL.NOTAS - 1] || "").trim(),
      pcUrl: normalizeUrl_(row[SSC.SALES_COL.PC_URL - 1]),
      pcId: String(row[SSC.SALES_COL.PC_ID - 1] || "").trim() || extractPriceChartingIdFromUrl_(row[SSC.SALES_COL.PC_URL - 1]),
      imageUrl: normalizeUrl_(row[SSC.SALES_COL.IMAGEN_URL - 1])
    });
  }
  return sales;
}

function buildStockIndex_(stockSheet) {
  var lastRow = stockSheet.getLastRow();
  var values = lastRow >= 2 ? stockSheet.getRange(2, 1, lastRow - 1, SSC.STOCK_COL.NOTAS).getValues() : [];
  var index = { bySku: {}, byPcId: {}, byUrl: {} };
  for (var i = 0; i < values.length; i++) {
    var rowNum = i + 2;
    var row = values[i];
    var sku = String(row[SSC.STOCK_COL.SKU - 1] || "").trim();
    var pcId = String(row[SSC.STOCK_COL.PC_ID - 1] || "").trim();
    var url = canonicalPriceChartingUrl_(row[SSC.STOCK_COL.PC_URL - 1]);
    var item = { row: rowNum, sku: sku, data: row };
    if (sku) index.bySku[sku] = item;
    if (pcId) index.byPcId[pcId] = item;
    if (url) index.byUrl[url] = item;
  }
  return index;
}

function findStockMatch_(index, sale) {
  if (sale.sku && index.bySku[sale.sku]) return index.bySku[sale.sku];
  if (sale.pcId && index.byPcId[sale.pcId]) return index.byPcId[sale.pcId];
  var url = canonicalPriceChartingUrl_(sale.pcUrl);
  if (url && index.byUrl[url]) return index.byUrl[url];
  return null;
}

function appendMissingStockRow_(stockSheet, index, sale) {
  var sku = sale.sku || (sale.pcId ? "PKM-PC-" + sale.pcId : "PKM-MANUAL-" + Utilities.getUuid().slice(0, 8).toUpperCase());
  var row = [
    sku,
    sale.name,
    sale.expansion,
    "",
    "",
    "",
    "",
    0,
    sale.pcUrl,
    sale.pcId,
    buildTcgplayerSearchUrl_(sale.name, sale.expansion, ""),
    sale.imageUrl,
    "",
    "",
    "",
    "",
    sale.price || "",
    new Date(),
    false,
    "Creada desde Ventas con stock 0"
  ];
  stockSheet.appendRow(row);
  var item = { row: stockSheet.getLastRow(), sku: sku, data: row };
  index.bySku[sku] = item;
  if (sale.pcId) index.byPcId[sale.pcId] = item;
  if (sale.pcUrl) index.byUrl[canonicalPriceChartingUrl_(sale.pcUrl)] = item;
  return item;
}

function decrementStock_(stockSheet, row, quantity) {
  var cell = stockSheet.getRange(row, SSC.STOCK_COL.CANTIDAD);
  var current = Number(cell.getValue()) || 0;
  cell.setValue(Math.max(0, current - quantity));
  stockSheet.getRange(row, SSC.STOCK_COL.ULTIMA_ACTUALIZACION).setValue(new Date());
}

function markSaleSynced_(sheet, row, sku) {
  sheet.getRange(row, SSC.SALES_COL.SYNC_STOCK).setValue("OK " + sku + " " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"));
}

function openStockSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(SSC.PROP.STOCK_SPREADSHEET_ID);
  if (!id) throw new Error("Falta configurar Stock Maestro.");
  return SpreadsheetApp.openById(id);
}

function extractSpreadsheetId_(input) {
  var text = String(input || "").trim();
  var match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = text.match(/^[a-zA-Z0-9-_]{20,}$/);
  return match ? match[0] : "";
}

function normalizeUrl_(value) {
  var text = String(value || "").trim();
  var match = text.match(/https?:\/\/[^\s\])]+/i);
  return match ? match[0] : text;
}

function canonicalPriceChartingUrl_(url) {
  var text = normalizeUrl_(url);
  if (!text) return "";
  return text.replace(/^http:\/\//i, "https://").split("#")[0].split("?")[0].replace(/\/+$/g, "").toLowerCase();
}

function extractPriceChartingIdFromUrl_(url) {
  var match = String(url || "").match(/[?&]id=(\d+)/i);
  return match ? match[1] : "";
}

function buildTcgplayerSearchUrl_(name, expansion, number) {
  var query = [name, expansion, number].filter(Boolean).join(" ");
  return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=" + encodeURIComponent(query);
}
