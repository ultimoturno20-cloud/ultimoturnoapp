// ============================================================
// Claim Generator V2
// Reusable claim tool. It reads PriceCharting data from the central cache,
// archives each finished claim as a new spreadsheet, sends sold rows to
// Administracion, then resets the working sheets.
// ============================================================

var CGV2 = {
  SHEETS: {
    CONFIG: "Config",
    CARGA: "Carga",
    CLAIM: "Claim",
    FREES: "Frees",
    INFO: "Info",
    CLAIMS_LOG: "Claims Log",
    LOG: "Log"
  },
  PROP: {
    ADMIN_SPREADSHEET_ID: "ADMIN_SPREADSHEET_ID",
    PC_CACHE_SPREADSHEET_ID: "PC_CACHE_SPREADSHEET_ID"
  },
  CARGA_COL: {
    ID: 1,
    FECHA_CARGA: 2,
    PC_URL: 3,
    PC_ID: 4,
    NOMBRE_PC: 5,
    NOMBRE: 6,
    EXPANSION_PC: 7,
    EXPANSION: 8,
    NUMERO: 9,
    USD: 10,
    ARS_CALCULADO: 11,
    ARS_REDONDEADO: 12,
    PRECIO_SUGERIDO: 13,
    IMAGEN_URL: 14,
    PREVIEW: 15,
    ESTADO: 16,
    GRID_LOTE: 17,
    ERROR: 18,
    ACTUALIZADO: 19
  },
  CLAIM_COL: {
    ID: 1,
    NOMBRE: 2,
    EXPANSION: 3,
    USD: 4,
    ARS_CALCULADO: 5,
    ARS_REDONDEADO: 6,
    PRECIO_FINAL: 7,
    PRECIO_FINAL_USD: 8,
    NOMBRE_FINAL: 9,
    COMPRADOR: 10,
    TAGS: 11,
    PC_URL: 12,
    PC_ID: 13,
    IMAGEN_URL: 14
  },
  FREE_COL: {
    NOMBRE_FINAL: 1,
    NOMBRE: 2,
    EXPANSION: 3,
    CANTIDAD: 4,
    COMPRADOR: 5,
    PC_URL: 6,
    PC_ID: 7,
    TAGS: 8,
    NOTAS: 9
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Claims V2")
    .addItem("Crear / reparar estructura", "setupClaimGeneratorV2")
    .addItem("Configurar conexiones", "promptConfigureClaimGeneratorV2")
    .addItem("Diagnosticar conexiones", "diagnoseClaimGeneratorV2Connections")
    .addItem("Diagnosticar filas destino", "diagnoseClaimGeneratorV2TargetRows")
    .addSeparator()
    .addItem("Procesar links", "processClaimGeneratorLinks")
    .addItem("Actualizar info", "updateClaimGeneratorInfo")
    .addItem("Generar grid adelanto", "promptExportReadyGrid")
    .addSeparator()
    .addItem("Terminar claim", "finishClaimGeneratorClaim")
    .addItem("Resetear generador", "promptResetClaimGenerator")
    .addSeparator()
    .addItem("Activar trigger de carga", "setupClaimGeneratorV2Trigger")
    .addItem("Desactivar triggers", "removeClaimGeneratorV2Triggers")
    .addToUi();
}

function setupClaimGeneratorV2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupCgv2Config_(ss);
  setupCgv2Load_(ss);
  setupCgv2Claim_(ss);
  setupCgv2Frees_(ss);
  setupCgv2Info_(ss);
  setupCgv2ClaimsLog_(ss);
  setupCgv2Log_(ss);
  SpreadsheetApp.getUi().alert("Generador de Claims V2 listo.");
}

function promptConfigureClaimGeneratorV2() {
  var ui = SpreadsheetApp.getUi();

  var adminPrompt = ui.prompt("Administracion", "Pega el ID o URL de la planilla Stock + Administracion.", ui.ButtonSet.OK_CANCEL);
  if (adminPrompt.getSelectedButton() !== ui.Button.OK) return;
  var adminId = extractCgv2SpreadsheetId_(adminPrompt.getResponseText());
  if (!adminId) {
    ui.alert("No pude leer el ID de Administracion.");
    return;
  }

  var cachePrompt = ui.prompt("PriceCharting Cache", "Pega el ID o URL de la planilla cache.", ui.ButtonSet.OK_CANCEL);
  if (cachePrompt.getSelectedButton() !== ui.Button.OK) return;
  var cacheId = extractCgv2SpreadsheetId_(cachePrompt.getResponseText());
  if (!cacheId) {
    ui.alert("No pude leer el ID de PriceCharting Cache.");
    return;
  }

  var props = PropertiesService.getScriptProperties();
  props.setProperty(CGV2.PROP.ADMIN_SPREADSHEET_ID, adminId);
  props.setProperty(CGV2.PROP.PC_CACHE_SPREADSHEET_ID, cacheId);
  ui.alert("Conexiones guardadas.");
}

function diagnoseClaimGeneratorV2Connections() {
  var props = PropertiesService.getScriptProperties();
  var adminId = props.getProperty(CGV2.PROP.ADMIN_SPREADSHEET_ID) || "";
  var cacheId = props.getProperty(CGV2.PROP.PC_CACHE_SPREADSHEET_ID) || "";
  var lines = [];

  lines.push("Generador: " + SpreadsheetApp.getActiveSpreadsheet().getName());
  lines.push("Admin ID: " + (adminId || "NO CONFIGURADO"));
  lines.push("Cache ID: " + (cacheId || "NO CONFIGURADO"));

  if (adminId) {
    try {
      var admin = SpreadsheetApp.openById(adminId);
      lines.push("Admin nombre: " + admin.getName());
      lines.push("Admin URL: " + admin.getUrl());
      lines.push("Hoja Ordenes: " + describeCgv2Sheet_(admin, "Ordenes"));
      lines.push("Hoja Ventas Detalle: " + describeCgv2Sheet_(admin, "Ventas Detalle"));
      lines.push("Hoja Frees: " + describeCgv2Sheet_(admin, "Frees"));
      lines.push("Hoja Claims Log: " + describeCgv2Sheet_(admin, "Claims Log"));
    } catch (err) {
      lines.push("Admin ERROR: " + String(err && err.message ? err.message : err));
    }
  }

  if (cacheId) {
    try {
      var cache = SpreadsheetApp.openById(cacheId);
      lines.push("Cache nombre: " + cache.getName());
      lines.push("Cache URL: " + cache.getUrl());
      lines.push("Hoja PriceCharting Cache: " + describeCgv2Sheet_(cache, "PriceCharting Cache"));
    } catch (cacheErr) {
      lines.push("Cache ERROR: " + String(cacheErr && cacheErr.message ? cacheErr.message : cacheErr));
    }
  }

  var message = lines.join("\n");
  logCgv2_("Diagnostico conexiones", message);
  SpreadsheetApp.getUi().alert("Diagnostico conexiones", message.slice(0, 1800), SpreadsheetApp.getUi().ButtonSet.OK);
}

function describeCgv2Sheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return "NO EXISTE";
  return "OK, filas=" + sheet.getLastRow() + ", columnas=" + sheet.getLastColumn();
}

function diagnoseClaimGeneratorV2TargetRows() {
  var adminId = PropertiesService.getScriptProperties().getProperty(CGV2.PROP.ADMIN_SPREADSHEET_ID);
  if (!adminId) throw new Error("Falta configurar Administracion.");

  var admin = SpreadsheetApp.openById(adminId);
  var lines = [];
  ["Ordenes", "Ventas Detalle", "Frees", "Claims Log"].forEach(function(name) {
    var sheet = admin.getSheetByName(name);
    if (!sheet) {
      lines.push(name + ": NO EXISTE");
      return;
    }
    lines.push(
      name +
      ": getLastRow=" + sheet.getLastRow() +
      ", getMaxRows=" + sheet.getMaxRows() +
      ", proxima fila=" + findFirstEmptyCgv2KeyRow_(sheet, 1)
    );
  });

  var message = lines.join("\n");
  logCgv2_("Diagnostico filas destino", message);
  SpreadsheetApp.getUi().alert("Diagnostico filas destino", message, SpreadsheetApp.getUi().ButtonSet.OK);
}


function setupClaimGeneratorV2Trigger() {
  removeClaimGeneratorV2Triggers(false);
  ScriptApp.newTrigger("claimGeneratorV2OnEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  SpreadsheetApp.getUi().alert("Trigger de carga activado.");
}

function removeClaimGeneratorV2Triggers(showAlert) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "claimGeneratorV2OnEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  if (showAlert !== false) SpreadsheetApp.getUi().alert("Triggers desactivados.");
}

function claimGeneratorV2OnEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== CGV2.SHEETS.CARGA) return;

  var startCol = e.range.getColumn();
  var endCol = startCol + e.range.getNumColumns() - 1;
  if (CGV2.CARGA_COL.PC_URL < startCol || CGV2.CARGA_COL.PC_URL > endCol) return;

  var startRow = Math.max(2, e.range.getRow());
  var skippedHeaderRows = Math.max(0, 2 - e.range.getRow());
  var numRows = e.range.getNumRows() - skippedHeaderRows;
  if (numRows > 0) {
    processClaimGeneratorLinks({ startRow: startRow, numRows: numRows });
  }
}

function processClaimGeneratorLinks(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { processed: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var load = ss.getSheetByName(CGV2.SHEETS.CARGA);
    var claim = ss.getSheetByName(CGV2.SHEETS.CLAIM);
    if (!load || !claim) throw new Error("Faltan hojas Carga o Claim.");
    if (load.getLastRow() < 2) return { processed: 0 };

    var config = readCgv2Config_();
    var startRow = Math.max(2, Number(options.startRow || 2));
    var numRows = Number(options.numRows || (load.getLastRow() - startRow + 1));
    var useFastLookup = numRows <= Number((config || {}).fast_lookup_max_rows || 80);
    var cache = useFastLookup ? buildCgv2CacheLookup_() : buildCgv2CacheIndex_();
    var range = load.getRange(startRow, 1, numRows, CGV2.CARGA_COL.ACTUALIZADO);
    var values = range.getValues();
    var claimIndex = buildCgv2ClaimIndex_(claim);
    var processed = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var pcUrl = normalizeCgv2Url_(row[CGV2.CARGA_COL.PC_URL - 1]);
      var pcId = String(row[CGV2.CARGA_COL.PC_ID - 1] || "").trim() || extractCgv2PriceChartingId_(pcUrl);
      if (!pcUrl && !pcId) continue;

      if (!row[CGV2.CARGA_COL.ID - 1]) row[CGV2.CARGA_COL.ID - 1] = "CG-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      if (!row[CGV2.CARGA_COL.FECHA_CARGA - 1]) row[CGV2.CARGA_COL.FECHA_CARGA - 1] = new Date();

      var item = findCgv2CacheItem_(cache, pcId, pcUrl);
      if (!item) {
        row[CGV2.CARGA_COL.ESTADO - 1] = "Error";
        row[CGV2.CARGA_COL.ERROR - 1] = "No encontrado en PriceCharting Cache";
        row[CGV2.CARGA_COL.ACTUALIZADO - 1] = new Date();
        continue;
      }

      fillCgv2LoadRow_(row, item, config);
      upsertCgv2ClaimRow_(claim, claimIndex, row, item, config);
      processed++;
    }

    range.setValues(values);
    applyCgv2LoadPreviewFormulas_(load, startRow, numRows);
    updateClaimGeneratorInfo();
    return { processed: processed };
  } finally {
    lock.releaseLock();
  }
}

function finishClaimGeneratorClaim() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    "Terminar claim",
    "Esto archiva el claim, envia compradores a Administracion y limpia Carga/Claim/Frees. Continuar?",
    ui.ButtonSet.OK_CANCEL
  );
  if (confirm !== ui.Button.OK) return;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) {
    ui.alert("Ya hay una sincronizacion corriendo.");
    return;
  }

  try {
    var result = finishCgv2Claim_();
    ui.alert(
      "Claim terminado",
      "Archivo: " + result.archiveUrl +
        "\nOrdenes: " + result.orders +
        "\nCartas vendidas: " + result.soldRows +
        "\nFrees: " + result.frees +
        "\nDuplicados omitidos: " + result.duplicates,
      ui.ButtonSet.OK
    );
  } catch (err) {
    var message = String(err && err.message ? err.message : err);
    logCgv2_("Terminar claim ERROR", message);
    ui.alert("No se pudo terminar el claim", message, ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

function finishCgv2Claim_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var claimName = buildCgv2ClaimName_();
  updateClaimGeneratorInfo();

  var claimRows = readCgv2ClaimRows_();
  var freeRows = readCgv2FreeRows_();
  var soldRows = claimRows.filter(function(row) { return row.comprador; });
  if (!claimRows.length) throw new Error("No hay cartas en Claim.");

  var archive = createCgv2ClaimArchive_(claimName);
  var adminResult = sendCgv2ClaimToAdministration_(claimName, archive.url, soldRows, freeRows);
  logCgv2FinishedClaim_(claimName, archive.url, soldRows, freeRows, adminResult.orders);
  resetClaimGenerator_(false);
  return {
    archiveUrl: archive.url,
    archiveId: archive.spreadsheetId,
    orders: adminResult.orders,
    duplicates: adminResult.duplicates,
    soldRows: soldRows.length,
    frees: freeRows.length
  };
}

function promptResetClaimGenerator() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert("Resetear generador", "Limpiar Carga, Claim y Frees?", ui.ButtonSet.OK_CANCEL);
  if (response !== ui.Button.OK) return;
  resetClaimGenerator_(true);
}

function resetClaimGenerator_(showAlert) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  clearCgv2DataSheet_(ss.getSheetByName(CGV2.SHEETS.CARGA), CGV2.CARGA_COL.ACTUALIZADO);
  clearCgv2DataSheet_(ss.getSheetByName(CGV2.SHEETS.CLAIM), CGV2.CLAIM_COL.IMAGEN_URL);
  clearCgv2DataSheet_(ss.getSheetByName(CGV2.SHEETS.FREES), CGV2.FREE_COL.NOTAS);
  updateClaimGeneratorInfo();
  if (showAlert) SpreadsheetApp.getUi().alert("Generador reseteado.");
}

function clearCgv2DataSheet_(sheet, lastCol) {
  if (!sheet || sheet.getLastRow() < 2) return;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).clearContent();
}

function updateClaimGeneratorInfo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var info = ss.getSheetByName(CGV2.SHEETS.INFO);
  if (!info) return;

  var claimRows = readCgv2ClaimRows_();
  var freeRows = readCgv2FreeRows_();
  var sold = claimRows.filter(function(row) { return row.comprador; });
  var totalArs = sold.reduce(function(sum, row) { return sum + (Number(row.precioFinal) || 0); }, 0);
  var totalUsd = sold.reduce(function(sum, row) { return sum + (Number(row.precioFinalUsd) || 0); }, 0);
  var buyerTotals = {};
  for (var i = 0; i < sold.length; i++) {
    if (!buyerTotals[sold[i].comprador]) buyerTotals[sold[i].comprador] = { count: 0, ars: 0, usd: 0 };
    buyerTotals[sold[i].comprador].count++;
    buyerTotals[sold[i].comprador].ars += Number(sold[i].precioFinal) || 0;
    buyerTotals[sold[i].comprador].usd += Number(sold[i].precioFinalUsd) || 0;
  }

  info.clearContents();
  info.getRange("A1:B8").setValues([
    ["Claim sugerido", buildCgv2ClaimName_()],
    ["Fecha", new Date()],
    ["Cartas cargadas", claimRows.length],
    ["Cartas con comprador", sold.length],
    ["Total vendido ARS", totalArs],
    ["Total vendido USD", totalUsd],
    ["Frees", freeRows.length],
    ["Estado", "Abierto"]
  ]);
  info.getRange("A1:A8").setFontWeight("bold");
  info.getRange("B2").setNumberFormat("yyyy-mm-dd hh:mm");
  info.getRange("B5:B6").setNumberFormat("#,##0.00");

  var buyers = Object.keys(buyerTotals).sort();
  if (buyers.length) {
    info.getRange(1, 4, 1, 4).setValues([["Comprador", "Cartas", "Total ARS", "Total USD"]]);
    var output = buyers.map(function(buyer) {
      return [buyer, buyerTotals[buyer].count, buyerTotals[buyer].ars, buyerTotals[buyer].usd];
    });
    info.getRange(2, 4, output.length, 4).setValues(output);
    info.getRange(1, 4, 1, 4).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    info.getRange(2, 6, output.length, 2).setNumberFormat("#,##0.00");
  }
}

function readCgv2ClaimRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CGV2.SHEETS.CLAIM);
  if (!sheet || sheet.getLastRow() < 2) return [];
  SpreadsheetApp.flush();
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CGV2.CLAIM_COL.IMAGEN_URL).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[CGV2.CLAIM_COL.ID - 1] || "").trim();
    var name = String(row[CGV2.CLAIM_COL.NOMBRE - 1] || "").trim();
    if (!id && !name) continue;
    rows.push({
      id: id,
      nombre: name,
      expansion: String(row[CGV2.CLAIM_COL.EXPANSION - 1] || "").trim(),
      usd: Number(row[CGV2.CLAIM_COL.USD - 1]) || 0,
      arsCalculado: Number(row[CGV2.CLAIM_COL.ARS_CALCULADO - 1]) || 0,
      arsRedondeado: Number(row[CGV2.CLAIM_COL.ARS_REDONDEADO - 1]) || 0,
      precioFinal: Number(row[CGV2.CLAIM_COL.PRECIO_FINAL - 1]) || 0,
      precioFinalUsd: Number(row[CGV2.CLAIM_COL.PRECIO_FINAL_USD - 1]) || 0,
      nombreFinal: String(row[CGV2.CLAIM_COL.NOMBRE_FINAL - 1] || "").trim(),
      comprador: String(row[CGV2.CLAIM_COL.COMPRADOR - 1] || "").trim(),
      tags: String(row[CGV2.CLAIM_COL.TAGS - 1] || "").trim(),
      pcUrl: normalizeCgv2Url_(row[CGV2.CLAIM_COL.PC_URL - 1]),
      pcId: String(row[CGV2.CLAIM_COL.PC_ID - 1] || "").trim(),
      imageUrl: normalizeCgv2Url_(row[CGV2.CLAIM_COL.IMAGEN_URL - 1])
    });
  }
  return rows;
}

function readCgv2FreeRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CGV2.SHEETS.FREES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CGV2.FREE_COL.NOTAS).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var nombreFinal = String(row[CGV2.FREE_COL.NOMBRE_FINAL - 1] || "").trim();
    var comprador = String(row[CGV2.FREE_COL.COMPRADOR - 1] || "").trim();
    if (!nombreFinal && !comprador) continue;
    rows.push({
      nombreFinal: nombreFinal,
      nombre: String(row[CGV2.FREE_COL.NOMBRE - 1] || "").trim(),
      expansion: String(row[CGV2.FREE_COL.EXPANSION - 1] || "").trim(),
      cantidad: Number(row[CGV2.FREE_COL.CANTIDAD - 1]) || 1,
      comprador: comprador,
      pcUrl: normalizeCgv2Url_(row[CGV2.FREE_COL.PC_URL - 1]),
      pcId: String(row[CGV2.FREE_COL.PC_ID - 1] || "").trim() || extractCgv2PriceChartingId_(row[CGV2.FREE_COL.PC_URL - 1]),
      tags: String(row[CGV2.FREE_COL.TAGS - 1] || "").trim(),
      notas: String(row[CGV2.FREE_COL.NOTAS - 1] || "").trim()
    });
  }
  return rows;
}

function sendCgv2ClaimToAdministration_(claimName, claimUrl, soldRows, freeRows) {
  var adminId = PropertiesService.getScriptProperties().getProperty(CGV2.PROP.ADMIN_SPREADSHEET_ID);
  if (!adminId) throw new Error("Falta configurar Administracion.");
  var admin = SpreadsheetApp.openById(adminId);
  var orders = admin.getSheetByName("Ordenes");
  var sales = admin.getSheetByName("Ventas Detalle");
  var frees = admin.getSheetByName("Frees");
  var claimsLog = admin.getSheetByName("Claims Log");
  if (!orders || !sales || !frees) throw new Error("La planilla de Administracion no tiene Ordenes/Ventas Detalle/Frees.");

  var date = new Date();
  var grouped = groupCgv2SoldRows_(soldRows);
  var orderIds = buildExistingCgv2OrderIdSet_(orders);
  var existingClaimBuyers = buildExistingCgv2ClaimBuyerSet_(orders);
  var orderRows = [];
  var saleRows = [];
  var freeAdminRows = [];
  var buyerCount = 0;
  var duplicates = [];

  for (var comprador in grouped) {
    if (!grouped.hasOwnProperty(comprador)) continue;
    var claimBuyerKey = buildCgv2ClaimBuyerKey_(claimName, comprador);
    if (existingClaimBuyers[claimBuyerKey]) {
      logCgv2_("Enviar a Administracion", "Omitido por duplicado: " + claimBuyerKey);
      duplicates.push(comprador);
      continue;
    }

    var group = grouped[comprador];
    var orderId = uniqueCgv2OrderId_(buildCgv2OrderId_(date, comprador), orderIds);
    orderIds[orderId] = true;
    existingClaimBuyers[claimBuyerKey] = true;
    buyerCount++;

    var totalArs = group.reduce(function(sum, row) { return sum + (Number(row.precioFinal) || 0); }, 0);
    var totalUsd = group.reduce(function(sum, row) { return sum + (Number(row.precioFinalUsd) || 0); }, 0);
    orderRows.push([orderId, claimName, date, comprador, totalArs, totalUsd, group.length, false, false, false, "", "", "", claimUrl, ""]);

    for (var i = 0; i < group.length; i++) {
      var card = group[i];
      var sku = card.pcId ? "PKM-PC-" + card.pcId : "";
      saleRows.push([
        orderId + "-" + (i + 1),
        orderId,
        claimName,
        date,
        "",
        "Claim",
        comprador,
        card.nombreFinal || buildCgv2FinalName_(card.nombre, card.expansion, card.precioFinal, card.precioFinalUsd),
        card.nombre,
        card.expansion,
        1,
        card.precioFinal,
        card.precioFinalUsd,
        card.pcUrl,
        card.pcId,
        sku,
        false,
        false,
        false,
        "",
        card.tags,
        ""
      ]);
    }

    var buyerFrees = freeRows.filter(function(row) { return row.comprador === comprador; });
    for (var f = 0; f < buyerFrees.length; f++) {
      var free = buyerFrees[f];
      freeAdminRows.push([
        orderId + "-FREE-" + (f + 1),
        orderId,
        claimName,
        date,
        comprador,
        free.nombreFinal,
        free.nombre,
        free.expansion,
        free.cantidad,
        free.pcUrl,
        free.pcId,
        free.pcId ? "PKM-PC-" + free.pcId : "",
        false,
        "",
        free.tags,
        free.notas
      ]);
    }
  }

  var orphanFrees = freeRows.filter(function(row) { return row.comprador && !grouped[row.comprador]; });
  for (var o = 0; o < orphanFrees.length; o++) {
    var orphan = orphanFrees[o];
    var orphanOrderId = uniqueCgv2OrderId_(buildCgv2OrderId_(date, orphan.comprador) + "-FREE", orderIds);
    orderIds[orphanOrderId] = true;
    orderRows.push([orphanOrderId, claimName, date, orphan.comprador, 0, 0, 0, true, false, false, "", "", "", claimUrl, "Solo frees"]);
    freeAdminRows.push([
      orphanOrderId + "-FREE-1",
      orphanOrderId,
      claimName,
      date,
      orphan.comprador,
      orphan.nombreFinal,
      orphan.nombre,
      orphan.expansion,
      orphan.cantidad,
      orphan.pcUrl,
      orphan.pcId,
      orphan.pcId ? "PKM-PC-" + orphan.pcId : "",
      false,
      "",
      orphan.tags,
      orphan.notas
    ]);
  }

  appendCgv2Rows_(orders, orderRows);
  appendCgv2Rows_(sales, saleRows);
  appendCgv2Rows_(frees, freeAdminRows);

  if (claimsLog) {
    claimsLog.appendRow([
      new Date(),
      claimName,
      claimUrl,
      buyerCount,
      soldRows.length,
      soldRows.reduce(function(sum, row) { return sum + (Number(row.precioFinal) || 0); }, 0),
      freeRows.length,
      "Generador Claims V2",
      ""
    ]);
  }

  if (duplicates.length) {
    logCgv2_("Duplicados omitidos", duplicates.join(", "));
  }

  return { orders: orderRows.length, sales: saleRows.length, frees: freeAdminRows.length, duplicates: duplicates.length };
}

function createCgv2ClaimArchive_(claimName) {
  var source = SpreadsheetApp.getActiveSpreadsheet();
  var archive = SpreadsheetApp.create(claimName);
  var first = archive.getSheets()[0];
  first.setName(CGV2.SHEETS.CARGA);
  copyCgv2SheetValues_(source.getSheetByName(CGV2.SHEETS.CARGA), first);
  copyCgv2SheetValues_(source.getSheetByName(CGV2.SHEETS.CLAIM), archive.insertSheet(CGV2.SHEETS.CLAIM));
  copyCgv2SheetValues_(source.getSheetByName(CGV2.SHEETS.FREES), archive.insertSheet(CGV2.SHEETS.FREES));
  copyCgv2SheetValues_(source.getSheetByName(CGV2.SHEETS.INFO), archive.insertSheet(CGV2.SHEETS.INFO));

  var folderName = String(readCgv2Config_().claim_archive_folder || "Pokemon Claims Archivados");
  var folder = getOrCreateCgv2Folder_(folderName);
  var file = DriveApp.getFileById(archive.getId());
  try {
    file.moveTo(folder);
  } catch (ignored) {}

  return { spreadsheetId: archive.getId(), url: archive.getUrl() };
}

function copyCgv2SheetValues_(source, target) {
  if (!source || !target) return;
  target.clear();
  var lastRow = Math.max(1, source.getLastRow());
  var lastCol = Math.max(1, source.getLastColumn());
  var values = source.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  target.getRange(1, 1, values.length, values[0].length).setValues(values);
  target.getRange(1, 1, 1, lastCol).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  target.setFrozenRows(1);
}

function logCgv2FinishedClaim_(claimName, claimUrl, soldRows, freeRows, orders) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CGV2.SHEETS.CLAIMS_LOG);
  if (!sheet) return;
  var total = soldRows.reduce(function(sum, row) { return sum + (Number(row.precioFinal) || 0); }, 0);
  sheet.appendRow([new Date(), claimName, claimUrl, orders, soldRows.length, total, freeRows.length, "Terminado"]);
}

function setupCgv2Config_(ss) {
  var sheet = ss.getSheetByName(CGV2.SHEETS.CONFIG) || ss.insertSheet(CGV2.SHEETS.CONFIG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:B1").setValues([["Clave", "Valor"]]);
  appendMissingCgv2Config_(sheet, [
    ["usd_ars", 1510],
    ["round_to", 500],
    ["min_price", 800],
    ["claim_archive_folder", "Pokemon Claims Archivados"],
    ["grid_folder_name", "Pokemon Claim Grids"],
    ["grid_columns", 5],
    ["grid_rows", 6],
    ["fetch_image_if_missing", true],
    ["image_fetch_delay_ms", 350],
    ["fast_lookup_max_rows", 80]
  ]);
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#263238").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function setupCgv2Load_(ss) {
  var sheet = ss.getSheetByName(CGV2.SHEETS.CARGA) || ss.insertSheet(CGV2.SHEETS.CARGA);
  applyCgv2Header_(sheet, [
    "ID", "Fecha carga", "PriceCharting URL", "PriceCharting ID", "Nombre PC", "Nombre",
    "Expansion PC", "Expansion", "Numero", "Precio USD", "Precio ARS calculado",
    "Precio redondeado", "Precio sugerido", "Imagen URL", "Preview", "Estado",
    "Grid lote", "Error", "Actualizado"
  ], "#1f2933");
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("J:M").setNumberFormat("#,##0.00");
  sheet.getRange("S:S").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.setColumnWidth(CGV2.CARGA_COL.PC_URL, 360);
  sheet.setColumnWidth(CGV2.CARGA_COL.IMAGEN_URL, 360);
  sheet.setColumnWidth(CGV2.CARGA_COL.PREVIEW, 120);
}

function setupCgv2Claim_(ss) {
  var sheet = ss.getSheetByName(CGV2.SHEETS.CLAIM) || ss.insertSheet(CGV2.SHEETS.CLAIM);
  applyCgv2Header_(sheet, [
    "ID", "Nombre", "Expansion", "Precio USD", "Precio ARS calculado", "Precio redondeado",
    "Precio final", "Precio final USD", "Nombre final", "Comprador", "Tags",
    "PriceCharting URL", "PriceCharting ID", "Imagen URL"
  ], "#0f766e");
  sheet.setFrozenColumns(3);
  sheet.getRange("D:H").setNumberFormat("#,##0.00");
  sheet.setColumnWidth(CGV2.CLAIM_COL.NOMBRE_FINAL, 300);
  sheet.setColumnWidth(CGV2.CLAIM_COL.COMPRADOR, 180);
  sheet.setColumnWidth(CGV2.CLAIM_COL.TAGS, 220);
  sheet.setColumnWidth(CGV2.CLAIM_COL.PC_URL, 360);
}

function setupCgv2Frees_(ss) {
  var sheet = ss.getSheetByName(CGV2.SHEETS.FREES) || ss.insertSheet(CGV2.SHEETS.FREES);
  applyCgv2Header_(sheet, ["Nombre final", "Nombre", "Expansion", "Cantidad", "Comprador", "PriceCharting URL", "PriceCharting ID", "Tags", "Notas"], "#b45309");
  sheet.getRange("D:D").setNumberFormat("#,##0");
  sheet.setColumnWidth(CGV2.FREE_COL.NOMBRE_FINAL, 300);
  sheet.setColumnWidth(CGV2.FREE_COL.PC_URL, 360);
}

function setupCgv2Info_(ss) {
  var sheet = ss.getSheetByName(CGV2.SHEETS.INFO) || ss.insertSheet(CGV2.SHEETS.INFO);
  if (!sheet.getRange("A1").getValue()) updateClaimGeneratorInfo();
}

function setupCgv2ClaimsLog_(ss) {
  var sheet = ss.getSheetByName(CGV2.SHEETS.CLAIMS_LOG) || ss.insertSheet(CGV2.SHEETS.CLAIMS_LOG);
  applyCgv2Header_(sheet, ["Fecha", "Claim", "Claim URL", "Ordenes", "Cartas vendidas", "Total ARS", "Frees", "Estado"], "#334155");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("F:F").setNumberFormat("#,##0.00");
  sheet.setColumnWidth(3, 360);
}

function setupCgv2Log_(ss) {
  var sheet = ss.getSheetByName(CGV2.SHEETS.LOG) || ss.insertSheet(CGV2.SHEETS.LOG);
  applyCgv2Header_(sheet, ["Fecha", "Origen", "Mensaje"], "#7f1d1d");
}

function applyCgv2Header_(sheet, headers, color) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(color).setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function fillCgv2LoadRow_(row, item, config) {
  var usdArs = Number(config.usd_ars || 1510);
  var roundTo = Number(config.round_to || 500);
  var minPrice = Number(config.min_price || 800);
  var usd = Number(item.usd) || 0;
  var ars = usd ? usd * usdArs : "";
  var rounded = usd ? roundCgv2Price_(ars, roundTo, minPrice) : "";
  var pcUrl = normalizeCgv2Url_(row[CGV2.CARGA_COL.PC_URL - 1] || item.pcUrl || "");
  var bestPcUrl = buildCgv2PriceChartingUrlFromItem_(item) || normalizeCgv2Url_(item.pcUrl);
  var imageUrl = item.imageUrl || "";

  if (!imageUrl && toCgv2Boolean_(config.fetch_image_if_missing) && pcUrl) {
    try {
      imageUrl = fetchCgv2PriceChartingImageUrl_(pickCgv2ExactPriceChartingUrl_(bestPcUrl, pcUrl, item.pcUrl) || pcUrl);
      Utilities.sleep(Number(config.image_fetch_delay_ms || 350));
    } catch (err) {
      row[CGV2.CARGA_COL.ERROR - 1] = "Info OK, imagen no encontrada: " + String(err && err.message ? err.message : err);
    }
  }

  row[CGV2.CARGA_COL.PC_ID - 1] = item.pcId;
  row[CGV2.CARGA_COL.NOMBRE_PC - 1] = item.nombrePc;
  row[CGV2.CARGA_COL.NOMBRE - 1] = item.nombre;
  row[CGV2.CARGA_COL.EXPANSION_PC - 1] = item.expansionPc;
  row[CGV2.CARGA_COL.EXPANSION - 1] = item.expansion;
  row[CGV2.CARGA_COL.NUMERO - 1] = item.numero;
  row[CGV2.CARGA_COL.USD - 1] = usd || "";
  row[CGV2.CARGA_COL.ARS_CALCULADO - 1] = ars;
  row[CGV2.CARGA_COL.ARS_REDONDEADO - 1] = rounded;
  row[CGV2.CARGA_COL.PRECIO_SUGERIDO - 1] = rounded;
  row[CGV2.CARGA_COL.IMAGEN_URL - 1] = imageUrl;
  row[CGV2.CARGA_COL.ESTADO - 1] = "OK";
  row[CGV2.CARGA_COL.ERROR - 1] = "";
  row[CGV2.CARGA_COL.ACTUALIZADO - 1] = new Date();
}

function upsertCgv2ClaimRow_(claim, claimIndex, loadRow, item, config) {
  var id = String(loadRow[CGV2.CARGA_COL.ID - 1] || "").trim();
  var targetRow = claimIndex[id] || (claim.getLastRow() + 1);
  var existing = targetRow <= claim.getLastRow()
    ? claim.getRange(targetRow, 1, 1, CGV2.CLAIM_COL.IMAGEN_URL).getValues()[0]
    : [];
  var existingFormulas = targetRow <= claim.getLastRow()
    ? claim.getRange(targetRow, 1, 1, CGV2.CLAIM_COL.IMAGEN_URL).getFormulas()[0]
    : [];

  var rounded = Number(loadRow[CGV2.CARGA_COL.ARS_REDONDEADO - 1]) || "";
  var finalPrice = existing[CGV2.CLAIM_COL.PRECIO_FINAL - 1] || "";
  var finalUsd = existing[CGV2.CLAIM_COL.PRECIO_FINAL_USD - 1] || "";
  var nombre = existing[CGV2.CLAIM_COL.NOMBRE - 1] || item.nombre || "";
  var expansion = existing[CGV2.CLAIM_COL.EXPANSION - 1] || item.expansion || "";
  var hasManualFinalName = existing[CGV2.CLAIM_COL.NOMBRE_FINAL - 1] &&
    !existingFormulas[CGV2.CLAIM_COL.NOMBRE_FINAL - 1];

  var values = [[
    id,
    nombre,
    expansion,
    loadRow[CGV2.CARGA_COL.USD - 1],
    loadRow[CGV2.CARGA_COL.ARS_CALCULADO - 1],
    rounded,
    finalPrice,
    finalUsd,
    hasManualFinalName ? existing[CGV2.CLAIM_COL.NOMBRE_FINAL - 1] : "",
    existing[CGV2.CLAIM_COL.COMPRADOR - 1] || "",
    existing[CGV2.CLAIM_COL.TAGS - 1] || "",
    loadRow[CGV2.CARGA_COL.PC_URL - 1] || item.pcUrl,
    item.pcId,
    item.imageUrl
  ]];
  claim.getRange(targetRow, 1, 1, CGV2.CLAIM_COL.IMAGEN_URL).setValues(values);
  if (!hasManualFinalName) {
    claim.getRange(targetRow, CGV2.CLAIM_COL.NOMBRE_FINAL).setFormula(buildCgv2FinalNameFormula_(targetRow));
  }
  claimIndex[id] = targetRow;
}

function applyCgv2LoadPreviewFormulas_(sheet, startRow, numRows) {
  var formulas = [];
  for (var i = 0; i < numRows; i++) {
    var row = startRow + i;
    formulas.push(["=IF(N" + row + "=\"\",\"\",IMAGE(N" + row + "))"]);
  }
  sheet.getRange(startRow, CGV2.CARGA_COL.PREVIEW, numRows, 1).setFormulas(formulas);
}

function buildCgv2ClaimIndex_(claim) {
  var index = {};
  if (!claim || claim.getLastRow() < 2) return index;
  var values = claim.getRange(2, CGV2.CLAIM_COL.ID, claim.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0] || "").trim();
    if (id) index[id] = i + 2;
  }
  return index;
}

function groupCgv2SoldRows_(rows) {
  var grouped = {};
  for (var i = 0; i < rows.length; i++) {
    var buyer = rows[i].comprador;
    if (!buyer) continue;
    if (!grouped[buyer]) grouped[buyer] = [];
    grouped[buyer].push(rows[i]);
  }
  return grouped;
}

function buildExistingCgv2OrderIdSet_(orders) {
  var out = {};
  if (!orders || orders.getLastRow() < 2) return out;
  var values = orders.getRange(2, 1, orders.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0]) out[String(values[i][0])] = true;
  }
  return out;
}

function buildExistingCgv2ClaimBuyerSet_(orders) {
  var out = {};
  if (!orders || orders.getLastRow() < 2) return out;
  var values = orders.getRange(2, 1, orders.getLastRow() - 1, 4).getValues();
  for (var i = 0; i < values.length; i++) {
    var claim = String(values[i][1] || "").trim();
    var buyer = String(values[i][3] || "").trim();
    if (claim && buyer) out[buildCgv2ClaimBuyerKey_(claim, buyer)] = true;
  }
  return out;
}

function buildCgv2ClaimBuyerKey_(claimName, comprador) {
  return slugCgv2_(claimName) + "::" + slugCgv2_(comprador);
}

function uniqueCgv2OrderId_(base, existing) {
  if (!existing[base]) return base;
  var index = 2;
  while (existing[base + "-" + index]) index++;
  return base + "-" + index;
}

function buildCgv2OrderId_(date, comprador) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + slugCgv2_(comprador).toUpperCase();
}

function buildCgv2ClaimName_() {
  var now = new Date();
  var day = Utilities.formatDate(now, Session.getScriptTimeZone(), "d");
  var month = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), "M"));
  var months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return "Claim " + day + " de " + months[month - 1];
}

function buildCgv2FinalName_(name, expansion, priceArs, priceUsd) {
  var base = [name, expansion].filter(Boolean).join(" - ");
  var prices = [];
  if (priceArs) prices.push("$" + priceArs);
  if (priceUsd) prices.push("$" + priceUsd + "usd");
  return prices.length ? base + " - " + prices.join(" + ") : base;
}

function buildCgv2FinalNameFormula_(row) {
  return "=IF(AND(B" + row + "=\"\",C" + row + "=\"\"),\"\",B" + row +
    "&IF(C" + row + "<>\"\",\" - \"&C" + row + ",\"\")" +
    "&IF(AND(G" + row + "<>\"\",H" + row + "<>\"\"),\" - $\"&G" + row + "&\" + $\"&H" + row + "&\"usd\"," +
    "IF(G" + row + "<>\"\",\" - $\"&G" + row + ",IF(H" + row + "<>\"\",\" - $\"&H" + row + "&\"usd\",\"\"))))";
}

function buildCgv2CacheIndex_() {
  var id = PropertiesService.getScriptProperties().getProperty(CGV2.PROP.PC_CACHE_SPREADSHEET_ID);
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

function buildCgv2CacheLookup_() {
  var id = PropertiesService.getScriptProperties().getProperty(CGV2.PROP.PC_CACHE_SPREADSHEET_ID);
  if (!id) throw new Error("Falta configurar PriceCharting Cache.");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("PriceCharting Cache");
  if (!sheet || sheet.getLastRow() < 2) {
    return { byId: {}, byUrl: {}, find: function() { return null; } };
  }

  var memoById = {};
  var memoByUrl = {};
  return {
    byId: memoById,
    byUrl: memoByUrl,
    find: function(pcId, pcUrl) {
      pcId = String(pcId || "").trim();
      var canonical = canonicalCgv2Url_(pcUrl);

      if (pcId && memoById.hasOwnProperty(pcId)) return memoById[pcId];
      if (canonical && memoByUrl.hasOwnProperty(canonical)) return memoByUrl[canonical];

      var item = null;
      if (pcId) {
        item = findCgv2CacheRowByText_(sheet, 1, pcId);
      }
      if (!item && canonical) {
        item = findCgv2CacheRowByText_(sheet, 2, canonical);
      }

      if (pcId) memoById[pcId] = item;
      if (canonical) memoByUrl[canonical] = item;
      return item;
    }
  };
}

function findCgv2CacheRowByText_(sheet, column, text) {
  var found = sheet
    .getRange(2, column, Math.max(1, sheet.getLastRow() - 1), 1)
    .createTextFinder(String(text))
    .matchEntireCell(true)
    .findNext();
  if (!found) return null;

  var values = sheet.getRange(found.getRow(), 1, 1, 12).getValues()[0];
  return {
    pcId: String(values[0] || "").trim(),
    canonicalUrl: String(values[1] || "").trim(),
    pcUrl: values[2],
    nombrePc: values[3],
    nombre: values[4],
    expansionPc: values[5],
    expansion: values[6],
    numero: values[7],
    usd: values[8],
    imageUrl: values[9]
  };
}

function findCgv2CacheItem_(cache, pcId, pcUrl) {
  if (cache && typeof cache.find === "function") return cache.find(pcId, pcUrl);
  if (pcId && cache.byId[String(pcId)]) return cache.byId[String(pcId)];
  var canonical = canonicalCgv2Url_(pcUrl);
  return canonical ? cache.byUrl[canonical] : null;
}

function appendCgv2Rows_(sheet, rows) {
  if (!rows.length) return;
  var startRow = findFirstEmptyCgv2KeyRow_(sheet, 1);
  var range = sheet.getRange(startRow, 1, rows.length, rows[0].length);
  range.setValues(rows);
}

function findFirstEmptyCgv2KeyRow_(sheet, keyCol) {
  var maxRows = Math.max(2, sheet.getMaxRows());
  var values = sheet.getRange(2, keyCol, maxRows - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (isCgv2EmptyAppendCell_(values[i][0])) return i + 2;
  }
  return maxRows + 1;
}

function isCgv2EmptyAppendCell_(value) {
  if (value === false || value === "" || value === null || value === undefined) return true;
  var text = String(value).trim().toLowerCase();
  return text === "" || text === "false";
}

function appendMissingCgv2Config_(sheet, defaults) {
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) if (values[i][0]) existing[String(values[i][0])] = true;
  }
  var append = defaults.filter(function(row) { return !existing[row[0]]; });
  if (append.length) sheet.getRange(sheet.getLastRow() + 1, 1, append.length, 2).setValues(append);
}

function readCgv2Config_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CGV2.SHEETS.CONFIG);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) if (values[i][0]) out[String(values[i][0])] = values[i][1];
  return out;
}

function getOrCreateCgv2Folder_(folderName) {
  var ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  var parents = ssFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var folders = parent.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(folderName);
}

function getReadyImageGridPayload(options) {
  options = options || {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CGV2.SHEETS.CARGA);
  if (!sheet || sheet.getLastRow() < 2) throw new Error("No hay links cargados.");

  var config = readCgv2Config_();
  var columns = Number(config.grid_columns || 5);
  var rows = Number(config.grid_rows || 6);
  var limit = columns * rows;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CGV2.CARGA_COL.ACTUALIZADO).getValues();
  var urls = [];
  var rowNumbers = [];

  for (var i = 0; i < values.length; i++) {
    var imageUrl = normalizeCgv2Url_(values[i][CGV2.CARGA_COL.IMAGEN_URL - 1]);
    var grid = String(values[i][CGV2.CARGA_COL.GRID_LOTE - 1] || "").trim();
    var status = String(values[i][CGV2.CARGA_COL.ESTADO - 1] || "").trim();
    if (imageUrl && !grid && status !== "Error") {
      urls.push(imageUrl);
      rowNumbers.push(i + 2);
    }
    if (urls.length >= limit) break;
  }
  if (!urls.length) throw new Error("No hay imagenes listas para grid.");

  return {
    totalUrls: urls.length,
    rowNumbers: rowNumbers,
    batches: [urls],
    canvasWidth: Number(options.canvasWidth || 1600),
    cardAspectRatio: 63 / 88,
    outputFolderName: String(options.outputFolderName || config.grid_folder_name || "Pokemon Claim Grids"),
    filePrefix: String(options.filePrefix || "grid-claim"),
    backgroundColor: String(options.backgroundColor || "#ffffff"),
    columns: columns,
    rows: rows,
    outerMargin: Number(options.outerMargin || 0),
    cellGap: Number(options.cellGap || 0)
  };
}

function getReadyImageGridBatchData(options, batchIndex) {
  var payload = getReadyImageGridPayload(options || {});
  var urls = payload.batches[Number(batchIndex) || 0] || [];
  var images = [];
  var skipped = 0;

  for (var i = 0; i < urls.length; i++) {
    try {
      var blob = fetchCgv2ImageBlob_(urls[i], i);
      images.push({ ok: true, url: urls[i], dataUrl: blobToCgv2DataUrl_(blob) });
    } catch (err) {
      skipped++;
      images.push({ ok: false, url: urls[i], error: String(err && err.message ? err.message : err) });
    }
  }

  return { batchIndex: Number(batchIndex) || 0, images: images, skipped: skipped };
}

function saveGeneratedReadyGridPng(fileName, dataUrl, outputFolderName, rowNumbers) {
  var base64 = String(dataUrl || "").replace(/^data:image\/png;base64,/, "");
  if (!base64) throw new Error("PNG vacio.");
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), "image/png", fileName);
  var folder = getOrCreateCgv2Folder_(outputFolderName || "Pokemon Claim Grids");
  var file = folder.createFile(blob);
  var batchName = String(fileName || "").replace(/\.png$/i, "");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CGV2.SHEETS.CARGA);
  var rows = (rowNumbers || []).map(function(row) { return Number(row); }).filter(function(row) { return row > 1; });
  for (var i = 0; sheet && i < rows.length; i++) {
    sheet.getRange(rows[i], CGV2.CARGA_COL.GRID_LOTE).setValue(batchName);
  }
  return { name: file.getName(), url: file.getUrl(), folderUrl: folder.getUrl() };
}

function promptExportReadyGrid() {
  var config = readCgv2Config_();
  var exportConfig = {
    mode: "ready",
    columns: Number(config.grid_columns || 5),
    rows: Number(config.grid_rows || 6),
    canvasWidth: 1600,
    outerMargin: 0,
    cellGap: 0,
    backgroundColor: "#ffffff",
    outputFolderName: String(config.grid_folder_name || "Pokemon Claim Grids"),
    filePrefix: "grid-claim"
  };

  var template = HtmlService.createTemplateFromFile("ImageGridExporterDialog");
  template.exportConfigJson = JSON.stringify(exportConfig);
  var html = template.evaluate().setWidth(480).setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, "Exportando grid PNG");
}

function fetchCgv2ImageBlob_(url, index) {
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Mozilla/5.0 ClaimGeneratorV2 Image Grid" }
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error("HTTP " + status);
  var blob = response.getBlob();
  var contentType = String(blob.getContentType() || "");
  if (contentType.indexOf("image/") !== 0) throw new Error("Content-Type invalido: " + contentType);
  return blob.setName("card-" + (index + 1) + ".jpg");
}

function fetchCgv2PriceChartingImageUrl_(url) {
  var candidates = buildCgv2FetchUrlCandidates_(url);
  var lastError = "";
  for (var i = 0; i < candidates.length; i++) {
    var response = UrlFetchApp.fetch(candidates[i], {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0 ClaimGeneratorV2/2.0" }
    });
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      lastError = "HTTP " + status;
      continue;
    }
    var html = response.getContentText();
    var imageUrl = extractFirstCgv2_(html, /(https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'<>\s]+\/1600\.jpg)/i)
      || extractFirstCgv2_(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
      || extractFirstCgv2_(html, /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    if (imageUrl) return imageUrl;
    lastError = "Imagen no encontrada";
  }
  throw new Error(lastError || "Imagen no encontrada");
}

function blobToCgv2DataUrl_(blob) {
  return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
}

function roundCgv2Price_(value, roundTo, minPrice) {
  var rounded = Math.ceil(value / roundTo) * roundTo;
  return Math.max(Number(minPrice) || 0, rounded);
}

function extractCgv2SpreadsheetId_(input) {
  var text = String(input || "").trim();
  var match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = text.match(/^[a-zA-Z0-9-_]{20,}$/);
  return match ? match[0] : "";
}

function extractCgv2PriceChartingId_(url) {
  var match = String(url || "").match(/[?&]id=(\d+)/i);
  return match ? match[1] : "";
}

function normalizeCgv2Url_(value) {
  var text = String(value || "").trim();
  var match = text.match(/https?:\/\/[^\s\])]+/i);
  return match ? match[0] : text;
}

function canonicalCgv2Url_(url) {
  var text = normalizeCgv2Url_(url);
  if (!text) return "";
  text = text.replace(/^http:\/\//i, "https://").split("#")[0].split("?")[0].replace(/\/+$/g, "").toLowerCase();
  var match = text.match(/^(https:\/\/www\.pricecharting\.com\/game\/)([^\/]+)\/([^\/]+)$/i);
  if (match) {
    return match[1].toLowerCase() + slugCgv2_(decodeURIComponentSafeCgv2_(match[2])) + "/" + slugCgv2_(decodeURIComponentSafeCgv2_(match[3]));
  }
  return text;
}

function buildCgv2PriceChartingUrlFromItem_(item) {
  item = item || {};
  var expansion = item.expansionPc || item.expansion || "";
  var product = item.nombrePc || item.nombre || "";
  if (!product && item.nombre && item.numero) product = item.nombre + " #" + item.numero;
  if (!expansion || !product) return "";
  return "https://www.pricecharting.com/game/" + slugCgv2PriceChartingPath_(expansion) + "/" + slugCgv2PriceChartingPath_(product);
}

function pickCgv2ExactPriceChartingUrl_() {
  for (var i = 0; i < arguments.length; i++) {
    var url = normalizeCgv2Url_(arguments[i]);
    if (url && /^https?:\/\/www\.pricecharting\.com\/game\/[^\/]+\/[^\/]+$/i.test(url.split("#")[0].split("?")[0].replace(/\/+$/g, ""))) return url;
  }
  return "";
}

function buildCgv2FetchUrlCandidates_(url) {
  var out = [];
  var seen = {};
  var base = normalizeCgv2Url_(url);
  [base, base.replace(/['\u2019]/g, "%27")].forEach(function(candidate) {
    if (candidate && !seen[candidate]) {
      seen[candidate] = true;
      out.push(candidate);
    }
  });
  return out;
}

function extractFirstCgv2_(text, regex) {
  var match = String(text || "").match(regex);
  return match ? match[1] : "";
}

function decodeURIComponentSafeCgv2_(text) {
  try {
    return decodeURIComponent(String(text || ""));
  } catch (err) {
    return String(text || "");
  }
}

function toCgv2Boolean_(value) {
  if (value === true) return true;
  var text = String(value || "").toLowerCase().trim();
  return text === "true" || text === "si" || text === "1" || text === "ok";
}

function slugCgv2_(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugCgv2PriceChartingPath_(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['\u2019]/g, "%27")
    .replace(/[^a-z0-9%]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function logCgv2_(origin, message) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CGV2.SHEETS.LOG);
  if (sheet) sheet.appendRow([new Date(), origin, message]);
}
