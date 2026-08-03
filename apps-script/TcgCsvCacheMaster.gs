// ============================================================
// TCGCSV Cache Master
// Standalone spreadsheet used as a daily cache for TCGplayer Pokemon
// product + market price data from https://tcgcsv.com.
// Other spreadsheets read this cache by spreadsheet ID.
// ============================================================

var TCC = {
  SHEETS: {
    CONFIG: "Config",
    CACHE: "TCGplayer Cache",
    LOG: "Log"
  },
  COL: {
    PRODUCT_ID: 1,
    GROUP_ID: 2,
    GROUP_NAME: 3,
    GROUP_ABBREV: 4,
    PRODUCT_NAME: 5,
    CLEAN_NAME: 6,
    NUMBER: 7,
    NUMBER_KEY: 8,
    RARITY: 9,
    SUBTYPE: 10,
    MARKET_USD: 11,
    LOW_USD: 12,
    MID_USD: 13,
    HIGH_USD: 14,
    DIRECT_LOW_USD: 15,
    TCGPLAYER_URL: 16,
    IMAGE_URL: 17,
    UPDATED_AT: 18,
    MATCH_KEY: 19,
    NAME_NUMBER_KEY: 20,
    SOURCE_UPDATED_AT: 21
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TCGplayer Cache")
    .addItem("Crear / reparar estructura", "setupTcgCsvCacheMaster")
    .addSeparator()
    .addItem("Actualizar cache ahora", "refreshFullTcgCsvCache")
    .addItem("Forzar actualizacion completa", "forceRefreshFullTcgCsvCache")
    .addItem("Diagnosticar TCGCSV", "diagnoseTcgCsv")
    .addSeparator()
    .addItem("Activar trigger diario", "setupDailyTcgCsvCacheTrigger")
    .addItem("Desactivar triggers", "removeTcgCsvCacheTriggers")
    .addToUi();
}

function setupTcgCsvCacheMaster() {
  ensureTcgCsvCacheMaster_();
  SpreadsheetApp.getUi().alert("TCGplayer Cache listo.");
}

function setupDailyTcgCsvCacheTrigger() {
  removeTcgCsvCacheTriggers(false);
  ScriptApp.newTrigger("refreshFullTcgCsvCache")
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();
  SpreadsheetApp.getUi().alert("Trigger diario activado para las 7 AM.");
}

function removeTcgCsvCacheTriggers(showAlert) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "refreshFullTcgCsvCache") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  if (showAlert !== false) SpreadsheetApp.getUi().alert("Triggers desactivados.");
}

function forceRefreshFullTcgCsvCache() {
  return refreshFullTcgCsvCache({ force: true });
}

function refreshFullTcgCsvCache(options) {
  options = options || {};
  ensureTcgCsvCacheMaster_();

  var config = readTccConfig_();
  var remoteUpdatedAt = fetchTccText_("https://tcgcsv.com/last-updated.txt").trim();
  var lastRemote = String(config.last_remote_update || "").trim();
  if (!options.force && remoteUpdatedAt && lastRemote === remoteUpdatedAt) {
    logTcc_("TCGCSV", "Sin cambios. Remote update: " + remoteUpdatedAt);
    return 0;
  }

  var categoryId = Number(config.category_id || 3);
  var requestDelayMs = Math.max(100, Number(config.request_delay_ms || 150));
  var writeChunkSize = Math.max(100, Number(config.write_chunk_size || 1000));
  var groupsPayload = fetchTccJson_("https://tcgcsv.com/tcgplayer/" + categoryId + "/groups");
  var groups = (groupsPayload && groupsPayload.results) || [];
  var now = new Date();
  var output = [];

  for (var i = 0; i < groups.length; i++) {
    var group = groups[i] || {};
    var groupId = Number(group.groupId || 0);
    if (!groupId) continue;

    try {
      var productsPayload = fetchTccJson_("https://tcgcsv.com/tcgplayer/" + categoryId + "/" + groupId + "/products");
      Utilities.sleep(requestDelayMs);
      var pricesPayload = fetchTccJson_("https://tcgcsv.com/tcgplayer/" + categoryId + "/" + groupId + "/prices");
      Utilities.sleep(requestDelayMs);

      var priceMap = groupTccPricesByProduct_((pricesPayload && pricesPayload.results) || []);
      var products = (productsPayload && productsPayload.results) || [];
      for (var p = 0; p < products.length; p++) {
        var rows = buildTccRowsForProduct_(products[p], group, priceMap, now, remoteUpdatedAt);
        for (var r = 0; r < rows.length; r++) output.push(rows[r]);
      }
      logTcc_("Grupo", "OK " + groupId + " " + group.name + " productos=" + products.length + " filas=" + output.length);
    } catch (err) {
      logTcc_("Grupo ERROR", groupId + " " + group.name + ": " + String(err && err.message ? err.message : err));
    }
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TCC.SHEETS.CACHE);
  sheet.clear({ contentsOnly: true });
  writeTccCacheHeader_(sheet);
  writeTccRowsInChunks_(sheet, output, writeChunkSize);
  if (output.length) {
    sheet.getRange(2, TCC.COL.MARKET_USD, output.length, 5).setNumberFormat("0.00");
    sheet.getRange(2, TCC.COL.UPDATED_AT, output.length, 1).setNumberFormat("yyyy-mm-dd hh:mm");
  }

  updateTccConfigValue_("last_remote_update", remoteUpdatedAt);
  updateTccConfigValue_("last_success_update", now);
  updateTccConfigValue_("last_rows", output.length);
  logTcc_("TCGCSV", "Filas importadas: " + output.length + ". Remote update: " + remoteUpdatedAt);
  return output.length;
}

function diagnoseTcgCsv() {
  ensureTcgCsvCacheMaster_();
  var config = readTccConfig_();
  var categoryId = Number(config.category_id || 3);
  var remoteUpdatedAt = fetchTccText_("https://tcgcsv.com/last-updated.txt").trim();
  var groupsPayload = fetchTccJson_("https://tcgcsv.com/tcgplayer/" + categoryId + "/groups");
  var groups = (groupsPayload && groupsPayload.results) || [];
  var sampleGroup = groups.length ? groups[0] : {};
  var message = [
    "Remote updated: " + remoteUpdatedAt,
    "Category ID: " + categoryId,
    "Grupos Pokemon: " + groups.length,
    "Primer grupo: " + (sampleGroup.groupId || "") + " | " + (sampleGroup.name || ""),
    "Cache actual filas: " + Math.max(0, SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TCC.SHEETS.CACHE).getLastRow() - 1)
  ].join("\n");
  logTcc_("Diagnostico", message);
  SpreadsheetApp.getUi().alert("Diagnostico TCGCSV", message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function ensureTcgCsvCacheMaster_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupTccConfig_(ss);
  setupTccCache_(ss);
  setupTccLog_(ss);
}

function setupTccConfig_(ss) {
  var sheet = ss.getSheetByName(TCC.SHEETS.CONFIG) || ss.insertSheet(TCC.SHEETS.CONFIG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:B1").setValues([["Clave", "Valor"]]);
  appendMissingTccConfig_(sheet, [
    ["category_id", 3],
    ["last_remote_update", ""],
    ["last_success_update", ""],
    ["last_rows", ""],
    ["request_delay_ms", 150],
    ["write_chunk_size", 1000]
  ]);
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#7f1d1d").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 260);
}

function setupTccCache_(ss) {
  var sheet = ss.getSheetByName(TCC.SHEETS.CACHE) || ss.insertSheet(TCC.SHEETS.CACHE);
  if (!sheet.getRange("A1").getValue()) writeTccCacheHeader_(sheet);
  sheet.setFrozenRows(1);
}

function setupTccLog_(ss) {
  var sheet = ss.getSheetByName(TCC.SHEETS.LOG) || ss.insertSheet(TCC.SHEETS.LOG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:C1").setValues([["Fecha", "Origen", "Mensaje"]]);
  sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#7f1d1d").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
}

function writeTccCacheHeader_(sheet) {
  var headers = [
    "TCGplayer Product ID",
    "Group ID",
    "Group Name",
    "Group Abbrev",
    "Product Name",
    "Clean Name",
    "Number",
    "Number Key",
    "Rarity",
    "Subtype",
    "Market USD",
    "Low USD",
    "Mid USD",
    "High USD",
    "Direct Low USD",
    "TCGplayer URL",
    "Image URL",
    "Updated At",
    "Match Key",
    "Name Number Key",
    "Source Updated At"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1f2933").setFontColor("#ffffff");
  sheet.setColumnWidth(TCC.COL.TCGPLAYER_URL, 360);
  sheet.setColumnWidth(TCC.COL.IMAGE_URL, 360);
}

function buildTccRowsForProduct_(product, group, priceMap, now, remoteUpdatedAt) {
  product = product || {};
  var extended = tccExtendedDataMap_(product.extendedData || []);
  var number = String(extended.Number || extended["Card Number"] || "").trim();
  var rarity = String(extended.Rarity || "").trim();
  if (!number || !rarity) return [];

  var productId = String(product.productId || "").trim();
  var prices = priceMap[productId] || [];
  if (!prices.length) prices = [{ subTypeName: "Product" }];

  var rows = [];
  for (var i = 0; i < prices.length; i++) {
    var price = prices[i] || {};
    var subtype = String(price.subTypeName || "Product").trim();
    rows.push([
      productId,
      group.groupId || "",
      group.name || "",
      group.abbreviation || "",
      product.name || "",
      product.cleanName || "",
      number,
      normalizeTccCardNumber_(number),
      rarity,
      subtype,
      numberOrBlankTcc_(price.marketPrice),
      numberOrBlankTcc_(price.lowPrice),
      numberOrBlankTcc_(price.midPrice),
      numberOrBlankTcc_(price.highPrice),
      numberOrBlankTcc_(price.directLowPrice),
      product.url || "",
      upgradeTccImageUrl_(product.imageUrl || ""),
      now,
      buildTccMatchKey_(product.name || product.cleanName || "", group.name || "", number),
      buildTccNameNumberKey_(product.name || product.cleanName || "", number),
      remoteUpdatedAt || ""
    ]);
  }
  return rows;
}

function groupTccPricesByProduct_(prices) {
  var out = {};
  for (var i = 0; i < prices.length; i++) {
    var price = prices[i] || {};
    var productId = String(price.productId || "").trim();
    if (!productId) continue;
    if (!out[productId]) out[productId] = [];
    out[productId].push(price);
  }
  return out;
}

function tccExtendedDataMap_(extendedData) {
  var out = {};
  for (var i = 0; i < extendedData.length; i++) {
    var item = extendedData[i] || {};
    if (item.name) out[item.name] = item.value;
    if (item.displayName) out[item.displayName] = item.value;
  }
  return out;
}

function fetchTccJson_(url) {
  return JSON.parse(fetchTccText_(url));
}

function fetchTccText_(url) {
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "UltimoTurnoTCGCSVCache/1.0" }
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error("TCGCSV HTTP " + status + " en " + url);
  return response.getContentText();
}

function writeTccRowsInChunks_(sheet, rows, chunkSize) {
  if (!rows.length) return;
  for (var start = 0; start < rows.length; start += chunkSize) {
    var chunk = rows.slice(start, start + chunkSize);
    sheet.getRange(start + 2, 1, chunk.length, chunk[0].length).setValues(chunk);
  }
}

function appendMissingTccConfig_(sheet, defaults) {
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) if (values[i][0]) existing[String(values[i][0])] = true;
  }
  var append = defaults.filter(function(row) { return !existing[row[0]]; });
  if (append.length) sheet.getRange(sheet.getLastRow() + 1, 1, append.length, 2).setValues(append);
}

function readTccConfig_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TCC.SHEETS.CONFIG);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) if (values[i][0]) out[String(values[i][0])] = values[i][1];
  return out;
}

function updateTccConfigValue_(key, value) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TCC.SHEETS.CONFIG);
  var values = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function buildTccMatchKey_(name, expansion, number) {
  return [normalizeTccMatchText_(name), normalizeTccExpansion_(expansion), normalizeTccCardNumber_(number)].join("|");
}

function buildTccNameNumberKey_(name, number) {
  return [normalizeTccMatchText_(name), normalizeTccCardNumber_(number)].join("|");
}

function normalizeTccExpansion_(value) {
  return normalizeTccMatchText_(value)
    .replace(/\bpokemon\b/g, "")
    .replace(/\bsv\b/g, "")
    .replace(/\bsword shield\b/g, "")
    .replace(/\bscarlet violet\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTccMatchText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTccCardNumber_(value) {
  var text = String(value || "").trim();
  if (text.indexOf("/") >= 0) text = text.split("/")[0];
  text = text.toLowerCase().replace(/^#/, "").trim();
  if (/^\d+$/.test(text)) return String(Number(text));
  return text.replace(/[^a-z0-9]+/g, "");
}

function upgradeTccImageUrl_(url) {
  return String(url || "").replace(/_200w(?=\.)/i, "_in_1000x1000");
}

function numberOrBlankTcc_(value) {
  var number = Number(value);
  return isNaN(number) ? "" : number;
}

function logTcc_(origin, message) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TCC.SHEETS.LOG);
  if (sheet) sheet.appendRow([new Date(), origin, message]);
}
