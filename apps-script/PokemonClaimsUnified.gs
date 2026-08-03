// ============================================================
// Pokemon Claims Unified
// One-sheet workflow for PriceCharting data, image URLs, claims,
// and automatic 30-card preview grids.
// ============================================================

var PCU = {
  SHEETS: {
    CONFIG: "Config",
    CARDS: "Cartas",
    CLAIMS: "Claims",
    GRID_LOG: "Grid Log",
    ERROR_LOG: "Log"
  },
  COL: {
    ID: 1,
    FECHA_CARGA: 2,
    PC_URL: 3,
    NOMBRE_PC: 4,
    NOMBRE_LIMPIO: 5,
    EXPANSION_PC: 6,
    EXPANSION_LIMPIA: 7,
    NUMERO: 8,
    USD: 9,
    ARS_CALCULADO: 10,
    ARS_REDONDEADO: 11,
    PRECIO_FINAL: 12,
    UNIDADES: 13,
    IMAGEN_URL: 14,
    MENSAJE: 15,
    COMPRADOR: 16,
    ESTADO: 17,
    GRID_LOTE: 18,
    ACTUALIZADO: 19,
    ERROR: 20,
    CLAIM_LOTE: 21,
    CLAIM_URL: 22
  },
  CONFIG_KEYS: {
    USD_ARS: "usd_ars",
    ROUND_TO: "round_to",
    MIN_PRICE: "min_price",
    GRID_SIZE: "grid_size",
    GRID_COLUMNS: "grid_columns",
    GRID_ROWS: "grid_rows",
    GRID_FOLDER: "grid_folder_name",
    CLAIM_FOLDER: "claim_folder_name",
    KEEP_SLIDES: "keep_source_slides",
    PROCESS_BATCH_SIZE: "process_batch_size",
    FETCH_DELAY_MS: "fetch_delay_ms",
    RATE_LIMIT_COOLDOWN_MIN: "rate_limit_cooldown_min",
    PROCESSING_STALE_MIN: "processing_stale_min",
    INSTANT_PROCESS_LIMIT: "instant_process_limit",
    INSTANT_FETCH_DELAY_MS: "instant_fetch_delay_ms"
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Pokemon Claims")
    .addItem("Crear / reparar estructura", "setupPokemonClaims")
    .addSeparator()
    .addItem("Procesar pendientes ahora", "processPendingCards")
    .addItem("Destrabar procesando", "resetStuckProcessingRows")
    .addItem("Generar grid pendiente ahora", "promptExportReadyGrid")
    .addItem("Generar claim", "promptGenerateClaim")
    .addSeparator()
    .addItem("Activar triggers", "setupPokemonClaimsTriggers")
    .addItem("Desactivar triggers", "removePokemonClaimsTriggers")
    .addToUi();
}

function setupPokemonClaims() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupConfigSheet_(ss);
  setupCardsSheet_(ss);
  setupClaimsSheet_(ss);
  setupGridLogSheet_(ss);
  setupErrorLogSheet_(ss);
  SpreadsheetApp.getUi().alert("Estructura creada/reparada.");
}

function setupPokemonClaimsTriggers() {
  removePokemonClaimsTriggers(false);
  var ss = SpreadsheetApp.getActive();

  ScriptApp.newTrigger("pokemonClaimsOnEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ScriptApp.newTrigger("processPendingCards")
    .timeBased()
    .everyMinutes(1)
    .create();

  SpreadsheetApp.getUi().alert("Triggers activados.");
}

function removePokemonClaimsTriggers(showAlert) {
  var handlers = {
    pokemonClaimsOnEdit: true,
    processPendingCards: true,
    generateReadyGrids: true
  };
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (handlers[triggers[i].getHandlerFunction()]) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  if (showAlert !== false) {
    SpreadsheetApp.getUi().alert("Triggers desactivados.");
  }
}

function pokemonClaimsOnEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  if (sheet.getName() !== PCU.SHEETS.CARDS) return;

  var startCol = e.range.getColumn();
  var endCol = startCol + e.range.getNumColumns() - 1;
  if (PCU.COL.PC_URL < startCol || PCU.COL.PC_URL > endCol) return;

  var startRow = e.range.getRow();
  var numRows = e.range.getNumRows();
  if (startRow < 2) {
    numRows = Math.max(0, numRows - (2 - startRow));
    startRow = 2;
  }
  if (numRows <= 0) return;

  queueRows_(sheet, startRow, numRows);

  var config = readConfig_();
  var instantLimit = Number(config.instant_process_limit || 8);

  // Keep small manual pastes feeling instant, but avoid freezing big pastes.
  if (numRows <= instantLimit) {
    clearRateLimitCooldown_();
    processPendingCards({
      maxRows: numRows,
      maxSeconds: 75,
      fetchDelayMs: Number(config.instant_fetch_delay_ms || 250),
      fastMode: true
    });
  }
}

function processPendingCards(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { processed: 0, message: "Otro proceso esta corriendo" };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(PCU.SHEETS.CARDS);
    if (!sheet) return { processed: 0, message: "No existe hoja Cartas" };

    var config = readConfig_();
    var cooldown = getRateLimitCooldown_();
    if (cooldown.active) {
      return {
        processed: 0,
        message: "Pausado por rate limit hasta " + cooldown.until
      };
    }

    resetStuckProcessingRows({ silent: true, config: config });

    var maxRows = Number(options.maxRows || config.process_batch_size || 12);
    var maxSeconds = Number(options.maxSeconds || 280);
    var fetchDelayMs = Number(
      options.fetchDelayMs !== undefined ? options.fetchDelayMs : (config.fetch_delay_ms || 2500)
    );
    var started = new Date().getTime();
    var rows = findPendingRows_(sheet, maxRows);
    var processed = 0;

    for (var i = 0; i < rows.length; i++) {
      var elapsed = (new Date().getTime() - started) / 1000;
      if (elapsed > maxSeconds) break;
      var result = processCardRow_(sheet, rows[i], config, {
        fastMode: !!options.fastMode
      });
      processed++;
      if (result && result.rateLimited) break;
      Utilities.sleep(fetchDelayMs);
    }

    return { processed: processed, remaining: Math.max(0, rows.length - processed) };
  } finally {
    lock.releaseLock();
  }
}

function generateReadyGrids() {
  return {
    generated: 0,
    message: "El grid automatico por Slides esta desactivado. Usar Pokemon Claims > Generar grid pendiente ahora."
  };
}

function promptExportReadyGrid() {
  var config = readConfig_();
  var columns = 5;
  var rows = 6;
  var exportConfig = {
    mode: "ready",
    columns: columns,
    rows: rows,
    canvasWidth: 1600,
    outerMargin: 0,
    cellGap: 0,
    backgroundColor: "#ffffff",
    outputFolderName: String(config.grid_folder_name || "Pokemon Claim Grids"),
    filePrefix: "grid-canvas"
  };

  var template = HtmlService.createTemplateFromFile("ImageGridExporterDialog");
  template.exportConfigJson = JSON.stringify(exportConfig);
  var html = template.evaluate().setWidth(480).setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, "Exportando grid PNG");
}

function resetStuckProcessingRows(options) {
  options = options || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.CARDS);
  if (!sheet) {
    if (!options.silent) SpreadsheetApp.getUi().alert("No existe hoja Cartas.");
    return { reset: 0 };
  }

  var config = options.config || readConfig_();
  var staleMin = Number(config.processing_stale_min || 8);
  var cutoffMs = new Date().getTime() - (staleMin * 60 * 1000);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { reset: 0 };

  var numRows = lastRow - 1;
  var states = sheet.getRange(2, PCU.COL.ESTADO, numRows, 1).getValues();
  var updated = sheet.getRange(2, PCU.COL.ACTUALIZADO, numRows, 1).getValues();
  var errors = sheet.getRange(2, PCU.COL.ERROR, numRows, 1).getValues();
  var reset = 0;

  for (var i = 0; i < numRows; i++) {
    var state = String(states[i][0] || "").trim();
    if (state !== "Procesando") continue;

    var startedAt = updated[i][0] instanceof Date ? updated[i][0].getTime() : 0;
    if (!startedAt || startedAt < cutoffMs) {
      states[i][0] = "Pendiente";
      errors[i][0] = "Reintentando: quedo trabada en Procesando";
      reset++;
    }
  }

  if (reset > 0) {
    sheet.getRange(2, PCU.COL.ESTADO, numRows, 1).setValues(states);
    sheet.getRange(2, PCU.COL.ERROR, numRows, 1).setValues(errors);
  }

  if (!options.silent) {
    SpreadsheetApp.getUi().alert("Filas destrabadas: " + reset);
  }
  return { reset: reset };
}

function promptGenerateClaim() {
  var ui = SpreadsheetApp.getUi();
  var namePrompt = ui.prompt(
    "Generar claim",
    "Nombre de la nueva planilla de claim. Ejemplo: Claim 20 de Julio",
    ui.ButtonSet.OK_CANCEL
  );
  if (namePrompt.getSelectedButton() !== ui.Button.OK) return;

  var claimName = String(namePrompt.getResponseText() || "").trim();
  if (!claimName) {
    ui.alert("Necesito un nombre para crear la planilla.");
    return;
  }

  var limitPrompt = ui.prompt(
    "Cantidad de cartas",
    "Cantidad maxima a incluir. Dejalo vacio para incluir todas las cartas listas sin claim.",
    ui.ButtonSet.OK_CANCEL
  );
  if (limitPrompt.getSelectedButton() !== ui.Button.OK) return;

  var limitText = String(limitPrompt.getResponseText() || "").trim();
  var limit = limitText ? Number(limitText) : 0;
  if (limitText && (!limit || limit < 1)) {
    ui.alert("La cantidad debe ser un numero mayor a 0, o vacio para incluir todas.");
    return;
  }

  var result = generateClaimSpreadsheet({
    claimName: claimName,
    limit: limit
  });

  if (!result || !result.success) {
    ui.alert("No se pudo generar el claim", result ? result.message : "Error desconocido", ui.ButtonSet.OK);
    return;
  }

  ui.alert(
    "Claim generado",
    "Planilla: " + result.url + "\nCartas incluidas: " + result.count,
    ui.ButtonSet.OK
  );
}

function generateClaimSpreadsheet(options) {
  options = options || {};
  var claimName = String(options.claimName || "").trim();
  if (!claimName) {
    return { success: false, message: "Falta claimName" };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cards = ss.getSheetByName(PCU.SHEETS.CARDS);
  if (!cards) {
    return { success: false, message: "No existe hoja Cartas" };
  }

  var config = readConfig_();
  var limit = Number(options.limit || 0);
  var rows = getReadyClaimRows_(cards, limit);
  if (!rows.length) {
    return {
      success: false,
      message: "No hay cartas listas sin claim. Necesitan Mensaje, Imagen URL y Claim lote vacio."
    };
  }

  var data = buildClaimRows_(cards, rows);
  var result = createClaimSpreadsheet_(claimName, data, config);
  markRowsWithClaim_(cards, rows, claimName, result.url);
  logClaim_(claimName, rows, result.url);

  return {
    success: true,
    claimName: claimName,
    count: rows.length,
    url: result.url,
    spreadsheetId: result.spreadsheetId
  };
}

function setupConfigSheet_(ss) {
  var sheet = ss.getSheetByName(PCU.SHEETS.CONFIG) || ss.insertSheet(PCU.SHEETS.CONFIG);
  var defaults = [
    [PCU.CONFIG_KEYS.USD_ARS, 1510],
    [PCU.CONFIG_KEYS.ROUND_TO, 500],
    [PCU.CONFIG_KEYS.MIN_PRICE, 800],
    [PCU.CONFIG_KEYS.GRID_SIZE, 30],
    [PCU.CONFIG_KEYS.GRID_COLUMNS, 5],
    [PCU.CONFIG_KEYS.GRID_ROWS, 6],
    [PCU.CONFIG_KEYS.GRID_FOLDER, "Pokemon Claim Grids"],
    [PCU.CONFIG_KEYS.CLAIM_FOLDER, "Pokemon Claims"],
    [PCU.CONFIG_KEYS.KEEP_SLIDES, false],
    [PCU.CONFIG_KEYS.PROCESS_BATCH_SIZE, 4],
    [PCU.CONFIG_KEYS.FETCH_DELAY_MS, 2500],
    [PCU.CONFIG_KEYS.RATE_LIMIT_COOLDOWN_MIN, 0.5],
    [PCU.CONFIG_KEYS.PROCESSING_STALE_MIN, 8],
    [PCU.CONFIG_KEYS.INSTANT_PROCESS_LIMIT, 8],
    [PCU.CONFIG_KEYS.INSTANT_FETCH_DELAY_MS, 250]
  ];

  if (sheet.getRange("A1").getValue() === "") {
    sheet.getRange("A1:B1").setValues([["Clave", "Valor"]]);
  }

  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      var key = String(values[i][0] || "").trim();
      if (key) existing[key] = true;
    }
  }

  var append = [];
  for (var d = 0; d < defaults.length; d++) {
    if (!existing[defaults[d][0]]) append.push(defaults[d]);
  }
  if (append.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, append.length, 2).setValues(append);
  }

  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#263238").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function setupCardsSheet_(ss) {
  var sheet = ss.getSheetByName(PCU.SHEETS.CARDS) || ss.insertSheet(PCU.SHEETS.CARDS);
  var headers = [
    "ID",
    "Fecha carga",
    "PriceCharting URL",
    "Nombre PC",
    "Nombre limpio",
    "Expansion PC",
    "Expansion limpia",
    "Numero",
    "USD",
    "ARS calculado",
    "ARS redondeado",
    "Precio final",
    "Unidades",
    "Imagen URL",
    "Mensaje",
    "Comprador",
    "Estado",
    "Grid lote",
    "Actualizado",
    "Error",
    "Claim lote",
    "Claim URL"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1f2933").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  sheet.getRange("A:V").setVerticalAlignment("middle");
  sheet.getRange("C:C").setWrap(false);
  sheet.getRange("N:O").setWrap(true);
  sheet.getRange("I:L").setNumberFormat("#,##0.00");
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("S:S").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.setColumnWidths(1, 1, 90);
  sheet.setColumnWidths(3, 1, 360);
  sheet.setColumnWidths(4, 4, 180);
  sheet.setColumnWidths(14, 2, 360);
  sheet.setColumnWidths(16, 7, 150);
  ensureCardsDataValidation_(sheet);
}

function setupClaimsSheet_(ss) {
  var sheet = ss.getSheetByName(PCU.SHEETS.CLAIMS) || ss.insertSheet(PCU.SHEETS.CLAIMS);
  var isBlank = sheet.getLastRow() === 0 || sheet.getRange("A1").getValue() === "";
  var isOldUnusedLayout = String(sheet.getRange("B1").getValue() || "") === "Card ID" && sheet.getLastRow() <= 1;
  if (isBlank || isOldUnusedLayout) {
    sheet.clear();
    sheet.getRange("A1:F1").setValues([[
      "Fecha",
      "Claim",
      "Cantidad",
      "Planilla URL",
      "Filas Cartas",
      "Notas"
    ]]);
  }
  sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#374151").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(4, 420);
  sheet.setColumnWidth(5, 240);
}

function setupGridLogSheet_(ss) {
  var sheet = ss.getSheetByName(PCU.SHEETS.GRID_LOG) || ss.insertSheet(PCU.SHEETS.GRID_LOG);
  if (sheet.getLastRow() === 0 || sheet.getRange("A1").getValue() === "") {
    sheet.getRange("A1:F1").setValues([["Fecha", "Lote", "Cantidad", "PNG URL", "Folder URL", "Rows"]]);
  }
  sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function setupErrorLogSheet_(ss) {
  var sheet = ss.getSheetByName(PCU.SHEETS.ERROR_LOG) || ss.insertSheet(PCU.SHEETS.ERROR_LOG);
  if (sheet.getLastRow() === 0 || sheet.getRange("A1").getValue() === "") {
    sheet.getRange("A1:E1").setValues([["Fecha", "Origen", "Fila", "URL", "Error"]]);
  }
  sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#7f1d1d").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function ensureCardsDataValidation_(sheet) {
  var states = ["Pendiente", "Procesando", "OK", "Error", "Reservada", "Vendida", "Entregada"];
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(states, true).setAllowInvalid(true).build();
  sheet.getRange(2, PCU.COL.ESTADO, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
}

function queueRows_(sheet, startRow, numRows) {
  var now = new Date();
  var urlValues = sheet.getRange(startRow, PCU.COL.PC_URL, numRows, 1).getValues();
  var idValues = sheet.getRange(startRow, PCU.COL.ID, numRows, 1).getValues();
  var dateValues = sheet.getRange(startRow, PCU.COL.FECHA_CARGA, numRows, 1).getValues();
  var stateValues = sheet.getRange(startRow, PCU.COL.ESTADO, numRows, 1).getValues();
  var errorValues = sheet.getRange(startRow, PCU.COL.ERROR, numRows, 1).getValues();
  var arsFormulas = [];
  var roundFormulas = [];
  var messageFormulas = [];

  for (var i = 0; i < numRows; i++) {
    var row = startRow + i;
    var url = normalizeUrl_(urlValues[i][0]);
    if (url) {
      if (!idValues[i][0]) idValues[i][0] = "PC-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      if (!dateValues[i][0]) dateValues[i][0] = now;
      stateValues[i][0] = "Pendiente";
      errorValues[i][0] = "";
    }
    arsFormulas.push([url ? buildArsFormula_(row) : ""]);
    roundFormulas.push([url ? buildRoundedFormula_(row) : ""]);
    messageFormulas.push([url ? buildMessageFormula_(row) : ""]);
  }

  sheet.getRange(startRow, PCU.COL.ID, numRows, 1).setValues(idValues);
  sheet.getRange(startRow, PCU.COL.FECHA_CARGA, numRows, 1).setValues(dateValues);
  sheet.getRange(startRow, PCU.COL.ESTADO, numRows, 1).setValues(stateValues);
  sheet.getRange(startRow, PCU.COL.ERROR, numRows, 1).setValues(errorValues);
  sheet.getRange(startRow, PCU.COL.ARS_CALCULADO, numRows, 1).setFormulas(arsFormulas);
  sheet.getRange(startRow, PCU.COL.ARS_REDONDEADO, numRows, 1).setFormulas(roundFormulas);
  sheet.getRange(startRow, PCU.COL.MENSAJE, numRows, 1).setFormulas(messageFormulas);
}

function findPendingRows_(sheet, maxRows) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, PCU.COL.ERROR).getValues();
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    var row = i + 2;
    var url = normalizeUrl_(values[i][PCU.COL.PC_URL - 1]);
    var status = String(values[i][PCU.COL.ESTADO - 1] || "").trim();
    if (!url) continue;
    if (status === "Pendiente" || status === "") {
      rows.push(row);
    }
    if (rows.length >= maxRows) break;
  }
  return rows;
}

function processCardRow_(sheet, row, config, options) {
  options = options || {};
  var url = normalizeUrl_(sheet.getRange(row, PCU.COL.PC_URL).getValue());
  if (!url) return;

  sheet.getRange(row, PCU.COL.ESTADO).setValue("Procesando");
  sheet.getRange(row, PCU.COL.ACTUALIZADO).setValue(new Date());
  if (!options.fastMode) {
    SpreadsheetApp.flush();
  }

  try {
    var data = fetchPriceChartingData_(url);
    if (!data || (!data.name && !data.expansion && !data.ungraded && !data.imageUrl)) {
      throw new Error("No se pudieron leer datos de PriceCharting");
    }

    var parsedName = parseNameAndNumber_(data.name || "");
    var cleanExpansion = cleanExpansion_(data.expansion || "");

    ensureRowId_(sheet, row);
    sheet.getRange(row, PCU.COL.NOMBRE_PC).setValue(data.name || "");
    sheet.getRange(row, PCU.COL.NOMBRE_LIMPIO).setValue(parsedName.name || "");
    sheet.getRange(row, PCU.COL.EXPANSION_PC).setValue(data.expansion || "");
    sheet.getRange(row, PCU.COL.EXPANSION_LIMPIA).setValue(cleanExpansion);
    sheet.getRange(row, PCU.COL.NUMERO).setValue(parsedName.number || "");
    if (data.ungraded) sheet.getRange(row, PCU.COL.USD).setValue(data.ungraded);
    if (data.imageUrl) sheet.getRange(row, PCU.COL.IMAGEN_URL).setValue(data.imageUrl);
    applyRowFormulas_(sheet, row);

    // Make Precio final editable: only seed it when it is blank.
    var priceCell = sheet.getRange(row, PCU.COL.PRECIO_FINAL);
    if (priceCell.getValue() === "") {
      priceCell.setFormula("=K" + row);
    }

    sheet.getRange(row, PCU.COL.ACTUALIZADO).setValue(new Date());
    sheet.getRange(row, PCU.COL.ESTADO).setValue("OK");
    sheet.getRange(row, PCU.COL.ERROR).clearContent();
  } catch (err) {
    var message = String(err && err.message ? err.message : err);
    if (err && err.rateLimited) {
      var until = setRateLimitCooldown_(config);
      sheet.getRange(row, PCU.COL.ESTADO).setValue("Pendiente");
      sheet.getRange(row, PCU.COL.ERROR).setValue("HTTP 429 - reintento despues de " + until);
      logError_("PriceCharting", row, url, "HTTP 429 - cooldown hasta " + until);
      return { rateLimited: true };
    } else {
      sheet.getRange(row, PCU.COL.ESTADO).setValue("Error");
      sheet.getRange(row, PCU.COL.ERROR).setValue(message);
      logError_("PriceCharting", row, url, message);
    }
  }
  return { rateLimited: false };
}

function fetchPriceChartingData_(url) {
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Mozilla/5.0 (PokemonClaimsUnified/1.0)" }
  });

  var status = response.getResponseCode();
  if (status === 429) {
    var rateErr = new Error("HTTP 429");
    rateErr.rateLimited = true;
    throw rateErr;
  }
  if (status < 200 || status >= 300) {
    throw new Error("HTTP " + status);
  }

  var html = response.getContentText();
  var title = extractFirst_(html, /<title>([^<]+)<\/title>/i);
  var name = "";
  var expansion = "";

  if (title) {
    title = decodeHtml_(title).trim();
    var priceSplit = title.split(/ Prices?\b/i);
    name = (priceSplit[0] || "").trim();

    var pipeSplit = title.split(" | ");
    if (pipeSplit.length > 2) {
      expansion = pipeSplit[1].trim();
    } else if (pipeSplit.length > 1) {
      expansion = pipeSplit[pipeSplit.length - 1].replace(/ Prices?$/i, "").trim();
    }
  }

  if (!expansion || expansion === "Pokemon Cards") {
    expansion = decodeHtml_(extractFirst_(html, /<a[^>]+href="\/console\/[^"]+">([^<]+)<\/a>/i) || expansion);
  }

  var priceText = extractFirst_(html, /id="used_price"[^>]*>\s*\$?([\d,.]+)/i)
    || extractFirst_(html, /Ungraded[\s\S]*?\$\s*([\d,.]+)/i)
    || extractFirst_(html, /class="price[^"]*"[^>]*>\s*\$?([\d,.]+)/i);
  var ungraded = priceText ? parseFloat(String(priceText).replace(/,/g, "")) : 0;

  var imageUrl = extractFirst_(html, /(https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'<>\s]+\/1600\.jpg)/i);

  return {
    name: name,
    expansion: expansion,
    ungraded: ungraded || 0,
    imageUrl: imageUrl || ""
  };
}

function applyRowFormulas_(sheet, row) {
  sheet.getRange(row, PCU.COL.ARS_CALCULADO).setFormula(buildArsFormula_(row));
  sheet.getRange(row, PCU.COL.ARS_REDONDEADO).setFormula(buildRoundedFormula_(row));
  sheet.getRange(row, PCU.COL.MENSAJE).setFormula(buildMessageFormula_(row));
}

function buildArsFormula_(row) {
  return "=IF(I" + row + "=\"\",\"\",I" + row + "*Config!$B$2)";
}

function buildRoundedFormula_(row) {
  return "=IF(J" + row + "=\"\",\"\",MAX(Config!$B$4,ROUNDUP(J" + row + "/Config!$B$3,0)*Config!$B$3))";
}

function buildMessageFormula_(row) {
  return "=IF(E" + row + "=\"\",\"\",SUBSTITUTE(E" + row + ",\"&#39;\",\"'\")" +
    "&IF(G" + row + "<>\"\",\" - \"&SUBSTITUTE(G" + row + ",\"&#39;\",\"'\"),\"\")" +
    "&\" - $\"&IF(AND(L" + row + ">=10000,MOD(L" + row + ",1000)=0),L" + row + "/1000&\"mil\",L" + row + ")" +
    "&IF(M" + row + "=\"\",\"\",IF(M" + row + ">3,\" - hay varios\",\" - hay \"&M" + row + ")))";
}

function maybeGenerateReadyGrids_(config) {
  config = config || readConfig_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.CARDS);
  if (!sheet) return { generated: 0, message: "No existe hoja Cartas" };

  var gridSize = Number(config.grid_size || 30);
  var ready = getReadyGridRows_(sheet, gridSize);
  if (ready.length < gridSize) {
    return { generated: 0, ready: ready.length };
  }

  var batch = ready.slice(0, gridSize);
  var result = createGridPngFromRows_(sheet, batch, config);
  markRowsWithGridBatch_(sheet, batch, result.batchName);
  logGrid_(result, batch);
  return { generated: 1, url: result.pngUrl, batchName: result.batchName };
}

function getReadyGridRows_(sheet, limit) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, PCU.COL.ERROR).getValues();
  var rows = [];

  for (var i = 0; i < data.length; i++) {
    var row = i + 2;
    var imageUrl = normalizeUrl_(data[i][PCU.COL.IMAGEN_URL - 1]);
    var gridBatch = String(data[i][PCU.COL.GRID_LOTE - 1] || "").trim();
    var status = String(data[i][PCU.COL.ESTADO - 1] || "").trim();
    if (imageUrl && !gridBatch && status !== "Error") {
      rows.push(row);
    }
    if (rows.length >= limit) break;
  }
  return rows;
}

function getReadyImageGridPayload(options) {
  options = options || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.CARDS);
  if (!sheet) {
    throw new Error("No existe hoja Cartas");
  }

  var columns = 5;
  var rows = 6;
  var limit = columns * rows;
  var rowNumbers = getReadyGridRows_(sheet, limit);
  if (!rowNumbers.length) {
    throw new Error("No hay cartas listas con Imagen URL y sin Grid lote.");
  }

  var urls = [];
  for (var i = 0; i < rowNumbers.length; i++) {
    urls.push(normalizeUrl_(sheet.getRange(rowNumbers[i], PCU.COL.IMAGEN_URL).getValue()));
  }

  return {
    totalUrls: urls.length,
    rowNumbers: rowNumbers,
    batches: [urls],
    canvasWidth: Number(options.canvasWidth || 1600),
    cardAspectRatio: 63 / 88,
    outputFolderName: String(options.outputFolderName || "Pokemon Claim Grids"),
    filePrefix: String(options.filePrefix || "grid"),
    backgroundColor: String(options.backgroundColor || "#ffffff"),
    columns: columns,
    rows: rows,
    outerMargin: Number(options.outerMargin || 0),
    cellGap: Number(options.cellGap || 0)
  };
}

function getReadyImageGridBatchData(options, batchIndex) {
  var payload = getReadyImageGridPayload(options || {});
  var index = Number(batchIndex) || 0;
  if (index < 0 || index >= payload.batches.length) {
    throw new Error("Batch invalido: " + batchIndex);
  }

  var urls = payload.batches[index];
  var images = [];
  var skipped = 0;

  for (var i = 0; i < urls.length; i++) {
    try {
      var blob = fetchImageBlob_(urls[i], i);
      images.push({
        ok: true,
        url: urls[i],
        dataUrl: blobToDataUrl_(blob)
      });
    } catch (err) {
      skipped++;
      images.push({
        ok: false,
        url: urls[i],
        error: String(err && err.message ? err.message : err)
      });
    }
  }

  return {
    batchIndex: index,
    images: images,
    skipped: skipped
  };
}

function saveGeneratedReadyGridPng(fileName, dataUrl, outputFolderName, rowNumbers) {
  var base64 = String(dataUrl || "").replace(/^data:image\/png;base64,/, "");
  if (!base64) {
    throw new Error("PNG vacio");
  }

  var blob = Utilities.newBlob(Utilities.base64Decode(base64), "image/png", fileName);
  var folder = getOrCreateFolder_(outputFolderName || "Pokemon Claim Grids");
  var file = folder.createFile(blob);
  var batchName = String(fileName || "").replace(/\.png$/i, "");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.CARDS);
  var rows = (rowNumbers || []).map(function(row) { return Number(row); }).filter(function(row) { return row > 1; });
  if (sheet && rows.length) {
    markRowsWithGridBatch_(sheet, rows, batchName);
    logGrid_({
      batchName: batchName,
      count: rows.length,
      pngUrl: file.getUrl(),
      folderUrl: folder.getUrl()
    }, rows);
  }

  return {
    name: file.getName(),
    url: file.getUrl(),
    folderUrl: folder.getUrl()
  };
}

function blobToDataUrl_(blob) {
  return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
}

function getReadyClaimRows_(sheet, limit) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  SpreadsheetApp.flush();

  var lastCol = PCU.COL.CLAIM_URL;
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var rows = [];

  for (var i = 0; i < data.length; i++) {
    var row = i + 2;
    var message = String(data[i][PCU.COL.MENSAJE - 1] || "").trim();
    var imageUrl = normalizeUrl_(data[i][PCU.COL.IMAGEN_URL - 1]);
    var claimBatch = String(data[i][PCU.COL.CLAIM_LOTE - 1] || "").trim();
    var status = String(data[i][PCU.COL.ESTADO - 1] || "").trim();

    if (message && imageUrl && !claimBatch && status !== "Error") {
      rows.push(row);
    }

    if (limit && rows.length >= limit) break;
  }
  return rows;
}

function buildClaimRows_(sheet, rows) {
  var output = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var values = sheet.getRange(row, 1, 1, PCU.COL.CLAIM_URL).getValues()[0];
    output.push({
      sourceRow: row,
      id: values[PCU.COL.ID - 1],
      pcUrl: values[PCU.COL.PC_URL - 1],
      nombrePc: values[PCU.COL.NOMBRE_PC - 1],
      nombreLimpio: values[PCU.COL.NOMBRE_LIMPIO - 1],
      expansionPc: values[PCU.COL.EXPANSION_PC - 1],
      expansionLimpia: values[PCU.COL.EXPANSION_LIMPIA - 1],
      numero: values[PCU.COL.NUMERO - 1],
      usd: values[PCU.COL.USD - 1],
      arsCalculado: values[PCU.COL.ARS_CALCULADO - 1],
      arsRedondeado: values[PCU.COL.ARS_REDONDEADO - 1],
      precioFinal: values[PCU.COL.PRECIO_FINAL - 1],
      unidades: values[PCU.COL.UNIDADES - 1],
      imagenUrl: values[PCU.COL.IMAGEN_URL - 1],
      mensaje: values[PCU.COL.MENSAJE - 1],
      comprador: values[PCU.COL.COMPRADOR - 1]
    });
  }
  return output;
}

function createClaimSpreadsheet_(claimName, data, config) {
  var claimSs = SpreadsheetApp.create(claimName);
  var claimId = claimSs.getId();
  var list = claimSs.getSheets()[0];
  list.setName("LISTA");

  var imageSheet = claimSs.insertSheet("IMAGENES");
  var info = claimSs.insertSheet("INFO");

  writeClaimListSheet_(list, data);
  writeClaimImagesSheet_(imageSheet, data);
  writeClaimInfoSheet_(info, claimName, data);

  var folderName = String(config.claim_folder_name || "Pokemon Claims");
  var folder = getOrCreateFolder_(folderName);
  var file = DriveApp.getFileById(claimId);
  try {
    file.moveTo(folder);
  } catch (ignored) {}

  return {
    spreadsheetId: claimId,
    url: claimSs.getUrl()
  };
}

function writeClaimListSheet_(sheet, data) {
  var headers = [
    "Nombre",
    "Expansion",
    "numero",
    "link",
    "unidades",
    "Corregido",
    "Detalle",
    "exp corregida",
    "USD",
    "Pesos",
    "REDONDEO",
    "precio final",
    "nombrefinal",
    "Comprador",
    "Imagen URL",
    "ID"
  ];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (data.length) {
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      rows.push([
        data[i].nombrePc || "",
        data[i].expansionPc || "",
        data[i].numero || "",
        data[i].pcUrl || "",
        data[i].unidades || "",
        data[i].nombreLimpio || "",
        "",
        data[i].expansionLimpia || "",
        data[i].usd || "",
        data[i].arsCalculado || "",
        data[i].arsRedondeado || "",
        data[i].precioFinal || "",
        data[i].mensaje || "",
        data[i].comprador || "",
        data[i].imagenUrl || "",
        data[i].id || ""
      ]);
    }
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#1f2933")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  sheet.getRange("I:L").setNumberFormat("#,##0.00");
  sheet.getRange("D:D").setWrap(false);
  sheet.getRange("M:O").setWrap(true);
  sheet.setColumnWidths(1, 2, 180);
  sheet.setColumnWidths(4, 1, 320);
  sheet.setColumnWidths(6, 3, 180);
  sheet.setColumnWidths(13, 3, 340);
  sheet.autoResizeColumns(5, 8);
}

function writeClaimImagesSheet_(sheet, data) {
  sheet.clear();
  sheet.getRange("A1:D1").setValues([["Imagen URL", "Preview", "Mensaje", "ID"]]);
  if (data.length) {
    var values = [];
    var formulas = [];
    for (var i = 0; i < data.length; i++) {
      values.push([data[i].imagenUrl || "", "", data[i].mensaje || "", data[i].id || ""]);
      formulas.push(["=IF(A" + (i + 2) + "=\"\",\"\",IMAGE(A" + (i + 2) + "))"]);
    }
    sheet.getRange(2, 1, values.length, 4).setValues(values);
    sheet.getRange(2, 2, formulas.length, 1).setFormulas(formulas);
  }
  sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 360);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 340);
  sheet.setColumnWidth(4, 120);
  if (data.length) {
    sheet.setRowHeights(2, data.length, 160);
  }
}

function writeClaimInfoSheet_(sheet, claimName, data) {
  var master = SpreadsheetApp.getActiveSpreadsheet();
  sheet.clear();
  sheet.getRange("A1:B6").setValues([
    ["Claim", claimName],
    ["Fecha generado", new Date()],
    ["Cartas incluidas", data.length],
    ["Planilla maestra", master.getUrl()],
    ["Criterio", "Cartas con Mensaje + Imagen URL + Claim lote vacio"],
    ["Nota", "Esta planilla es una foto del claim al momento de generarlo."]
  ]);
  sheet.getRange("A1:A6").setFontWeight("bold");
  sheet.getRange("B2").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.setColumnWidths(1, 2, 260);
}

function markRowsWithClaim_(sheet, rows, claimName, claimUrl) {
  for (var i = 0; i < rows.length; i++) {
    sheet.getRange(rows[i], PCU.COL.CLAIM_LOTE, 1, 2).setValues([[claimName, claimUrl]]);
  }
}

function logClaim_(claimName, rows, claimUrl) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.CLAIMS);
  if (!sheet) {
    setupClaimsSheet_(ss);
    sheet = ss.getSheetByName(PCU.SHEETS.CLAIMS);
  }
  sheet.appendRow([
    new Date(),
    claimName,
    rows.length,
    claimUrl,
    rows.join(","),
    ""
  ]);
}

function createGridPngFromRows_(sheet, rows, config) {
  var columns = Number(config.grid_columns || 5);
  var gridRows = Number(config.grid_rows || 6);
  var now = new Date();
  var batchName = "grid-" + Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");

  var folder = getOrCreateFolder_(String(config.grid_folder_name || "Pokemon Claim Grids"));
  var presentation = SlidesApp.create(batchName);
  var presentationId = presentation.getId();

  // Match the original canvas exporter: exact grid aspect ratio, no side margins.
  var widthPt = 720;
  var cardWidth = widthPt / columns;
  var cardHeight = cardWidth * 88 / 63;
  var heightPt = cardHeight * gridRows;
  try {
    presentation.setPageWidth(widthPt);
    presentation.setPageHeight(heightPt);
  } catch (sizeErr) {
    Logger.log("No se pudo ajustar el tamaño de pagina del grid: " + sizeErr);
  }

  var slide = presentation.getSlides()[0];
  var slideId = slide.getObjectId();
  var elements = slide.getPageElements();
  for (var e = 0; e < elements.length; e++) {
    elements[e].remove();
  }

  slide.getBackground().setSolidFill("#ffffff");

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var imageUrl = normalizeUrl_(sheet.getRange(row, PCU.COL.IMAGEN_URL).getValue());
    if (!imageUrl) continue;

    try {
      var blob = fetchImageBlob_(imageUrl, i);
      var col = i % columns;
      var gridRow = Math.floor(i / columns);
      var img = slide.insertImage(blob);
      img.setLeft(col * cardWidth);
      img.setTop(gridRow * cardHeight);
      img.setWidth(cardWidth);
      img.setHeight(cardHeight);
    } catch (err) {
      logError_("Grid image", row, imageUrl, String(err && err.message ? err.message : err));
    }
  }

  presentation.saveAndClose();

  var sourceFile = DriveApp.getFileById(presentationId);
  try {
    sourceFile.moveTo(folder);
  } catch (ignored) {}

  var exportUrl = "https://docs.google.com/presentation/d/" + presentationId +
    "/export/png?id=" + presentationId + "&pageid=" + slideId;
  var pngResponse = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (pngResponse.getResponseCode() < 200 || pngResponse.getResponseCode() >= 300) {
    throw new Error("No se pudo exportar PNG: HTTP " + pngResponse.getResponseCode());
  }

  var pngFile = folder.createFile(pngResponse.getBlob().setName(batchName + ".png"));

  if (!toBoolean_(config.keep_source_slides)) {
    sourceFile.setTrashed(true);
  }

  return {
    batchName: batchName,
    count: rows.length,
    pngUrl: pngFile.getUrl(),
    folderUrl: folder.getUrl()
  };
}

function fetchImageBlob_(url, index) {
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Mozilla/5.0 Apps Script Image Grid" }
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("HTTP " + status);
  }
  var blob = response.getBlob();
  var contentType = String(blob.getContentType() || "");
  if (contentType.indexOf("image/") !== 0) {
    throw new Error("Content-Type invalido: " + contentType);
  }
  return blob.setName("card-" + (index + 1) + ".jpg");
}

function markRowsWithGridBatch_(sheet, rows, batchName) {
  for (var i = 0; i < rows.length; i++) {
    sheet.getRange(rows[i], PCU.COL.GRID_LOTE).setValue(batchName);
  }
}

function logGrid_(result, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.GRID_LOG);
  if (!sheet) return;
  sheet.appendRow([
    new Date(),
    result.batchName,
    result.count,
    result.pngUrl,
    result.folderUrl,
    rows.join(",")
  ]);
}

function logError_(origin, row, url, error) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.ERROR_LOG);
  if (!sheet) return;
  sheet.appendRow([new Date(), origin, row, url, error]);
}

function readConfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PCU.SHEETS.CONFIG);
  if (!sheet) {
    setupConfigSheet_(ss);
    sheet = ss.getSheetByName(PCU.SHEETS.CONFIG);
  }

  var values = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 2).getValues();
  var config = {};
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || "").trim();
    if (!key) continue;
    config[key] = values[i][1];
  }
  return config;
}

function getRateLimitCooldown_() {
  var props = PropertiesService.getScriptProperties();
  var untilMs = Number(props.getProperty("pcu_rate_limit_until_ms") || 0);
  var nowMs = new Date().getTime();
  if (untilMs && untilMs > nowMs) {
    return {
      active: true,
      until: Utilities.formatDate(new Date(untilMs), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
    };
  }
  if (untilMs) {
    props.deleteProperty("pcu_rate_limit_until_ms");
  }
  return { active: false, until: "" };
}

function setRateLimitCooldown_(config) {
  var minutes = Number((config || {}).rate_limit_cooldown_min || 0.5);
  var untilMs = new Date().getTime() + (minutes * 60 * 1000);
  PropertiesService.getScriptProperties().setProperty("pcu_rate_limit_until_ms", String(untilMs));
  return Utilities.formatDate(new Date(untilMs), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function clearRateLimitCooldown_() {
  PropertiesService.getScriptProperties().deleteProperty("pcu_rate_limit_until_ms");
}

function ensureRowId_(sheet, row) {
  var cell = sheet.getRange(row, PCU.COL.ID);
  if (!cell.getValue()) {
    cell.setValue("PC-" + Utilities.getUuid().slice(0, 8).toUpperCase());
  }
}

function getOrCreateFolder_(folderName) {
  var ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  var parents = ssFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var folders = parent.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(folderName);
}

function normalizeUrl_(value) {
  var text = String(value || "").trim();
  if (!text) return "";

  var markdown = text.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdown) return markdown[1].trim();

  var plain = text.match(/https?:\/\/[^\s\])]+/i);
  if (plain) return plain[0].trim();

  return text;
}

function parseNameAndNumber_(name) {
  name = decodeHtml_(String(name || "").trim());
  var match = name.match(/^(.*)\s+#([^#]+)$/);
  if (!match) return { name: name, number: "" };
  return { name: match[1].trim(), number: match[2].trim() };
}

function cleanExpansion_(expansion) {
  return decodeHtml_(String(expansion || ""))
    .replace(/^Pokemon\s+/i, "")
    .trim();
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

function extractFirst_(text, regex) {
  var match = String(text || "").match(regex);
  return match ? match[1] : "";
}

function toBoolean_(value) {
  if (value === true) return true;
  var text = String(value || "").toLowerCase().trim();
  return text === "true" || text === "si" || text === "1";
}
