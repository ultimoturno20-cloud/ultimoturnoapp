// ============================================================
// PriceCharting Cache Master
// Standalone spreadsheet used as a daily full cache for Pokemon CSV.
// Other spreadsheets read this cache by spreadsheet ID.
// ============================================================

var PCC = {
  SHEETS: {
    CONFIG: "Config",
    CACHE: "PriceCharting Cache",
    LOG: "Log"
  },
  PROP: {
    TOKEN: "PRICECHARTING_TOKEN",
    RATE_LIMIT_UNTIL_MS: "PCC_RATE_LIMIT_UNTIL_MS"
  },
  COL: {
    PC_ID: 1,
    CANONICAL_URL: 2,
    PC_URL: 3,
    NOMBRE_PC: 4,
    NOMBRE_LIMPIO: 5,
    EXPANSION_PC: 6,
    EXPANSION_LIMPIA: 7,
    NUMERO: 8,
    LOOSE_USD: 9,
    IMAGEN_URL: 10,
    UPDATED_AT: 11,
    SEARCH_KEY: 12
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PriceCharting Cache")
    .addItem("Crear / reparar estructura", "setupPriceChartingCacheMaster")
    .addItem("Configurar token", "promptSetPriceChartingCacheToken")
    .addSeparator()
    .addItem("Actualizar cache ahora", "refreshFullPriceChartingCache")
    .addItem("Diagnosticar columnas CSV", "diagnosePriceChartingCsvColumns")
    .addItem("Activar trigger diario", "setupDailyPriceChartingCacheTrigger")
    .addItem("Desactivar triggers", "removePriceChartingCacheTriggers")
    .addToUi();
}

function setupPriceChartingCacheMaster() {
  ensurePriceChartingCacheMaster_();
  SpreadsheetApp.getUi().alert("PriceCharting Cache listo.");
}

function ensurePriceChartingCacheMaster_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPccConfig_(ss);
  setupPccCache_(ss);
  setupPccLog_(ss);
}

function promptSetPriceChartingCacheToken() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "PriceCharting token",
    "Pega tu token. Se guarda en Script Properties, no en la hoja.",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  var token = String(response.getResponseText() || "").trim();
  if (!token) {
    ui.alert("Token vacio.");
    return;
  }

  PropertiesService.getScriptProperties().setProperty(PCC.PROP.TOKEN, token);
  ui.alert("Token guardado.");
}

function setupDailyPriceChartingCacheTrigger() {
  removePriceChartingCacheTriggers(false);
  ScriptApp.newTrigger("refreshFullPriceChartingCache")
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();
  SpreadsheetApp.getUi().alert("Trigger diario activado para las 6 AM.");
}

function removePriceChartingCacheTriggers(showAlert) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "refreshFullPriceChartingCache") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  if (showAlert !== false) SpreadsheetApp.getUi().alert("Triggers desactivados.");
}

function refreshFullPriceChartingCache() {
  var token = PropertiesService.getScriptProperties().getProperty(PCC.PROP.TOKEN);
  if (!token) throw new Error("Falta configurar PriceCharting token.");

  ensurePriceChartingCacheMaster_();
  var config = readPccConfig_();
  var cooldown = getPccRateLimitCooldown_();
  if (cooldown.active) {
    throw new Error("PriceCharting en cooldown hasta " + cooldown.until + ". Espera y reintenta despues.");
  }

  var category = String(config.pricecharting_category || "pokemon-cards").trim();
  var url = "https://www.pricecharting.com/price-guide/download-custom?t=" +
    encodeURIComponent(token) + "&category=" + encodeURIComponent(category);

  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Mozilla/5.0 PriceChartingCacheMaster/2.0" }
  });

  var status = response.getResponseCode();
  if (status === 429) {
    var until = setPccRateLimitCooldown_(config);
    logPcc_("PriceCharting CSV", "HTTP 429. Cooldown hasta " + until);
    throw new Error("PriceCharting CSV HTTP 429. Cooldown hasta " + until + ".");
  }
  if (status < 200 || status >= 300) {
    throw new Error("PriceCharting CSV HTTP " + status);
  }

  var rows = Utilities.parseCsv(response.getContentText());
  if (!rows || rows.length < 2) throw new Error("CSV vacio o invalido.");

  var imported = importFullPriceChartingRows_(rows, config);
  updatePccConfigValue_("last_update", new Date());
  logPcc_("PriceCharting CSV", "Filas importadas: " + imported);
  return imported;
}

function diagnosePriceChartingCsvColumns() {
  var token = PropertiesService.getScriptProperties().getProperty(PCC.PROP.TOKEN);
  if (!token) throw new Error("Falta configurar PriceCharting token.");

  ensurePriceChartingCacheMaster_();
  var config = readPccConfig_();
  var cooldown = getPccRateLimitCooldown_();
  if (cooldown.active) {
    throw new Error("PriceCharting en cooldown hasta " + cooldown.until + ". Espera y reintenta despues.");
  }

  var category = String(config.pricecharting_category || "pokemon-cards").trim();
  var url = "https://www.pricecharting.com/price-guide/download-custom?t=" +
    encodeURIComponent(token) + "&category=" + encodeURIComponent(category);

  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Mozilla/5.0 PriceChartingCacheMaster/2.0" }
  });

  var status = response.getResponseCode();
  if (status === 429) {
    var until = setPccRateLimitCooldown_(config);
    logPcc_("Diagnostico CSV", "HTTP 429. Cooldown hasta " + until);
    throw new Error("PriceCharting CSV HTTP 429. Cooldown hasta " + until + ".");
  }
  if (status < 200 || status >= 300) throw new Error("PriceCharting CSV HTTP " + status);

  var rows = Utilities.parseCsv(response.getContentText());
  if (!rows || rows.length < 2) throw new Error("CSV vacio o invalido.");

  var rawHeaders = rows[0];
  var normalized = rawHeaders.map(normalizePccHeader_);
  var idx = {};
  for (var i = 0; i < normalized.length; i++) idx[normalized[i]] = i;

  var sample = rows[1] || [];
  var looseRaw = getPccCsvValue_(sample, idx, ["loose-price", "loose", "used-price", "used", "ungraded-price", "ungraded"]);
  var imageRaw = getPccCsvValue_(sample, idx, ["image-url", "image", "photo-url", "thumbnail", "image"]);
  var message = [
    "Headers originales: " + rawHeaders.join(" | "),
    "Headers normalizados: " + normalized.join(" | "),
    "Loose raw muestra: " + looseRaw,
    "Loose USD parseado: " + parsePccPriceUsd_(looseRaw),
    "Imagen raw muestra: " + imageRaw
  ].join("\n");

  logPcc_("Diagnostico CSV", message);
  SpreadsheetApp.getUi().alert("Diagnostico CSV", message.slice(0, 1800), SpreadsheetApp.getUi().ButtonSet.OK);
}

function importFullPriceChartingRows_(rows, config) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCC.SHEETS.CACHE);
  var headers = rows[0].map(normalizePccHeader_);
  var idx = {};
  for (var i = 0; i < headers.length; i++) idx[headers[i]] = i;

  var now = new Date();
  var output = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    var id = getPccCsvValue_(row, idx, ["id", "product-id"]);
    var namePc = decodePccHtml_(getPccCsvValue_(row, idx, ["product-name", "name"]));
    var expansionPc = decodePccHtml_(getPccCsvValue_(row, idx, ["console-name", "set-name"]));
    if (!id || !namePc) continue;

    var parsed = parsePccNameAndNumber_(namePc);
    var expansionClean = cleanPccExpansion_(expansionPc);
    var pcUrl = getPccCsvValue_(row, idx, ["url", "product-url", "pricecharting-url"]);
    if (!pcUrl) pcUrl = "https://www.pricecharting.com/game/" + slugPccPriceChartingPath_(expansionPc) + "/" + slugPccPriceChartingPath_(namePc);
    var canonicalUrl = canonicalPccUrl_(pcUrl);
    var looseUsd = parsePccPriceUsd_(getPccCsvValue_(row, idx, [
      "loose-price",
      "loose",
      "used-price",
      "used",
      "ungraded-price",
      "ungraded",
      "ungrounded-price"
    ]));
    var imageUrl = getPccCsvValue_(row, idx, ["image-url", "image", "photo-url", "thumbnail-url", "thumbnail"]);

    output.push([
      String(id),
      canonicalUrl,
      pcUrl,
      namePc,
      parsed.name,
      expansionPc,
      expansionClean,
      parsed.number,
      looseUsd,
      imageUrl,
      now,
      buildPccSearchKey_(parsed.name, expansionClean, parsed.number)
    ]);
  }

  sheet.clear({ contentsOnly: true });
  writePccCacheHeader_(sheet);
  writePccRowsInChunks_(sheet, output, Number((config || {}).write_chunk_size || 1000));
  if (output.length) {
    sheet.getRange(2, PCC.COL.LOOSE_USD, output.length, 1).setNumberFormat("0.00");
    sheet.getRange(2, PCC.COL.UPDATED_AT, output.length, 1).setNumberFormat("yyyy-mm-dd hh:mm");
  }
  return output.length;
}

function writePccRowsInChunks_(sheet, rows, chunkSize) {
  if (!rows.length) return;
  for (var start = 0; start < rows.length; start += chunkSize) {
    var chunk = rows.slice(start, start + chunkSize);
    sheet.getRange(start + 2, 1, chunk.length, chunk[0].length).setValues(chunk);
  }
}

function setupPccConfig_(ss) {
  var sheet = ss.getSheetByName(PCC.SHEETS.CONFIG) || ss.insertSheet(PCC.SHEETS.CONFIG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:B1").setValues([["Clave", "Valor"]]);
  appendMissingPccConfig_(sheet, [
    ["pricecharting_category", "pokemon-cards"],
    ["last_update", ""],
    ["write_chunk_size", 1000],
    ["rate_limit_cooldown_min", 60]
  ]);
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#263238").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 240);
}

function setupPccCache_(ss) {
  var sheet = ss.getSheetByName(PCC.SHEETS.CACHE) || ss.insertSheet(PCC.SHEETS.CACHE);
  if (!sheet.getRange("A1").getValue()) writePccCacheHeader_(sheet);
  sheet.setFrozenRows(1);
}

function writePccCacheHeader_(sheet) {
  var headers = [
    "PriceCharting ID",
    "Canonical URL",
    "PriceCharting URL",
    "Nombre PC",
    "Nombre limpio",
    "Expansion PC",
    "Expansion limpia",
    "Numero",
    "Loose USD",
    "Imagen URL",
    "Actualizado",
    "Search key"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
}

function setupPccLog_(ss) {
  var sheet = ss.getSheetByName(PCC.SHEETS.LOG) || ss.insertSheet(PCC.SHEETS.LOG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:C1").setValues([["Fecha", "Origen", "Mensaje"]]);
  sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#7f1d1d").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function appendMissingPccConfig_(sheet, defaults) {
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) if (values[i][0]) existing[String(values[i][0])] = true;
  }
  var append = defaults.filter(function(row) { return !existing[row[0]]; });
  if (append.length) sheet.getRange(sheet.getLastRow() + 1, 1, append.length, 2).setValues(append);
}

function readPccConfig_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PCC.SHEETS.CONFIG);
  var config = {};
  if (!sheet || sheet.getLastRow() < 2) return config;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) if (values[i][0]) config[String(values[i][0])] = values[i][1];
  return config;
}

function updatePccConfigValue_(key, value) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PCC.SHEETS.CONFIG);
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

function getPccRateLimitCooldown_() {
  var props = PropertiesService.getScriptProperties();
  var untilMs = Number(props.getProperty(PCC.PROP.RATE_LIMIT_UNTIL_MS) || 0);
  var nowMs = new Date().getTime();
  if (untilMs && untilMs > nowMs) {
    return {
      active: true,
      until: Utilities.formatDate(new Date(untilMs), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
    };
  }
  if (untilMs) props.deleteProperty(PCC.PROP.RATE_LIMIT_UNTIL_MS);
  return { active: false, until: "" };
}

function setPccRateLimitCooldown_(config) {
  var minutes = Number((config || {}).rate_limit_cooldown_min || 60);
  var untilMs = new Date().getTime() + (minutes * 60 * 1000);
  PropertiesService.getScriptProperties().setProperty(PCC.PROP.RATE_LIMIT_UNTIL_MS, String(untilMs));
  return Utilities.formatDate(new Date(untilMs), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function getPccCsvValue_(row, idx, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = normalizePccHeader_(keys[i]);
    if (idx[key] !== undefined) return row[idx[key]];
  }
  return "";
}

function parsePccPriceUsd_(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value === "number") {
    return value > 50 && Math.floor(value) === value ? value / 100 : value;
  }

  var raw = String(value || "").trim();
  if (!raw) return "";
  var hasDecimal = /[.,]\d{1,2}$/.test(raw);
  var hasCurrency = /[$]/.test(raw);
  var cleaned = raw.replace(/[^\d.,-]/g, "");

  if (cleaned.indexOf(",") >= 0 && cleaned.indexOf(".") >= 0) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.indexOf(",") >= 0) {
    cleaned = cleaned.replace(",", ".");
  }

  var number = Number(cleaned);
  if (isNaN(number) || number <= 0) return "";

  // PriceCharting CSV often exports prices as cents, e.g. 499 = USD 4.99.
  // If the value clearly has currency/decimal formatting, keep it as dollars.
  if (!hasCurrency && !hasDecimal && Math.floor(number) === number) return number / 100;
  return number;
}

function normalizePccHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalPccUrl_(url) {
  var text = normalizePccUrl_(url);
  if (!text) return "";
  text = text.replace(/^http:\/\//i, "https://").split("#")[0].split("?")[0].replace(/\/+$/g, "").toLowerCase();
  var match = text.match(/^(https:\/\/www\.pricecharting\.com\/game\/)([^\/]+)\/([^\/]+)$/i);
  if (match) {
    return match[1].toLowerCase() + slugPcc_(decodeURIComponentSafePcc_(match[2])) + "/" + slugPcc_(decodeURIComponentSafePcc_(match[3]));
  }
  return text;
}

function normalizePccUrl_(value) {
  var text = String(value || "").trim();
  var match = text.match(/https?:\/\/[^\s\])]+/i);
  return match ? match[0] : text;
}

function decodeURIComponentSafePcc_(text) {
  try {
    return decodeURIComponent(String(text || ""));
  } catch (err) {
    return String(text || "");
  }
}

function parsePccNameAndNumber_(name) {
  var text = decodePccHtml_(String(name || "").trim());
  var match = text.match(/^(.*)\s+#([^#]+)$/);
  return match ? { name: match[1].trim(), number: match[2].trim() } : { name: text, number: "" };
}

function cleanPccExpansion_(expansion) {
  return decodePccHtml_(String(expansion || "")).replace(/^Pokemon\s+/i, "").trim();
}

function buildPccSearchKey_(name, expansion, number) {
  return [name, expansion, number].filter(Boolean).join(" ").toLowerCase();
}

function decodePccHtml_(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ");
}

function slugPcc_(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugPccPriceChartingPath_(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['\u2019]/g, "%27")
    .replace(/[^a-z0-9%]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function logPcc_(origin, message) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PCC.SHEETS.LOG);
  if (sheet) sheet.appendRow([new Date(), origin, message]);
}
