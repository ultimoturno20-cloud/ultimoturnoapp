// ============================================================
// Claims -> Ventas connector
// Install this script in the Presupuestador / Generador de Claims spreadsheet.
// It reads claim rows with buyer and appends sales.
// The Ventas spreadsheet is responsible for decrementing Stock Maestro.
// ============================================================

var CSSC = {
  CONFIG_SHEET: "Config",
  DEFAULT_CLAIM_SHEET: "LISTA",
  PROP: {
    SALES_SPREADSHEET_ID: "SALES_SPREADSHEET_ID"
  },
  SALES_SHEET: "Ventas"
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Claims Sync")
    .addItem("Configurar conexiones", "promptConfigureConnections")
    .addItem("Enviar compradores a Ventas", "sendClaimBuyersToSales")
    .addToUi();
}

function promptConfigureConnections() {
  var ui = SpreadsheetApp.getUi();

  var salesPrompt = ui.prompt(
    "Ventas",
    "Pegá el ID o URL de la planilla Ventas.",
    ui.ButtonSet.OK_CANCEL
  );
  if (salesPrompt.getSelectedButton() !== ui.Button.OK) return;

  var salesId = extractSpreadsheetId_(salesPrompt.getResponseText());
  if (!salesId) {
    ui.alert("No pude leer el ID de Ventas.");
    return;
  }

  PropertiesService.getScriptProperties().setProperty(CSSC.PROP.SALES_SPREADSHEET_ID, salesId);
  ui.alert("Conexion con Ventas guardada.");
}

function sendClaimBuyersToSales() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) {
    SpreadsheetApp.getUi().alert("Ya hay una sincronizacion corriendo.");
    return;
  }

  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    var claimSheet = getClaimSheet_(active);
    var salesSs = openConfiguredSpreadsheet_(CSSC.PROP.SALES_SPREADSHEET_ID, "Ventas");
    var salesSheet = salesSs.getSheetByName(CSSC.SALES_SHEET);

    if (!salesSheet) throw new Error("No existe hoja Ventas en planilla Ventas.");

    var claimData = readClaimRows_(claimSheet);
    var sent = 0;
    var skipped = 0;

    for (var i = 0; i < claimData.rows.length; i++) {
      var item = claimData.rows[i];
      if (!item.buyer) {
        skipped++;
        continue;
      }
      if (item.synced) {
        skipped++;
        continue;
      }

      appendSale_(salesSheet, item);
      markClaimSynced_(claimSheet, item.row, claimData.syncedCol, item.sku);
      sent++;
    }

    SpreadsheetApp.getUi().alert(
      "Envio a Ventas completo\n" +
      "Ventas enviadas: " + sent + "\n" +
      "Omitidas: " + skipped
    );
  } finally {
    lock.releaseLock();
  }
}

function getClaimSheet_(ss) {
  var sheet = ss.getActiveSheet();
  if (sheet && sheet.getLastRow() > 1) return sheet;
  return ss.getSheetByName(CSSC.DEFAULT_CLAIM_SHEET) || sheet;
}

function readClaimRows_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { rows: [], syncedCol: ensureSyncedColumn_(sheet) };

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(normalizeHeader_);
  var cols = resolveClaimColumns_(headers);
  var syncedCol = ensureSyncedColumn_(sheet);

  // If the synced column was just added after reading values, read it separately.
  var syncedValues = sheet.getRange(2, syncedCol, lastRow - 1, 1).getValues();
  var rows = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var buyer = getByCol_(row, cols.buyer);
    var pcUrl = getByCol_(row, cols.pcUrl);
    var sku = getByCol_(row, cols.sku);
    var name = getByCol_(row, cols.name);
    var expansion = getByCol_(row, cols.expansion);
    var number = getByCol_(row, cols.number);
    var price = parseNumber_(getByCol_(row, cols.price));
    var imageUrl = getByCol_(row, cols.imageUrl);
    var message = getByCol_(row, cols.message);

    rows.push({
      row: r + 1,
      sku: String(sku || "").trim(),
      pcUrl: normalizeUrl_(pcUrl),
      pcId: extractPriceChartingIdFromUrl_(pcUrl),
      name: String(name || "").trim(),
      expansion: String(expansion || "").trim(),
      number: String(number || "").trim(),
      price: price,
      imageUrl: normalizeUrl_(imageUrl),
      message: String(message || "").trim(),
      buyer: String(buyer || "").trim(),
      synced: String(syncedValues[r - 1][0] || "").trim()
    });
  }

  return { rows: rows, syncedCol: syncedCol };
}

function resolveClaimColumns_(headers) {
  return {
    sku: findHeader_(headers, ["sku", "id", "id-interno"]),
    name: findHeader_(headers, ["nombre", "nombre-pc"]),
    expansion: findHeader_(headers, ["expansion", "expansion-pc", "exp-corregida"]),
    number: findHeader_(headers, ["numero", "nro", "#"]),
    pcUrl: findHeader_(headers, ["pricecharting-url", "link", "pricecharting-link"]),
    buyer: findHeader_(headers, ["comprador", "buyer", "persona"]),
    price: findHeader_(headers, ["precio-final", "precio", "redondeo"]),
    imageUrl: findHeader_(headers, ["imagen-url", "image-url"]),
    message: findHeader_(headers, ["nombrefinal", "mensaje", "message"])
  };
}

function ensureSyncedColumn_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
  var existing = findHeader_(headers, ["sync-stock", "stock-sync", "sincronizado"]);
  if (existing) return existing;
  var col = lastCol + 1;
  sheet.getRange(1, col).setValue("Sync Stock");
  return col;
}

function appendSale_(salesSheet, item) {
  salesSheet.appendRow([
    new Date(),
    item.sku,
    item.name,
    item.expansion,
    1,
    item.price || "",
    item.price || "",
    item.buyer,
    "",
    item.message || item.pcUrl,
    item.pcUrl,
    item.pcId,
    item.imageUrl,
    ""
  ]);
}

function markClaimSynced_(claimSheet, row, syncedCol, sku) {
  claimSheet.getRange(row, syncedCol).setValue("ENVIADO VENTAS " + (sku || "") + " " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"));
}

function openConfiguredSpreadsheet_(propName, label) {
  var id = PropertiesService.getScriptProperties().getProperty(propName);
  if (!id) throw new Error("Falta configurar " + label + ".");
  return SpreadsheetApp.openById(id);
}

function extractSpreadsheetId_(input) {
  var text = String(input || "").trim();
  var match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = text.match(/^[a-zA-Z0-9-_]{20,}$/);
  return match ? match[0] : "";
}

function findHeader_(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var target = normalizeHeader_(candidates[i]);
    for (var c = 0; c < headers.length; c++) {
      if (headers[c] === target) return c + 1;
    }
  }
  return 0;
}

function getByCol_(row, col) {
  return col ? row[col - 1] : "";
}

function normalizeHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumber_(value) {
  if (typeof value === "number") return value;
  var text = String(value || "").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  var number = Number(text);
  return isNaN(number) ? 0 : number;
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
