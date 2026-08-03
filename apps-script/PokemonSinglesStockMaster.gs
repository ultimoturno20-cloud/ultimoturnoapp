// ============================================================
// Pokemon Singles Stock Master
// Master stock for singles + PriceCharting CSV cache + ecommerce export.
// Store API token in Script Properties, never in visible cells.
// ============================================================

var PSM = {
  SHEETS: {
    CONFIG: "Config",
    STOCK: "Stock",
    PC_CACHE: "Cache PriceCharting",
    ECOMMERCE: "Ecommerce Export",
    LOG: "Log"
  },
  PROP: {
    PC_TOKEN: "PRICECHARTING_TOKEN"
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
  },
  CACHE_COL: {
    PC_ID: 1,
    PC_URL: 2,
    NOMBRE: 3,
    EXPANSION: 4,
    NUMERO: 5,
    LOOSE_USD: 6,
    IMAGEN_URL: 7,
    UPDATED_AT: 8,
    RAW_JSON: 9
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Stock Maestro")
    .addItem("Crear / reparar estructura", "setupSinglesStockMaster")
    .addSeparator()
    .addItem("Configurar PriceCharting token", "promptSetPriceChartingToken")
    .addItem("Actualizar CSV PriceCharting ahora", "refreshPriceChartingCsv")
    .addItem("Completar stock desde cache", "syncStockFromCache")
    .addItem("Completar imagenes faltantes", "fetchMissingStockImages")
    .addItem("Limpiar hojas externas vacias", "removeExternalSheetsIfEmpty")
    .addSeparator()
    .addItem("Actualizar Ecommerce Export", "refreshEcommerceExport")
    .addSeparator()
    .addItem("Activar trigger diario", "setupDailyPriceRefreshTrigger")
    .addItem("Desactivar triggers", "removeSinglesStockTriggers")
    .addToUi();
}

function setupSinglesStockMaster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupConfig_(ss);
  setupStock_(ss);
  setupPriceChartingCache_(ss);
  setupEcommerce_(ss);
  setupLog_(ss);
  SpreadsheetApp.getUi().alert("Planilla maestra de singles creada/reparada.");
}

function promptSetPriceChartingToken() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "PriceCharting API token",
    "Pegá tu token. Se guarda en Script Properties, no en la hoja.",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var token = String(response.getResponseText() || "").trim();
  if (!token) {
    ui.alert("Token vacío.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty(PSM.PROP.PC_TOKEN, token);
  ui.alert("Token guardado.");
}

function setupDailyPriceRefreshTrigger() {
  removeSinglesStockTriggers(false);
  ScriptApp.newTrigger("refreshPriceChartingCsv")
    .timeBased()
    .atHour(4)
    .everyDays(1)
    .create();
  SpreadsheetApp.getUi().alert("Trigger diario activado para las 4 AM.");
}

function removeSinglesStockTriggers(showAlert) {
  var handlers = { refreshPriceChartingCsv: true };
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (handlers[triggers[i].getHandlerFunction()]) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  if (showAlert !== false) SpreadsheetApp.getUi().alert("Triggers desactivados.");
}

function removeExternalSheetsIfEmpty() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var removed = [];
  var kept = [];
  ["Ventas", "Claims"].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    if (isSheetEmptyOrHeaderOnly_(sheet)) {
      ss.deleteSheet(sheet);
      removed.push(name);
    } else {
      kept.push(name);
    }
  });

  SpreadsheetApp.getUi().alert(
    "Limpieza terminada\n" +
    "Eliminadas: " + (removed.join(", ") || "ninguna") + "\n" +
    "Con datos, no eliminadas: " + (kept.join(", ") || "ninguna")
  );
}

function isSheetEmptyOrHeaderOnly_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return true;
  var values = sheet.getRange(2, 1, lastRow - 1, Math.max(1, lastCol)).getValues();
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      if (values[r][c] !== "" && values[r][c] !== null) return false;
    }
  }
  return true;
}

function refreshPriceChartingCsv() {
  var token = getPriceChartingToken_();
  if (!token) throw new Error("Falta configurar PriceCharting token.");

  var url = "https://www.pricecharting.com/price-guide/download-custom?t=" +
    encodeURIComponent(token) + "&category=pokemon-cards";
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Mozilla/5.0 PokemonSinglesStockMaster/1.0" }
  });

  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("PriceCharting CSV HTTP " + status);
  }

  var csvText = response.getContentText();
  var rows = Utilities.parseCsv(csvText);
  if (!rows || rows.length < 2) {
    throw new Error("CSV vacío o inválido.");
  }

  var imported = importPriceChartingCsvRows_(rows);
  syncStockFromCache();
  refreshEcommerceExport();
  log_("PriceCharting CSV", "Importadas " + imported + " filas.");
  return imported;
}

function importPriceChartingCsvRows_(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PSM.SHEETS.PC_CACHE);
  if (!sheet) {
    setupPriceChartingCache_(ss);
    sheet = ss.getSheetByName(PSM.SHEETS.PC_CACHE);
  }

  var headers = rows[0].map(function(h) { return normalizeHeader_(h); });
  var idx = {};
  for (var i = 0; i < headers.length; i++) idx[headers[i]] = i;

  var wanted = getWantedPriceChartingKeys_();
  var now = new Date();
  var output = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    var id = getCsvValue_(row, idx, ["id", "product-id"]);
    var name = decodeHtml_(getCsvValue_(row, idx, ["product-name", "name"]));
    var expansion = decodeHtml_(getCsvValue_(row, idx, ["console-name", "set-name"]));
    if (!id || !name) continue;

    var pcUrl = "https://www.pricecharting.com/game/" + slug_(expansion) + "/" + slug_(name);
    var canonicalUrl = canonicalPriceChartingUrl_(pcUrl);
    if (wanted.hasAny && !wanted.byId[id] && !wanted.byUrl[canonicalUrl]) continue;
    if (!wanted.hasAny) continue;

    var parsed = parseNameAndNumber_(name);
    var loosePennies = Number(getCsvValue_(row, idx, ["loose-price", "used-price", "ungraded-price"])) || 0;
    var looseUsd = loosePennies ? loosePennies / 100 : "";
    var imageUrl = getCsvValue_(row, idx, ["image-url", "image"]);

    output.push([
      id,
      pcUrl,
      name,
      cleanExpansion_(expansion),
      parsed.number || "",
      looseUsd,
      imageUrl,
      now,
      ""
    ]);
  }

  sheet.clearContents();
  writePriceChartingCacheHeader_(sheet);
  if (output.length) {
    sheet.getRange(2, 1, output.length, output[0].length).setValues(output);
  }
  sheet.getRange("F:F").setNumberFormat("0.00");
  sheet.getRange("H:H").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.autoResizeColumns(1, 8);
  updateConfigValue_("last_pc_csv_update", now);
  return output.length;
}

function getWantedPriceChartingKeys_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stock = ss.getSheetByName(PSM.SHEETS.STOCK);
  var wanted = { byId: {}, byUrl: {}, hasAny: false };
  if (!stock || stock.getLastRow() < 2) return wanted;

  var values = stock.getRange(2, 1, stock.getLastRow() - 1, PSM.STOCK_COL.PC_ID).getValues();
  for (var i = 0; i < values.length; i++) {
    var pcUrl = normalizeUrl_(values[i][PSM.STOCK_COL.PC_URL - 1]);
    var pcId = String(values[i][PSM.STOCK_COL.PC_ID - 1] || "").trim() || extractPriceChartingIdFromUrl_(pcUrl);
    if (pcId) {
      wanted.byId[pcId] = true;
      wanted.hasAny = true;
    }
    if (pcUrl) {
      wanted.byUrl[canonicalPriceChartingUrl_(pcUrl)] = true;
      wanted.hasAny = true;
    }
  }
  return wanted;
}

function syncStockFromCache() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stock = ss.getSheetByName(PSM.SHEETS.STOCK);
  var cache = ss.getSheetByName(PSM.SHEETS.PC_CACHE);
  if (!stock || !cache) return 0;

  var lastStockRow = stock.getLastRow();
  var lastCacheRow = cache.getLastRow();
  if (lastStockRow < 2 || lastCacheRow < 2) return 0;

  var config = readConfig_();
  var usdArs = Number(config.usd_ars || 1510);
  var roundTo = Number(config.round_to || 500);
  var minPrice = Number(config.min_price || 800);

  var cacheValues = cache.getRange(2, 1, lastCacheRow - 1, 8).getValues();
  var byId = {};
  var byUrl = {};
  for (var i = 0; i < cacheValues.length; i++) {
    byId[String(cacheValues[i][PSM.CACHE_COL.PC_ID - 1])] = cacheValues[i];
    byUrl[canonicalPriceChartingUrl_(cacheValues[i][PSM.CACHE_COL.PC_URL - 1])] = cacheValues[i];
  }

  var range = stock.getRange(2, 1, lastStockRow - 1, PSM.STOCK_COL.NOTAS);
  var values = range.getValues();
  var now = new Date();
  var updated = 0;

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var pcUrl = normalizeUrl_(row[PSM.STOCK_COL.PC_URL - 1]);
    var pcId = String(row[PSM.STOCK_COL.PC_ID - 1] || "").trim() || extractPriceChartingIdFromUrl_(pcUrl);
    if (!pcId) continue;

    var cacheRow = pcId ? byId[pcId] : null;
    if (!cacheRow && pcUrl) cacheRow = byUrl[canonicalPriceChartingUrl_(pcUrl)];
    if (!cacheRow) continue;
    pcId = pcId || String(cacheRow[PSM.CACHE_COL.PC_ID - 1] || "");

    if (!row[PSM.STOCK_COL.SKU - 1]) row[PSM.STOCK_COL.SKU - 1] = buildSku_(pcId);
    row[PSM.STOCK_COL.PC_ID - 1] = pcId;
    if (!row[PSM.STOCK_COL.NOMBRE - 1]) row[PSM.STOCK_COL.NOMBRE - 1] = cacheRow[PSM.CACHE_COL.NOMBRE - 1];
    if (!row[PSM.STOCK_COL.EXPANSION - 1]) row[PSM.STOCK_COL.EXPANSION - 1] = cacheRow[PSM.CACHE_COL.EXPANSION - 1];
    if (!row[PSM.STOCK_COL.NUMERO - 1]) row[PSM.STOCK_COL.NUMERO - 1] = cacheRow[PSM.CACHE_COL.NUMERO - 1];
    if (!row[PSM.STOCK_COL.TCGPLAYER_URL - 1]) {
      row[PSM.STOCK_COL.TCGPLAYER_URL - 1] = buildTcgplayerSearchUrl_(row[PSM.STOCK_COL.NOMBRE - 1], row[PSM.STOCK_COL.EXPANSION - 1], row[PSM.STOCK_COL.NUMERO - 1]);
    }
    if (!row[PSM.STOCK_COL.IMAGEN_URL - 1] && cacheRow[PSM.CACHE_COL.IMAGEN_URL - 1]) {
      row[PSM.STOCK_COL.IMAGEN_URL - 1] = cacheRow[PSM.CACHE_COL.IMAGEN_URL - 1];
    }

    var usd = Number(cacheRow[PSM.CACHE_COL.LOOSE_USD - 1]) || 0;
    row[PSM.STOCK_COL.PC_USD - 1] = usd || "";
    row[PSM.STOCK_COL.DOLAR_USADO - 1] = usdArs;
    if (usd) {
      row[PSM.STOCK_COL.PRECIO_SUGERIDO_ARS - 1] = roundPrice_(usd * usdArs, roundTo, minPrice);
    }
    row[PSM.STOCK_COL.PRECIO_FINAL_ARS - 1] = row[PSM.STOCK_COL.PRECIO_MANUAL_ARS - 1] || row[PSM.STOCK_COL.PRECIO_SUGERIDO_ARS - 1] || "";
    row[PSM.STOCK_COL.ULTIMA_ACTUALIZACION - 1] = now;
    updated++;
  }

  range.setValues(values);
  return updated;
}

function fetchMissingStockImages() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stock = ss.getSheetByName(PSM.SHEETS.STOCK);
  if (!stock) return 0;
  var lastRow = stock.getLastRow();
  if (lastRow < 2) return 0;

  var values = stock.getRange(2, 1, lastRow - 1, PSM.STOCK_COL.NOTAS).getValues();
  var updated = 0;
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var url = normalizeUrl_(row[PSM.STOCK_COL.PC_URL - 1]);
    var image = normalizeUrl_(row[PSM.STOCK_COL.IMAGEN_URL - 1]);
    if (!url || image) continue;
    try {
      var imageUrl = fetchPriceChartingImageUrl_(url);
      if (imageUrl) {
        stock.getRange(i + 2, PSM.STOCK_COL.IMAGEN_URL).setValue(imageUrl);
        updated++;
      }
      Utilities.sleep(500);
    } catch (err) {
      log_("Imagen PriceCharting", "Fila " + (i + 2) + ": " + err);
    }
  }
  refreshEcommerceExport();
  return updated;
}

function refreshEcommerceExport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stock = ss.getSheetByName(PSM.SHEETS.STOCK);
  var ecommerce = ss.getSheetByName(PSM.SHEETS.ECOMMERCE);
  if (!stock || !ecommerce) return 0;

  var headers = ["SKU", "Titulo", "Descripcion", "Precio", "Stock", "Imagen", "Categoria", "Tags", "PriceCharting URL", "TCGplayer URL", "Ubicacion interna"];
  ecommerce.clearContents();
  ecommerce.getRange(1, 1, 1, headers.length).setValues([headers]);

  var lastRow = stock.getLastRow();
  if (lastRow < 2) return 0;

  var values = stock.getRange(2, 1, lastRow - 1, PSM.STOCK_COL.NOTAS).getValues();
  var output = [];
  for (var i = 0; i < values.length; i++) {
    var qty = Number(values[i][PSM.STOCK_COL.CANTIDAD - 1]) || 0;
    if (qty <= 0) continue;
    var title = buildTitle_(values[i]);
    output.push([
      values[i][PSM.STOCK_COL.SKU - 1],
      title,
      buildDescription_(values[i]),
      values[i][PSM.STOCK_COL.PRECIO_FINAL_ARS - 1],
      qty,
      values[i][PSM.STOCK_COL.IMAGEN_URL - 1],
      "Pokemon Singles",
      buildTags_(values[i]),
      values[i][PSM.STOCK_COL.PC_URL - 1],
      values[i][PSM.STOCK_COL.TCGPLAYER_URL - 1],
      values[i][PSM.STOCK_COL.UBICACION - 1]
    ]);
  }
  if (output.length) ecommerce.getRange(2, 1, output.length, headers.length).setValues(output);
  ecommerce.getRange("D:D").setNumberFormat("#,##0");
  ecommerce.autoResizeColumns(1, headers.length);
  return output.length;
}

function setupConfig_(ss) {
  var sheet = ss.getSheetByName(PSM.SHEETS.CONFIG) || ss.insertSheet(PSM.SHEETS.CONFIG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:B1").setValues([["Clave", "Valor"]]);
  var defaults = [
    ["usd_ars", 1510],
    ["round_to", 500],
    ["min_price", 800],
    ["pricecharting_category", "pokemon-cards"],
    ["last_pc_csv_update", ""]
  ];
  appendMissingConfig_(sheet, defaults);
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#263238").setFontColor("#ffffff");
  sheet.autoResizeColumns(1, 2);
}

function setupStock_(ss) {
  var sheet = ss.getSheetByName(PSM.SHEETS.STOCK) || ss.insertSheet(PSM.SHEETS.STOCK);
  var headers = [
    "SKU", "Nombre", "Expansion", "Numero", "Idioma", "Condicion", "Ubicacion", "Cantidad",
    "PriceCharting URL", "PriceCharting ID", "TCGplayer Search URL", "Imagen URL",
    "Precio PC USD", "Dolar usado", "Precio sugerido ARS", "Precio manual ARS",
    "Precio final ARS", "Ultima actualizacion", "Incluir claim", "Notas"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1f2933").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.getRange("M:Q").setNumberFormat("#,##0.00");
  sheet.getRange("R:R").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange(2, PSM.STOCK_COL.INCLUIR_CLAIM, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  setStockValidations_(sheet);
  sheet.setColumnWidth(2, 190);
  sheet.setColumnWidth(3, 190);
  sheet.setColumnWidth(9, 360);
  sheet.setColumnWidth(11, 360);
  sheet.setColumnWidth(12, 360);
}

function setupPriceChartingCache_(ss) {
  var sheet = ss.getSheetByName(PSM.SHEETS.PC_CACHE) || ss.insertSheet(PSM.SHEETS.PC_CACHE);
  if (!sheet.getRange("A1").getValue()) writePriceChartingCacheHeader_(sheet);
}

function writePriceChartingCacheHeader_(sheet) {
  var headers = ["PriceCharting ID", "PriceCharting URL", "Nombre PC", "Expansion PC", "Numero", "Loose USD", "Imagen URL", "Actualizado", "Raw"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function setupEcommerce_(ss) {
  var sheet = ss.getSheetByName(PSM.SHEETS.ECOMMERCE) || ss.insertSheet(PSM.SHEETS.ECOMMERCE);
  if (!sheet.getRange("A1").getValue()) {
    sheet.getRange("A1:K1").setValues([["SKU", "Titulo", "Descripcion", "Precio", "Stock", "Imagen", "Categoria", "Tags", "PriceCharting URL", "TCGplayer URL", "Ubicacion interna"]]);
  }
  sheet.getRange("A1:K1").setFontWeight("bold").setBackground("#0f766e").setFontColor("#ffffff");
}

function setupLog_(ss) {
  var sheet = ss.getSheetByName(PSM.SHEETS.LOG) || ss.insertSheet(PSM.SHEETS.LOG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:C1").setValues([["Fecha", "Origen", "Mensaje"]]);
  sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#7f1d1d").setFontColor("#ffffff");
}

function setStockValidations_(sheet) {
  var idiomas = SpreadsheetApp.newDataValidation().requireValueInList(["EN", "JP", "ES", "KR", "CN", "OTRO"], true).setAllowInvalid(true).build();
  var condiciones = SpreadsheetApp.newDataValidation().requireValueInList(["NM", "LP", "MP", "HP", "DMG"], true).setAllowInvalid(true).build();
  var ubicaciones = SpreadsheetApp.newDataValidation().requireValueInList(["Bulk", "Carpeta naranja", "Carpeta celeste", "Carpeta violeta"], true).setAllowInvalid(true).build();
  sheet.getRange(2, PSM.STOCK_COL.IDIOMA, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(idiomas);
  sheet.getRange(2, PSM.STOCK_COL.CONDICION, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(condiciones);
  sheet.getRange(2, PSM.STOCK_COL.UBICACION, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(ubicaciones);
}

function appendMissingConfig_(sheet, defaults) {
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) if (values[i][0]) existing[String(values[i][0])] = true;
  }
  var append = defaults.filter(function(row) { return !existing[row[0]]; });
  if (append.length) sheet.getRange(sheet.getLastRow() + 1, 1, append.length, 2).setValues(append);
}

function updateConfigValue_(key, value) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSM.SHEETS.CONFIG);
  if (!sheet) return;
  var values = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function readConfig_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSM.SHEETS.CONFIG);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) if (values[i][0]) out[String(values[i][0])] = values[i][1];
  return out;
}

function getPriceChartingToken_() {
  return PropertiesService.getScriptProperties().getProperty(PSM.PROP.PC_TOKEN);
}

function getCsvValue_(row, idx, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = normalizeHeader_(keys[i]);
    if (idx[key] !== undefined) return row[idx[key]];
  }
  return "";
}

function normalizeHeader_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function extractPriceChartingIdFromUrl_(url) {
  var idMatch = String(url || "").match(/[?&]id=(\d+)/i);
  return idMatch ? idMatch[1] : "";
}

function buildSku_(pcId) {
  return "PKM-PC-" + pcId;
}

function canonicalPriceChartingUrl_(url) {
  var text = normalizeUrl_(url);
  if (!text) return "";
  text = text.replace(/^http:\/\//i, "https://");
  text = text.split("#")[0].split("?")[0];
  return text.replace(/\/+$/g, "").toLowerCase();
}

function fetchPriceChartingImageUrl_(url) {
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Mozilla/5.0 PokemonSinglesStockMaster/1.0" }
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("HTTP " + status);
  }
  var html = response.getContentText();
  var match = html.match(/https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'<>\s]+\/1600\.jpg/i);
  return match ? match[0] : "";
}

function buildTitle_(row) {
  var parts = [row[PSM.STOCK_COL.NOMBRE - 1], row[PSM.STOCK_COL.EXPANSION - 1]];
  if (row[PSM.STOCK_COL.NUMERO - 1]) parts.push("#" + row[PSM.STOCK_COL.NUMERO - 1]);
  if (row[PSM.STOCK_COL.CONDICION - 1]) parts.push(row[PSM.STOCK_COL.CONDICION - 1]);
  return parts.filter(Boolean).join(" - ");
}

function buildDescription_(row) {
  return [
    buildTitle_(row),
    "Idioma: " + (row[PSM.STOCK_COL.IDIOMA - 1] || ""),
    "Condicion: " + (row[PSM.STOCK_COL.CONDICION - 1] || "")
  ].join("\n");
}

function buildTags_(row) {
  return ["pokemon", "single", row[PSM.STOCK_COL.EXPANSION - 1], row[PSM.STOCK_COL.IDIOMA - 1], row[PSM.STOCK_COL.CONDICION - 1]].filter(Boolean).join(",");
}

function buildTcgplayerSearchUrl_(name, expansion, number) {
  var query = [name, expansion, number].filter(Boolean).join(" ");
  return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=" + encodeURIComponent(query);
}

function roundPrice_(value, roundTo, minPrice) {
  var rounded = Math.ceil(value / roundTo) * roundTo;
  return Math.max(minPrice, rounded);
}

function parseNameAndNumber_(name) {
  var text = String(name || "").trim();
  var match = text.match(/^(.*)\s+#([^#]+)$/);
  return match ? { name: match[1].trim(), number: match[2].trim() } : { name: text, number: "" };
}

function cleanExpansion_(expansion) {
  return decodeHtml_(String(expansion || "")).replace(/^Pokemon\s+/i, "").trim();
}

function decodeHtml_(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ");
}

function slug_(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeUrl_(value) {
  var text = String(value || "").trim();
  var match = text.match(/https?:\/\/[^\s\])]+/i);
  return match ? match[0] : text;
}

function log_(origin, message) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSM.SHEETS.LOG);
  if (sheet) sheet.appendRow([new Date(), origin, message]);
}
