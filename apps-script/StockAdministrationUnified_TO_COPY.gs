// ============================================================
// Stock + Administracion
// Main spreadsheet for stock, purchases, claim orders, manual sales,
// freebies, and final stock movements.
// ============================================================

var SAU = {
  SHEETS: {
    DASHBOARD: "Dashboard",
    CONFIG: "Config",
    STOCK: "Stock",
    COMPRAS: "Compras",
    ORDENES: "Ordenes",
    VENTAS: "Ventas Detalle",
    FREES: "Frees",
    CLAIMS_LOG: "Claims Log",
    ENTREGAS_LOG: "Entregas Log",
    LOG: "Log",
    MOVIMIENTOS: "Movimientos Stock",
    REVISION: "Revision Pendiente",
    SNAPSHOTS: "Stock Snapshots",
    AUDITORIA: "Auditoria App",
    PAGOS: "Pagos Ordenes",
    EMBALAJE: "Embalaje Detalle",
    ACCIONES_APP: "Acciones App",
    USUARIOS_APP: "Usuarios App",
    SESIONES_APP: "Sesiones App"
  },
  PROP: {
    PC_CACHE_SPREADSHEET_ID: "PC_CACHE_SPREADSHEET_ID",
    TCG_CACHE_SPREADSHEET_ID: "TCG_CACHE_SPREADSHEET_ID",
    CLAIM_GENERATOR_SPREADSHEET_ID: "CLAIM_GENERATOR_SPREADSHEET_ID",
    MOBILE_API_TOKEN: "MOBILE_API_TOKEN",
    STOCK_IMAGE_REPAIR_NEXT_ROW: "STOCK_IMAGE_REPAIR_NEXT_ROW",
    STOCK_IMAGE_REPAIR_AUTO_RUNNING: "STOCK_IMAGE_REPAIR_AUTO_RUNNING",
    STOCK_IMAGE_REPAIR_LAST_RESULT: "STOCK_IMAGE_REPAIR_LAST_RESULT"
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
    ULTIMA_COMPRA_USD: 21,
    TCGPLAYER_ID: 22,
    TCGPLAYER_MARKET_USD: 23,
    TCGPLAYER_SUBTYPE: 24,
    TCGPLAYER_UPDATED_AT: 25
  },
  COMPRA_COL: {
    FECHA: 1,
    PROVEEDOR: 2,
    ITEM: 3,
    NOMBRE: 4,
    EXPANSION: 5,
    CANTIDAD: 6,
    COSTO_TOTAL_ARS: 7,
    COSTO_UNITARIO_ARS: 8,
    PC_URL: 9,
    PC_ID: 10,
    RECIBIDO: 11,
    SYNC_STOCK: 12,
    NOTAS: 13,
    COSTO_TOTAL_USD: 14,
    COSTO_UNITARIO_USD: 15,
    COMPRA_ID: 16,
    RECIBIDO_CANTIDAD: 17,
    CREADO_POR: 18
  },
  ORDEN_COL: {
    ORDER_ID: 1,
    CLAIM: 2,
    FECHA_CLAIM: 3,
    COMPRADOR: 4,
    TOTAL_ARS: 5,
    TOTAL_USD: 6,
    CARTAS: 7,
    PAGADO: 8,
    EMBALADO: 9,
    ENTREGADO: 10,
    FECHA_PAGO: 11,
    FECHA_ENTREGA: 12,
    SYNC_VENTAS: 13,
    CLAIM_URL: 14,
    NOTAS: 15,
    PAGADO_ARS: 16,
    PAGADO_USD: 17,
    SALDO_ARS: 18,
    SALDO_USD: 19,
    ULTIMO_PAGO: 20,
    PAGO_NOTAS: 21
  },
  VENTA_COL: {
    VENTA_ID: 1,
    ORDER_ID: 2,
    CLAIM: 3,
    FECHA_CLAIM: 4,
    FECHA_VENTA: 5,
    ORIGEN: 6,
    COMPRADOR: 7,
    NOMBRE_FINAL: 8,
    NOMBRE: 9,
    EXPANSION: 10,
    CANTIDAD: 11,
    PRECIO_ARS: 12,
    PRECIO_USD: 13,
    PC_URL: 14,
    PC_ID: 15,
    SKU: 16,
    PAGADO: 17,
    EMBALADO: 18,
    ENTREGADO: 19,
    SYNC_STOCK: 20,
    TAGS: 21,
    NOTAS: 22,
    ANULADA: 23,
    FECHA_ANULACION: 24,
    ANULADA_POR: 25,
    MOTIVO_ANULACION: 26
  },
  FREE_COL: {
    FREE_ID: 1,
    ORDER_ID: 2,
    CLAIM: 3,
    FECHA_CLAIM: 4,
    COMPRADOR: 5,
    NOMBRE_FINAL: 6,
    NOMBRE: 7,
    EXPANSION: 8,
    CANTIDAD: 9,
    PC_URL: 10,
    PC_ID: 11,
    SKU: 12,
    ENTREGADO: 13,
    SYNC_STOCK: 14,
    TAGS: 15,
    NOTAS: 16
  }
};

var SAU_CLAIM = {
  SHEETS: {
    CONFIG: "Config",
    LOAD: "Carga",
    CLAIM: "Claim",
    FREES: "Frees",
    INFO: "Info",
    CLAIMS_LOG: "Claims Log",
    STATE: "App Claim State",
    GRID_LOG: "App Claim Grids"
  },
  LOAD_COL: {
    ID: 1,
    LOADED_AT: 2,
    PC_URL: 3,
    PC_ID: 4,
    PC_NAME: 5,
    NAME: 6,
    PC_EXPANSION: 7,
    EXPANSION: 8,
    NUMBER: 9,
    PC_USD: 10,
    PC_ARS: 11,
    ROUNDED_ARS: 12,
    SUGGESTED_ARS: 13,
    IMAGE_URL: 14,
    PREVIEW: 15,
    STATUS: 16,
    GRID_BATCH: 17,
    ERROR: 18,
    UPDATED_AT: 19
  },
  CLAIM_COL: {
    ID: 1,
    NAME: 2,
    EXPANSION: 3,
    PC_USD: 4,
    PC_ARS: 5,
    SUGGESTED_ARS: 6,
    FINAL_ARS: 7,
    FINAL_USD: 8,
    FINAL_NAME: 9,
    BUYER: 10,
    TAGS: 11,
    PC_URL: 12,
    PC_ID: 13,
    IMAGE_URL: 14
  },
  FREE_COL: {
    FINAL_NAME: 1,
    NAME: 2,
    EXPANSION: 3,
    QUANTITY: 4,
    BUYER: 5,
    PC_URL: 6,
    PC_ID: 7,
    TAGS: 8,
    NOTES: 9
  }
};

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Stock Admin")
    .addSubMenu(ui.createMenu("Inicio y app")
      .addItem("Abrir app ventas", "showMobileSalesApp")
      .addItem("Actualizar dashboard", "refreshStockAdminDashboard"))
    .addSubMenu(ui.createMenu("Configuracion")
      .addItem("Crear / reparar estructura", "setupStockAdministration")
      .addItem("Configurar token app mobile", "promptConfigureMobileApiToken")
      .addItem("Configurar PriceCharting Cache", "promptConfigureStockAdminPcCache")
      .addItem("Configurar TCGplayer Cache", "promptConfigureStockAdminTcgCache")
      .addItem("Configurar Generador de Claims", "promptConfigureStockAdminClaimGenerator"))
    .addSubMenu(ui.createMenu("Stock")
      .addItem("Completar stock desde PriceCharting", "completeStockFromPriceChartingCache")
      .addItem("Completar stock con TCGplayer", "completeStockFromTcgCsvCache")
      .addItem("Registrar snapshot de stock", "recordSauDailyStockSnapshot")
      .addItem("Revisar salud del stock", "refreshSauPendingReview")
      .addItem("Iniciar reparar imagenes automatico", "startStockImageRepairAuto")
      .addItem("Pausar reparar imagenes automatico", "stopStockImageRepairAuto")
      .addItem("Reparar links e imagenes (tanda)", "repairStockLinksAndImagesBatch")
      .addItem("Reparar filas seleccionadas", "repairSelectedStockLinksAndImages")
      .addItem("Reset reparar imagenes", "resetStockImageRepairProgress"))
    .addSubMenu(ui.createMenu("Compras")
      .addItem("Completar compras desde cache", "completePurchasesFromPriceChartingCache")
      .addItem("Procesar compras recibidas", "processReceivedPurchases"))
    .addSubMenu(ui.createMenu("Ventas y ordenes")
      .addItem("Completar ventas desde cache", "completeSalesFromPriceChartingCache")
      .addItem("Procesar ordenes listas", "processReadyOrders")
      .addItem("Sincronizar ventas y frees listas", "syncReadySalesAndFrees")
      .addItem("Archivar ordenes entregadas", "archiveDeliveredOrders"))
    .addSubMenu(ui.createMenu("Visual")
      .addItem("Aplicar formato visual", "applyStockAdminVisualPolish")
      .addItem("Actualizar dashboard", "refreshStockAdminDashboard"))
    .addSubMenu(ui.createMenu("Automatizaciones")
      .addItem("Activar triggers", "setupStockAdministrationTriggers")
      .addItem("Desactivar triggers", "removeStockAdministrationTriggers"))
    .addToUi();
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleSauMobileApi_(e.parameter);
  }
  return HtmlService.createHtmlOutputFromFile("MobileSalesApp")
    .setTitle("Ultimo Turno - Ventas")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
}

function doPost(e) {
  var request = {};
  if (e && e.postData && e.postData.contents) {
    try {
      request = JSON.parse(e.postData.contents);
    } catch (err) {
      return mobileSauJson_({ ok: false, error: "JSON invalido." });
    }
  }
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(key) {
      if (request[key] === undefined) request[key] = e.parameter[key];
    });
  }
  return handleSauMobileApi_(request);
}

function showMobileSalesApp() {
  var html = HtmlService.createHtmlOutputFromFile("MobileSalesApp")
    .setWidth(430)
    .setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, "App ventas");
}

function promptConfigureMobileApiToken() {
  var ui = SpreadsheetApp.getUi();
  var current = PropertiesService.getScriptProperties().getProperty(SAU.PROP.MOBILE_API_TOKEN);
  var generated = Utilities.getUuid().replace(/-/g, "");
  var prompt = ui.prompt(
    "Token app mobile",
    "Pega un token interno o deja vacio para generar uno nuevo." + (current ? "\nYa hay un token configurado." : "\nSugerido: " + generated),
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var token = String(prompt.getResponseText() || "").trim() || generated;
  PropertiesService.getScriptProperties().setProperty(SAU.PROP.MOBILE_API_TOKEN, token);
  ui.alert("Token configurado:\n" + token + "\n\nGuardalo para cargarlo en la app nativa.");
}

function setupStockAdministration() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSauDashboard_(ss);
  setupSauConfig_(ss);
  setupSauStock_(ss);
  setupSauPurchases_(ss);
  setupSauOrders_(ss);
  setupSauSales_(ss);
  setupSauFrees_(ss);
  setupSauClaimsLog_(ss);
  setupSauDeliveryLog_(ss);
  setupSauLog_(ss);
  setupSauMovements_(ss);
  setupSauReview_(ss);
  setupSauSnapshots_(ss);
  setupSauAudit_(ss);
  setupSauPayments_(ss);
  setupSauPacking_(ss);
  setupSauAppActions_(ss);
  setupSauUsers_(ss);
  setupSauSessions_(ss);
  refreshStockAdminDashboard();
  applyStockAdminVisualPolish();
  SpreadsheetApp.getUi().alert("Stock + Administracion listo.");
}

function promptConfigureStockAdminPcCache() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt("PriceCharting Cache", "Pega el ID o URL de la planilla cache.", ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var id = extractSauSpreadsheetId_(prompt.getResponseText());
  if (!id) {
    ui.alert("No pude leer el ID.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty(SAU.PROP.PC_CACHE_SPREADSHEET_ID, id);
  ui.alert("Cache configurado.");
}

function promptConfigureStockAdminTcgCache() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt("TCGplayer Cache", "Pega el ID o URL de la planilla TCGplayer Cache.", ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var id = extractSauSpreadsheetId_(prompt.getResponseText());
  if (!id) {
    ui.alert("No pude leer el ID.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty(SAU.PROP.TCG_CACHE_SPREADSHEET_ID, id);
  ui.alert("TCGplayer Cache configurado.");
}

function promptConfigureStockAdminClaimGenerator() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt("Generador de Claims", "Pega el ID o URL de la planilla Generador de Claims V2.", ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var id = extractSauSpreadsheetId_(prompt.getResponseText());
  if (!id) {
    ui.alert("No pude leer el ID.");
    return;
  }
  var generator = SpreadsheetApp.openById(id);
  assertSauClaimGeneratorStructure_(generator);
  ensureSauClaimAppSheets_(generator);
  PropertiesService.getScriptProperties().setProperty(SAU.PROP.CLAIM_GENERATOR_SPREADSHEET_ID, id);
  ui.alert("Generador configurado: " + generator.getName());
}

function setupStockAdministrationTriggers() {
  removeStockAdministrationTriggers(false);
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("stockAdministrationOnEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("processReadyOrders").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("recordSauDailyStockSnapshot").timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger("refreshSauPendingReview").timeBased().everyDays(1).atHour(4).create();
  SpreadsheetApp.getUi().alert("Triggers activados.");
}

function removeStockAdministrationTriggers(showAlert) {
  var handlers = {
    stockAdministrationOnEdit: true,
    processReadyOrders: true,
    runStockImageRepairAuto: true,
    recordSauDailyStockSnapshot: true,
    refreshSauPendingReview: true
  };
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (handlers[triggers[i].getHandlerFunction()]) ScriptApp.deleteTrigger(triggers[i]);
  }
  if (showAlert !== false) SpreadsheetApp.getUi().alert("Triggers desactivados.");
}

function stockAdministrationOnEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var name = sheet.getName();
  var col = e.range.getColumn();

  if (name === SAU.SHEETS.STOCK && col === SAU.STOCK_COL.PC_URL) {
    completeStockFromPriceChartingCache({ startRow: e.range.getRow(), numRows: e.range.getNumRows() });
    return;
  }

  if (name === SAU.SHEETS.VENTAS && col === SAU.VENTA_COL.PC_URL) {
    completeSalesFromPriceChartingCache({ startRow: e.range.getRow(), numRows: e.range.getNumRows() });
    return;
  }

  if (name === SAU.SHEETS.COMPRAS && col === SAU.COMPRA_COL.RECIBIDO) {
    processReceivedPurchases();
    return;
  }

  if (name === SAU.SHEETS.COMPRAS && col === SAU.COMPRA_COL.PC_URL) {
    completePurchasesFromPriceChartingCache({ startRow: e.range.getRow(), numRows: e.range.getNumRows() });
    return;
  }

  if (name === SAU.SHEETS.ORDENES &&
      (col === SAU.ORDEN_COL.PAGADO || col === SAU.ORDEN_COL.EMBALADO || col === SAU.ORDEN_COL.ENTREGADO)) {
    processReadyOrders();
  }
}

function completeStockFromPriceChartingCache(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { updated: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!stock) throw new Error("No existe hoja Stock.");
    if (stock.getLastRow() < 2) return { updated: 0 };

    var startRow = Math.max(2, Number(options.startRow || 2));
    var numRows = Number(options.numRows || (stock.getLastRow() - startRow + 1));
    if (numRows <= 0) return { updated: 0 };

    var config = readSauConfig_();
    config.force_product_url = toSauBoolean_(options.forceProductUrl);
    config.force_image = toSauBoolean_(options.forceImage);
    config.fetch_image_if_missing = toSauBoolean_(config.fetch_image_if_missing) && numRows <= Number(config.image_repair_batch_size || 40);
    var useFastLookup = numRows <= Number((config || {}).fast_lookup_max_rows || 80);
    var cache = useFastLookup ? buildSauCacheLookup_() : buildSauCacheIndex_();
    var range = stock.getRange(startRow, 1, numRows, SAU.STOCK_COL.NOTAS);
    var values = range.getValues();
    var now = new Date();
    var updated = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var pcUrl = normalizeSauUrl_(row[SAU.STOCK_COL.PC_URL - 1]);
      var pcId = String(row[SAU.STOCK_COL.PC_ID - 1] || "").trim() || extractSauPriceChartingId_(pcUrl);
      if (!pcUrl && !pcId) continue;
      var item = findSauCacheItem_(cache, pcId, pcUrl);
      if (!item) continue;
      fillSauStockRowFromCache_(row, item, config, now);
      updated++;
    }

    range.setValues(values);
    return { updated: updated };
  } finally {
    lock.releaseLock();
  }
}

function completeStockFromTcgCsvCache(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { updated: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!stock) throw new Error("No existe hoja Stock.");
    if (stock.getLastRow() < 2) return { updated: 0 };

    var startRow = Math.max(2, Number(options.startRow || 2));
    var numRows = Number(options.numRows || (stock.getLastRow() - startRow + 1));
    if (numRows <= 0) return { updated: 0 };

    var config = readSauConfig_();
    var useFastLookup = numRows <= Number((config || {}).fast_lookup_max_rows || 80);
    var cache = useFastLookup ? buildSauTcgCacheLookup_() : buildSauTcgCacheIndex_();
    var range = stock.getRange(startRow, 1, numRows, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT);
    var values = range.getValues();
    var updated = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var before = JSON.stringify(row);
      var item = findSauTcgCacheItem_(cache, {
        productId: row[SAU.STOCK_COL.TCGPLAYER_ID - 1],
        name: row[SAU.STOCK_COL.NOMBRE - 1],
        expansion: row[SAU.STOCK_COL.EXPANSION - 1],
        number: row[SAU.STOCK_COL.NUMERO - 1]
      });
      if (!item) continue;
      fillSauStockRowFromTcgCache_(row, item);
      if (JSON.stringify(row) !== before) updated++;
    }

    range.setValues(values);
    return { updated: updated };
  } finally {
    lock.releaseLock();
  }
}

function repairStockLinksAndImagesBatch() {
  var result = repairStockLinksAndImagesBatch_();
  SpreadsheetApp.getUi().alert([
    "Tanda reparada.",
    "Filas revisadas: " + result.scanned,
    "Filas actualizadas: " + result.updated,
    "Imagenes traidas: " + result.imagesFetched,
    result.done ? "Estado: terminado" : "Proxima fila: " + result.nextRow
  ].join("\n"));
}

function startStockImageRepairAuto() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(SAU.PROP.STOCK_IMAGE_REPAIR_AUTO_RUNNING, "true");
  ensureStockImageRepairAutoTrigger_();
  var result = repairStockLinksAndImagesBatch_();
  props.setProperty(SAU.PROP.STOCK_IMAGE_REPAIR_LAST_RESULT, JSON.stringify({
    at: formatSauDateTime_(new Date()),
    scanned: result.scanned,
    updated: result.updated,
    imagesFetched: result.imagesFetched,
    nextRow: result.nextRow,
    done: result.done,
    message: result.message || ""
  }));
  if (result.done) stopStockImageRepairAuto(false);
  SpreadsheetApp.getUi().alert([
    result.done ? "Reparacion terminada." : "Reparacion automatica iniciada.",
    "Esta primera tanda ya corrio.",
    "Filas revisadas: " + result.scanned,
    "Filas actualizadas: " + result.updated,
    "Imagenes traidas: " + result.imagesFetched,
    result.done ? "Estado: terminado" : "Va a continuar sola cada minuto desde fila " + result.nextRow + "."
  ].join("\n"));
}

function stopStockImageRepairAuto(showAlert) {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(SAU.PROP.STOCK_IMAGE_REPAIR_AUTO_RUNNING);
  deleteSauTriggersByHandler_("runStockImageRepairAuto");
  if (showAlert !== false) SpreadsheetApp.getUi().alert("Reparacion automatica pausada. El progreso queda guardado.");
}

function runStockImageRepairAuto() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(SAU.PROP.STOCK_IMAGE_REPAIR_AUTO_RUNNING) !== "true") {
    deleteSauTriggersByHandler_("runStockImageRepairAuto");
    return;
  }

  var result = repairStockLinksAndImagesBatch_();
  props.setProperty(SAU.PROP.STOCK_IMAGE_REPAIR_LAST_RESULT, JSON.stringify({
    at: formatSauDateTime_(new Date()),
    scanned: result.scanned,
    updated: result.updated,
    imagesFetched: result.imagesFetched,
    nextRow: result.nextRow,
    done: result.done,
    message: result.message || ""
  }));

  if (result.done) stopStockImageRepairAuto(false);
}

function ensureStockImageRepairAutoTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runStockImageRepairAuto") return;
  }
  ScriptApp.newTrigger("runStockImageRepairAuto").timeBased().everyMinutes(1).create();
}

function deleteSauTriggersByHandler_(handlerName) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(triggers[i]);
  }
}

function repairSelectedStockLinksAndImages() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  if (!sheet || sheet.getName() !== SAU.SHEETS.STOCK) {
    SpreadsheetApp.getUi().alert("Selecciona una o mas filas en la hoja Stock.");
    return;
  }
  var range = sheet.getActiveRange();
  if (!range || range.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("Selecciona una o mas filas de cartas, no el encabezado.");
    return;
  }
  var startRow = Math.max(2, range.getRow());
  var numRows = range.getLastRow() - startRow + 1;
  var result = repairStockLinksAndImagesBatch_({ startRow: startRow, batchSize: numRows, skipProgress: true });
  SpreadsheetApp.getUi().alert([
    "Filas seleccionadas reparadas.",
    "Filas revisadas: " + result.scanned,
    "Filas actualizadas: " + result.updated,
    "Imagenes traidas: " + result.imagesFetched
  ].join("\n"));
}

function resetStockImageRepairProgress() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(SAU.PROP.STOCK_IMAGE_REPAIR_NEXT_ROW);
  props.deleteProperty(SAU.PROP.STOCK_IMAGE_REPAIR_LAST_RESULT);
  SpreadsheetApp.getUi().alert("Progreso de reparacion reseteado. La proxima tanda empieza en fila 2.");
}

function repairStockLinksAndImagesBatch_(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { scanned: 0, updated: 0, imagesFetched: 0, done: false, message: "Ya hay otra sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!stock || stock.getLastRow() < 2) return { scanned: 0, updated: 0, imagesFetched: 0, done: true };

    var props = PropertiesService.getScriptProperties();
    var config = readSauConfig_();
    var batchSize = Math.max(5, Math.min(Number(options.batchSize || config.image_repair_batch_size || 40), 120));
    var startRow = Math.max(2, Number(options.startRow || props.getProperty(SAU.PROP.STOCK_IMAGE_REPAIR_NEXT_ROW) || 2));
    var lastRow = stock.getLastRow();
    if (startRow > lastRow) startRow = 2;
    var numRows = Math.min(batchSize, lastRow - startRow + 1);

    var cache = buildSauCacheLookup_();
    var range = stock.getRange(startRow, 1, numRows, SAU.STOCK_COL.ULTIMA_COMPRA_USD);
    var values = range.getValues();
    var now = new Date();
    var updated = 0;
    var imagesFetched = 0;

    config.force_product_url = true;
    config.force_image = false;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var before = JSON.stringify(row);
      var pcUrl = normalizeSauUrl_(row[SAU.STOCK_COL.PC_URL - 1]);
      var pcId = String(row[SAU.STOCK_COL.PC_ID - 1] || "").trim() || extractSauPcIdFromSku_(row[SAU.STOCK_COL.SKU - 1]) || extractSauPriceChartingId_(pcUrl);
      var item = findSauCacheItem_(cache, pcId, pcUrl);
      if (item) fillSauStockRowFromCache_(row, item, config, now);

      var exactUrl = pickSauExactPriceChartingUrl_(item && buildSauPriceChartingUrlFromItem_(item), row[SAU.STOCK_COL.PC_URL - 1], pcUrl, item && item.pcUrl);
      if (!row[SAU.STOCK_COL.IMAGEN_URL - 1] && isSauExactPriceChartingProductUrl_(exactUrl)) {
        try {
          row[SAU.STOCK_COL.IMAGEN_URL - 1] = fetchSauPriceChartingImageUrl_(exactUrl);
          imagesFetched++;
          Utilities.sleep(Number(config.image_fetch_delay_ms || 350));
        } catch (err) {
          row[SAU.STOCK_COL.NOTAS - 1] = [row[SAU.STOCK_COL.NOTAS - 1], "Imagen no encontrada: " + String(err && err.message ? err.message : err)].filter(Boolean).join(" | ");
        }
      }

      if (JSON.stringify(row) !== before) updated++;
    }

    range.setValues(values);
    var nextRow = startRow + numRows;
    var done = nextRow > lastRow;
    if (!options.skipProgress) {
      if (done) {
        props.deleteProperty(SAU.PROP.STOCK_IMAGE_REPAIR_NEXT_ROW);
      } else {
        props.setProperty(SAU.PROP.STOCK_IMAGE_REPAIR_NEXT_ROW, String(nextRow));
      }
    }
    return { scanned: numRows, updated: updated, imagesFetched: imagesFetched, nextRow: nextRow, done: done };
  } finally {
    lock.releaseLock();
  }
}

function processReceivedPurchases() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { processed: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var purchases = ss.getSheetByName(SAU.SHEETS.COMPRAS);
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!purchases || !stock) throw new Error("Faltan hojas Compras o Stock.");
    if (purchases.getLastRow() < 2) return { processed: 0 };

    var config = readSauConfig_();
    var cache = buildSauCacheIndex_();
    var stockIndex = buildSauStockIndex_(stock);
    var values = purchases.getRange(2, 1, purchases.getLastRow() - 1, SAU.COMPRA_COL.CREADO_POR).getValues();
    var processed = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var received = toSauBoolean_(row[SAU.COMPRA_COL.RECIBIDO - 1]);
      var quantity = Number(row[SAU.COMPRA_COL.CANTIDAD - 1]) || 0;
      var receivedQuantity = Number(row[SAU.COMPRA_COL.RECIBIDO_CANTIDAD - 1]) || (received ? quantity : 0);
      var syncedQuantity = getSauPurchaseSyncedQuantity_(row[SAU.COMPRA_COL.SYNC_STOCK - 1], quantity);
      var quantityToSync = Math.max(0, Math.min(quantity, receivedQuantity) - syncedQuantity);
      if (quantityToSync <= 0 || quantity <= 0) continue;

      var unitCostUsd = getSauPurchaseUnitUsd_(row, quantity);
      var pcUrl = normalizeSauUrl_(row[SAU.COMPRA_COL.PC_URL - 1]);
      var pcId = String(row[SAU.COMPRA_COL.PC_ID - 1] || "").trim() || extractSauPriceChartingId_(pcUrl);
      var item = findSauCacheItem_(cache, pcId, pcUrl);
      var stockItem = buildSauMovementItem_({
        sku: pcId ? buildSauSku_(pcId) : "",
        name: row[SAU.COMPRA_COL.NOMBRE - 1],
        expansion: row[SAU.COMPRA_COL.EXPANSION - 1],
        quantity: quantityToSync,
        pcUrl: pcUrl,
        pcId: pcId,
        cacheItem: item,
        note: "Compra recibida",
        lastPurchaseUsd: unitCostUsd
      });

      var match = appendOrIncrementSauStock_(stock, stockIndex, stockItem, quantityToSync, config, unitCostUsd);
      appendSauStockMovement_({
        type: "Compra recibida", sourceId: String(row[SAU.COMPRA_COL.COMPRA_ID - 1] || ("Compra fila " + (i + 2))),
        sku: match.sku, name: stockItem.name, delta: quantityToSync,
        before: match.beforeQuantity, after: match.afterQuantity, actor: String(row[SAU.COMPRA_COL.CREADO_POR - 1] || "Sistema"),
        notes: String(row[SAU.COMPRA_COL.PROVEEDOR - 1] || "")
      });
      purchases.getRange(i + 2, SAU.COMPRA_COL.SYNC_STOCK).setValue(
        "QTY:" + (syncedQuantity + quantityToSync) + " OK " + match.sku + " " + formatSauDateTime_(new Date())
      );
      processed++;
    }

    return { processed: processed };
  } finally {
    lock.releaseLock();
  }
}

function completePurchasesFromPriceChartingCache(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { updated: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var purchases = ss.getSheetByName(SAU.SHEETS.COMPRAS);
    if (!purchases) throw new Error("No existe hoja Compras.");
    if (purchases.getLastRow() < 2) return { updated: 0 };

    var startRow = Math.max(2, Number(options.startRow || 2));
    var numRows = Number(options.numRows || (purchases.getLastRow() - startRow + 1));
    if (numRows <= 0) return { updated: 0 };

    var config = readSauConfig_();
    var useFastLookup = numRows <= Number((config || {}).fast_lookup_max_rows || 80);
    var cache = useFastLookup ? buildSauCacheLookup_() : buildSauCacheIndex_();
    var range = purchases.getRange(startRow, 1, numRows, SAU.COMPRA_COL.COSTO_UNITARIO_USD);
    var values = range.getValues();
    var updated = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var pcUrl = normalizeSauUrl_(row[SAU.COMPRA_COL.PC_URL - 1]);
      var pcId = String(row[SAU.COMPRA_COL.PC_ID - 1] || "").trim() || extractSauPriceChartingId_(pcUrl);
      if (!pcUrl && !pcId) continue;

      var item = findSauCacheItem_(cache, pcId, pcUrl);
      if (!item) continue;

      if (!row[SAU.COMPRA_COL.FECHA - 1]) row[SAU.COMPRA_COL.FECHA - 1] = new Date();
      if (!row[SAU.COMPRA_COL.ITEM - 1]) {
        row[SAU.COMPRA_COL.ITEM - 1] = [item.nombre || item.nombrePc, item.expansion || item.expansionPc].filter(Boolean).join(" - ");
      }
      if (!row[SAU.COMPRA_COL.NOMBRE - 1]) row[SAU.COMPRA_COL.NOMBRE - 1] = item.nombre || item.nombrePc || "";
      if (!row[SAU.COMPRA_COL.EXPANSION - 1]) row[SAU.COMPRA_COL.EXPANSION - 1] = item.expansion || item.expansionPc || "";
      if (!row[SAU.COMPRA_COL.CANTIDAD - 1]) row[SAU.COMPRA_COL.CANTIDAD - 1] = 1;
      if (!row[SAU.COMPRA_COL.PC_ID - 1]) row[SAU.COMPRA_COL.PC_ID - 1] = item.pcId || pcId || "";
      updated++;
    }

    range.setValues(values);
    return { updated: updated };
  } finally {
    lock.releaseLock();
  }
}

function getSauPurchaseUnitUsd_(row, quantity) {
  var unit = Number(row[SAU.COMPRA_COL.COSTO_UNITARIO_USD - 1]) || 0;
  if (unit) return unit;
  var total = Number(row[SAU.COMPRA_COL.COSTO_TOTAL_USD - 1]) || 0;
  return total && quantity ? total / quantity : "";
}

function completeSalesFromPriceChartingCache(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { updated: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
    if (!sales) throw new Error("No existe hoja Ventas Detalle.");
    if (sales.getLastRow() < 2) return { updated: 0 };

    var startRow = Math.max(2, Number(options.startRow || 2));
    var numRows = Number(options.numRows || (sales.getLastRow() - startRow + 1));
    if (numRows <= 0) return { updated: 0 };

    var config = readSauConfig_();
    var useFastLookup = numRows <= Number((config || {}).fast_lookup_max_rows || 80);
    var cache = useFastLookup ? buildSauCacheLookup_() : buildSauCacheIndex_();
    var range = sales.getRange(startRow, 1, numRows, SAU.VENTA_COL.NOTAS);
    var values = range.getValues();
    var updated = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var pcUrl = normalizeSauUrl_(row[SAU.VENTA_COL.PC_URL - 1]);
      var pcId = String(row[SAU.VENTA_COL.PC_ID - 1] || "").trim() || extractSauPriceChartingId_(pcUrl);
      if (!pcUrl && !pcId) continue;

      var item = findSauCacheItem_(cache, pcId, pcUrl);
      if (!item) continue;

      if (!row[SAU.VENTA_COL.VENTA_ID - 1]) row[SAU.VENTA_COL.VENTA_ID - 1] = "VTA-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      if (!row[SAU.VENTA_COL.FECHA_VENTA - 1]) row[SAU.VENTA_COL.FECHA_VENTA - 1] = new Date();
      if (!row[SAU.VENTA_COL.ORIGEN - 1]) row[SAU.VENTA_COL.ORIGEN - 1] = "Mesa";
      if (!row[SAU.VENTA_COL.NOMBRE - 1]) row[SAU.VENTA_COL.NOMBRE - 1] = item.nombre || item.nombrePc || "";
      if (!row[SAU.VENTA_COL.EXPANSION - 1]) row[SAU.VENTA_COL.EXPANSION - 1] = item.expansion || item.expansionPc || "";
      if (!row[SAU.VENTA_COL.NOMBRE_FINAL - 1]) {
        row[SAU.VENTA_COL.NOMBRE_FINAL - 1] = [row[SAU.VENTA_COL.NOMBRE - 1], row[SAU.VENTA_COL.EXPANSION - 1]].filter(Boolean).join(" - ");
      }
      if (!row[SAU.VENTA_COL.CANTIDAD - 1]) row[SAU.VENTA_COL.CANTIDAD - 1] = 1;
      if (!row[SAU.VENTA_COL.PC_ID - 1]) row[SAU.VENTA_COL.PC_ID - 1] = item.pcId || pcId || "";
      if (!row[SAU.VENTA_COL.SKU - 1] && (item.pcId || pcId)) row[SAU.VENTA_COL.SKU - 1] = buildSauSku_(item.pcId || pcId);
      if (!row[SAU.VENTA_COL.PRECIO_USD - 1] && item.usd) row[SAU.VENTA_COL.PRECIO_USD - 1] = item.usd;
      updated++;
    }

    range.setValues(values);
    return { updated: updated };
  } finally {
    lock.releaseLock();
  }
}

function handleSauMobileApi_(request) {
  try {
    request = request || {};
    assertSauMobileApiToken_(request.token);

    var action = String(request.action || "").trim();
    var normalizedAction = action.toLowerCase();
    if (normalizedAction === "authenticateuser") {
      return mobileSauJson_({ ok: true, data: mobileAuthenticateUser(request.payload || request) });
    }
    if (normalizedAction === "ping") {
      return mobileSauJson_({ ok: true, data: { pong: true, at: formatSauDateTime_(new Date()) } });
    }
    var authUser = assertSauMobileSession_(request.sessionToken, normalizedAction);
    authorizeSauMobileAction_(authUser, normalizedAction);
    if (request.payload && typeof request.payload === "object") {
      request.payload.actor = authUser.name;
      request.payload.actorId = authUser.id;
      request.payload.actorRole = authUser.role;
    }
    if (normalizedAction === "searchstock") {
      return mobileSauJson_({
        ok: true,
        data: mobileSearchStock(request.q || request.query || "", request.limit)
      });
    }
    if (normalizedAction === "liststock") {
      return mobileSauJson_({ ok: true, data: mobileListStock(request) });
    }
    if (normalizedAction === "getstockcatalog") {
      return mobileSauJson_({ ok: true, data: mobileGetStockCatalog() });
    }
    if (normalizedAction === "getcarddetails") {
      return mobileSauJson_({
        ok: true,
        data: mobileGetCardDetails(request.sku)
      });
    }
    if (normalizedAction === "closesale") {
      return mobileSauJson_({
        ok: true,
        data: mobileCloseSale(request.payload || request)
      });
    }
    if (normalizedAction === "getdashboard" || normalizedAction === "dashboard") {
      var dashboardData = mobileGetDashboard(request.limit);
      if (authUser.role === "sales") {
        dashboardData.orders = [];
        dashboardData.summary.activeOrders = 0;
        dashboardData.summary.unpaidOrders = 0;
        dashboardData.summary.undeliveredOrders = 0;
        dashboardData.summary.arsToCollect = 0;
        dashboardData.summary.usdToCollect = 0;
      }
      return mobileSauJson_({
        ok: true,
        data: dashboardData
      });
    }
    if (normalizedAction === "listorders" || normalizedAction === "orders") {
      return mobileSauJson_({
        ok: true,
        data: mobileListOrders(request)
      });
    }
    if (normalizedAction === "listtodaysales" || normalizedAction === "todaysales") {
      return mobileSauJson_({
        ok: true,
        data: mobileListTodaySales(request)
      });
    }
    if (normalizedAction === "listsales") {
      return mobileSauJson_({ ok: true, data: mobileListSales(request) });
    }
    if (normalizedAction === "listpurchases" || normalizedAction === "purchases") {
      return mobileSauJson_({
        ok: true,
        data: mobileListPurchases(request)
      });
    }
    if (normalizedAction === "createpurchase") {
      return mobileSauJson_({
        ok: true,
        data: mobileCreatePurchase(request.payload || request)
      });
    }
    if (normalizedAction === "receivepurchase") {
      return mobileSauJson_({
        ok: true,
        data: mobileReceivePurchase(request.payload || request)
      });
    }
    if (normalizedAction === "importscannerstock" ||
        normalizedAction === "mobileimportscannerstock" ||
        normalizedAction === "scannerimportstock" ||
        normalizedAction === "importstockfromscanner") {
      return mobileSauJson_({
        ok: true,
        data: mobileImportScannerStock(request.payload || request)
      });
    }
    if (normalizedAction === "getclaimworkspace") {
      return mobileSauJson_({ ok: true, data: mobileGetClaimWorkspace(request) });
    }
    if (normalizedAction === "configureclaimgenerator") {
      return mobileSauJson_({ ok: true, data: mobileConfigureClaimGenerator(request.payload || request) });
    }
    if (normalizedAction === "prepareclaim") {
      return mobileSauJson_({ ok: true, data: mobilePrepareClaim(request.payload || request) });
    }
    if (normalizedAction === "updateclaimcard") {
      return mobileSauJson_({ ok: true, data: mobileUpdateClaimCard(request.payload || request) });
    }
    if (normalizedAction === "generateclaimgrid") {
      return mobileSauJson_({ ok: true, data: mobileGenerateClaimGrid(request.payload || request) });
    }
    if (normalizedAction === "saveclaimgrid") {
      return mobileSauJson_({ ok: true, data: mobileSaveClaimGrid(request.payload || request) });
    }
    if (normalizedAction === "finishclaim") {
      return mobileSauJson_({ ok: true, data: mobileFinishClaim(request.payload || request) });
    }
    if (normalizedAction === "resetclaim") {
      return mobileSauJson_({ ok: true, data: mobileResetClaim(request.payload || request) });
    }
    if (normalizedAction === "updateorder") {
      return mobileSauJson_({
        ok: true,
        data: mobileUpdateOrder(request.payload || request)
      });
    }
    if (normalizedAction === "recordorderpayment") {
      return mobileSauJson_({ ok: true, data: mobileRecordOrderPayment(request.payload || request) });
    }
    if (normalizedAction === "completeorder") {
      return mobileSauJson_({ ok: true, data: mobileCompleteOrder(request.payload || request) });
    }
    if (normalizedAction === "updatepackingline") {
      return mobileSauJson_({ ok: true, data: mobileUpdatePackingLine(request.payload || request) });
    }
    if (normalizedAction === "updatestock") {
      return mobileSauJson_({ ok: true, data: mobileUpdateStock(request.payload || request) });
    }
    if (normalizedAction === "cancelsale") {
      return mobileSauJson_({ ok: true, data: mobileCancelSale(request.payload || request) });
    }
    if (normalizedAction === "getsystemhealth") {
      return mobileSauJson_({ ok: true, data: mobileGetSystemHealth() });
    }
    if (normalizedAction === "resetuserpassword") {
      return mobileSauJson_({ ok: true, data: mobileResetUserPassword(request.payload || request) });
    }
    return mobileSauJson_({ ok: false, error: "Accion no reconocida: " + action });
  } catch (err) {
    return mobileSauJson_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function assertSauMobileApiToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty(SAU.PROP.MOBILE_API_TOKEN);
  if (!expected) throw new Error("Falta configurar token app mobile en el HUB.");
  if (String(token || "").trim() !== expected) throw new Error("Token invalido.");
}

function mobileAuthenticateUser(payload) {
  payload = payload || {};
  var userId = String(payload.userId || "").trim().toLowerCase();
  var password = String(payload.password || "");
  var deviceId = String(payload.deviceId || "").trim() || "dispositivo-sin-id";
  if (!userId || password.length < 4) throw new Error("Usuario o contrasena invalidos.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("El acceso esta ocupado. Proba nuevamente.");
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var users = ss.getSheetByName(SAU.SHEETS.USUARIOS_APP);
    var sessions = ss.getSheetByName(SAU.SHEETS.SESIONES_APP);
    if (!users) { setupSauUsers_(ss); users = ss.getSheetByName(SAU.SHEETS.USUARIOS_APP); }
    if (!sessions) { setupSauSessions_(ss); sessions = ss.getSheetByName(SAU.SHEETS.SESIONES_APP); }
    var values = users.getRange(2, 1, Math.max(1, users.getLastRow() - 1), 8).getValues();
    var rowNumber = 0;
    var user = null;
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0] || "").trim().toLowerCase() === userId) { rowNumber = i + 2; user = values[i]; break; }
    }
    if (!user || !toSauBoolean_(user[5])) throw new Error("Usuario no habilitado.");
    var salt = String(user[3] || "");
    var expected = String(user[4] || "");
    var firstAccess = !salt || !expected;
    if (firstAccess) {
      salt = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().slice(0, 8);
      expected = hashSauUserPassword_(password, salt);
      users.getRange(rowNumber, 4, 1, 2).setValues([[salt, expected]]);
      users.getRange(rowNumber, 8).setValue(new Date());
    } else if (hashSauUserPassword_(password, salt) !== expected) {
      throw new Error("Contrasena incorrecta.");
    }

    if (sessions.getLastRow() >= 2) {
      var sessionValues = sessions.getRange(2, 1, sessions.getLastRow() - 1, 6).getValues();
      for (var s = 0; s < sessionValues.length; s++) {
        if (String(sessionValues[s][1]) === userId && String(sessionValues[s][2]) === deviceId && !toSauBoolean_(sessionValues[s][5])) {
          sessions.getRange(s + 2, 6).setValue(true);
        }
      }
    }
    var token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    var now = new Date();
    appendSauRows_(sessions, [[token, userId, deviceId, now, now, false]]);
    appendSauAudit_(firstAccess ? "Crear acceso" : "Iniciar sesion", "Usuario", userId, String(user[1] || userId), deviceId, "");
    return { sessionToken: token, user: { id: userId, name: String(user[1] || userId), role: String(user[2] || "sales") }, firstAccess: firstAccess };
  } finally {
    lock.releaseLock();
  }
}

function hashSauUserPassword_(password, salt) {
  var value = salt + ":" + String(password || "");
  for (var i = 0; i < 2500; i++) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
    value = digest.map(function(byte) { var normalized = byte < 0 ? byte + 256 : byte; return ("0" + normalized.toString(16)).slice(-2); }).join("");
  }
  return value;
}

function assertSauMobileSession_(sessionToken, action) {
  return { id: "paused", name: "App interna", role: "admin" };
  var config = readSauConfig_();
  var required = config.require_user_session === undefined ? true : toSauBoolean_(config.require_user_session);
  sessionToken = String(sessionToken || "").trim();
  if (!sessionToken && !required) return { id: "legacy", name: "App", role: "admin" };
  if (!sessionToken) throw new Error("Sesion requerida. Volve a ingresar con tu contrasena.");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sessions = ss.getSheetByName(SAU.SHEETS.SESIONES_APP);
  var users = ss.getSheetByName(SAU.SHEETS.USUARIOS_APP);
  if (!sessions || !users || sessions.getLastRow() < 2) throw new Error("Sesion invalida. Volve a ingresar.");
  var found = sessions.getRange(2, 1, sessions.getLastRow() - 1, 1).createTextFinder(sessionToken).matchEntireCell(true).findNext();
  if (!found) throw new Error("Sesion invalida. Volve a ingresar.");
  var session = sessions.getRange(found.getRow(), 1, 1, 6).getValues()[0];
  if (toSauBoolean_(session[5])) throw new Error("Sesion revocada. Volve a ingresar.");
  var created = session[3] instanceof Date ? session[3] : new Date(session[3]);
  if (created && !isNaN(created.getTime()) && Date.now() - created.getTime() > 180 * 24 * 60 * 60 * 1000) throw new Error("La sesion vencio. Volve a ingresar.");
  var userId = String(session[1] || "").trim();
  var userValues = users.getRange(2, 1, Math.max(1, users.getLastRow() - 1), 8).getValues();
  for (var i = 0; i < userValues.length; i++) {
    if (String(userValues[i][0] || "").trim() !== userId) continue;
    if (!toSauBoolean_(userValues[i][5])) throw new Error("Usuario deshabilitado.");
    var lastUsed = session[4] instanceof Date ? session[4] : new Date(session[4]);
    if (!lastUsed || isNaN(lastUsed.getTime()) || Date.now() - lastUsed.getTime() > 15 * 60 * 1000) {
      sessions.getRange(found.getRow(), 5).setValue(new Date());
    }
    return { id: userId, name: String(userValues[i][1] || userId), role: String(userValues[i][2] || "sales") };
  }
  throw new Error("Usuario de sesion inexistente.");
}

function authorizeSauMobileAction_(user, action) {
  if (!user) throw new Error("Sesion requerida.");
  if (action === "resetuserpassword" && user.role !== "admin") throw new Error("Solo Seb puede resetear accesos.");
  if (action === "configureclaimgenerator" && user.role !== "admin") throw new Error("Solo Seb puede configurar el Generador de Claims.");
  if (user.role === "admin" || user.role === "staff") return;
  var salesActions = { searchstock: true, getstockcatalog: true, getcarddetails: true, closesale: true, getdashboard: true };
  if (!salesActions[action]) throw new Error("Tu usuario no tiene permiso para esta accion.");
}

function mobileResetUserPassword(payload) {
  payload = payload || {};
  var userId = String(payload.userId || "").trim().toLowerCase();
  if (!userId) throw new Error("Falta usuario.");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = ss.getSheetByName(SAU.SHEETS.USUARIOS_APP);
  var sessions = ss.getSheetByName(SAU.SHEETS.SESIONES_APP);
  if (!users) throw new Error("No existe Usuarios App.");
  var values = users.getRange(2, 1, Math.max(1, users.getLastRow() - 1), 8).getValues();
  var found = 0;
  for (var i = 0; i < values.length; i++) if (String(values[i][0] || "").trim().toLowerCase() === userId) { found = i + 2; break; }
  if (!found) throw new Error("Usuario inexistente.");
  users.getRange(found, 4, 1, 2).clearContent();
  users.getRange(found, 8).setValue(new Date());
  if (sessions && sessions.getLastRow() >= 2) {
    var sessionValues = sessions.getRange(2, 1, sessions.getLastRow() - 1, 6).getValues();
    for (var s = 0; s < sessionValues.length; s++) if (String(sessionValues[s][1] || "") === userId) sessions.getRange(s + 2, 6).setValue(true);
  }
  appendSauAudit_("Resetear acceso", "Usuario", userId, String(payload.actor || "Admin"), "", String(payload.localActionId || ""));
  return { userId: userId, reset: true };
}

function mobileSauJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function findSauAppActionResult_(actionId) {
  actionId = String(actionId || "").trim();
  if (!actionId) return null;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAU.SHEETS.ACCIONES_APP);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(actionId).matchEntireCell(true).findNext();
  if (!found) return null;
  var raw = String(sheet.getRange(found.getRow(), 5).getValue() || "");
  try { return JSON.parse(raw); } catch (ignored) { return { duplicate: true, actionId: actionId }; }
}

function saveSauAppActionResult_(actionId, action, actor, result) {
  actionId = String(actionId || "").trim();
  if (!actionId) return result;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SAU.SHEETS.ACCIONES_APP);
  if (!sheet) {
    setupSauAppActions_(ss);
    sheet = ss.getSheetByName(SAU.SHEETS.ACCIONES_APP);
  }
  appendSauRows_(sheet, [[actionId, new Date(), action || "", actor || "", JSON.stringify(result || {})]]);
  return result;
}

function appendSauAudit_(action, entity, entityId, actor, detail, actionId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SAU.SHEETS.AUDITORIA);
  if (!sheet) {
    setupSauAudit_(ss);
    sheet = ss.getSheetByName(SAU.SHEETS.AUDITORIA);
  }
  appendSauRows_(sheet, [[new Date(), actor || "Sistema", action || "", entity || "", entityId || "", detail || "", actionId || ""]]);
}

function appendSauStockMovement_(data) {
  data = data || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SAU.SHEETS.MOVIMIENTOS);
  if (!sheet) {
    setupSauMovements_(ss);
    sheet = ss.getSheetByName(SAU.SHEETS.MOVIMIENTOS);
  }
  appendSauRows_(sheet, [[
    data.movementId || ("MOV-" + Utilities.getUuid().slice(0, 8).toUpperCase()),
    data.date || new Date(), data.type || "Ajuste", data.sourceId || "", data.sku || "", data.name || "",
    Number(data.delta) || 0, Number(data.before) || 0, Number(data.after) || 0,
    data.actor || "Sistema", data.notes || ""
  ]]);
}

function addSauPendingReview_(type, id, name, detail) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SAU.SHEETS.REVISION);
  if (!sheet) {
    setupSauReview_(ss);
    sheet = ss.getSheetByName(SAU.SHEETS.REVISION);
  }
  appendSauRows_(sheet, [[new Date(), type || "Revision", id || "", name || "", detail || "", "Pendiente", "", ""]]);
}

function mobileSearchStock(query, limit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
  if (!stock) throw new Error("No existe hoja Stock.");
  if (stock.getLastRow() < 2) return [];

  var q = normalizeSauMobileSearch_(query);
  var max = Math.max(5, Math.min(Number(limit) || 30, 60));
  var values = stock.getRange(2, 1, stock.getLastRow() - 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT).getValues();
  var results = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var quantity = Number(row[SAU.STOCK_COL.CANTIDAD - 1]) || 0;
    if (quantity <= 0) continue;

    var item = buildSauMobileStockItem_(row, i + 2);
    var haystack = normalizeSauMobileSearch_([
      item.sku,
      item.nombre,
      item.expansion,
      item.numero,
      item.pcId,
      item.condicion,
      item.idioma,
      item.ubicacion,
      item.tcgplayerId,
      item.tcgplayerSubtype
    ].join(" "));
    if (q && !matchesSauMobileQuery_(haystack, q)) continue;

    item.score = scoreSauMobileStockResult_(item, q);
    results.push(item);
  }

  results.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.nombre).localeCompare(String(b.nombre));
  });
  return results.slice(0, max);
}

function mobileListStock(request) {
  request = request || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
  if (!stock || stock.getLastRow() < 2) return { items: [], total: 0 };
  var q = normalizeSauMobileSearch_(request.q || request.query || "");
  var mode = String(request.mode || "all").toLowerCase();
  var max = Math.max(10, Math.min(Number(request.limit) || 80, 250));
  var values = stock.getRange(2, 1, stock.getLastRow() - 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var item = buildSauMobileStockItem_(values[i], i + 2);
    if (!item.sku) continue;
    if (mode === "available" && (item.quantity <= 0 || !item.active)) continue;
    if (mode === "issues" && item.quantity >= 0 && item.imageUrl && item.pcUrl) continue;
    if (q && !matchesSauMobileQuery_(normalizeSauMobileSearch_([
      item.sku, item.nombre, item.expansion, item.numero, item.pcId, item.ubicacion, item.idioma, item.condicion
    ].join(" ")), q)) continue;
    out.push(item);
  }
  out.sort(function(a, b) { return String(a.nombre).localeCompare(String(b.nombre)); });
  return { items: out.slice(0, max), total: out.length };
}

function mobileGetStockCatalog() {
  var stock = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAU.SHEETS.STOCK);
  if (!stock || stock.getLastRow() < 2) return { updatedAt: new Date().toISOString(), items: [] };
  var values = stock.getRange(2, 1, stock.getLastRow() - 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT).getValues();
  var items = [];
  for (var i = 0; i < values.length; i++) {
    var item = buildSauMobileStockItem_(values[i], i + 2);
    if (!item.sku || item.quantity <= 0 || !item.active) continue;
    items.push({
      sku: item.sku,
      nombre: item.nombre,
      expansion: item.expansion,
      numero: item.numero,
      idioma: item.idioma,
      condicion: item.condicion,
      ubicacion: item.ubicacion,
      quantity: item.quantity,
      pcUrl: item.pcUrl,
      tcgplayerUrl: item.tcgplayerUrl,
      imageUrl: item.imageUrl,
      pcUsd: item.pcUsd,
      tcgplayerMarketUsd: item.tcgplayerMarketUsd,
      ultimaCompraUsd: item.ultimaCompraUsd,
      precioFinalArs: item.precioFinalArs,
      active: item.active
    });
  }
  return { updatedAt: new Date().toISOString(), items: items };
}

function mobileUpdateStock(payload) {
  payload = payload || {};
  var sku = String(payload.sku || "").trim();
  if (!sku) throw new Error("Falta SKU.");
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("La planilla esta ocupada. La accion puede reintentarse.");
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!stock) throw new Error("No existe hoja Stock.");
    var rowNumber = findSauStockRowBySku_(stock, sku);
    if (!rowNumber) throw new Error("No encontre SKU: " + sku);
    var row = stock.getRange(rowNumber, 1, 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT).getValues()[0];
    var beforeQty = Number(row[SAU.STOCK_COL.CANTIDAD - 1]) || 0;
    var afterQty = payload.quantity === undefined ? beforeQty + (Number(payload.delta) || 0) : Math.max(0, Number(payload.quantity) || 0);
    var actor = String(payload.actor || "").trim() || "App";

    row[SAU.STOCK_COL.CANTIDAD - 1] = afterQty;
    if (payload.priceManualArs !== undefined) row[SAU.STOCK_COL.PRECIO_MANUAL_ARS - 1] = Number(payload.priceManualArs) || "";
    if (payload.priceFinalArs !== undefined) row[SAU.STOCK_COL.PRECIO_FINAL_ARS - 1] = Number(payload.priceFinalArs) || "";
    if (payload.lastPurchaseUsd !== undefined) row[SAU.STOCK_COL.ULTIMA_COMPRA_USD - 1] = Number(payload.lastPurchaseUsd) || "";
    if (payload.location !== undefined) row[SAU.STOCK_COL.UBICACION - 1] = String(payload.location || "").trim();
    if (payload.condition !== undefined) row[SAU.STOCK_COL.CONDICION - 1] = String(payload.condition || "").trim();
    if (payload.language !== undefined) row[SAU.STOCK_COL.IDIOMA - 1] = String(payload.language || "").trim();
    if (payload.active !== undefined) row[SAU.STOCK_COL.ACTIVO - 1] = toSauBoolean_(payload.active);
    if (payload.notes !== undefined) row[SAU.STOCK_COL.NOTAS - 1] = String(payload.notes || "").trim();
    row[SAU.STOCK_COL.ULTIMA_ACTUALIZACION - 1] = new Date();
    stock.getRange(rowNumber, 1, 1, row.length).setValues([row]);

    if (afterQty !== beforeQty) appendSauStockMovement_({
      type: "Ajuste app", sourceId: actionId, sku: sku, name: row[SAU.STOCK_COL.NOMBRE - 1],
      delta: afterQty - beforeQty, before: beforeQty, after: afterQty, actor: actor, notes: String(payload.reason || "Ajuste manual desde app")
    });
    appendSauAudit_("Actualizar stock", "Stock", sku, actor, "Cantidad " + beforeQty + " -> " + afterQty, actionId);
    var result = { item: buildSauMobileStockItem_(row, rowNumber), actionId: actionId };
    return saveSauAppActionResult_(actionId, "updateStock", actor, result);
  } finally {
    lock.releaseLock();
  }
}

function mobileGetCardDetails(sku) {
  sku = String(sku || "").trim();
  if (!sku) throw new Error("Falta SKU.");

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2500)) throw new Error("La planilla esta ocupada. Proba de nuevo en unos segundos.");

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!stock) throw new Error("No existe hoja Stock.");
    if (stock.getLastRow() < 2) throw new Error("Stock vacio.");

    var rowNumber = findSauStockRowBySku_(stock, sku);
    if (!rowNumber) throw new Error("No encontre SKU: " + sku);

    var range = stock.getRange(rowNumber, 1, 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT);
    var row = range.getValues()[0];
    var config = readSauConfig_();
    config.force_product_url = true;
    config.force_image = !row[SAU.STOCK_COL.IMAGEN_URL - 1];

    var pcUrl = normalizeSauUrl_(row[SAU.STOCK_COL.PC_URL - 1]);
    var pcId = String(row[SAU.STOCK_COL.PC_ID - 1] || "").trim() || extractSauPcIdFromSku_(sku) || extractSauPriceChartingId_(pcUrl);
    var item = findSauCacheItem_(buildSauCacheLookup_(), pcId, pcUrl);
    if (item) {
      fillSauStockRowFromCache_(row, item, config, new Date());
      range.setValues([row]);
    } else if (!row[SAU.STOCK_COL.IMAGEN_URL - 1] && isSauExactPriceChartingProductUrl_(pcUrl)) {
      try {
        row[SAU.STOCK_COL.IMAGEN_URL - 1] = fetchSauPriceChartingImageUrl_(pcUrl);
        range.setValues([row]);
      } catch (err) {
        row[SAU.STOCK_COL.NOTAS - 1] = [row[SAU.STOCK_COL.NOTAS - 1], "Imagen no encontrada: " + String(err && err.message ? err.message : err)].filter(Boolean).join(" | ");
        range.setValues([row]);
      }
    }

    return buildSauMobileStockItem_(row, rowNumber);
  } finally {
    lock.releaseLock();
  }
}

function mobileCloseSale(payload) {
  payload = payload || {};
  var items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error("El carrito esta vacio.");

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("Ya hay otra venta procesandose. Probá de nuevo.");

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!sales || !stock) throw new Error("Faltan hojas Ventas Detalle o Stock.");

    var stockMap = buildSauMobileStockMap_(stock);
    var cart = normalizeSauMobileCart_(items);
    var now = new Date();
    var localSaleId = String(payload.localSaleId || "").trim();
    var existingSale = findSauMobileSaleByLocalId_(sales, localSaleId);
    if (existingSale) return existingSale;

    var reference = localSaleId ? "App mesa " + localSaleId : "App mesa " + formatSauDateTime_(now);
    var buyer = String(payload.buyer || "").trim() || "Mesa";
    var origin = String(payload.origin || "").trim() || "Mesa";
    var seller = String(payload.seller || "").trim();
    var notes = [
      String(payload.notes || "").trim(),
      localSaleId ? "LocalSaleId: " + localSaleId : "",
      seller ? "Vendedor: " + seller : ""
    ].filter(Boolean).join(" | ");
    var saleRows = [];
    var totalArs = 0;
    var totalUsd = 0;

    for (var i = 0; i < cart.length; i++) {
      var cartItem = cart[i];
      var stockItem = stockMap.bySku[cartItem.sku];
      if (!stockItem) throw new Error("No encontre SKU en stock: " + cartItem.sku);
      if (stockItem.quantity < cartItem.quantity) {
        throw new Error("Stock insuficiente para " + stockItem.nombre + ". Disponible: " + stockItem.quantity);
      }

      var lineArs = cartItem.priceArs * cartItem.quantity;
      var lineUsd = cartItem.priceUsd * cartItem.quantity;
      totalArs += lineArs;
      totalUsd += lineUsd;

      var saleId = "VTA-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      var syncText = "OK " + stockItem.sku + " " + formatSauDateTime_(now);
      var row = new Array(SAU.VENTA_COL.NOTAS);
      for (var c = 0; c < row.length; c++) row[c] = "";
      row[SAU.VENTA_COL.VENTA_ID - 1] = saleId;
      row[SAU.VENTA_COL.CLAIM - 1] = reference;
      row[SAU.VENTA_COL.FECHA_CLAIM - 1] = now;
      row[SAU.VENTA_COL.FECHA_VENTA - 1] = now;
      row[SAU.VENTA_COL.ORIGEN - 1] = origin;
      row[SAU.VENTA_COL.COMPRADOR - 1] = buyer;
      row[SAU.VENTA_COL.NOMBRE_FINAL - 1] = buildSauMobileFinalName_(stockItem, cartItem);
      row[SAU.VENTA_COL.NOMBRE - 1] = stockItem.nombre;
      row[SAU.VENTA_COL.EXPANSION - 1] = stockItem.expansion;
      row[SAU.VENTA_COL.CANTIDAD - 1] = cartItem.quantity;
      row[SAU.VENTA_COL.PRECIO_ARS - 1] = lineArs || "";
      row[SAU.VENTA_COL.PRECIO_USD - 1] = lineUsd || "";
      row[SAU.VENTA_COL.PC_URL - 1] = stockItem.pcUrl;
      row[SAU.VENTA_COL.PC_ID - 1] = stockItem.pcId;
      row[SAU.VENTA_COL.SKU - 1] = stockItem.sku;
      row[SAU.VENTA_COL.PAGADO - 1] = true;
      row[SAU.VENTA_COL.EMBALADO - 1] = true;
      row[SAU.VENTA_COL.ENTREGADO - 1] = true;
      row[SAU.VENTA_COL.SYNC_STOCK - 1] = syncText;
      row[SAU.VENTA_COL.NOTAS - 1] = notes;
      saleRows.push(row);
    }

    appendSauRows_(sales, saleRows);

    for (var d = 0; d < cart.length; d++) {
      var decrementItem = stockMap.bySku[cart[d].sku];
      var newQty = Math.max(0, decrementItem.quantity - cart[d].quantity);
      stock.getRange(decrementItem.row, SAU.STOCK_COL.CANTIDAD).setValue(newQty);
      stock.getRange(decrementItem.row, SAU.STOCK_COL.ULTIMA_ACTUALIZACION).setValue(now);
      appendSauStockMovement_({
        type: "Venta", sourceId: localSaleId || reference, sku: decrementItem.sku, name: decrementItem.nombre,
        delta: -cart[d].quantity, before: decrementItem.quantity, after: newQty,
        actor: seller || "App", notes: buyer + " - " + origin
      });
      decrementItem.quantity = newQty;
    }

    appendSauAudit_("Cerrar venta", "Venta", localSaleId || reference, seller || "App", buyer + " - " + cart.length + " lineas", localSaleId);

    return {
      ok: true,
      reference: reference,
      buyer: buyer,
      items: cart.length,
      totalArs: totalArs,
      totalUsd: totalUsd
    };
  } finally {
    lock.releaseLock();
  }
}

function findSauMobileSaleByLocalId_(sales, localSaleId) {
  localSaleId = String(localSaleId || "").trim();
  if (!localSaleId || !sales || sales.getLastRow() < 2) return null;

  var marker = "LocalSaleId: " + localSaleId;
  var values = sales.getRange(2, 1, sales.getLastRow() - 1, SAU.VENTA_COL.NOTAS).getValues();
  var found = null;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var notes = String(row[SAU.VENTA_COL.NOTAS - 1] || "");
    if (notes.indexOf(marker) < 0) continue;

    if (!found) {
      found = {
        ok: true,
        duplicate: true,
        localSaleId: localSaleId,
        reference: String(row[SAU.VENTA_COL.CLAIM - 1] || "").trim(),
        buyer: String(row[SAU.VENTA_COL.COMPRADOR - 1] || "").trim(),
        items: 0,
        totalArs: 0,
        totalUsd: 0
      };
    }
    found.items++;
    found.totalArs += Number(row[SAU.VENTA_COL.PRECIO_ARS - 1]) || 0;
    found.totalUsd += Number(row[SAU.VENTA_COL.PRECIO_USD - 1]) || 0;
  }

  return found;
}

function mobileGetDashboard(limit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
  var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
  var summary = {
    activeOrders: 0,
    unpaidOrders: 0,
    undeliveredOrders: 0,
    paidWaitingDelivery: 0,
    arsToCollect: 0,
    usdToCollect: 0,
    stockUnits: 0,
    stockSkus: 0,
    stockValueArs: 0,
    stockValueUsd: 0,
    soldWeekArs: 0,
    soldWeekUsd: 0,
    soldWeekCards: 0,
    soldWeekTrend: [],
    stockValueTrend: []
  };

  if (orders && orders.getLastRow() >= 2) {
    var orderValues = orders.getRange(2, 1, orders.getLastRow() - 1, SAU.ORDEN_COL.PAGO_NOTAS).getValues();
    for (var i = 0; i < orderValues.length; i++) {
      var row = orderValues[i];
      if (!String(row[SAU.ORDEN_COL.ORDER_ID - 1] || "").trim()) continue;
      var paid = toSauBoolean_(row[SAU.ORDEN_COL.PAGADO - 1]);
      var delivered = toSauBoolean_(row[SAU.ORDEN_COL.ENTREGADO - 1]);
      if (paid && delivered) continue;
      summary.activeOrders++;
      if (!paid) {
        summary.unpaidOrders++;
        var totalArs = Number(row[SAU.ORDEN_COL.TOTAL_ARS - 1]) || 0;
        var totalUsd = Number(row[SAU.ORDEN_COL.TOTAL_USD - 1]) || 0;
        var paidArs = Number(row[SAU.ORDEN_COL.PAGADO_ARS - 1]) || 0;
        var paidUsd = Number(row[SAU.ORDEN_COL.PAGADO_USD - 1]) || 0;
        summary.arsToCollect += Math.max(0, totalArs - paidArs);
        summary.usdToCollect += Math.max(0, totalUsd - paidUsd);
      }
      if (!delivered) summary.undeliveredOrders++;
      if (paid && !delivered) summary.paidWaitingDelivery++;
    }
  }

  if (stock && stock.getLastRow() >= 2) {
    var stockValues = stock.getRange(2, 1, stock.getLastRow() - 1, SAU.STOCK_COL.PRECIO_FINAL_ARS).getValues();
    for (var s = 0; s < stockValues.length; s++) {
      var stockRow = stockValues[s];
      var quantity = Number(stockRow[SAU.STOCK_COL.CANTIDAD - 1]) || 0;
      if (quantity <= 0) continue;
      summary.stockUnits += quantity;
      summary.stockSkus++;
      var pcUsd = Number(stockRow[SAU.STOCK_COL.PC_USD - 1]) || 0;
      var dolarUsado = Number(stockRow[SAU.STOCK_COL.DOLAR_USADO - 1]) || 0;
      var unitArs =
        Number(stockRow[SAU.STOCK_COL.PRECIO_FINAL_ARS - 1]) ||
        Number(stockRow[SAU.STOCK_COL.PRECIO_MANUAL_ARS - 1]) ||
        Number(stockRow[SAU.STOCK_COL.PRECIO_SUGERIDO_ARS - 1]) ||
        (pcUsd && dolarUsado ? pcUsd * dolarUsado : 0);
      var unitUsd = pcUsd || (unitArs && dolarUsado ? unitArs / dolarUsado : 0);
      summary.stockValueArs += quantity * unitArs;
      summary.stockValueUsd += quantity * unitUsd;
    }
  }

  var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
  if (sales && sales.getLastRow() >= 2) {
    var week = buildSauWeekWindow_();
    var daily = {};
    for (var d = 0; d < week.days.length; d++) {
      daily[week.days[d].key] = { label: week.days[d].label, ars: 0, usd: 0, cards: 0 };
    }
    var saleValues = sales.getRange(2, 1, sales.getLastRow() - 1, SAU.VENTA_COL.MOTIVO_ANULACION).getValues();
    for (var v = 0; v < saleValues.length; v++) {
      var sale = saleValues[v];
      if (toSauBoolean_(sale[SAU.VENTA_COL.ANULADA - 1])) continue;
      var saleDate = sale[SAU.VENTA_COL.FECHA_VENTA - 1] || sale[SAU.VENTA_COL.FECHA_CLAIM - 1];
      if (!(saleDate instanceof Date) || saleDate < week.start || saleDate >= week.end) continue;
      var key = Utilities.formatDate(saleDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (!daily[key]) continue;
      var cards = Number(sale[SAU.VENTA_COL.CANTIDAD - 1]) || 1;
      var ars = Number(sale[SAU.VENTA_COL.PRECIO_ARS - 1]) || 0;
      var usd = Number(sale[SAU.VENTA_COL.PRECIO_USD - 1]) || 0;
      daily[key].cards += cards;
      daily[key].ars += ars;
      daily[key].usd += usd;
      summary.soldWeekCards += cards;
      summary.soldWeekArs += ars;
      summary.soldWeekUsd += usd;
    }
    summary.soldWeekTrend = week.days.map(function(day) {
      return daily[day.key] || { label: day.label, ars: 0, usd: 0, cards: 0 };
    });
  }

  var snapshots = ss.getSheetByName(SAU.SHEETS.SNAPSHOTS);
  if (snapshots && snapshots.getLastRow() >= 2) {
    var snapshotCount = Math.min(30, snapshots.getLastRow() - 1);
    var snapshotValues = snapshots.getRange(snapshots.getLastRow() - snapshotCount + 1, 1, snapshotCount, 5).getValues();
    summary.stockValueTrend = snapshotValues.map(function(item) {
      var date = item[0] instanceof Date ? Utilities.formatDate(item[0], Session.getScriptTimeZone(), "dd/MM") : String(item[0] || "");
      return { label: date, units: Number(item[1]) || 0, skus: Number(item[2]) || 0, ars: Number(item[3]) || 0, usd: Number(item[4]) || 0 };
    });
  }

  return {
    summary: summary,
    orders: mobileListOrders({ limit: limit || 6 }).orders,
    updatedAt: formatSauDateTime_(new Date())
  };
}

function mobileListTodaySales(request) {
  request = request || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
  if (!sales) throw new Error("No existe hoja Ventas Detalle.");
  if (sales.getLastRow() < 2) {
    return {
      summary: { sales: 0, cards: 0, totalArs: 0, totalUsd: 0 },
      sales: [],
      updatedAt: formatSauDateTime_(new Date())
    };
  }

  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var max = Math.max(5, Math.min(Number(request.limit) || 60, 150));
  var values = sales.getRange(2, 1, sales.getLastRow() - 1, SAU.VENTA_COL.MOTIVO_ANULACION).getValues();
  var groups = {};
  var out = [];
  var summary = { sales: 0, cards: 0, totalArs: 0, totalUsd: 0 };

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (toSauBoolean_(row[SAU.VENTA_COL.ANULADA - 1])) continue;
    var saleDate = row[SAU.VENTA_COL.FECHA_VENTA - 1] || row[SAU.VENTA_COL.FECHA_CLAIM - 1];
    if (!saleDate) continue;
    var saleDay = saleDate instanceof Date
      ? Utilities.formatDate(saleDate, tz, "yyyy-MM-dd")
      : String(saleDate).slice(0, 10);
    if (saleDay !== todayKey) continue;

    var saleKey = String(row[SAU.VENTA_COL.CLAIM - 1] || row[SAU.VENTA_COL.ORDER_ID - 1] || row[SAU.VENTA_COL.VENTA_ID - 1] || ("fila-" + (i + 2))).trim();
    var quantity = Number(row[SAU.VENTA_COL.CANTIDAD - 1]) || 1;
    var ars = Number(row[SAU.VENTA_COL.PRECIO_ARS - 1]) || 0;
    var usd = Number(row[SAU.VENTA_COL.PRECIO_USD - 1]) || 0;
    var notes = String(row[SAU.VENTA_COL.NOTAS - 1] || "");

    if (!groups[saleKey]) {
      groups[saleKey] = {
        saleKey: saleKey,
        dateValue: saleDate instanceof Date ? saleDate.getTime() : 0,
        date: saleDate instanceof Date ? formatSauDateTime_(saleDate) : String(saleDate || ""),
        origin: String(row[SAU.VENTA_COL.ORIGEN - 1] || "").trim(),
        buyer: String(row[SAU.VENTA_COL.COMPRADOR - 1] || "").trim(),
        seller: extractSauSellerFromNotes_(notes),
        cards: 0,
        totalArs: 0,
        totalUsd: 0,
        items: []
      };
      out.push(groups[saleKey]);
    }

    var group = groups[saleKey];
    if (!group.seller) group.seller = extractSauSellerFromNotes_(notes);
    group.cards += quantity;
    group.totalArs += ars;
    group.totalUsd += usd;
    group.items.push({
      name: String(row[SAU.VENTA_COL.NOMBRE_FINAL - 1] || row[SAU.VENTA_COL.NOMBRE - 1] || "").trim(),
      quantity: quantity,
      ars: ars,
      usd: usd
    });
  }

  out.sort(function(a, b) {
    return (b.dateValue || 0) - (a.dateValue || 0);
  });

  for (var g = 0; g < out.length; g++) {
    var sale = out[g];
    summary.sales++;
    summary.cards += sale.cards;
    summary.totalArs += sale.totalArs;
    summary.totalUsd += sale.totalUsd;
    sale.itemsText = sale.items.map(function(item) {
      var money = [item.ars ? formatSauMoneyArs_(item.ars) : "", item.usd ? formatSauMoneyUsd_(item.usd) : ""].filter(Boolean).join(" + ");
      return [item.quantity > 1 ? item.quantity + "x" : "", item.name, money ? "(" + money + ")" : ""].filter(Boolean).join(" ");
    }).join("\n");
  }

  return {
    summary: summary,
    sales: out.slice(0, max),
    updatedAt: formatSauDateTime_(new Date())
  };
}

function mobileListSales(request) {
  request = request || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
  if (!sales || sales.getLastRow() < 2) return { summary: { sales: 0, cards: 0, totalArs: 0, totalUsd: 0 }, sales: [], updatedAt: formatSauDateTime_(new Date()) };
  var max = Math.max(10, Math.min(Number(request.limit) || 100, 300));
  var q = normalizeSauMobileSearch_(request.q || request.query || "");
  var from = request.dateFrom ? new Date(request.dateFrom + "T00:00:00") : null;
  var to = request.dateTo ? new Date(request.dateTo + "T23:59:59") : null;
  var sellerFilter = normalizeSauMobileSearch_(request.seller || "");
  var originFilter = normalizeSauMobileSearch_(request.origin || "");
  var includeCancelled = toSauBoolean_(request.includeCancelled);
  var values = sales.getRange(2, 1, sales.getLastRow() - 1, SAU.VENTA_COL.MOTIVO_ANULACION).getValues();
  var groups = {};
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var cancelled = toSauBoolean_(row[SAU.VENTA_COL.ANULADA - 1]);
    if (cancelled && !includeCancelled) continue;
    var saleDate = row[SAU.VENTA_COL.FECHA_VENTA - 1] || row[SAU.VENTA_COL.FECHA_CLAIM - 1];
    var dateValue = saleDate instanceof Date ? saleDate : new Date(saleDate);
    if (from && dateValue < from) continue;
    if (to && dateValue > to) continue;
    var notes = String(row[SAU.VENTA_COL.NOTAS - 1] || "");
    var seller = extractSauSellerFromNotes_(notes);
    var origin = String(row[SAU.VENTA_COL.ORIGEN - 1] || "").trim();
    if (sellerFilter && normalizeSauMobileSearch_(seller) !== sellerFilter) continue;
    if (originFilter && normalizeSauMobileSearch_(origin) !== originFilter) continue;
    var key = String(row[SAU.VENTA_COL.CLAIM - 1] || row[SAU.VENTA_COL.ORDER_ID - 1] || row[SAU.VENTA_COL.VENTA_ID - 1] || ("fila-" + (i + 2))).trim();
    if (!groups[key]) groups[key] = {
      saleKey: key, dateValue: dateValue && !isNaN(dateValue.getTime()) ? dateValue.getTime() : 0,
      date: dateValue && !isNaN(dateValue.getTime()) ? formatSauDateTime_(dateValue) : String(saleDate || ""),
      origin: origin, buyer: String(row[SAU.VENTA_COL.COMPRADOR - 1] || "").trim(), seller: seller,
      cards: 0, totalArs: 0, totalUsd: 0, items: [], cancelled: cancelled,
      cancelledBy: String(row[SAU.VENTA_COL.ANULADA_POR - 1] || ""), cancelReason: String(row[SAU.VENTA_COL.MOTIVO_ANULACION - 1] || "")
    };
    var quantity = Number(row[SAU.VENTA_COL.CANTIDAD - 1]) || 1;
    var ars = Number(row[SAU.VENTA_COL.PRECIO_ARS - 1]) || 0;
    var usd = Number(row[SAU.VENTA_COL.PRECIO_USD - 1]) || 0;
    groups[key].cards += quantity;
    groups[key].totalArs += ars;
    groups[key].totalUsd += usd;
    groups[key].items.push({ name: String(row[SAU.VENTA_COL.NOMBRE_FINAL - 1] || row[SAU.VENTA_COL.NOMBRE - 1] || ""), quantity: quantity, ars: ars, usd: usd });
  }
  var out = Object.keys(groups).map(function(key) {
    var sale = groups[key];
    sale.itemsText = sale.items.map(function(item) { return (item.quantity > 1 ? item.quantity + "x " : "") + item.name; }).join("\n");
    return sale;
  }).filter(function(sale) {
    return !q || matchesSauMobileQuery_(normalizeSauMobileSearch_([sale.saleKey, sale.buyer, sale.seller, sale.origin, sale.itemsText].join(" ")), q);
  });
  out.sort(function(a, b) { return b.dateValue - a.dateValue; });
  var summary = { sales: out.length, cards: 0, totalArs: 0, totalUsd: 0 };
  out.forEach(function(sale) { if (!sale.cancelled) { summary.cards += sale.cards; summary.totalArs += sale.totalArs; summary.totalUsd += sale.totalUsd; } });
  return { summary: summary, sales: out.slice(0, max), total: out.length, updatedAt: formatSauDateTime_(new Date()) };
}

function mobileCancelSale(payload) {
  payload = payload || {};
  var saleKey = String(payload.saleKey || "").trim();
  if (!saleKey) throw new Error("Falta identificador de venta.");
  var reason = String(payload.reason || "").trim();
  if (!reason) throw new Error("Indica el motivo de anulacion.");
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("La planilla esta ocupada. La anulacion puede reintentarse.");
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!sales || !stock) throw new Error("Faltan Ventas Detalle o Stock.");
    var values = sales.getRange(2, 1, sales.getLastRow() - 1, SAU.VENTA_COL.MOTIVO_ANULACION).getValues();
    var stockIndex = buildSauStockIndex_(stock);
    var actor = String(payload.actor || "").trim() || "App";
    var now = new Date();
    var restored = 0;
    var lines = 0;
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var key = String(row[SAU.VENTA_COL.CLAIM - 1] || row[SAU.VENTA_COL.ORDER_ID - 1] || row[SAU.VENTA_COL.VENTA_ID - 1] || ("fila-" + (i + 2))).trim();
      if (key !== saleKey || toSauBoolean_(row[SAU.VENTA_COL.ANULADA - 1])) continue;
      var sku = String(row[SAU.VENTA_COL.SKU - 1] || "").trim();
      var quantity = Number(row[SAU.VENTA_COL.CANTIDAD - 1]) || 1;
      var match = sku && stockIndex.bySku[sku];
      if (match) {
        var cell = stock.getRange(match.row, SAU.STOCK_COL.CANTIDAD);
        var before = Number(cell.getValue()) || 0;
        cell.setValue(before + quantity);
        stock.getRange(match.row, SAU.STOCK_COL.ULTIMA_ACTUALIZACION).setValue(now);
        appendSauStockMovement_({ type: "Anulacion venta", sourceId: saleKey, sku: sku, name: row[SAU.VENTA_COL.NOMBRE - 1], delta: quantity, before: before, after: before + quantity, actor: actor, notes: reason });
        restored += quantity;
      } else {
        addSauPendingReview_("Anulacion sin SKU", saleKey, row[SAU.VENTA_COL.NOMBRE - 1], "No se pudo devolver " + quantity + " al stock");
      }
      sales.getRange(i + 2, SAU.VENTA_COL.ANULADA, 1, 4).setValues([[true, now, actor, reason]]);
      lines++;
    }
    if (!lines) throw new Error("No encontre una venta activa con ese identificador.");
    appendSauAudit_("Anular venta", "Venta", saleKey, actor, reason, actionId);
    var result = { saleKey: saleKey, cancelled: true, lines: lines, restored: restored, actionId: actionId };
    return saveSauAppActionResult_(actionId, "cancelSale", actor, result);
  } finally {
    lock.releaseLock();
  }
}

function mobileListPurchases(request) {
  request = request || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var purchases = ss.getSheetByName(SAU.SHEETS.COMPRAS);
  if (!purchases) throw new Error("No existe hoja Compras.");
  if (purchases.getLastRow() < 2) return { purchases: [], total: 0 };

  var max = Math.max(5, Math.min(Number(request.limit) || 80, 200));
  var mode = String(request.mode || "pending").toLowerCase();
  var q = normalizeSauMobileSearch_(request.q || request.query || "");
  var values = purchases.getRange(2, 1, purchases.getLastRow() - 1, SAU.COMPRA_COL.CREADO_POR).getValues();
  var out = [];

  for (var i = 0; i < values.length; i++) {
    var item = buildSauMobilePurchase_(values[i], i + 2);
    if (!item.item && !item.pcUrl && !item.nombre) continue;
    if (mode === "pending" && item.synced) continue;
    if (mode === "received" && !item.received) continue;
    if (q && !matchesSauMobileQuery_(normalizeSauMobileSearch_([
      item.provider,
      item.item,
      item.nombre,
      item.expansion,
      item.pcId,
      item.pcUrl
    ].join(" ")), q)) continue;
    out.push(item);
  }

  out.sort(function(a, b) {
    return (b.dateValue || 0) - (a.dateValue || 0);
  });
  return { purchases: out.slice(0, max), total: out.length };
}

function mobileCreatePurchase(payload) {
  payload = payload || {};
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;
  var rawItems = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
  var cache = buildSauCacheLookup_();
  var now = new Date();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var purchases = ss.getSheetByName(SAU.SHEETS.COMPRAS);
  if (!purchases) throw new Error("No existe hoja Compras.");
  var purchaseId = String(payload.purchaseId || "").trim() || ("COM-" + Utilities.getUuid().slice(0, 8).toUpperCase());
  var actor = String(payload.actor || "").trim() || "App";
  var rows = [];
  for (var i = 0; i < rawItems.length; i++) {
    var raw = rawItems[i] || {};
    var quantity = Math.max(1, Number(raw.quantity) || 1);
    var pcUrl = normalizeSauUrl_(raw.pcUrl || raw.priceChartingUrl || "");
    var pcId = String(raw.pcId || "").trim() || extractSauPriceChartingId_(pcUrl);
    var item = findSauCacheItem_(cache, pcId, pcUrl);
    var row = new Array(SAU.COMPRA_COL.CREADO_POR);
    for (var c = 0; c < row.length; c++) row[c] = "";
    row[SAU.COMPRA_COL.FECHA - 1] = now;
    row[SAU.COMPRA_COL.PROVEEDOR - 1] = String(payload.provider || raw.provider || "").trim();
    row[SAU.COMPRA_COL.ITEM - 1] = String(raw.item || "").trim() || [item && (item.nombre || item.nombrePc), item && (item.expansion || item.expansionPc)].filter(Boolean).join(" - ");
    row[SAU.COMPRA_COL.NOMBRE - 1] = String(raw.name || "").trim() || (item && (item.nombre || item.nombrePc)) || "";
    row[SAU.COMPRA_COL.EXPANSION - 1] = String(raw.expansion || "").trim() || (item && (item.expansion || item.expansionPc)) || "";
    row[SAU.COMPRA_COL.CANTIDAD - 1] = quantity;
    row[SAU.COMPRA_COL.COSTO_TOTAL_ARS - 1] = Number(raw.totalArs) || "";
    row[SAU.COMPRA_COL.COSTO_UNITARIO_ARS - 1] = Number(raw.unitArs) || "";
    row[SAU.COMPRA_COL.PC_URL - 1] = pcUrl || (item && item.pcUrl) || "";
    row[SAU.COMPRA_COL.PC_ID - 1] = pcId || (item && item.pcId) || "";
    row[SAU.COMPRA_COL.RECIBIDO - 1] = toSauBoolean_(payload.received || raw.received);
    row[SAU.COMPRA_COL.NOTAS - 1] = String(payload.notes || raw.notes || "").trim();
    row[SAU.COMPRA_COL.COSTO_TOTAL_USD - 1] = Number(raw.totalUsd) || "";
    row[SAU.COMPRA_COL.COSTO_UNITARIO_USD - 1] = Number(raw.unitUsd) || "";
    row[SAU.COMPRA_COL.COMPRA_ID - 1] = purchaseId;
    row[SAU.COMPRA_COL.RECIBIDO_CANTIDAD - 1] = row[SAU.COMPRA_COL.RECIBIDO - 1] ? quantity : 0;
    row[SAU.COMPRA_COL.CREADO_POR - 1] = actor;
    rows.push(row);
  }
  var firstRow = purchases.getLastRow() + 1;
  appendSauRows_(purchases, rows);
  if (toSauBoolean_(payload.received)) processReceivedPurchases();
  var created = rows.map(function(row, index) { return buildSauMobilePurchase_(row, firstRow + index); });
  appendSauAudit_("Crear compra", "Compra", purchaseId, actor, rows.length + " lineas", actionId);
  var result = { purchaseId: purchaseId, purchases: created, purchase: created[0], actionId: actionId };
  return saveSauAppActionResult_(actionId, "createPurchase", actor, result);
}

function mobileReceivePurchase(payload) {
  payload = payload || {};
  var rowNumber = Number(payload.row);
  var purchaseId = String(payload.purchaseId || "").trim();
  if ((!rowNumber || rowNumber < 2) && !purchaseId) throw new Error("Falta compra o fila.");
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var purchases = ss.getSheetByName(SAU.SHEETS.COMPRAS);
  if (!purchases) throw new Error("No existe hoja Compras.");
  var targetRows = [];
  if (purchaseId) {
    var ids = purchases.getRange(2, SAU.COMPRA_COL.COMPRA_ID, Math.max(1, purchases.getLastRow() - 1), 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0] || "").trim() === purchaseId) targetRows.push(i + 2);
  } else targetRows.push(rowNumber);
  if (!targetRows.length || targetRows[0] > purchases.getLastRow()) throw new Error("No encontre esa compra.");
  for (var t = 0; t < targetRows.length; t++) {
    var target = targetRows[t];
    var qty = Number(purchases.getRange(target, SAU.COMPRA_COL.CANTIDAD).getValue()) || 0;
    var currentReceived = Number(purchases.getRange(target, SAU.COMPRA_COL.RECIBIDO_CANTIDAD).getValue()) || 0;
    var addQty = payload.quantity === undefined ? qty - currentReceived : Math.max(0, Number(payload.quantity) || 0);
    var nextReceived = Math.min(qty, currentReceived + addQty);
    purchases.getRange(target, SAU.COMPRA_COL.RECIBIDO_CANTIDAD).setValue(nextReceived);
    purchases.getRange(target, SAU.COMPRA_COL.RECIBIDO).setValue(nextReceived >= qty);
  }
  var result = processReceivedPurchases();
  var first = targetRows[0];
  var row = purchases.getRange(first, 1, 1, SAU.COMPRA_COL.CREADO_POR).getValues()[0];
  var actor = String(payload.actor || "").trim() || "App";
  appendSauAudit_("Recibir compra", "Compra", purchaseId || String(first), actor, targetRows.length + " lineas", actionId);
  var response = { processed: result.processed || 0, purchase: buildSauMobilePurchase_(row, first), purchaseId: purchaseId, actionId: actionId };
  return saveSauAppActionResult_(actionId, "receivePurchase", actor, response);
}

function mobileImportScannerStock(payload) {
  payload = payload || {};
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;
  var items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error("No hay items para importar.");

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("La planilla esta ocupada. Proba de nuevo en unos segundos.");

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    if (!stock) throw new Error("No existe hoja Stock.");

    var config = readSauConfig_();
    var cacheLookup = buildSauCacheLookup_();
    var cacheIndex = buildSauScannerCacheIndex_();
    var stockIndex = buildSauStockIndex_(stock);
    var imported = 0;
    var review = 0;
    var skipped = 0;
    var details = [];

    for (var i = 0; i < items.length; i++) {
      var raw = items[i] || {};
      if (raw.skip) {
        skipped++;
        continue;
      }
      var quantity = Number(raw.quantity) || 0;
      if (quantity <= 0) {
        skipped++;
        continue;
      }

      var pcUrl = normalizeSauUrl_(raw.pcUrl || "");
      var pcId = String(raw.pcId || "").trim() || extractSauPriceChartingId_(pcUrl);
      var matchResult = pcId || pcUrl
        ? { item: findSauCacheItem_(cacheLookup, pcId, pcUrl), status: "Link/ID", score: 100 }
        : findSauScannerCacheMatch_(cacheIndex, raw.name, raw.expansion || raw.set, raw.number);

      if (!matchResult || !matchResult.item) {
        review++;
        details.push({ status: "review", localKey: raw.localKey || "", name: raw.name || "", expansion: raw.expansion || raw.set || "", number: raw.number || "", error: matchResult && matchResult.error || "Sin match" });
        addSauPendingReview_("Importacion scanner", raw.localKey || "", raw.name || "", [raw.expansion || raw.set || "", raw.number || "", matchResult && matchResult.error || "Sin match"].filter(Boolean).join(" - "));
        continue;
      }

      var cacheItem = matchResult.item;
      var movement = buildSauMovementItem_({
        sku: cacheItem.pcId ? buildSauSku_(cacheItem.pcId) : "",
        name: raw.finalName || cacheItem.nombre || cacheItem.nombrePc || raw.name,
        expansion: raw.finalExpansion || cacheItem.expansion || cacheItem.expansionPc || raw.expansion || raw.set,
        quantity: quantity,
        pcUrl: cacheItem.pcUrl || pcUrl,
        pcId: cacheItem.pcId || pcId,
        cacheItem: cacheItem,
        lastPurchaseUsd: Number(raw.lastPurchaseUsd) || "",
        note: "Importado desde scanner " + String(raw.scanner || "MonPrice")
      });
      movement.language = raw.language || config.default_idioma || "EN";
      movement.condition = raw.condition || config.default_condicion || "NM";
      movement.location = raw.location || config.default_ubicacion || "";

      var stockMatch = appendOrIncrementSauStock_(stock, stockIndex, movement, quantity, config, movement.lastPurchaseUsd);
      appendSauStockMovement_({
        type: "Importacion scanner", sourceId: String(payload.localActionId || raw.localKey || ""), sku: stockMatch.sku,
        name: movement.name, delta: quantity, before: stockMatch.beforeQuantity, after: stockMatch.afterQuantity,
        actor: String(payload.actor || "App"), notes: matchResult.status || "Scanner"
      });
      imported++;
      details.push({ status: "imported", localKey: raw.localKey || "", sku: stockMatch.sku, name: movement.name, quantity: quantity });
    }

    var actor = String(payload.actor || "").trim() || "App";
    var result = { imported: imported, review: review, skipped: skipped, details: details, actionId: actionId };
    appendSauAudit_("Importar scanner", "Stock", actionId, actor, imported + " importadas, " + review + " a revisar", actionId);
    return saveSauAppActionResult_(actionId, "importScannerStock", actor, result);
  } finally {
    lock.releaseLock();
  }
}

function buildSauMobilePurchase_(row, rowNumber) {
  var received = toSauBoolean_(row[SAU.COMPRA_COL.RECIBIDO - 1]);
  var sync = String(row[SAU.COMPRA_COL.SYNC_STOCK - 1] || "").trim();
  var date = row[SAU.COMPRA_COL.FECHA - 1];
  var quantity = Number(row[SAU.COMPRA_COL.CANTIDAD - 1]) || 0;
  var receivedQuantity = Number(row[SAU.COMPRA_COL.RECIBIDO_CANTIDAD - 1]) || (received ? quantity : 0);
  var syncedQuantity = getSauPurchaseSyncedQuantity_(sync, quantity);
  return {
    row: rowNumber,
    date: date instanceof Date ? formatSauDateTime_(date) : String(date || ""),
    dateValue: date instanceof Date ? date.getTime() : 0,
    provider: String(row[SAU.COMPRA_COL.PROVEEDOR - 1] || "").trim(),
    item: String(row[SAU.COMPRA_COL.ITEM - 1] || "").trim(),
    nombre: String(row[SAU.COMPRA_COL.NOMBRE - 1] || "").trim(),
    expansion: String(row[SAU.COMPRA_COL.EXPANSION - 1] || "").trim(),
    quantity: quantity,
    receivedQuantity: receivedQuantity,
    remainingQuantity: Math.max(0, quantity - receivedQuantity),
    totalArs: Number(row[SAU.COMPRA_COL.COSTO_TOTAL_ARS - 1]) || 0,
    unitArs: Number(row[SAU.COMPRA_COL.COSTO_UNITARIO_ARS - 1]) || 0,
    pcUrl: normalizeSauUrl_(row[SAU.COMPRA_COL.PC_URL - 1]),
    pcId: String(row[SAU.COMPRA_COL.PC_ID - 1] || "").trim(),
    received: received,
    synced: syncedQuantity >= quantity && quantity > 0,
    syncedQuantity: syncedQuantity,
    sync: sync,
    notes: String(row[SAU.COMPRA_COL.NOTAS - 1] || "").trim(),
    totalUsd: Number(row[SAU.COMPRA_COL.COSTO_TOTAL_USD - 1]) || 0,
    unitUsd: Number(row[SAU.COMPRA_COL.COSTO_UNITARIO_USD - 1]) || 0,
    purchaseId: String(row[SAU.COMPRA_COL.COMPRA_ID - 1] || ("FILA-" + rowNumber)).trim(),
    createdBy: String(row[SAU.COMPRA_COL.CREADO_POR - 1] || "").trim()
  };
}

function getSauPurchaseSyncedQuantity_(value, legacyQuantity) {
  var text = String(value || "").trim();
  var match = text.match(/QTY:(\d+(?:\.\d+)?)/i);
  if (match) return Number(match[1]) || 0;
  return text ? Number(legacyQuantity) || 0 : 0;
}

function buildSauScannerCacheIndex_() {
  var cache = buildSauCacheIndex_();
  var index = { byFull: {}, byNameNumber: {}, byExpansionNumber: {} };
  Object.keys(cache.byId || {}).forEach(function(pcId) {
    var source = cache.byId[pcId];
    var item = {
      pcId: source.pcId,
      pcUrl: source.pcUrl,
      nombrePc: source.nombrePc,
      nombre: source.nombre || source.nombrePc || "",
      expansionPc: source.expansionPc,
      expansion: source.expansion || source.expansionPc || "",
      numero: normalizeSauScannerCardNumber_(source.numero),
      usd: source.usd,
      imageUrl: source.imageUrl
    };
    addSauScannerIndexItem_(index.byFull, buildSauScannerMatchKey_(item.nombre, item.expansion, item.numero), item);
    addSauScannerIndexItem_(index.byNameNumber, buildSauScannerNameNumberKey_(item.nombre, item.numero), item);
    addSauScannerIndexItem_(index.byExpansionNumber, buildSauScannerExpansionNumberKey_(item.expansion, item.numero), item);
  });
  return index;
}

function addSauScannerIndexItem_(bucket, key, item) {
  if (!key) return;
  if (!bucket[key]) bucket[key] = [];
  bucket[key].push(item);
}

function findSauScannerCacheMatch_(index, name, expansion, number) {
  name = String(name || "").trim();
  expansion = String(expansion || "").trim();
  number = normalizeSauScannerCardNumber_(number);
  if (!expansion || !number) return { error: "Falta expansion o numero" };

  var fullKey = buildSauScannerMatchKey_(name, expansion, number);
  if (name) {
    var fullMatches = index.byFull[fullKey] || [];
    if (fullMatches.length === 1) return { item: fullMatches[0], status: "Match OK", score: 100, key: fullKey };
    if (fullMatches.length > 1) return { error: "Match exacto duplicado: " + fullMatches.length };

    var nameNumberKey = buildSauScannerNameNumberKey_(name, number);
    var nameNumberMatches = index.byNameNumber[nameNumberKey] || [];
    if (nameNumberMatches.length === 1) return { item: nameNumberMatches[0], status: "Nombre+numero", score: 85, key: nameNumberKey };
    if (nameNumberMatches.length > 1) return { error: "Nombre + numero ambiguo: " + nameNumberMatches.length };
  }

  var expansionNumberKey = buildSauScannerExpansionNumberKey_(expansion, number);
  var expansionNumberMatches = index.byExpansionNumber[expansionNumberKey] || [];
  if (expansionNumberMatches.length === 1) {
    return { item: expansionNumberMatches[0], status: "Expansion+numero", score: 75, key: expansionNumberKey };
  }
  if (expansionNumberMatches.length > 1) return { error: "Expansion + numero ambiguo: " + expansionNumberMatches.length };

  return { error: "Sin match en cache" };
}

function buildSauScannerMatchKey_(name, expansion, number) {
  return [
    normalizeSauScannerMatchText_(name),
    normalizeSauScannerMatchText_(expansion),
    normalizeSauScannerCardNumber_(number)
  ].join("|");
}

function buildSauScannerNameNumberKey_(name, number) {
  return [normalizeSauScannerMatchText_(name), normalizeSauScannerCardNumber_(number)].join("|");
}

function buildSauScannerExpansionNumberKey_(expansion, number) {
  expansion = normalizeSauScannerMatchText_(expansion);
  number = normalizeSauScannerCardNumber_(number);
  if (!expansion || !number) return "";
  return [expansion, number].join("|");
}

function normalizeSauScannerMatchText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(ex|gx|v|vmax|vstar)\b/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSauScannerCardNumber_(value) {
  var text = String(value || "").trim();
  if (text.indexOf("/") >= 0) text = text.split("/")[0];
  text = text.toLowerCase().replace(/^#/, "").trim();
  if (/^\d+$/.test(text)) return String(Number(text));
  return text.replace(/[^a-z0-9]+/g, "");
}

function mobileConfigureClaimGenerator(payload) {
  payload = payload || {};
  var id = extractSauSpreadsheetId_(payload.spreadsheetUrl || payload.url || payload.spreadsheetId || "");
  if (!id) throw new Error("Pega una URL o ID valido del Generador de Claims.");
  var generator = SpreadsheetApp.openById(id);
  assertSauClaimGeneratorStructure_(generator);
  ensureSauClaimAppSheets_(generator);
  PropertiesService.getScriptProperties().setProperty(SAU.PROP.CLAIM_GENERATOR_SPREADSHEET_ID, id);
  appendSauAudit_("Configurar generador", "Claims", id, String(payload.actor || "App"), generator.getName(), String(payload.localActionId || ""));
  return buildSauClaimWorkspace_(generator);
}

function mobileGetClaimWorkspace(request) {
  var generator = getSauClaimGenerator_(false);
  if (!generator) {
    return {
      configured: false,
      cards: [],
      grids: [],
      summary: { cards: 0, buyers: 0, totalArs: 0, totalUsd: 0, missingImages: 0, remainingGridCards: 0 }
    };
  }
  return buildSauClaimWorkspace_(generator);
}

function getSauClaimGenerator_(required) {
  var id = PropertiesService.getScriptProperties().getProperty(SAU.PROP.CLAIM_GENERATOR_SPREADSHEET_ID);
  if (!id) {
    if (required !== false) throw new Error("Falta configurar la planilla Generador de Claims.");
    return null;
  }
  var generator = SpreadsheetApp.openById(id);
  assertSauClaimGeneratorStructure_(generator);
  ensureSauClaimAppSheets_(generator);
  return generator;
}

function assertSauClaimGeneratorStructure_(generator) {
  if (!generator) throw new Error("No pude abrir el Generador de Claims.");
  var required = [SAU_CLAIM.SHEETS.CONFIG, SAU_CLAIM.SHEETS.LOAD, SAU_CLAIM.SHEETS.CLAIM, SAU_CLAIM.SHEETS.FREES, SAU_CLAIM.SHEETS.INFO];
  var missing = required.filter(function(name) { return !generator.getSheetByName(name); });
  if (missing.length) throw new Error("El Generador de Claims no tiene: " + missing.join(", ") + ". Ejecuta Crear / reparar estructura en esa planilla.");
}

function ensureSauClaimAppSheets_(generator) {
  var state = generator.getSheetByName(SAU_CLAIM.SHEETS.STATE) || generator.insertSheet(SAU_CLAIM.SHEETS.STATE);
  if (!state.getRange("A1").getValue()) {
    state.getRange("A1:B1").setValues([["Clave", "Valor"]]);
    state.getRange("A1:B1").setFontWeight("bold").setBackground("#18181b").setFontColor("#ffffff");
    state.setFrozenRows(1);
  }
  var grids = generator.getSheetByName(SAU_CLAIM.SHEETS.GRID_LOG) || generator.insertSheet(SAU_CLAIM.SHEETS.GRID_LOG);
  if (!grids.getRange("A1").getValue()) {
    grids.getRange("A1:I1").setValues([["Session ID", "Fecha", "Lote", "Archivo ID", "URL", "Download URL", "Cartas", "Filas", "Publico"]]);
    grids.getRange("A1:I1").setFontWeight("bold").setBackground("#18181b").setFontColor("#ffffff");
    grids.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm");
    grids.setFrozenRows(1);
  }
  try { state.hideSheet(); } catch (ignoredState) {}
  try { grids.hideSheet(); } catch (ignoredGrids) {}
}

function readSauClaimConfig_(generator) {
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.CONFIG);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0]) out[String(values[i][0]).trim()] = values[i][1];
  }
  return out;
}

function readSauClaimState_(generator) {
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.STATE);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || "").trim();
    if (key) out[key] = values[i][1];
  }
  return out;
}

function writeSauClaimState_(generator, state) {
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.STATE);
  if (!sheet) {
    ensureSauClaimAppSheets_(generator);
    sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.STATE);
  }
  if (sheet.getLastRow() >= 2) sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
  var keys = Object.keys(state || {}).filter(function(key) { return state[key] !== undefined && state[key] !== null && state[key] !== ""; });
  if (keys.length) sheet.getRange(2, 1, keys.length, 2).setValues(keys.map(function(key) { return [key, state[key]]; }));
}

function ensureSauClaimActiveState_(generator, cards) {
  var state = readSauClaimState_(generator);
  if (state.session_id || !(cards || []).length) return state;
  state = {
    session_id: "CLM-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
    claim_name: buildUniqueSauClaimName_(generator),
    created_at: new Date(),
    updated_at: new Date(),
    status: "Abierto"
  };
  writeSauClaimState_(generator, state);
  return state;
}

function touchSauClaimState_(generator, patch) {
  var state = readSauClaimState_(generator);
  Object.keys(patch || {}).forEach(function(key) { state[key] = patch[key]; });
  state.updated_at = new Date();
  writeSauClaimState_(generator, state);
  return state;
}

function buildSauClaimWorkspace_(generator) {
  SpreadsheetApp.flush();
  var loadMap = readSauClaimLoadMap_(generator);
  var cards = readSauClaimCards_(generator, loadMap);
  var state = ensureSauClaimActiveState_(generator, cards);
  var grids = readSauClaimGrids_(generator, state.session_id || "");
  var config = readSauClaimConfig_(generator);
  var summary = buildSauClaimSummary_(cards, loadMap);
  return {
    configured: true,
    generatorName: generator.getName(),
    generatorUrl: generator.getUrl(),
    session: state.session_id ? {
      id: String(state.session_id || ""),
      name: String(state.claim_name || buildSauClaimName_()),
      status: String(state.status || "Abierto"),
      createdAt: state.created_at ? formatSauDateTime_(new Date(state.created_at)) : "",
      updatedAt: state.updated_at ? formatSauDateTime_(new Date(state.updated_at)) : ""
    } : null,
    cards: cards,
    grids: grids,
    summary: summary,
    settings: {
      usdArs: Number(config.usd_ars || 1510),
      roundTo: Number(config.round_to || 500),
      minPrice: Number(config.min_price || 800),
      gridColumns: Number(config.grid_columns || 5),
      gridRows: Number(config.grid_rows || 6)
    }
  };
}

function readSauClaimLoadMap_(generator) {
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.LOAD);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SAU_CLAIM.LOAD_COL.UPDATED_AT).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][SAU_CLAIM.LOAD_COL.ID - 1] || "").trim();
    if (!id) continue;
    out[id] = {
      rowNumber: i + 2,
      status: String(values[i][SAU_CLAIM.LOAD_COL.STATUS - 1] || "").trim(),
      gridBatch: String(values[i][SAU_CLAIM.LOAD_COL.GRID_BATCH - 1] || "").trim(),
      error: String(values[i][SAU_CLAIM.LOAD_COL.ERROR - 1] || "").trim()
    };
  }
  return out;
}

function readSauClaimCards_(generator, loadMap) {
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.CLAIM);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rowCount = sheet.getLastRow() - 1;
  var values = sheet.getRange(2, 1, rowCount, SAU_CLAIM.CLAIM_COL.IMAGE_URL).getValues();
  var finalNameFormulas = sheet.getRange(2, SAU_CLAIM.CLAIM_COL.FINAL_NAME, rowCount, 1).getFormulas();
  var cards = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[SAU_CLAIM.CLAIM_COL.ID - 1] || "").trim();
    var name = String(row[SAU_CLAIM.CLAIM_COL.NAME - 1] || "").trim();
    if (!id && !name) continue;
    var load = (loadMap || {})[id] || {};
    cards.push({
      id: id,
      rowNumber: i + 2,
      name: name,
      expansion: String(row[SAU_CLAIM.CLAIM_COL.EXPANSION - 1] || "").trim(),
      pcUsd: Number(row[SAU_CLAIM.CLAIM_COL.PC_USD - 1]) || 0,
      pcArs: Number(row[SAU_CLAIM.CLAIM_COL.PC_ARS - 1]) || 0,
      suggestedArs: Number(row[SAU_CLAIM.CLAIM_COL.SUGGESTED_ARS - 1]) || 0,
      finalArs: sauOptionalNumber_(row[SAU_CLAIM.CLAIM_COL.FINAL_ARS - 1]),
      finalUsd: sauOptionalNumber_(row[SAU_CLAIM.CLAIM_COL.FINAL_USD - 1]),
      finalName: String(row[SAU_CLAIM.CLAIM_COL.FINAL_NAME - 1] || "").trim(),
      customFinalName: !String(finalNameFormulas[i][0] || "").trim(),
      buyer: String(row[SAU_CLAIM.CLAIM_COL.BUYER - 1] || "").trim(),
      tags: String(row[SAU_CLAIM.CLAIM_COL.TAGS - 1] || "").trim(),
      pcUrl: normalizeSauUrl_(row[SAU_CLAIM.CLAIM_COL.PC_URL - 1]),
      pcId: String(row[SAU_CLAIM.CLAIM_COL.PC_ID - 1] || "").trim(),
      imageUrl: normalizeSauUrl_(row[SAU_CLAIM.CLAIM_COL.IMAGE_URL - 1]),
      status: load.status || "OK",
      gridBatch: load.gridBatch || "",
      error: load.error || ""
    });
  }
  return cards;
}

function readSauClaimFrees_(generator) {
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.FREES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SAU_CLAIM.FREE_COL.NOTES).getValues();
  return values.filter(function(row) {
    return row.some(function(value) { return String(value || "").trim(); });
  }).map(function(row, index) {
    return {
      rowNumber: index + 2,
      finalName: String(row[SAU_CLAIM.FREE_COL.FINAL_NAME - 1] || "").trim(),
      name: String(row[SAU_CLAIM.FREE_COL.NAME - 1] || "").trim(),
      expansion: String(row[SAU_CLAIM.FREE_COL.EXPANSION - 1] || "").trim(),
      quantity: Number(row[SAU_CLAIM.FREE_COL.QUANTITY - 1]) || 1,
      buyer: String(row[SAU_CLAIM.FREE_COL.BUYER - 1] || "").trim(),
      pcUrl: normalizeSauUrl_(row[SAU_CLAIM.FREE_COL.PC_URL - 1]),
      pcId: String(row[SAU_CLAIM.FREE_COL.PC_ID - 1] || "").trim(),
      tags: String(row[SAU_CLAIM.FREE_COL.TAGS - 1] || "").trim(),
      notes: String(row[SAU_CLAIM.FREE_COL.NOTES - 1] || "").trim()
    };
  });
}

function readSauClaimGrids_(generator, sessionId) {
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.GRID_LOG);
  if (!sheet || sheet.getLastRow() < 2 || !sessionId) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  var out = [];
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || "").trim() !== String(sessionId)) continue;
    out.push({
      batch: String(values[i][2] || ""),
      fileId: String(values[i][3] || ""),
      url: String(values[i][4] || ""),
      downloadUrl: String(values[i][5] || ""),
      cards: Number(values[i][6]) || 0,
      public: toSauBoolean_(values[i][8]),
      createdAt: values[i][1] ? formatSauDateTime_(new Date(values[i][1])) : ""
    });
  }
  return out;
}

function buildSauClaimSummary_(cards, loadMap) {
  var buyers = {};
  var totalArs = 0;
  var totalUsd = 0;
  var missingImages = 0;
  var remainingGridCards = 0;
  var missingPrices = 0;
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    if (card.buyer) buyers[normalizeSauMobileSearch_(card.buyer)] = true;
    if (card.buyer) {
      totalArs += Number(card.finalArs) || 0;
      totalUsd += Number(card.finalUsd) || 0;
      if (!Number(card.finalArs) && !Number(card.finalUsd)) missingPrices++;
    }
    if (!card.imageUrl) missingImages++;
    var load = (loadMap || {})[card.id] || {};
    if (card.imageUrl && !load.gridBatch) remainingGridCards++;
  }
  return {
    cards: cards.length,
    cardsWithBuyer: cards.filter(function(card) { return !!card.buyer; }).length,
    buyers: Object.keys(buyers).length,
    totalArs: totalArs,
    totalUsd: totalUsd,
    missingImages: missingImages,
    missingPrices: missingPrices,
    remainingGridCards: remainingGridCards
  };
}

function sauOptionalNumber_(value) {
  if (value === "" || value === null || value === undefined) return "";
  var number = Number(value);
  return isNaN(number) ? "" : number;
}

function mobilePrepareClaim(payload) {
  payload = payload || {};
  var actionId = String(payload.localActionId || "").trim();
  var previous = actionId ? findSauAppActionResult_(actionId) : null;
  var generator = getSauClaimGenerator_(true);
  if (previous) {
    previous.duplicate = true;
    previous.workspace = buildSauClaimWorkspace_(generator);
    return previous;
  }

  var items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error("No hay cartas para preparar.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Ya hay otra preparacion de claim corriendo.");
  try {
    var currentCards = readSauClaimCards_(generator, readSauClaimLoadMap_(generator));
    var replaceExisting = toSauBoolean_(payload.replaceExisting);
    var appendExisting = toSauBoolean_(payload.appendExisting);
    if (currentCards.length && !replaceExisting && !appendExisting) {
      throw new Error("Ya hay un claim activo. Elegi agregar estas cartas o reemplazarlo.");
    }
    if (replaceExisting) clearSauClaimWorkingSheets_(generator);

    var config = readSauClaimConfig_(generator);
    var fastCache = buildSauCacheLookup_();
    var needsScannerIndex = items.some(function(raw) {
      return !String(raw.pcId || "").trim() && !normalizeSauUrl_(raw.pcUrl || raw.priceChartingUrl || "");
    });
    var scannerIndex = needsScannerIndex ? buildSauScannerCacheIndex_() : null;
    var loadRows = [];
    var claimRows = [];
    var details = [];
    var prepared = 0;
    var review = 0;
    var now = new Date();
    var usdArs = Number(config.usd_ars || 1510);
    var roundTo = Number(config.round_to || 500);
    var minPrice = Number(config.min_price || 800);
    var fetchMissingImages = config.fetch_image_if_missing === undefined ? true : toSauBoolean_(config.fetch_image_if_missing);
    var imageDelay = Math.max(0, Number(config.image_fetch_delay_ms || 350));

    for (var i = 0; i < items.length; i++) {
      var raw = items[i] || {};
      if (toSauBoolean_(raw.skip)) continue;
      var localKey = String(raw.localKey || ("fila-" + (i + 1)));
      var quantity = Math.max(0, Math.min(50, Math.floor(Number(raw.quantity) || 1)));
      if (!quantity) continue;
      var pcUrl = normalizeSauUrl_(raw.pcUrl || raw.priceChartingUrl || "");
      var pcId = String(raw.pcId || "").trim() || extractSauPriceChartingId_(pcUrl);
      var cacheItem = findSauCacheItem_(fastCache, pcId, pcUrl);
      var matchStatus = pcId || pcUrl ? "Link / ID" : "";
      var matchError = "";
      if (!cacheItem && scannerIndex) {
        var match = findSauScannerCacheMatch_(scannerIndex, raw.name, raw.expansion || raw.set, raw.number);
        cacheItem = match && match.item;
        matchStatus = match && match.status || "";
        matchError = match && match.error || "Sin match en cache";
      }
      if (!cacheItem) {
        review++;
        details.push({ localKey: localKey, status: "review", error: matchError || "Sin match en PriceCharting Cache" });
        continue;
      }

      var exactUrl = pickSauExactPriceChartingUrl_(
        buildSauPriceChartingUrlFromItem_(cacheItem),
        pcUrl,
        cacheItem.pcUrl
      );
      var imageUrl = normalizeSauUrl_(cacheItem.imageUrl);
      var imageError = "";
      if (!imageUrl && fetchMissingImages && exactUrl) {
        try {
          imageUrl = fetchSauPriceChartingImageUrl_(exactUrl);
          if (imageDelay) Utilities.sleep(imageDelay);
        } catch (imageErr) {
          imageError = "Imagen pendiente: " + String(imageErr && imageErr.message ? imageErr.message : imageErr);
        }
      }
      var usd = Number(cacheItem.usd) || 0;
      var pcArs = usd ? usd * usdArs : 0;
      var suggested = usd ? roundSauPrice_(pcArs, roundTo, minPrice) : 0;
      var name = String(cacheItem.nombre || cacheItem.nombrePc || raw.name || "").trim();
      var expansion = String(cacheItem.expansion || cacheItem.expansionPc || raw.expansion || raw.set || "").trim();
      var number = String(cacheItem.numero || raw.number || "").trim();

      for (var copy = 0; copy < quantity; copy++) {
        var cardId = "CG-" + Utilities.getUuid().slice(0, 8).toUpperCase();
        loadRows.push([
          cardId, now, exactUrl || pcUrl, cacheItem.pcId || pcId, cacheItem.nombrePc || name, name,
          cacheItem.expansionPc || expansion, expansion, number, usd || "", pcArs || "", suggested || "", suggested || "",
          imageUrl, "", imageError ? "OK sin imagen" : "OK", "", imageError, now
        ]);
        claimRows.push([
          cardId, name, expansion, usd || "", pcArs || "", suggested || "", "", "", "", "", "",
          exactUrl || pcUrl, cacheItem.pcId || pcId, imageUrl
        ]);
        prepared++;
      }
      details.push({ localKey: localKey, status: "prepared", cards: quantity, match: matchStatus, pcId: cacheItem.pcId || pcId });
    }

    if (!prepared) throw new Error(review ? "Ninguna carta pudo asociarse al cache. Revisa los links indicados." : "No quedaron cartas activas para preparar.");
    var loadSheet = generator.getSheetByName(SAU_CLAIM.SHEETS.LOAD);
    var claimSheet = generator.getSheetByName(SAU_CLAIM.SHEETS.CLAIM);
    var loadStartRow = appendExisting && currentCards.length ? nextSauAppendRow_(loadSheet, SAU_CLAIM.LOAD_COL.ID) : 2;
    var claimStartRow = appendExisting && currentCards.length ? nextSauAppendRow_(claimSheet, SAU_CLAIM.CLAIM_COL.ID) : 2;
    loadSheet.getRange(loadStartRow, 1, loadRows.length, SAU_CLAIM.LOAD_COL.UPDATED_AT).setValues(loadRows);
    claimSheet.getRange(claimStartRow, 1, claimRows.length, SAU_CLAIM.CLAIM_COL.IMAGE_URL).setValues(claimRows);
    var previewFormulas = [];
    var nameFormulas = [];
    for (var rowIndex = 0; rowIndex < prepared; rowIndex++) {
      var loadRow = rowIndex + loadStartRow;
      var claimRow = rowIndex + claimStartRow;
      previewFormulas.push(["=IF(N" + loadRow + "=\"\",\"\",IMAGE(N" + loadRow + "))"]);
      nameFormulas.push([buildSauClaimFinalNameFormula_(claimRow)]);
    }
    loadSheet.getRange(loadStartRow, SAU_CLAIM.LOAD_COL.PREVIEW, prepared, 1).setFormulas(previewFormulas);
    claimSheet.getRange(claimStartRow, SAU_CLAIM.CLAIM_COL.FINAL_NAME, prepared, 1).setFormulas(nameFormulas);

    var state = appendExisting && currentCards.length ? readSauClaimState_(generator) : {};
    if (!state.session_id) {
      state = {
        session_id: "CLM-" + Utilities.getUuid().slice(0, 8).toUpperCase(),
        claim_name: buildUniqueSauClaimName_(generator),
        created_at: now,
        status: "Abierto",
        actor: String(payload.actor || "App")
      };
    }
    state.updated_at = now;
    writeSauClaimState_(generator, state);
    updateSauClaimInfo_(generator, state.claim_name);
    var compactResult = { prepared: prepared, review: review, details: details, sessionId: state.session_id, claimName: state.claim_name };
    if (actionId) saveSauAppActionResult_(actionId, "prepareClaim", String(payload.actor || "App"), compactResult);
    appendSauAudit_("Preparar claim", "Claims", state.session_id, String(payload.actor || "App"), prepared + " cartas; " + review + " a revisar", actionId);
    compactResult.workspace = buildSauClaimWorkspace_(generator);
    return compactResult;
  } finally {
    lock.releaseLock();
  }
}

function nextSauAppendRow_(sheet, keyColumn) {
  if (!sheet || sheet.getLastRow() < 2) return 2;
  var values = sheet.getRange(2, keyColumn, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || "").trim()) return i + 3;
  }
  return 2;
}

function mobileUpdateClaimCard(payload) {
  payload = payload || {};
  var generator = getSauClaimGenerator_(true);
  var cardId = String(payload.cardId || payload.id || "").trim();
  if (!cardId) throw new Error("Falta identificar la carta.");
  var actionId = String(payload.localActionId || "").trim();
  var previous = actionId ? findSauAppActionResult_(actionId) : null;
  if (previous) return previous;
  var sheet = generator.getSheetByName(SAU_CLAIM.SHEETS.CLAIM);
  var found = sheet.getRange(2, SAU_CLAIM.CLAIM_COL.ID, Math.max(1, sheet.getLastRow() - 1), 1)
    .createTextFinder(cardId).matchEntireCell(true).findNext();
  if (!found) throw new Error("La carta ya no existe en el claim activo.");
  var rowNumber = found.getRow();
  var patch = payload.patch || payload;
  var row = sheet.getRange(rowNumber, 1, 1, SAU_CLAIM.CLAIM_COL.IMAGE_URL).getValues()[0];
  if (patch.name !== undefined) row[SAU_CLAIM.CLAIM_COL.NAME - 1] = String(patch.name || "").trim();
  if (patch.expansion !== undefined) row[SAU_CLAIM.CLAIM_COL.EXPANSION - 1] = String(patch.expansion || "").trim();
  if (patch.finalArs !== undefined) row[SAU_CLAIM.CLAIM_COL.FINAL_ARS - 1] = sauOptionalNumber_(patch.finalArs);
  if (patch.finalUsd !== undefined) row[SAU_CLAIM.CLAIM_COL.FINAL_USD - 1] = sauOptionalNumber_(patch.finalUsd);
  if (patch.buyer !== undefined) row[SAU_CLAIM.CLAIM_COL.BUYER - 1] = String(patch.buyer || "").trim();
  if (patch.tags !== undefined) row[SAU_CLAIM.CLAIM_COL.TAGS - 1] = String(patch.tags || "").trim();
  if (patch.pcUrl !== undefined) row[SAU_CLAIM.CLAIM_COL.PC_URL - 1] = normalizeSauUrl_(patch.pcUrl);
  sheet.getRange(rowNumber, 1, 1, SAU_CLAIM.CLAIM_COL.IMAGE_URL).setValues([row]);
  if (patch.finalName !== undefined && String(patch.finalName || "").trim()) {
    sheet.getRange(rowNumber, SAU_CLAIM.CLAIM_COL.FINAL_NAME).setValue(String(patch.finalName).trim());
  } else {
    sheet.getRange(rowNumber, SAU_CLAIM.CLAIM_COL.FINAL_NAME).setFormula(buildSauClaimFinalNameFormula_(rowNumber));
  }
  var state = touchSauClaimState_(generator, { status: "Abierto" });
  updateSauClaimInfo_(generator, String(state.claim_name || buildSauClaimName_()));
  SpreadsheetApp.flush();
  var loadMap = readSauClaimLoadMap_(generator);
  var cards = readSauClaimCards_(generator, loadMap);
  var updated = cards.filter(function(card) { return card.id === cardId; })[0];
  var result = { card: updated, summary: buildSauClaimSummary_(cards, loadMap) };
  if (actionId) saveSauAppActionResult_(actionId, "updateClaimCard", String(payload.actor || "App"), result);
  return result;
}

function mobileResetClaim(payload) {
  payload = payload || {};
  var generator = getSauClaimGenerator_(true);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("Ya hay otra operacion de claims corriendo.");
  try {
    var state = readSauClaimState_(generator);
    clearSauClaimWorkingSheets_(generator);
    writeSauClaimState_(generator, {});
    updateSauClaimInfo_(generator, buildSauClaimName_());
    appendSauAudit_("Resetear claim", "Claims", String(state.session_id || ""), String(payload.actor || "App"), String(state.claim_name || ""), String(payload.localActionId || ""));
    return buildSauClaimWorkspace_(generator);
  } finally {
    lock.releaseLock();
  }
}

function clearSauClaimWorkingSheets_(generator) {
  var specs = [
    [SAU_CLAIM.SHEETS.LOAD, SAU_CLAIM.LOAD_COL.UPDATED_AT],
    [SAU_CLAIM.SHEETS.CLAIM, SAU_CLAIM.CLAIM_COL.IMAGE_URL],
    [SAU_CLAIM.SHEETS.FREES, SAU_CLAIM.FREE_COL.NOTES]
  ];
  for (var i = 0; i < specs.length; i++) {
    var sheet = generator.getSheetByName(specs[i][0]);
    if (sheet && sheet.getLastRow() >= 2) sheet.getRange(2, 1, sheet.getLastRow() - 1, specs[i][1]).clearContent();
  }
}

function buildSauClaimFinalNameFormula_(row) {
  return "=IF(AND(B" + row + "=\"\",C" + row + "=\"\"),\"\",B" + row +
    "&IF(C" + row + "<>\"\",\" - \"&C" + row + ",\"\")" +
    "&IF(AND(G" + row + "<>\"\",H" + row + "<>\"\"),\" - $\"&G" + row + "&\" + $\"&H" + row + "&\"usd\"," +
    "IF(G" + row + "<>\"\",\" - $\"&G" + row + ",IF(H" + row + "<>\"\",\" - $\"&H" + row + "&\"usd\",\"\"))))";
}

function updateSauClaimInfo_(generator, claimName) {
  var info = generator.getSheetByName(SAU_CLAIM.SHEETS.INFO);
  if (!info) return;
  SpreadsheetApp.flush();
  var loadMap = readSauClaimLoadMap_(generator);
  var cards = readSauClaimCards_(generator, loadMap);
  var frees = readSauClaimFrees_(generator);
  var summary = buildSauClaimSummary_(cards, loadMap);
  var buyerTotals = {};
  cards.forEach(function(card) {
    if (!card.buyer) return;
    if (!buyerTotals[card.buyer]) buyerTotals[card.buyer] = { count: 0, ars: 0, usd: 0 };
    buyerTotals[card.buyer].count++;
    buyerTotals[card.buyer].ars += Number(card.finalArs) || 0;
    buyerTotals[card.buyer].usd += Number(card.finalUsd) || 0;
  });
  info.clearContents();
  info.getRange("A1:B8").setValues([
    ["Claim sugerido", claimName || buildSauClaimName_()],
    ["Fecha", new Date()],
    ["Cartas cargadas", cards.length],
    ["Cartas con comprador", summary.cardsWithBuyer],
    ["Total vendido ARS", summary.totalArs],
    ["Total vendido USD", summary.totalUsd],
    ["Frees", frees.length],
    ["Estado", "Abierto"]
  ]);
  info.getRange("A1:A8").setFontWeight("bold");
  info.getRange("B2").setNumberFormat("yyyy-mm-dd hh:mm");
  info.getRange("B5:B6").setNumberFormat("#,##0.00");
  var buyers = Object.keys(buyerTotals).sort();
  if (buyers.length) {
    info.getRange(1, 4, 1, 4).setValues([["Comprador", "Cartas", "Total ARS", "Total USD"]]);
    info.getRange(2, 4, buyers.length, 4).setValues(buyers.map(function(buyer) {
      return [buyer, buyerTotals[buyer].count, buyerTotals[buyer].ars, buyerTotals[buyer].usd];
    }));
    info.getRange(1, 4, 1, 4).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    info.getRange(2, 6, buyers.length, 2).setNumberFormat("#,##0.00");
  }
}

function buildSauClaimName_() {
  var now = new Date();
  var day = Utilities.formatDate(now, Session.getScriptTimeZone(), "d");
  var month = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), "M"));
  var months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return "Claim " + day + " de " + months[month - 1];
}

function buildUniqueSauClaimName_(generator) {
  var base = buildSauClaimName_();
  var used = {};
  var sources = [
    generator.getSheetByName(SAU_CLAIM.SHEETS.CLAIMS_LOG),
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAU.SHEETS.CLAIMS_LOG)
  ];
  for (var s = 0; s < sources.length; s++) {
    var sheet = sources[s];
    if (!sheet || sheet.getLastRow() < 2) continue;
    var values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) if (values[i][0]) used[String(values[i][0]).trim().toLowerCase()] = true;
  }
  if (!used[base.toLowerCase()]) return base;
  var suffix = 2;
  while (used[(base + " #" + suffix).toLowerCase()]) suffix++;
  return base + " #" + suffix;
}

function mobileGenerateClaimGrid(payload) {
  payload = payload || {};
  var generator = getSauClaimGenerator_(true);
  var state = readSauClaimState_(generator);
  if (!state.session_id) throw new Error("No hay un claim activo.");
  var config = readSauClaimConfig_(generator);
  var columns = Math.max(2, Math.min(6, Number(payload.columns || config.grid_columns || 5)));
  var rows = Math.max(2, Math.min(8, Number(payload.rows || config.grid_rows || 6)));
  var limit = columns * rows;
  var loadMap = readSauClaimLoadMap_(generator);
  var cards = readSauClaimCards_(generator, loadMap).filter(function(card) {
    return !!card.imageUrl && !(loadMap[card.id] && loadMap[card.id].gridBatch);
  });
  var batchCards = cards.slice(0, limit).map(function(card) {
    return { id: card.id, name: card.name, expansion: card.expansion, imageUrl: card.imageUrl };
  });
  if (!batchCards.length) {
    return { complete: true, remaining: 0, batch: null, workspace: buildSauClaimWorkspace_(generator) };
  }
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  return {
    complete: false,
    remaining: Math.max(0, cards.length - batchCards.length),
    batch: {
      sessionId: String(state.session_id),
      claimName: String(state.claim_name || buildSauClaimName_()),
      fileName: "grid-claim-" + stamp + ".png",
      columns: columns,
      rows: rows,
      cards: batchCards
    }
  };
}

function mobileSaveClaimGrid(payload) {
  payload = payload || {};
  var generator = getSauClaimGenerator_(true);
  var state = readSauClaimState_(generator);
  if (!state.session_id) throw new Error("No hay un claim activo.");
  if (payload.sessionId && String(payload.sessionId) !== String(state.session_id)) throw new Error("El claim activo cambio mientras generabas el grid.");
  var actionId = String(payload.localActionId || "").trim();
  var previous = actionId ? findSauAppActionResult_(actionId) : null;
  if (previous) {
    previous.duplicate = true;
    previous.workspace = buildSauClaimWorkspace_(generator);
    return previous;
  }
  var cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.map(String) : [];
  if (!cardIds.length) throw new Error("El grid no contiene cartas.");
  var base64 = String(payload.base64 || payload.dataUrl || "").replace(/^data:image\/png;base64,/, "").trim();
  if (!base64) throw new Error("El PNG generado esta vacio.");
  if (base64.length > 20000000) throw new Error("El PNG es demasiado pesado. Genera un grid mas chico.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Ya hay otra operacion de claims corriendo.");
  try {
    var loadMap = readSauClaimLoadMap_(generator);
    var validIds = [];
    var rowNumbers = [];
    for (var i = 0; i < cardIds.length; i++) {
      var cardId = String(cardIds[i] || "").trim();
      var load = loadMap[cardId];
      if (!load || load.gridBatch) continue;
      validIds.push(cardId);
      rowNumbers.push(load.rowNumber);
    }
    if (!validIds.length) throw new Error("Estas cartas ya pertenecen a otro grid.");

    var config = readSauClaimConfig_(generator);
    var fileName = String(payload.fileName || ("grid-claim-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") + ".png"))
      .replace(/[^a-zA-Z0-9._-]+/g, "-");
    if (!/\.png$/i.test(fileName)) fileName += ".png";
    var folder = getOrCreateSauClaimFolder_(generator, String(config.grid_folder_name || "Pokemon Claim Grids"));
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), "image/png", fileName);
    var file = folder.createFile(blob);
    var publicFile = false;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      publicFile = true;
    } catch (sharingError) {}
    var batchName = fileName.replace(/\.png$/i, "");
    var loadSheet = generator.getSheetByName(SAU_CLAIM.SHEETS.LOAD);
    var ranges = rowNumbers.map(function(row) { return "Q" + row; });
    if (ranges.length) loadSheet.getRangeList(ranges).setValue(batchName);
    var downloadUrl = "https://drive.google.com/uc?export=download&id=" + file.getId();
    var gridLog = generator.getSheetByName(SAU_CLAIM.SHEETS.GRID_LOG);
    appendSauRows_(gridLog, [[
      String(state.session_id), new Date(), batchName, file.getId(), file.getUrl(), downloadUrl,
      validIds.length, rowNumbers.join(","), publicFile
    ]]);
    touchSauClaimState_(generator, { status: "Abierto" });
    var compactResult = {
      grid: { batch: batchName, fileId: file.getId(), url: file.getUrl(), downloadUrl: downloadUrl, cards: validIds.length, public: publicFile },
      remaining: Math.max(0, buildSauClaimWorkspace_(generator).summary.remainingGridCards)
    };
    if (actionId) saveSauAppActionResult_(actionId, "saveClaimGrid", String(payload.actor || "App"), compactResult);
    appendSauAudit_("Guardar grid", "Claims", String(state.session_id), String(payload.actor || "App"), batchName + " - " + validIds.length + " cartas", actionId);
    compactResult.workspace = buildSauClaimWorkspace_(generator);
    return compactResult;
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSauClaimFolder_(generator, folderName) {
  var generatorFile = DriveApp.getFileById(generator.getId());
  var parents = generatorFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var folders = parent.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parent.createFolder(folderName);
}

function mobileFinishClaim(payload) {
  payload = payload || {};
  var generator = getSauClaimGenerator_(true);
  var actionId = String(payload.localActionId || "").trim();
  var previous = actionId ? findSauAppActionResult_(actionId) : null;
  if (previous) {
    previous.duplicate = true;
    return previous;
  }
  var state = readSauClaimState_(generator);
  if (!state.session_id) throw new Error("No hay un claim activo.");
  if (payload.sessionId && String(payload.sessionId) !== String(state.session_id)) throw new Error("El claim activo cambio. Actualiza antes de terminarlo.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Ya hay otra operacion de claims corriendo.");
  try {
    var loadMap = readSauClaimLoadMap_(generator);
    var cards = readSauClaimCards_(generator, loadMap);
    var frees = readSauClaimFrees_(generator);
    if (!cards.length) throw new Error("No hay cartas en el claim activo.");
    var sold = cards.filter(function(card) { return !!card.buyer; });
    if (!sold.length) throw new Error("No hay ninguna carta con comprador. Usa Resetear si queres descartar el claim.");
    var withoutPrice = sold.filter(function(card) { return !Number(card.finalArs) && !Number(card.finalUsd); });
    if (withoutPrice.length) {
      throw new Error("Hay " + withoutPrice.length + " cartas vendidas sin precio: " + withoutPrice.slice(0, 4).map(function(card) { return card.name; }).join(", "));
    }
    var claimName = String(state.claim_name || buildUniqueSauClaimName_(generator));
    updateSauClaimInfo_(generator, claimName);
    var archive = createSauClaimArchive_(generator, claimName);
    var adminResult = sendSauClaimToAdministration_(claimName, archive.url, sold, frees);
    logSauFinishedClaim_(generator, claimName, archive.url, sold, frees, adminResult.orders);
    var result = {
      sessionId: String(state.session_id),
      claimName: claimName,
      archiveUrl: archive.url,
      archiveId: archive.id,
      orders: adminResult.orders,
      soldRows: adminResult.sales,
      frees: adminResult.frees,
      duplicates: adminResult.duplicates
    };
    if (actionId) saveSauAppActionResult_(actionId, "finishClaim", String(payload.actor || "App"), result);
    appendSauAudit_("Terminar claim", "Claims", String(state.session_id), String(payload.actor || "App"), claimName + " - " + adminResult.orders + " ordenes", actionId);
    clearSauClaimWorkingSheets_(generator);
    writeSauClaimState_(generator, {});
    updateSauClaimInfo_(generator, buildSauClaimName_());
    return result;
  } finally {
    lock.releaseLock();
  }
}

function createSauClaimArchive_(generator, claimName) {
  var archive = SpreadsheetApp.create(claimName);
  var sheetNames = [SAU_CLAIM.SHEETS.LOAD, SAU_CLAIM.SHEETS.CLAIM, SAU_CLAIM.SHEETS.FREES, SAU_CLAIM.SHEETS.INFO];
  var first = archive.getSheets()[0];
  first.setName(sheetNames[0]);
  copySauClaimSheetValues_(generator.getSheetByName(sheetNames[0]), first);
  for (var i = 1; i < sheetNames.length; i++) {
    copySauClaimSheetValues_(generator.getSheetByName(sheetNames[i]), archive.insertSheet(sheetNames[i]));
  }
  var config = readSauClaimConfig_(generator);
  var folder = getOrCreateSauClaimFolder_(generator, String(config.claim_archive_folder || "Pokemon Claims Archivados"));
  var file = DriveApp.getFileById(archive.getId());
  try { file.moveTo(folder); } catch (moveError) {}
  return { id: archive.getId(), url: archive.getUrl() };
}

function copySauClaimSheetValues_(source, target) {
  if (!source || !target) return;
  target.clear();
  var lastRow = Math.max(1, source.getLastRow());
  var lastCol = Math.max(1, source.getLastColumn());
  var values = source.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  target.getRange(1, 1, values.length, values[0].length).setValues(values);
  target.getRange(1, 1, 1, lastCol).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  target.setFrozenRows(1);
}

function sendSauClaimToAdministration_(claimName, claimUrl, soldRows, freeRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
  var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
  var frees = ss.getSheetByName(SAU.SHEETS.FREES);
  if (!orders || !sales || !frees) throw new Error("El HUB no tiene Ordenes, Ventas Detalle o Frees.");
  var grouped = groupSauClaimSoldRows_(soldRows);
  var existingIds = buildExistingSauClaimOrderIds_(orders);
  var existingClaimBuyers = buildExistingSauClaimBuyerKeys_(orders);
  var orderRows = [];
  var saleRows = [];
  var freeAdminRows = [];
  var duplicateCount = 0;
  var now = new Date();

  Object.keys(grouped).forEach(function(key) {
    var group = grouped[key];
    var buyer = group[0].buyer;
    var claimBuyerKey = normalizeSauMobileSearch_(claimName) + "::" + normalizeSauMobileSearch_(buyer);
    if (existingClaimBuyers[claimBuyerKey]) {
      duplicateCount++;
      return;
    }
    var baseOrderId = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + slugSau_(buyer).toUpperCase();
    var orderId = baseOrderId;
    var suffix = 2;
    while (existingIds[orderId]) orderId = baseOrderId + "-" + suffix++;
    existingIds[orderId] = true;
    existingClaimBuyers[claimBuyerKey] = true;
    var totalArs = group.reduce(function(sum, card) { return sum + (Number(card.finalArs) || 0); }, 0);
    var totalUsd = group.reduce(function(sum, card) { return sum + (Number(card.finalUsd) || 0); }, 0);
    orderRows.push([
      orderId, claimName, now, buyer, totalArs, totalUsd, group.length,
      false, false, false, "", "", "", claimUrl, "", 0, 0, totalArs, totalUsd, "", ""
    ]);
    for (var i = 0; i < group.length; i++) {
      var card = group[i];
      var sku = card.pcId ? "PKM-PC-" + card.pcId : "";
      saleRows.push([
        orderId + "-" + (i + 1), orderId, claimName, now, "", "Claim", buyer,
        card.finalName || buildSauClaimFinalName_(card.name, card.expansion, card.finalArs, card.finalUsd),
        card.name, card.expansion, 1, Number(card.finalArs) || 0, Number(card.finalUsd) || 0,
        card.pcUrl, card.pcId, sku, false, false, false, "", card.tags, "", false, "", "", ""
      ]);
    }
    var buyerFrees = (freeRows || []).filter(function(free) { return normalizeSauMobileSearch_(free.buyer) === normalizeSauMobileSearch_(buyer); });
    for (var f = 0; f < buyerFrees.length; f++) {
      var free = buyerFrees[f];
      var freeSku = free.pcId ? "PKM-PC-" + free.pcId : "";
      freeAdminRows.push([
        orderId + "-FREE-" + (f + 1), orderId, claimName, now, buyer,
        free.finalName || [free.name, free.expansion].filter(Boolean).join(" - "),
        free.name, free.expansion, Number(free.quantity) || 1, free.pcUrl, free.pcId, freeSku,
        false, "", free.tags, free.notes
      ]);
    }
  });

  appendSauRows_(orders, orderRows);
  appendSauRows_(sales, saleRows);
  appendSauRows_(frees, freeAdminRows);
  return { orders: orderRows.length, sales: saleRows.length, frees: freeAdminRows.length, duplicates: duplicateCount };
}

function groupSauClaimSoldRows_(rows) {
  var grouped = {};
  for (var i = 0; i < rows.length; i++) {
    var key = normalizeSauMobileSearch_(rows[i].buyer);
    if (!key) continue;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rows[i]);
  }
  return grouped;
}

function buildExistingSauClaimOrderIds_(orders) {
  var out = {};
  if (!orders || orders.getLastRow() < 2) return out;
  var values = orders.getRange(2, SAU.ORDEN_COL.ORDER_ID, orders.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) if (values[i][0]) out[String(values[i][0])] = true;
  return out;
}

function buildExistingSauClaimBuyerKeys_(orders) {
  var out = {};
  if (!orders || orders.getLastRow() < 2) return out;
  var values = orders.getRange(2, SAU.ORDEN_COL.ORDER_ID, orders.getLastRow() - 1, SAU.ORDEN_COL.COMPRADOR).getValues();
  for (var i = 0; i < values.length; i++) {
    var claim = String(values[i][SAU.ORDEN_COL.CLAIM - 1] || "").trim();
    var buyer = String(values[i][SAU.ORDEN_COL.COMPRADOR - 1] || "").trim();
    if (claim && buyer) out[normalizeSauMobileSearch_(claim) + "::" + normalizeSauMobileSearch_(buyer)] = true;
  }
  return out;
}

function buildSauClaimFinalName_(name, expansion, priceArs, priceUsd) {
  var base = [name, expansion].filter(Boolean).join(" - ");
  var prices = [];
  if (Number(priceArs)) prices.push("$" + Number(priceArs));
  if (Number(priceUsd)) prices.push("$" + Number(priceUsd) + "usd");
  return prices.length ? base + " - " + prices.join(" + ") : base;
}

function logSauFinishedClaim_(generator, claimName, claimUrl, soldRows, freeRows, ordersCount) {
  var now = new Date();
  var totalArs = soldRows.reduce(function(sum, card) { return sum + (Number(card.finalArs) || 0); }, 0);
  var buyers = {};
  soldRows.forEach(function(card) { buyers[normalizeSauMobileSearch_(card.buyer)] = true; });
  var generatorLog = generator.getSheetByName(SAU_CLAIM.SHEETS.CLAIMS_LOG);
  if (generatorLog) appendSauRows_(generatorLog, [[now, claimName, claimUrl, ordersCount, soldRows.length, totalArs, freeRows.length, "Terminado desde app"]]);
  var hubLog = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAU.SHEETS.CLAIMS_LOG);
  if (hubLog) appendSauRows_(hubLog, [[now, claimName, claimUrl, Object.keys(buyers).length, soldRows.length, totalArs, freeRows.length, "App", ""]]);
}

function mobileListOrders(request) {
  request = request || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
  if (!orders) throw new Error("No existe hoja Ordenes.");
  if (orders.getLastRow() < 2) return { orders: [] };

  var max = Math.max(5, Math.min(Number(request.limit) || 30, 100));
  var q = normalizeSauMobileSearch_(request.q || request.query || "");
  var mode = String(request.mode || "pending").toLowerCase();
  var orderValues = orders.getRange(2, 1, orders.getLastRow() - 1, SAU.ORDEN_COL.PAGO_NOTAS).getValues();
  var candidates = [];

  for (var i = 0; i < orderValues.length; i++) {
    var order = buildSauMobileOrder_(orderValues[i], i + 2, {});
    if (!order.orderId) continue;
    if (mode === "pending" && order.paid && order.delivered) continue;
    if (q && !matchesSauMobileQuery_(normalizeSauMobileSearch_([
      order.orderId,
      order.reference,
      order.buyer
    ].join(" ")), q)) continue;
    candidates.push({ row: orderValues[i], rowNumber: i + 2, order: order });
  }

  candidates.sort(function(a, b) {
    return String(b.order.dateValue || "").localeCompare(String(a.order.dateValue || ""));
  });
  var selected = candidates.slice(0, max);
  var targetOrderIds = {};
  selected.forEach(function(candidate) { targetOrderIds[candidate.order.orderId] = true; });
  var details = buildSauMobileOrderDetails_(targetOrderIds);
  var out = selected.map(function(candidate) {
    return buildSauMobileOrder_(candidate.row, candidate.rowNumber, details);
  });
  return { orders: out, total: candidates.length };
}

function mobileUpdateOrder(payload) {
  payload = payload || {};
  var orderId = String(payload.orderId || "").trim();
  if (!orderId) throw new Error("Falta orderId.");
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2500)) throw new Error("La planilla esta ocupada. Proba de nuevo en unos segundos.");

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
    if (!orders) throw new Error("No existe hoja Ordenes.");
    var rowNumber = findSauOrderRow_(orders, orderId);
    if (!rowNumber) throw new Error("No encontre la orden: " + orderId);

    var current = orders.getRange(rowNumber, 1, 1, SAU.ORDEN_COL.PAGO_NOTAS).getValues()[0];
    var paid = payload.paid === undefined ? toSauBoolean_(current[SAU.ORDEN_COL.PAGADO - 1]) : toSauBoolean_(payload.paid);
    var delivered = payload.delivered === undefined ? toSauBoolean_(current[SAU.ORDEN_COL.ENTREGADO - 1]) : toSauBoolean_(payload.delivered);
    var packed = payload.packed === undefined ? toSauBoolean_(current[SAU.ORDEN_COL.EMBALADO - 1]) : toSauBoolean_(payload.packed);
    if (delivered) packed = true;

    var now = new Date();
    orders.getRange(rowNumber, SAU.ORDEN_COL.PAGADO, 1, 3).setValues([[paid, packed, delivered]]);
    if (paid && !current[SAU.ORDEN_COL.FECHA_PAGO - 1]) orders.getRange(rowNumber, SAU.ORDEN_COL.FECHA_PAGO).setValue(now);
    if (delivered && !current[SAU.ORDEN_COL.FECHA_ENTREGA - 1]) orders.getRange(rowNumber, SAU.ORDEN_COL.FECHA_ENTREGA).setValue(now);

    if (paid) {
      var totalArs = Number(current[SAU.ORDEN_COL.TOTAL_ARS - 1]) || 0;
      var totalUsd = Number(current[SAU.ORDEN_COL.TOTAL_USD - 1]) || 0;
      orders.getRange(rowNumber, SAU.ORDEN_COL.PAGADO_ARS, 1, 5).setValues([[totalArs, totalUsd, 0, 0, now]]);
    }

    var result = {
      orderId: orderId,
      paid: paid,
      delivered: delivered,
      packed: packed,
      syncQueued: paid && delivered,
      actionId: actionId
    };
    var actor = String(payload.actor || "").trim() || "App";
    appendSauAudit_("Actualizar orden", "Orden", orderId, actor, JSON.stringify({ paid: paid, packed: packed, delivered: delivered }), actionId);
    return saveSauAppActionResult_(actionId, "updateOrder", actor, result);
  } finally {
    lock.releaseLock();
  }
}

function mobileRecordOrderPayment(payload) {
  payload = payload || {};
  var orderId = String(payload.orderId || "").trim();
  if (!orderId) throw new Error("Falta orderId.");
  var requestedArs = Math.max(0, Number(payload.ars) || 0);
  var requestedUsd = Math.max(0, Number(payload.usd) || 0);
  if (!requestedArs && !requestedUsd) throw new Error("Ingresa un pago en ARS o USD.");
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("La planilla esta ocupada. El pago puede reintentarse.");
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
    if (!orders) throw new Error("No existe hoja Ordenes.");
    var rowNumber = findSauOrderRow_(orders, orderId);
    if (!rowNumber) throw new Error("No encontre la orden: " + orderId);
    var row = orders.getRange(rowNumber, 1, 1, SAU.ORDEN_COL.PAGO_NOTAS).getValues()[0];
    var totalArs = Number(row[SAU.ORDEN_COL.TOTAL_ARS - 1]) || 0;
    var totalUsd = Number(row[SAU.ORDEN_COL.TOTAL_USD - 1]) || 0;
    var paidArs = Number(row[SAU.ORDEN_COL.PAGADO_ARS - 1]) || 0;
    var paidUsd = Number(row[SAU.ORDEN_COL.PAGADO_USD - 1]) || 0;
    var appliedArs = Math.min(requestedArs, Math.max(0, totalArs - paidArs));
    var appliedUsd = Math.min(requestedUsd, Math.max(0, totalUsd - paidUsd));
    paidArs += appliedArs;
    paidUsd += appliedUsd;
    var balanceArs = Math.max(0, totalArs - paidArs);
    var balanceUsd = Math.max(0, totalUsd - paidUsd);
    var paid = balanceArs < 0.01 && balanceUsd < 0.01;
    var now = new Date();
    var notes = String(payload.notes || "").trim();
    var previousNotes = String(row[SAU.ORDEN_COL.PAGO_NOTAS - 1] || "").trim();
    var combinedNotes = [previousNotes, notes ? formatSauDateTime_(now) + ": " + notes : ""].filter(Boolean).join(" | ");

    orders.getRange(rowNumber, SAU.ORDEN_COL.PAGADO).setValue(paid);
    orders.getRange(rowNumber, SAU.ORDEN_COL.PAGADO_ARS, 1, 6).setValues([[
      paidArs, paidUsd, balanceArs, balanceUsd, now, combinedNotes
    ]]);
    if (paid && !row[SAU.ORDEN_COL.FECHA_PAGO - 1]) orders.getRange(rowNumber, SAU.ORDEN_COL.FECHA_PAGO).setValue(now);

    var actor = String(payload.actor || "").trim() || "App";
    var payments = ss.getSheetByName(SAU.SHEETS.PAGOS);
    if (!payments) { setupSauPayments_(ss); payments = ss.getSheetByName(SAU.SHEETS.PAGOS); }
    var paymentId = "PAG-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    appendSauRows_(payments, [[paymentId, now, orderId, row[SAU.ORDEN_COL.COMPRADOR - 1], appliedArs, appliedUsd, String(payload.method || "Seña"), notes, actor, actionId]]);
    appendSauAudit_("Registrar pago", "Orden", orderId, actor, formatSauMoneyArs_(appliedArs) + " + " + formatSauMoneyUsd_(appliedUsd), actionId);
    var result = {
      orderId: orderId, paymentId: paymentId, paid: paid, paidArs: paidArs, paidUsd: paidUsd,
      balanceArs: balanceArs, balanceUsd: balanceUsd, appliedArs: appliedArs, appliedUsd: appliedUsd, actionId: actionId
    };
    return saveSauAppActionResult_(actionId, "recordOrderPayment", actor, result);
  } finally {
    lock.releaseLock();
  }
}

function mobileCompleteOrder(payload) {
  payload = payload || {};
  var orderId = String(payload.orderId || "").trim();
  if (!orderId) throw new Error("Falta orderId.");
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("La planilla esta ocupada. La orden puede reintentarse.");
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
    if (!orders) throw new Error("No existe hoja Ordenes.");
    var rowNumber = findSauOrderRow_(orders, orderId);
    if (!rowNumber) throw new Error("No encontre la orden: " + orderId);
    var row = orders.getRange(rowNumber, 1, 1, SAU.ORDEN_COL.PAGO_NOTAS).getValues()[0];
    var totalArs = Number(row[SAU.ORDEN_COL.TOTAL_ARS - 1]) || 0;
    var totalUsd = Number(row[SAU.ORDEN_COL.TOTAL_USD - 1]) || 0;
    var previousArs = Number(row[SAU.ORDEN_COL.PAGADO_ARS - 1]) || 0;
    var previousUsd = Number(row[SAU.ORDEN_COL.PAGADO_USD - 1]) || 0;
    var remainingArs = Math.max(0, totalArs - previousArs);
    var remainingUsd = Math.max(0, totalUsd - previousUsd);
    var now = new Date();
    orders.getRange(rowNumber, SAU.ORDEN_COL.PAGADO, 1, 3).setValues([[true, true, true]]);
    orders.getRange(rowNumber, SAU.ORDEN_COL.FECHA_PAGO).setValue(row[SAU.ORDEN_COL.FECHA_PAGO - 1] || now);
    orders.getRange(rowNumber, SAU.ORDEN_COL.FECHA_ENTREGA).setValue(row[SAU.ORDEN_COL.FECHA_ENTREGA - 1] || now);
    orders.getRange(rowNumber, SAU.ORDEN_COL.PAGADO_ARS, 1, 5).setValues([[totalArs, totalUsd, 0, 0, now]]);
    var actor = String(payload.actor || "").trim() || "App";
    if (remainingArs || remainingUsd) {
      var payments = ss.getSheetByName(SAU.SHEETS.PAGOS);
      if (!payments) { setupSauPayments_(ss); payments = ss.getSheetByName(SAU.SHEETS.PAGOS); }
      appendSauRows_(payments, [["PAG-" + Utilities.getUuid().slice(0, 8).toUpperCase(), now, orderId, row[SAU.ORDEN_COL.COMPRADOR - 1], remainingArs, remainingUsd, "Completar orden", String(payload.notes || "").trim(), actor, actionId]]);
    }
    appendSauAudit_("Completar orden", "Orden", orderId, actor, "Pago, embalaje y entrega completos", actionId);
    var result = { orderId: orderId, paid: true, packed: true, delivered: true, paidArs: totalArs, paidUsd: totalUsd, balanceArs: 0, balanceUsd: 0, actionId: actionId };
    return saveSauAppActionResult_(actionId, "completeOrder", actor, result);
  } finally {
    lock.releaseLock();
  }
}

function mobileUpdatePackingLine(payload) {
  payload = payload || {};
  var orderId = String(payload.orderId || "").trim();
  var lineId = String(payload.lineId || "").trim();
  if (!orderId || !lineId) throw new Error("Falta orden o linea de embalaje.");
  var actionId = String(payload.localActionId || "").trim();
  var duplicate = findSauAppActionResult_(actionId);
  if (duplicate) return duplicate;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("La planilla esta ocupada. El checklist puede reintentarse.");
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SAU.SHEETS.EMBALAJE);
    if (!sheet) { setupSauPacking_(ss); sheet = ss.getSheetByName(SAU.SHEETS.EMBALAJE); }
    var checked = toSauBoolean_(payload.checked);
    var actor = String(payload.actor || "").trim() || "App";
    var key = orderId + "|" + lineId;
    var rowNumber = 0;
    if (sheet.getLastRow() >= 2) {
      var keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) + "|" + String(keys[i][1]) === key) { rowNumber = i + 2; break; }
      }
    }
    var values = [orderId, lineId, String(payload.type || "venta"), String(payload.name || ""), checked, new Date(), actor, String(payload.problem || ""), String(payload.notes || "")];
    if (rowNumber) sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
    else appendSauRows_(sheet, [values]);

    var packed = isSauOrderPackingComplete_(orderId);
    if (packed) {
      var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
      var orderRow = orders && findSauOrderRow_(orders, orderId);
      if (orderRow) orders.getRange(orderRow, SAU.ORDEN_COL.EMBALADO).setValue(true);
    }
    appendSauAudit_(checked ? "Revisar carta" : "Desmarcar carta", "Embalaje", key, actor, String(payload.name || ""), actionId);
    var result = { orderId: orderId, lineId: lineId, checked: checked, packed: packed, actionId: actionId };
    return saveSauAppActionResult_(actionId, "updatePackingLine", actor, result);
  } finally {
    lock.releaseLock();
  }
}

function buildSauPackingStatusMap_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAU.SHEETS.EMBALAJE);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || "") + "|" + String(values[i][1] || "");
    out[key] = { checked: toSauBoolean_(values[i][4]), problem: String(values[i][7] || ""), notes: String(values[i][8] || "") };
  }
  return out;
}

function isSauOrderPackingComplete_(orderId) {
  var target = {};
  target[orderId] = true;
  var details = buildSauMobileOrderDetails_(target);
  var detail = details[orderId] || { items: [], frees: [] };
  var lines = detail.items.concat(detail.frees);
  return lines.length > 0 && lines.every(function(line) { return !!line.packedChecked; });
}

function buildSauMobileOrderDetails_(orderFilter) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
  var frees = ss.getSheetByName(SAU.SHEETS.FREES);
  var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
  var stockIndex = buildSauMobileStockDetailIndex_(stock);
  var pcCache = buildSauMobilePcCacheLookup_();
  var packing = buildSauPackingStatusMap_();
  var out = {};

  if (sales && sales.getLastRow() >= 2) {
    var saleValues = sales.getRange(2, 1, sales.getLastRow() - 1, SAU.VENTA_COL.NOTAS).getValues();
    for (var i = 0; i < saleValues.length; i++) {
      var sale = saleValues[i];
      var orderId = String(sale[SAU.VENTA_COL.ORDER_ID - 1] || "").trim();
      if (!orderId) continue;
      if (orderFilter && !orderFilter[orderId]) continue;
      if (!out[orderId]) out[orderId] = { items: [], frees: [] };
      var saleSku = String(sale[SAU.VENTA_COL.SKU - 1] || "").trim();
      var salePcId = String(sale[SAU.VENTA_COL.PC_ID - 1] || "").trim();
      var salePcUrl = normalizeSauUrl_(sale[SAU.VENTA_COL.PC_URL - 1]);
      var saleLineId = String(sale[SAU.VENTA_COL.VENTA_ID - 1] || ("venta-fila-" + (i + 2))).trim();
      var salePacking = packing[orderId + "|" + saleLineId] || {};
      var stockItem = findSauMobileStockDetail_(stockIndex, saleSku, salePcId, salePcUrl);
      var cacheItem = (!stockItem || !stockItem.imageUrl || !stockItem.expansion)
        ? findSauMobilePcCacheItem_(pcCache, salePcId, salePcUrl)
        : null;
      out[orderId].items.push({
        lineId: saleLineId,
        name: String(sale[SAU.VENTA_COL.NOMBRE_FINAL - 1] || sale[SAU.VENTA_COL.NOMBRE - 1] || "").trim(),
        baseName: String(sale[SAU.VENTA_COL.NOMBRE - 1] || "").trim(),
        expansion: String(sale[SAU.VENTA_COL.EXPANSION - 1] || (stockItem && stockItem.expansion) || (cacheItem && (cacheItem.expansion || cacheItem.expansionPc)) || "").trim(),
        number: (stockItem && stockItem.number) || (cacheItem && cacheItem.numero) || "",
        quantity: Number(sale[SAU.VENTA_COL.CANTIDAD - 1]) || 1,
        ars: Number(sale[SAU.VENTA_COL.PRECIO_ARS - 1]) || 0,
        usd: Number(sale[SAU.VENTA_COL.PRECIO_USD - 1]) || 0,
        pcUrl: salePcUrl || (stockItem && stockItem.pcUrl) || (cacheItem && cacheItem.pcUrl) || "",
        pcId: salePcId || (stockItem && stockItem.pcId) || (cacheItem && cacheItem.pcId) || "",
        sku: saleSku,
        imageUrl: (stockItem && stockItem.imageUrl) || (cacheItem && cacheItem.imageUrl) || "",
        packedChecked: !!salePacking.checked,
        packingProblem: salePacking.problem || "",
        packingNotes: salePacking.notes || ""
      });
    }
  }

  if (frees && frees.getLastRow() >= 2) {
    var freeValues = frees.getRange(2, 1, frees.getLastRow() - 1, SAU.FREE_COL.NOTAS).getValues();
    for (var f = 0; f < freeValues.length; f++) {
      var free = freeValues[f];
      var freeOrderId = String(free[SAU.FREE_COL.ORDER_ID - 1] || "").trim();
      if (!freeOrderId) continue;
      if (orderFilter && !orderFilter[freeOrderId]) continue;
      if (!out[freeOrderId]) out[freeOrderId] = { items: [], frees: [] };
      var freeSku = String(free[SAU.FREE_COL.SKU - 1] || "").trim();
      var freePcId = String(free[SAU.FREE_COL.PC_ID - 1] || "").trim();
      var freePcUrl = normalizeSauUrl_(free[SAU.FREE_COL.PC_URL - 1]);
      var freeLineId = String(free[SAU.FREE_COL.FREE_ID - 1] || ("free-fila-" + (f + 2))).trim();
      var freePacking = packing[freeOrderId + "|" + freeLineId] || {};
      var freeStockItem = findSauMobileStockDetail_(stockIndex, freeSku, freePcId, freePcUrl);
      var freeCacheItem = (!freeStockItem || !freeStockItem.imageUrl || !freeStockItem.expansion)
        ? findSauMobilePcCacheItem_(pcCache, freePcId, freePcUrl)
        : null;
      out[freeOrderId].frees.push({
        lineId: freeLineId,
        name: String(free[SAU.FREE_COL.NOMBRE_FINAL - 1] || free[SAU.FREE_COL.NOMBRE - 1] || "").trim(),
        baseName: String(free[SAU.FREE_COL.NOMBRE - 1] || "").trim(),
        expansion: String(free[SAU.FREE_COL.EXPANSION - 1] || (freeStockItem && freeStockItem.expansion) || (freeCacheItem && (freeCacheItem.expansion || freeCacheItem.expansionPc)) || "").trim(),
        number: (freeStockItem && freeStockItem.number) || (freeCacheItem && freeCacheItem.numero) || "",
        quantity: Number(free[SAU.FREE_COL.CANTIDAD - 1]) || 1,
        pcUrl: freePcUrl || (freeStockItem && freeStockItem.pcUrl) || (freeCacheItem && freeCacheItem.pcUrl) || "",
        pcId: freePcId || (freeStockItem && freeStockItem.pcId) || (freeCacheItem && freeCacheItem.pcId) || "",
        sku: freeSku,
        imageUrl: (freeStockItem && freeStockItem.imageUrl) || (freeCacheItem && freeCacheItem.imageUrl) || "",
        packedChecked: !!freePacking.checked,
        packingProblem: freePacking.problem || "",
        packingNotes: freePacking.notes || ""
      });
    }
  }

  return out;
}

function buildSauMobileStockDetailIndex_(stock) {
  var out = { bySku: {}, byPcId: {}, byUrl: {} };
  if (!stock || stock.getLastRow() < 2) return out;
  var values = stock.getRange(2, 1, stock.getLastRow() - 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var item = {
      sku: String(row[SAU.STOCK_COL.SKU - 1] || "").trim(),
      pcId: String(row[SAU.STOCK_COL.PC_ID - 1] || "").trim(),
      pcUrl: normalizeSauUrl_(row[SAU.STOCK_COL.PC_URL - 1]),
      imageUrl: String(row[SAU.STOCK_COL.IMAGEN_URL - 1] || "").trim(),
      expansion: String(row[SAU.STOCK_COL.EXPANSION - 1] || "").trim(),
      number: String(row[SAU.STOCK_COL.NUMERO - 1] || "").trim()
    };
    if (item.sku) out.bySku[item.sku] = item;
    if (item.pcId) out.byPcId[item.pcId] = item;
    if (item.pcUrl) out.byUrl[canonicalSauUrl_(item.pcUrl)] = item;
  }
  return out;
}

function findSauMobileStockDetail_(index, sku, pcId, pcUrl) {
  sku = String(sku || "").trim();
  pcId = String(pcId || "").trim();
  var canonical = canonicalSauUrl_(pcUrl);
  return (sku && index.bySku[sku]) || (pcId && index.byPcId[pcId]) || (canonical && index.byUrl[canonical]) || null;
}

function buildSauMobilePcCacheLookup_() {
  try {
    return buildSauCacheLookup_();
  } catch (err) {
    return null;
  }
}

function findSauMobilePcCacheItem_(cache, pcId, pcUrl) {
  if (!cache) return null;
  try {
    return findSauCacheItem_(cache, pcId || extractSauPriceChartingId_(pcUrl), pcUrl);
  } catch (err) {
    return null;
  }
}

function buildSauMobileOrder_(row, rowNumber, details) {
  var orderId = String(row[SAU.ORDEN_COL.ORDER_ID - 1] || "").trim();
  var detail = details[orderId] || { items: [], frees: [] };
  var date = row[SAU.ORDEN_COL.FECHA_CLAIM - 1];
  var itemsText = detail.items.slice(0, 4).map(function(item) {
    return (item.quantity > 1 ? item.quantity + "x " : "") + item.name;
  }).join(" | ");
  if (detail.items.length > 4) itemsText += " | +" + (detail.items.length - 4);

  var totalArs = Number(row[SAU.ORDEN_COL.TOTAL_ARS - 1]) || 0;
  var totalUsd = Number(row[SAU.ORDEN_COL.TOTAL_USD - 1]) || 0;
  var paidArs = Number(row[SAU.ORDEN_COL.PAGADO_ARS - 1]) || (toSauBoolean_(row[SAU.ORDEN_COL.PAGADO - 1]) ? totalArs : 0);
  var paidUsd = Number(row[SAU.ORDEN_COL.PAGADO_USD - 1]) || (toSauBoolean_(row[SAU.ORDEN_COL.PAGADO - 1]) ? totalUsd : 0);
  var balanceArs = Math.max(0, Number(row[SAU.ORDEN_COL.SALDO_ARS - 1]) || (totalArs - paidArs));
  var balanceUsd = Math.max(0, Number(row[SAU.ORDEN_COL.SALDO_USD - 1]) || (totalUsd - paidUsd));
  return {
    row: rowNumber,
    orderId: orderId,
    reference: String(row[SAU.ORDEN_COL.CLAIM - 1] || "").trim(),
    date: date ? formatSauDateTime_(new Date(date)) : "",
    dateValue: date ? new Date(date).toISOString() : "",
    buyer: String(row[SAU.ORDEN_COL.COMPRADOR - 1] || "").trim(),
    totalArs: totalArs,
    totalUsd: totalUsd,
    paidArs: paidArs,
    paidUsd: paidUsd,
    balanceArs: balanceArs,
    balanceUsd: balanceUsd,
    hasDeposit: (paidArs > 0 && balanceArs > 0) || (paidUsd > 0 && balanceUsd > 0),
    paymentNotes: String(row[SAU.ORDEN_COL.PAGO_NOTAS - 1] || "").trim(),
    cards: Number(row[SAU.ORDEN_COL.CARTAS - 1]) || detail.items.length,
    paid: toSauBoolean_(row[SAU.ORDEN_COL.PAGADO - 1]),
    packed: toSauBoolean_(row[SAU.ORDEN_COL.EMBALADO - 1]),
    delivered: toSauBoolean_(row[SAU.ORDEN_COL.ENTREGADO - 1]),
    paidAt: row[SAU.ORDEN_COL.FECHA_PAGO - 1] ? formatSauDateTime_(new Date(row[SAU.ORDEN_COL.FECHA_PAGO - 1])) : "",
    deliveredAt: row[SAU.ORDEN_COL.FECHA_ENTREGA - 1] ? formatSauDateTime_(new Date(row[SAU.ORDEN_COL.FECHA_ENTREGA - 1])) : "",
    items: detail.items,
    frees: detail.frees,
    itemsText: itemsText || "Sin detalle cargado"
  };
}

function findSauOrderRow_(orders, orderId) {
  if (orders.getLastRow() < 2) return 0;
  var values = orders.getRange(2, SAU.ORDEN_COL.ORDER_ID, orders.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === orderId) return i + 2;
  }
  return 0;
}

function processReadyOrders(options) {
  options = options || {};
  var lock = options.lockAlreadyHeld ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(2000)) return { processed: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
    var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
    var frees = ss.getSheetByName(SAU.SHEETS.FREES);
    if (!orders || !sales) throw new Error("Faltan hojas Ordenes o Ventas Detalle.");
    if (orders.getLastRow() < 2) return syncReadySalesAndFrees({ lockAlreadyHeld: true });

    var orderValues = orders.getRange(2, 1, orders.getLastRow() - 1, SAU.ORDEN_COL.NOTAS).getValues();
    var salesIndex = buildSauRowsByOrder_(sales, SAU.VENTA_COL.ORDER_ID);
    var freeIndex = frees ? buildSauRowsByOrder_(frees, SAU.FREE_COL.ORDER_ID) : {};
    var now = new Date();
    var processed = 0;

    for (var i = 0; i < orderValues.length; i++) {
      var order = orderValues[i];
      var orderId = String(order[SAU.ORDEN_COL.ORDER_ID - 1] || "").trim();
      if (!orderId) continue;

      var paid = toSauBoolean_(order[SAU.ORDEN_COL.PAGADO - 1]);
      var packed = toSauBoolean_(order[SAU.ORDEN_COL.EMBALADO - 1]);
      var delivered = toSauBoolean_(order[SAU.ORDEN_COL.ENTREGADO - 1]);
      if (paid && !order[SAU.ORDEN_COL.FECHA_PAGO - 1]) {
        orders.getRange(i + 2, SAU.ORDEN_COL.FECHA_PAGO).setValue(now);
      }
      if (delivered && !order[SAU.ORDEN_COL.FECHA_ENTREGA - 1]) {
        orders.getRange(i + 2, SAU.ORDEN_COL.FECHA_ENTREGA).setValue(now);
      }

      updateSauSalesStatusForOrder_(sales, salesIndex[orderId] || [], paid, packed, delivered);
      if (paid && delivered) {
        updateSauFreesDeliveredForOrder_(frees, freeIndex[orderId] || []);
        orders.getRange(i + 2, SAU.ORDEN_COL.SYNC_VENTAS).setValue("LISTA " + formatSauDateTime_(now));
        processed++;
      }
    }

    var syncResult = syncReadySalesAndFrees({ lockAlreadyHeld: true });
    var archiveResult = archiveDeliveredOrders({ lockAlreadyHeld: true, silent: true });
    return {
      processed: processed,
      salesSynced: syncResult.salesSynced,
      freesSynced: syncResult.freesSynced,
      archived: archiveResult.archived
    };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function archiveDeliveredOrders(options) {
  options = options || {};
  var lock = options.lockAlreadyHeld ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(2000)) return { archived: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orders = ss.getSheetByName(SAU.SHEETS.ORDENES);
    var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
    var frees = ss.getSheetByName(SAU.SHEETS.FREES);
    var deliveryLog = ss.getSheetByName(SAU.SHEETS.ENTREGAS_LOG);
    if (!orders || !deliveryLog) throw new Error("Faltan hojas Ordenes o Entregas Log.");
    if (orders.getLastRow() < 2) return { archived: 0 };

    var salesStatus = buildSauSyncStatusByOrder_(sales, SAU.VENTA_COL.ORDER_ID, SAU.VENTA_COL.SYNC_STOCK);
    var freeStatus = buildSauSyncStatusByOrder_(frees, SAU.FREE_COL.ORDER_ID, SAU.FREE_COL.SYNC_STOCK);
    var values = orders.getRange(2, 1, orders.getLastRow() - 1, SAU.ORDEN_COL.PAGO_NOTAS).getValues();
    var archiveRows = [];
    var deleteRows = [];
    var now = new Date();

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var orderId = String(row[SAU.ORDEN_COL.ORDER_ID - 1] || "").trim();
      if (!orderId) continue;

      var paid = toSauBoolean_(row[SAU.ORDEN_COL.PAGADO - 1]);
      var delivered = toSauBoolean_(row[SAU.ORDEN_COL.ENTREGADO - 1]);
      if (!paid || !delivered) continue;
      if (!isSauOrderFullySynced_(orderId, salesStatus, freeStatus)) continue;

      archiveRows.push([now].concat(row));
      deleteRows.push(i + 2);
    }

    if (archiveRows.length) {
      appendSauRows_(deliveryLog, archiveRows);
      deleteRows.sort(function(a, b) { return b - a; });
      for (var d = 0; d < deleteRows.length; d++) {
        orders.deleteRow(deleteRows[d]);
      }
    }

    if (!options.silent) {
      SpreadsheetApp.getUi().alert("Ordenes archivadas: " + archiveRows.length);
    }
    return { archived: archiveRows.length };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function syncReadySalesAndFrees(options) {
  options = options || {};
  var lock = options.lockAlreadyHeld ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(2000)) return { salesSynced: 0, freesSynced: 0, message: "Ya hay una sincronizacion corriendo." };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
    var sales = ss.getSheetByName(SAU.SHEETS.VENTAS);
    var frees = ss.getSheetByName(SAU.SHEETS.FREES);
    if (!stock || !sales) throw new Error("Faltan hojas Stock o Ventas Detalle.");

    var config = readSauConfig_();
    var cache = buildSauCacheIndex_();
    var stockIndex = buildSauStockIndex_(stock);
    var salesSynced = syncSauSalesDetails_(sales, stock, stockIndex, cache, config);
    var freesSynced = frees ? syncSauFrees_(frees, stock, stockIndex, cache, config) : 0;
    return { salesSynced: salesSynced, freesSynced: freesSynced };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function syncSauSalesDetails_(sales, stock, stockIndex, cache, config) {
  if (sales.getLastRow() < 2) return 0;
  var values = sales.getRange(2, 1, sales.getLastRow() - 1, SAU.VENTA_COL.MOTIVO_ANULACION).getValues();
  var synced = 0;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (toSauBoolean_(row[SAU.VENTA_COL.ANULADA - 1])) continue;
    var paid = toSauBoolean_(row[SAU.VENTA_COL.PAGADO - 1]);
    var delivered = toSauBoolean_(row[SAU.VENTA_COL.ENTREGADO - 1]);
    var sync = String(row[SAU.VENTA_COL.SYNC_STOCK - 1] || "").trim();
    var quantity = Number(row[SAU.VENTA_COL.CANTIDAD - 1]) || 1;
    if (!paid || !delivered || sync || quantity <= 0) continue;

    var pcUrl = normalizeSauUrl_(row[SAU.VENTA_COL.PC_URL - 1]);
    var pcId = String(row[SAU.VENTA_COL.PC_ID - 1] || "").trim() || extractSauPriceChartingId_(pcUrl);
    var cacheItem = findSauCacheItem_(cache, pcId, pcUrl);
    var item = buildSauMovementItem_({
      sku: row[SAU.VENTA_COL.SKU - 1],
      name: row[SAU.VENTA_COL.NOMBRE - 1] || row[SAU.VENTA_COL.NOMBRE_FINAL - 1],
      expansion: row[SAU.VENTA_COL.EXPANSION - 1],
      quantity: quantity,
      pcUrl: pcUrl,
      pcId: pcId,
      cacheItem: cacheItem,
      note: "Creada desde venta si no existia"
    });

    var match = findOrCreateSauStock_(stock, stockIndex, item, config);
    var beforeQuantity = Number(stock.getRange(match.row, SAU.STOCK_COL.CANTIDAD).getValue()) || 0;
    decrementSauStock_(stock, match.row, quantity);
    appendSauStockMovement_({
      type: "Venta claim", sourceId: String(row[SAU.VENTA_COL.ORDER_ID - 1] || row[SAU.VENTA_COL.CLAIM - 1] || ""),
      sku: match.sku, name: item.name, delta: -quantity, before: beforeQuantity, after: Math.max(0, beforeQuantity - quantity), actor: "Sistema", notes: "Sincronizacion de orden"
    });
    if (!row[SAU.VENTA_COL.VENTA_ID - 1]) {
      sales.getRange(i + 2, SAU.VENTA_COL.VENTA_ID).setValue("VTA-" + Utilities.getUuid().slice(0, 8).toUpperCase());
    }
    if (!row[SAU.VENTA_COL.FECHA_VENTA - 1]) {
      sales.getRange(i + 2, SAU.VENTA_COL.FECHA_VENTA).setValue(new Date());
    }
    sales.getRange(i + 2, SAU.VENTA_COL.SYNC_STOCK).setValue("OK " + match.sku + " " + formatSauDateTime_(new Date()));
    synced++;
  }

  return synced;
}

function syncSauFrees_(frees, stock, stockIndex, cache, config) {
  if (frees.getLastRow() < 2) return 0;
  var values = frees.getRange(2, 1, frees.getLastRow() - 1, SAU.FREE_COL.NOTAS).getValues();
  var synced = 0;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var delivered = toSauBoolean_(row[SAU.FREE_COL.ENTREGADO - 1]);
    var sync = String(row[SAU.FREE_COL.SYNC_STOCK - 1] || "").trim();
    var quantity = Number(row[SAU.FREE_COL.CANTIDAD - 1]) || 1;
    if (!delivered || sync || quantity <= 0) continue;

    var pcUrl = normalizeSauUrl_(row[SAU.FREE_COL.PC_URL - 1]);
    var pcId = String(row[SAU.FREE_COL.PC_ID - 1] || "").trim() || extractSauPriceChartingId_(pcUrl);
    var cacheItem = findSauCacheItem_(cache, pcId, pcUrl);
    var item = buildSauMovementItem_({
      sku: row[SAU.FREE_COL.SKU - 1],
      name: row[SAU.FREE_COL.NOMBRE - 1] || row[SAU.FREE_COL.NOMBRE_FINAL - 1],
      expansion: row[SAU.FREE_COL.EXPANSION - 1],
      quantity: quantity,
      pcUrl: pcUrl,
      pcId: pcId,
      cacheItem: cacheItem,
      note: "Creada desde free si no existia"
    });

    var match = findOrCreateSauStock_(stock, stockIndex, item, config);
    var beforeQuantity = Number(stock.getRange(match.row, SAU.STOCK_COL.CANTIDAD).getValue()) || 0;
    decrementSauStock_(stock, match.row, quantity);
    appendSauStockMovement_({
      type: "Free", sourceId: String(row[SAU.FREE_COL.ORDER_ID - 1] || row[SAU.FREE_COL.CLAIM - 1] || ""),
      sku: match.sku, name: item.name, delta: -quantity, before: beforeQuantity, after: Math.max(0, beforeQuantity - quantity), actor: "Sistema", notes: "Free entregado"
    });
    frees.getRange(i + 2, SAU.FREE_COL.SYNC_STOCK).setValue("OK " + match.sku + " " + formatSauDateTime_(new Date()));
    synced++;
  }

  return synced;
}

function recordSauDailyStockSnapshot() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SAU.SHEETS.SNAPSHOTS);
  if (!sheet) { setupSauSnapshots_(ss); sheet = ss.getSheetByName(SAU.SHEETS.SNAPSHOTS); }
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (sheet.getLastRow() >= 2) {
    var lastDate = sheet.getRange(sheet.getLastRow(), 1).getValue();
    var lastKey = lastDate instanceof Date ? Utilities.formatDate(lastDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(lastDate || "").slice(0, 10);
    if (lastKey === today) return { saved: false, date: today };
  }
  var summary = mobileGetDashboard(1).summary;
  appendSauRows_(sheet, [[new Date(), summary.stockUnits, summary.stockSkus, summary.stockValueArs, summary.stockValueUsd, summary.soldWeekArs, summary.soldWeekUsd]]);
  return { saved: true, date: today };
}

function refreshSauPendingReview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var review = ss.getSheetByName(SAU.SHEETS.REVISION);
  var stock = ss.getSheetByName(SAU.SHEETS.STOCK);
  if (!review) { setupSauReview_(ss); review = ss.getSheetByName(SAU.SHEETS.REVISION); }
  if (review.getLastRow() >= 2) {
    var existing = review.getRange(2, 1, review.getLastRow() - 1, 8).getValues();
    for (var r = existing.length - 1; r >= 0; r--) {
      if (String(existing[r][1] || "").indexOf("Stock:") === 0) review.deleteRow(r + 2);
    }
  }
  if (!stock || stock.getLastRow() < 2) return { issues: 0 };
  var values = stock.getRange(2, 1, stock.getLastRow() - 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT).getValues();
  var bySku = {};
  var rows = [];
  var now = new Date();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var sku = String(row[SAU.STOCK_COL.SKU - 1] || "").trim();
    var name = String(row[SAU.STOCK_COL.NOMBRE - 1] || "").trim();
    if (!sku && !name) continue;
    if (sku) bySku[sku] = (bySku[sku] || 0) + 1;
    var quantity = Number(row[SAU.STOCK_COL.CANTIDAD - 1]) || 0;
    if (quantity < 0) rows.push([now, "Stock: cantidad negativa", sku, name, "Cantidad " + quantity, "Pendiente", "", ""]);
    if (!row[SAU.STOCK_COL.PC_URL - 1]) rows.push([now, "Stock: link faltante", sku, name, "Sin PriceCharting URL", "Pendiente", "", ""]);
    if (!row[SAU.STOCK_COL.IMAGEN_URL - 1]) rows.push([now, "Stock: imagen faltante", sku, name, "Sin imagen", "Pendiente", "", ""]);
    if (!row[SAU.STOCK_COL.PRECIO_FINAL_ARS - 1]) rows.push([now, "Stock: precio faltante", sku, name, "Sin precio final ARS", "Pendiente", "", ""]);
  }
  Object.keys(bySku).forEach(function(sku) {
    if (bySku[sku] > 1) rows.push([now, "Stock: SKU duplicado", sku, "", bySku[sku] + " filas", "Pendiente", "", ""]);
  });
  if (rows.length) appendSauRows_(review, rows);
  return { issues: rows.length };
}

function mobileGetSystemHealth() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var review = ss.getSheetByName(SAU.SHEETS.REVISION);
  var actions = ss.getSheetByName(SAU.SHEETS.ACCIONES_APP);
  var pending = 0;
  var types = {};
  if (review && review.getLastRow() >= 2) {
    var values = review.getRange(2, 1, review.getLastRow() - 1, 6).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][5] || "").toLowerCase() === "resuelto") continue;
      pending++;
      var type = String(values[i][1] || "Revision");
      types[type] = (types[type] || 0) + 1;
    }
  }
  return {
    ok: pending === 0,
    pendingReview: pending,
    issueTypes: types,
    processedActions: actions ? Math.max(0, actions.getLastRow() - 1) : 0,
    updatedAt: formatSauDateTime_(new Date())
  };
}

function setupSauDashboard_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.DASHBOARD) || ss.insertSheet(SAU.SHEETS.DASHBOARD, 0);
  sheet.setTabColor("#0f172a");
  try {
    sheet.setHiddenGridlines(true);
  } catch (ignored) {}
}

function refreshStockAdminDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSauDashboard_(ss);
  var sheet = ss.getSheetByName(SAU.SHEETS.DASHBOARD);

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  try {
    sheet.setHiddenGridlines(true);
  } catch (ignored) {}

  sheet.getRange("A1:J1").merge()
    .setValue("Ultimo Turno - HUB")
    .setFontSize(20)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0f172a")
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 44);

  sheet.getRange("A2:J2").merge()
    .setValue("Panel operativo: cobros, entregas, ventas y stock")
    .setFontColor("#475569")
    .setBackground("#e2e8f0");

  var metrics = [
    ["Ordenes activas", '=COUNTIFS(Ordenes!A2:A,"<>")'],
    ["Pendientes de cobro", '=COUNTIFS(Ordenes!A2:A,"<>",Ordenes!H2:H,FALSE)'],
    ["ARS por cobrar", '=SUMIFS(Ordenes!E2:E,Ordenes!A2:A,"<>",Ordenes!H2:H,FALSE)'],
    ["USD por cobrar", '=SUMIFS(Ordenes!F2:F,Ordenes!A2:A,"<>",Ordenes!H2:H,FALSE)'],
    ["Pagadas sin embalar", '=COUNTIFS(Ordenes!A2:A,"<>",Ordenes!H2:H,TRUE,Ordenes!I2:I,FALSE)'],
    ["Pagadas sin entregar", '=COUNTIFS(Ordenes!A2:A,"<>",Ordenes!H2:H,TRUE,Ordenes!J2:J,FALSE)'],
    ["Entregadas por archivar", '=COUNTIFS(Ordenes!A2:A,"<>",Ordenes!H2:H,TRUE,Ordenes!J2:J,TRUE)'],
    ["Cartas en stock", '=SUM(Stock!H2:H)'],
    ["Items sin stock", '=COUNTIFS(Stock!A2:A,"<>",Stock!H2:H,"<=0")'],
    ["ARS vendidos sincronizados", '=SUMIFS(\'Ventas Detalle\'!L2:L,\'Ventas Detalle\'!T2:T,"<>")'],
    ["USD vendidos sincronizados", '=SUMIFS(\'Ventas Detalle\'!M2:M,\'Ventas Detalle\'!T2:T,"<>")']
  ];

  sheet.getRange("A4:B4").setValues([["Indicador", "Valor"]]);
  sheet.getRange(5, 1, metrics.length, 1).setValues(metrics.map(function(row) { return [row[0]]; }));
  sheet.getRange(5, 2, metrics.length, 1).setFormulas(metrics.map(function(row) { return [row[1]]; }));
  styleSauDashboardTable_(sheet.getRange(4, 1, metrics.length + 1, 2), "#334155");
  sheet.getRange("B7:B8").setNumberFormat("#,##0.00");
  sheet.getRange("B14:B15").setNumberFormat("#,##0.00");

  sheet.getRange("D4:J4").merge().setValue("Ordenes activas recientes");
  sheet.getRange("D5:J5").setValues([["Comprador", "Total ARS", "Total USD", "Cartas", "Pagado", "Embalado", "Entregado"]]);
  sheet.getRange("D6").setFormula('=IFERROR(QUERY(Ordenes!A2:O,"select D,E,F,G,H,I,J where A is not null order by C desc limit 12",0),"")');
  styleSauDashboardTable_(sheet.getRange("D4:J18"), "#0f766e");
  sheet.getRange("E6:F18").setNumberFormat("#,##0.00");

  sheet.getRange("D20:J20").merge().setValue("Ventas recientes");
  sheet.getRange("D21:J21").setValues([["Fecha", "Origen", "Comprador", "Carta", "ARS", "USD", "Sync"]]);
  sheet.getRange("D22").setFormula('=IFERROR(QUERY(\'Ventas Detalle\'!A2:V,"select E,F,G,H,L,M,T where A is not null order by E desc limit 12",0),"")');
  styleSauDashboardTable_(sheet.getRange("D20:J34"), "#4338ca");
  sheet.getRange("H22:I34").setNumberFormat("#,##0.00");

  sheet.getRange("A18:B18").merge().setValue("Acciones sugeridas");
  sheet.getRange("A19:B23").setValues([
    ["Cobrar", '=IF(B6>0,"Revisar Ordenes pendientes","OK")'],
    ["Embalar", '=IF(B9>0,"Preparar pedidos pagados","OK")'],
    ["Entregar", '=IF(B10>0,"Coordinar entregas","OK")'],
    ["Archivar", '=IF(B11>0,"Stock Admin > Archivar ordenes entregadas","OK")'],
    ["Stock", '=IF(B13>0,"Revisar items sin stock","OK")']
  ]);
  styleSauDashboardTable_(sheet.getRange("A18:B23"), "#b45309");

  sheet.setColumnWidths(1, 1, 210);
  sheet.setColumnWidths(2, 1, 150);
  sheet.setColumnWidths(4, 7, 135);
  sheet.getRange("A:J").setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
}

function styleSauDashboardTable_(range, headerColor) {
  var sheet = range.getSheet();
  var row = range.getRow();
  var col = range.getColumn();
  var cols = range.getNumColumns();
  sheet.getRange(row, col, 1, cols)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground(headerColor)
    .setHorizontalAlignment("left");
  range.setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
}

function applyStockAdminVisualPolish() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var styles = {};
  styles[SAU.SHEETS.STOCK] = { color: "#1f2933", frozen: 2 };
  styles[SAU.SHEETS.COMPRAS] = { color: "#374151", frozen: 2 };
  styles[SAU.SHEETS.ORDENES] = { color: "#0f766e", frozen: 2 };
  styles[SAU.SHEETS.VENTAS] = { color: "#4338ca", frozen: 2 };
  styles[SAU.SHEETS.FREES] = { color: "#b45309", frozen: 2 };
  styles[SAU.SHEETS.CLAIMS_LOG] = { color: "#334155", frozen: 1 };
  styles[SAU.SHEETS.ENTREGAS_LOG] = { color: "#166534", frozen: 2 };
  styles[SAU.SHEETS.CONFIG] = { color: "#263238", frozen: 1 };
  styles[SAU.SHEETS.LOG] = { color: "#7f1d1d", frozen: 1 };
  styles[SAU.SHEETS.MOVIMIENTOS] = { color: "#075985", frozen: 2 };
  styles[SAU.SHEETS.REVISION] = { color: "#a16207", frozen: 2 };
  styles[SAU.SHEETS.SNAPSHOTS] = { color: "#166534", frozen: 1 };
  styles[SAU.SHEETS.AUDITORIA] = { color: "#7c3aed", frozen: 2 };
  styles[SAU.SHEETS.PAGOS] = { color: "#047857", frozen: 3 };
  styles[SAU.SHEETS.EMBALAJE] = { color: "#be123c", frozen: 2 };
  styles[SAU.SHEETS.USUARIOS_APP] = { color: "#1d4ed8", frozen: 2 };

  Object.keys(styles).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    applySauBaseSheetStyle_(sheet, styles[name].color, styles[name].frozen);
  });

  applySauOrdersConditionalFormatting_(ss.getSheetByName(SAU.SHEETS.ORDENES));
  applySauPurchasesConditionalFormatting_(ss.getSheetByName(SAU.SHEETS.COMPRAS));
  applySauSalesConditionalFormatting_(ss.getSheetByName(SAU.SHEETS.VENTAS));
  applySauFreesConditionalFormatting_(ss.getSheetByName(SAU.SHEETS.FREES));
  applySauStockConditionalFormatting_(ss.getSheetByName(SAU.SHEETS.STOCK));
  setupSauDashboard_(ss);
}

function applySauBaseSheetStyle_(sheet, color, frozenColumns) {
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

function applySauOrdersConditionalFormatting_(sheet) {
  if (!sheet) return;
  var range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), SAU.ORDEN_COL.PAGO_NOTAS);
  setSauConditionalRules_(sheet, [
    ruleSau_(range, '=AND($A2<>"",$H2=TRUE,$J2=TRUE)', "#dcfce7", "#166534"),
    ruleSau_(range, '=AND($A2<>"",$H2=TRUE,$I2=TRUE,$J2=FALSE)', "#dbeafe", "#1e3a8a"),
    ruleSau_(range, '=AND($A2<>"",$H2=TRUE,$I2=FALSE)', "#fef3c7", "#92400e"),
    ruleSau_(range, '=AND($A2<>"",$H2=FALSE,OR($P2>0,$Q2>0))', "#fef3c7", "#92400e"),
    ruleSau_(range, '=AND($A2<>"",$H2=FALSE)', "#fee2e2", "#991b1b")
  ]);
}

function applySauPurchasesConditionalFormatting_(sheet) {
  if (!sheet) return;
  var range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), SAU.COMPRA_COL.CREADO_POR);
  setSauConditionalRules_(sheet, [
    ruleSau_(range, '=AND($A2<>"",$K2=TRUE,$L2<>"")', "#dcfce7", "#166534"),
    ruleSau_(range, '=AND($A2<>"",$K2=TRUE,$L2="")', "#fef3c7", "#92400e"),
    ruleSau_(range, '=AND($I2<>"",$K2=FALSE)', "#e0f2fe", "#075985")
  ]);
}

function applySauSalesConditionalFormatting_(sheet) {
  if (!sheet) return;
  var range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), SAU.VENTA_COL.MOTIVO_ANULACION);
  setSauConditionalRules_(sheet, [
    ruleSau_(range, '=AND($A2<>"",$Q2=TRUE,$S2=TRUE,$T2<>"")', "#dcfce7", "#166534"),
    ruleSau_(range, '=AND($A2<>"",$Q2=TRUE,$S2=TRUE,$T2="")', "#fef3c7", "#92400e"),
    ruleSau_(range, '=AND($A2<>"",$Q2=TRUE,$S2=FALSE)', "#dbeafe", "#1e3a8a"),
    ruleSau_(range, '=AND($A2<>"",$Q2=FALSE)', "#fee2e2", "#991b1b")
  ]);
}

function applySauFreesConditionalFormatting_(sheet) {
  if (!sheet) return;
  var range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), SAU.FREE_COL.NOTAS);
  setSauConditionalRules_(sheet, [
    ruleSau_(range, '=AND($A2<>"",$M2=TRUE,$N2<>"")', "#dcfce7", "#166534"),
    ruleSau_(range, '=AND($A2<>"",$M2=TRUE,$N2="")', "#fef3c7", "#92400e"),
    ruleSau_(range, '=AND($A2<>"",$M2=FALSE)', "#e0f2fe", "#075985")
  ]);
}

function applySauStockConditionalFormatting_(sheet) {
  if (!sheet) return;
  var range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), SAU.STOCK_COL.ULTIMA_COMPRA_USD);
  setSauConditionalRules_(sheet, [
    ruleSau_(range, '=AND($A2<>"",$H2<=0)', "#fee2e2", "#991b1b"),
    ruleSau_(range, '=AND($A2<>"",$H2=1)', "#fef3c7", "#92400e"),
    ruleSau_(range, '=AND($A2<>"",$S2=FALSE)', "#e5e7eb", "#6b7280")
  ]);
}

function setSauConditionalRules_(sheet, rules) {
  sheet.setConditionalFormatRules(rules.filter(Boolean));
}

function ruleSau_(range, formula, background, fontColor) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground(background)
    .setFontColor(fontColor)
    .setRanges([range])
    .build();
}

function setupSauConfig_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.CONFIG) || ss.insertSheet(SAU.SHEETS.CONFIG);
  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1:B1").setValues([["Clave", "Valor"]]);
  appendMissingSauConfig_(sheet, [
    ["usd_ars", 1510],
    ["round_to", 500],
    ["min_price", 800],
    ["default_idioma", "EN"],
    ["default_condicion", "NM"],
    ["default_ubicacion", ""],
    ["fetch_image_if_missing", true],
    ["image_fetch_delay_ms", 350],
    ["image_repair_batch_size", 40],
    ["fast_lookup_max_rows", 80],
    ["require_user_session", true],
    ["pause_user_passwords", true]
  ]);
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#263238").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function setupSauStock_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.STOCK) || ss.insertSheet(SAU.SHEETS.STOCK);
  var headers = [
    "SKU", "Nombre", "Expansion", "Numero", "Idioma", "Condicion", "Ubicacion", "Cantidad",
    "PriceCharting URL", "PriceCharting ID", "TCGplayer Search URL", "Imagen URL",
    "Precio PC USD", "Dolar usado", "Precio sugerido ARS", "Precio manual ARS",
    "Precio final ARS", "Ultima actualizacion", "Activo", "Notas", "Ultima compra USD",
    "TCGplayer ID", "TCGplayer Market USD", "TCGplayer Variante", "TCGplayer actualizado"
  ];
  applySauHeader_(sheet, headers, "#1f2933");
  sheet.setFrozenColumns(2);
  sheet.getRange("H:H").setNumberFormat("#,##0");
  sheet.getRange("M:Q").setNumberFormat("#,##0.00");
  sheet.getRange("U:U").setNumberFormat("#,##0.00");
  sheet.getRange("W:W").setNumberFormat("#,##0.00");
  sheet.getRange("Y:Y").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("R:R").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange(2, SAU.STOCK_COL.ACTIVO, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  setSauStockValidations_(sheet);
  sheet.setColumnWidth(SAU.STOCK_COL.PC_URL, 360);
  sheet.setColumnWidth(SAU.STOCK_COL.TCGPLAYER_URL, 360);
  sheet.setColumnWidth(SAU.STOCK_COL.IMAGEN_URL, 360);
}

function setupSauPurchases_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.COMPRAS) || ss.insertSheet(SAU.SHEETS.COMPRAS);
  applySauHeader_(sheet, [
    "Fecha", "Proveedor", "Item", "Nombre", "Expansion", "Cantidad", "Costo total ARS",
    "Costo unitario ARS", "PriceCharting URL", "PriceCharting ID", "Recibido", "Sync Stock",
    "Notas", "Costo total USD", "Costo unitario USD", "Compra ID", "Cantidad recibida", "Creado por"
  ], "#374151");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("F:H").setNumberFormat("#,##0.00");
  sheet.getRange("N:O").setNumberFormat("#,##0.00");
  sheet.getRange("Q:Q").setNumberFormat("#,##0");
  sheet.getRange(2, SAU.COMPRA_COL.RECIBIDO, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  sheet.setColumnWidth(SAU.COMPRA_COL.PC_URL, 360);
  sheet.setColumnWidth(SAU.COMPRA_COL.NOTAS, 280);
}

function setupSauOrders_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.ORDENES) || ss.insertSheet(SAU.SHEETS.ORDENES);
  applySauHeader_(sheet, [
    "Order ID", "Referencia", "Fecha referencia", "Comprador", "Total ARS", "Total USD", "Cartas",
    "Pagado", "Embalado", "Entregado", "Fecha pago", "Fecha entrega", "Sync ventas", "Referencia URL", "Notas",
    "Pagado ARS", "Pagado USD", "Saldo ARS", "Saldo USD", "Ultimo pago", "Notas de pago"
  ], "#0f766e");
  sheet.getRange("C:C").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("E:F").setNumberFormat("#,##0.00");
  sheet.getRange("K:L").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("P:S").setNumberFormat("#,##0.00");
  sheet.getRange("T:T").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange(2, SAU.ORDEN_COL.PAGADO, Math.max(999, sheet.getMaxRows() - 1), 3).insertCheckboxes();
  sheet.setColumnWidth(SAU.ORDEN_COL.COMPRADOR, 180);
  sheet.setColumnWidth(SAU.ORDEN_COL.CLAIM_URL, 360);
  initializeSauOrderBalances_(sheet);
}

function initializeSauOrderBalances_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SAU.ORDEN_COL.PAGO_NOTAS).getValues();
  var changed = false;
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!String(row[SAU.ORDEN_COL.ORDER_ID - 1] || "").trim()) continue;
    var totalArs = Number(row[SAU.ORDEN_COL.TOTAL_ARS - 1]) || 0;
    var totalUsd = Number(row[SAU.ORDEN_COL.TOTAL_USD - 1]) || 0;
    var paid = toSauBoolean_(row[SAU.ORDEN_COL.PAGADO - 1]);
    var paidArs = Number(row[SAU.ORDEN_COL.PAGADO_ARS - 1]) || (paid ? totalArs : 0);
    var paidUsd = Number(row[SAU.ORDEN_COL.PAGADO_USD - 1]) || (paid ? totalUsd : 0);
    var balanceArs = Math.max(0, totalArs - paidArs);
    var balanceUsd = Math.max(0, totalUsd - paidUsd);
    if (row[SAU.ORDEN_COL.PAGADO_ARS - 1] !== paidArs || row[SAU.ORDEN_COL.PAGADO_USD - 1] !== paidUsd || row[SAU.ORDEN_COL.SALDO_ARS - 1] !== balanceArs || row[SAU.ORDEN_COL.SALDO_USD - 1] !== balanceUsd) {
      row[SAU.ORDEN_COL.PAGADO_ARS - 1] = paidArs;
      row[SAU.ORDEN_COL.PAGADO_USD - 1] = paidUsd;
      row[SAU.ORDEN_COL.SALDO_ARS - 1] = balanceArs;
      row[SAU.ORDEN_COL.SALDO_USD - 1] = balanceUsd;
      changed = true;
    }
  }
  if (changed) sheet.getRange(2, 1, values.length, SAU.ORDEN_COL.PAGO_NOTAS).setValues(values);
}

function setupSauSales_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.VENTAS) || ss.insertSheet(SAU.SHEETS.VENTAS);
  applySauHeader_(sheet, [
    "Venta ID", "Order ID", "Referencia", "Fecha referencia", "Fecha venta", "Origen", "Comprador",
    "Nombre final", "Nombre", "Expansion", "Cantidad", "Precio ARS", "Precio USD",
    "PriceCharting URL", "PriceCharting ID", "SKU", "Pagado", "Embalado", "Entregado",
    "Sync Stock", "Tags", "Notas", "Anulada", "Fecha anulacion", "Anulada por", "Motivo anulacion"
  ], "#4338ca");
  sheet.getRange("D:E").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("K:M").setNumberFormat("#,##0.00");
  sheet.getRange(2, SAU.VENTA_COL.PAGADO, Math.max(999, sheet.getMaxRows() - 1), 3).insertCheckboxes();
  sheet.getRange(2, SAU.VENTA_COL.ANULADA, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  setSauSalesValidations_(sheet);
  sheet.setColumnWidth(SAU.VENTA_COL.NOMBRE_FINAL, 280);
  sheet.setColumnWidth(SAU.VENTA_COL.PC_URL, 360);
}

function setupSauFrees_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.FREES) || ss.insertSheet(SAU.SHEETS.FREES);
  applySauHeader_(sheet, [
    "Free ID", "Order ID", "Referencia", "Fecha referencia", "Comprador", "Nombre final", "Nombre",
    "Expansion", "Cantidad", "PriceCharting URL", "PriceCharting ID", "SKU", "Entregado",
    "Sync Stock", "Tags", "Notas"
  ], "#b45309");
  sheet.getRange("D:D").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("I:I").setNumberFormat("#,##0");
  sheet.getRange(2, SAU.FREE_COL.ENTREGADO, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  sheet.setColumnWidth(SAU.FREE_COL.NOMBRE_FINAL, 260);
  sheet.setColumnWidth(SAU.FREE_COL.PC_URL, 360);
}

function setupSauClaimsLog_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.CLAIMS_LOG) || ss.insertSheet(SAU.SHEETS.CLAIMS_LOG);
  applySauHeader_(sheet, ["Fecha", "Claim", "Claim URL", "Compradores", "Cartas vendidas", "Total ARS", "Frees", "Origen", "Notas"], "#334155");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("F:F").setNumberFormat("#,##0.00");
  sheet.setColumnWidth(3, 360);
}

function setupSauDeliveryLog_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.ENTREGAS_LOG) || ss.insertSheet(SAU.SHEETS.ENTREGAS_LOG);
  applySauHeader_(sheet, [
    "Fecha archivo", "Order ID", "Referencia", "Fecha referencia", "Comprador", "Total ARS", "Total USD",
    "Cartas", "Pagado", "Embalado", "Entregado", "Fecha pago", "Fecha entrega", "Sync ventas",
    "Referencia URL", "Notas", "Pagado ARS", "Pagado USD", "Saldo ARS", "Saldo USD", "Ultimo pago", "Notas de pago"
  ], "#166534");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("D:D").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("F:G").setNumberFormat("#,##0.00");
  sheet.getRange("L:M").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(15, 360);
}

function setupSauLog_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.LOG) || ss.insertSheet(SAU.SHEETS.LOG);
  applySauHeader_(sheet, ["Fecha", "Origen", "Mensaje"], "#7f1d1d");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
}

function setupSauMovements_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.MOVIMIENTOS) || ss.insertSheet(SAU.SHEETS.MOVIMIENTOS);
  applySauHeader_(sheet, [
    "Movimiento ID", "Fecha", "Tipo", "Origen ID", "SKU", "Nombre", "Cantidad cambio",
    "Cantidad anterior", "Cantidad nueva", "Usuario", "Notas"
  ], "#075985");
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("G:I").setNumberFormat("#,##0");
}

function setupSauReview_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.REVISION) || ss.insertSheet(SAU.SHEETS.REVISION);
  applySauHeader_(sheet, ["Fecha", "Tipo", "SKU / ID", "Nombre", "Detalle", "Estado", "Resuelto por", "Fecha resolucion"], "#a16207");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("H:H").setNumberFormat("yyyy-mm-dd hh:mm");
}

function setupSauSnapshots_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.SNAPSHOTS) || ss.insertSheet(SAU.SHEETS.SNAPSHOTS);
  applySauHeader_(sheet, ["Fecha", "Unidades", "SKUs", "Valor ARS", "Valor USD", "Ventas semana ARS", "Ventas semana USD"], "#166534");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("B:G").setNumberFormat("#,##0.00");
}

function setupSauAudit_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.AUDITORIA) || ss.insertSheet(SAU.SHEETS.AUDITORIA);
  applySauHeader_(sheet, ["Fecha", "Usuario", "Accion", "Entidad", "Entidad ID", "Detalle", "Action ID"], "#7c3aed");
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
}

function setupSauPayments_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.PAGOS) || ss.insertSheet(SAU.SHEETS.PAGOS);
  applySauHeader_(sheet, ["Pago ID", "Fecha", "Order ID", "Comprador", "ARS", "USD", "Metodo", "Notas", "Usuario", "Action ID"], "#047857");
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("E:F").setNumberFormat("#,##0.00");
}

function setupSauPacking_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.EMBALAJE) || ss.insertSheet(SAU.SHEETS.EMBALAJE);
  applySauHeader_(sheet, ["Order ID", "Linea ID", "Tipo", "Nombre", "Revisada", "Fecha", "Usuario", "Problema", "Notas"], "#be123c");
  sheet.getRange(2, 5, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  sheet.getRange("F:F").setNumberFormat("yyyy-mm-dd hh:mm");
}

function setupSauAppActions_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.ACCIONES_APP) || ss.insertSheet(SAU.SHEETS.ACCIONES_APP);
  applySauHeader_(sheet, ["Action ID", "Fecha", "Accion", "Usuario", "Resultado JSON"], "#334155");
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm");
  try { sheet.hideSheet(); } catch (ignored) {}
}

function setupSauUsers_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.USUARIOS_APP) || ss.insertSheet(SAU.SHEETS.USUARIOS_APP);
  applySauHeader_(sheet, ["User ID", "Nombre", "Rol", "Password salt", "Password hash", "Activo", "Creado", "Actualizado"], "#1d4ed8");
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function(row) { existing[String(row[0] || "").trim()] = true; });
  }
  var defaults = [["seb", "Seb", "admin"], ["may", "Mayu", "staff"], ["melo", "Melo", "staff"], ["ger", "Ger", "sales"]];
  var now = new Date();
  var rows = defaults.filter(function(item) { return !existing[item[0]]; }).map(function(item) { return [item[0], item[1], item[2], "", "", true, now, now]; });
  if (rows.length) appendSauRows_(sheet, rows);
  sheet.getRange(2, 6, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
}

function setupSauSessions_(ss) {
  var sheet = ss.getSheetByName(SAU.SHEETS.SESIONES_APP) || ss.insertSheet(SAU.SHEETS.SESIONES_APP);
  applySauHeader_(sheet, ["Session token", "User ID", "Device ID", "Creada", "Ultimo uso", "Revocada"], "#0f766e");
  sheet.getRange("D:E").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange(2, 6, Math.max(999, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  try { sheet.hideSheet(); } catch (ignored) {}
}

function applySauHeader_(sheet, headers, color) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(color).setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

function setSauStockValidations_(sheet) {
  var idiomas = SpreadsheetApp.newDataValidation().requireValueInList(["EN", "JP", "ES", "KR", "CN", "OTRO"], true).setAllowInvalid(true).build();
  var condiciones = SpreadsheetApp.newDataValidation().requireValueInList(["NM", "LP", "MP", "HP", "DMG"], true).setAllowInvalid(true).build();
  sheet.getRange(2, SAU.STOCK_COL.IDIOMA, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(idiomas);
  sheet.getRange(2, SAU.STOCK_COL.CONDICION, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(condiciones);
}

function setSauSalesValidations_(sheet) {
  var origins = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Claim", "Mesa", "Evento", "Online", "Local", "Otro"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, SAU.VENTA_COL.ORIGEN, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(origins);
}

function buildSauMobileStockMap_(stockSheet) {
  var values = stockSheet.getLastRow() >= 2
    ? stockSheet.getRange(2, 1, stockSheet.getLastRow() - 1, SAU.STOCK_COL.TCGPLAYER_UPDATED_AT).getValues()
    : [];
  var map = { bySku: {} };
  for (var i = 0; i < values.length; i++) {
    var item = buildSauMobileStockItem_(values[i], i + 2);
    if (item.sku) map.bySku[item.sku] = item;
  }
  return map;
}

function findSauStockRowBySku_(stockSheet, sku) {
  var found = stockSheet
    .getRange(2, SAU.STOCK_COL.SKU, Math.max(1, stockSheet.getLastRow() - 1), 1)
    .createTextFinder(String(sku || "").trim())
    .matchEntireCell(true)
    .findNext();
  return found ? found.getRow() : 0;
}

function buildSauMobileStockItem_(row, rowNumber) {
  var suggested = Number(row[SAU.STOCK_COL.PRECIO_SUGERIDO_ARS - 1]) || 0;
  var manual = Number(row[SAU.STOCK_COL.PRECIO_MANUAL_ARS - 1]) || 0;
  var finalArs = Number(row[SAU.STOCK_COL.PRECIO_FINAL_ARS - 1]) || manual || suggested || 0;
  return {
    row: rowNumber,
    sku: String(row[SAU.STOCK_COL.SKU - 1] || "").trim(),
    nombre: String(row[SAU.STOCK_COL.NOMBRE - 1] || "").trim(),
    expansion: String(row[SAU.STOCK_COL.EXPANSION - 1] || "").trim(),
    numero: String(row[SAU.STOCK_COL.NUMERO - 1] || "").trim(),
    idioma: String(row[SAU.STOCK_COL.IDIOMA - 1] || "").trim(),
    condicion: String(row[SAU.STOCK_COL.CONDICION - 1] || "").trim(),
    ubicacion: String(row[SAU.STOCK_COL.UBICACION - 1] || "").trim(),
    quantity: Number(row[SAU.STOCK_COL.CANTIDAD - 1]) || 0,
    pcUrl: normalizeSauUrl_(row[SAU.STOCK_COL.PC_URL - 1]),
    pcId: String(row[SAU.STOCK_COL.PC_ID - 1] || "").trim(),
    tcgplayerUrl: normalizeSauUrl_(row[SAU.STOCK_COL.TCGPLAYER_URL - 1]),
    imageUrl: String(row[SAU.STOCK_COL.IMAGEN_URL - 1] || "").trim(),
    pcUsd: Number(row[SAU.STOCK_COL.PC_USD - 1]) || 0,
    precioSugeridoArs: suggested,
    precioManualArs: manual,
    precioFinalArs: finalArs,
    dolarUsado: Number(row[SAU.STOCK_COL.DOLAR_USADO - 1]) || 0,
    active: row[SAU.STOCK_COL.ACTIVO - 1] === "" ? true : toSauBoolean_(row[SAU.STOCK_COL.ACTIVO - 1]),
    notes: String(row[SAU.STOCK_COL.NOTAS - 1] || "").trim(),
    ultimaCompraUsd: Number(row[SAU.STOCK_COL.ULTIMA_COMPRA_USD - 1]) || 0,
    tcgplayerId: String(row[SAU.STOCK_COL.TCGPLAYER_ID - 1] || "").trim(),
    tcgplayerMarketUsd: Number(row[SAU.STOCK_COL.TCGPLAYER_MARKET_USD - 1]) || 0,
    tcgplayerSubtype: String(row[SAU.STOCK_COL.TCGPLAYER_SUBTYPE - 1] || "").trim(),
    tcgplayerUpdatedAt: String(row[SAU.STOCK_COL.TCGPLAYER_UPDATED_AT - 1] || "").trim()
  };
}

function normalizeSauMobileCart_(items) {
  var merged = {};
  for (var i = 0; i < items.length; i++) {
    var raw = items[i] || {};
    var sku = String(raw.sku || "").trim();
    if (!sku) continue;
    var quantity = Math.max(1, Number(raw.quantity) || 1);
    var priceArs = Math.max(0, Number(raw.priceArs) || 0);
    var priceUsd = Math.max(0, Number(raw.priceUsd) || 0);
    if (!merged[sku]) {
      merged[sku] = { sku: sku, quantity: 0, priceArs: priceArs, priceUsd: priceUsd };
    }
    merged[sku].quantity += quantity;
    merged[sku].priceArs = priceArs;
    merged[sku].priceUsd = priceUsd;
  }
  return Object.keys(merged).map(function(sku) { return merged[sku]; });
}

function buildSauMobileFinalName_(stockItem, cartItem) {
  var base = [stockItem.nombre, stockItem.expansion].filter(Boolean).join(" - ");
  var prices = [];
  if (cartItem.priceArs) prices.push("$" + cartItem.priceArs);
  if (cartItem.priceUsd) prices.push("$" + cartItem.priceUsd + "usd");
  return prices.length ? base + " - " + prices.join(" + ") : base;
}

function scoreSauMobileStockResult_(item, q) {
  if (!q) return 0;
  var sku = normalizeSauMobileSearch_(item.sku);
  var name = normalizeSauMobileSearch_(item.nombre);
  var number = normalizeSauMobileSearch_(item.numero);
  var expansion = normalizeSauMobileSearch_(item.expansion);
  if (sku === q || number === q) return 100;
  if (name === q) return 90;
  if (name.indexOf(q) === 0) return 80;
  if (expansion.indexOf(q) === 0) return 50;
  return 20;
}

function normalizeSauMobileSearch_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesSauMobileQuery_(haystack, query) {
  var parts = String(query || "").split(" ").filter(Boolean);
  for (var i = 0; i < parts.length; i++) {
    if (haystack.indexOf(parts[i]) < 0) return false;
  }
  return true;
}

function buildSauCacheIndex_() {
  var id = PropertiesService.getScriptProperties().getProperty(SAU.PROP.PC_CACHE_SPREADSHEET_ID);
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

function buildSauCacheLookup_() {
  var id = PropertiesService.getScriptProperties().getProperty(SAU.PROP.PC_CACHE_SPREADSHEET_ID);
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
      var canonical = canonicalSauUrl_(pcUrl);

      if (pcId && memoById.hasOwnProperty(pcId)) return memoById[pcId];
      if (canonical && memoByUrl.hasOwnProperty(canonical)) return memoByUrl[canonical];

      var item = null;
      if (pcId) {
        item = findSauCacheRowByText_(sheet, PCC_LIKE_COL_PC_ID_(), pcId);
      }
      if (!item && canonical) {
        item = findSauCacheRowByText_(sheet, PCC_LIKE_COL_CANONICAL_URL_(), canonical);
      }

      if (pcId) memoById[pcId] = item;
      if (canonical) memoByUrl[canonical] = item;
      return item;
    }
  };
}

function findSauCacheRowByText_(sheet, column, text) {
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

function buildSauTcgCacheIndex_() {
  var id = PropertiesService.getScriptProperties().getProperty(SAU.PROP.TCG_CACHE_SPREADSHEET_ID);
  if (!id) throw new Error("Falta configurar TCGplayer Cache.");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("TCGplayer Cache");
  if (!sheet || sheet.getLastRow() < 2) return { byProductId: {}, byMatchKey: {}, byNameNumberKey: {} };

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 21).getValues();
  var index = { byProductId: {}, byMatchKey: {}, byNameNumberKey: {}, nameNumberProductIds: {} };
  for (var i = 0; i < values.length; i++) {
    var item = buildSauTcgCacheItemFromRow_(values[i]);
    if (!item.productId) continue;
    addPreferredSauTcgItem_(index.byProductId, item.productId, item);
    if (item.matchKey) addPreferredSauTcgItem_(index.byMatchKey, item.matchKey, item);
    if (item.nameNumberKey) addSauTcgNameNumberItem_(index, item);
  }
  return index;
}

function buildSauTcgCacheLookup_() {
  var id = PropertiesService.getScriptProperties().getProperty(SAU.PROP.TCG_CACHE_SPREADSHEET_ID);
  if (!id) throw new Error("Falta configurar TCGplayer Cache.");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("TCGplayer Cache");
  if (!sheet || sheet.getLastRow() < 2) {
    return { byProductId: {}, byMatchKey: {}, byNameNumberKey: {}, find: function() { return null; } };
  }

  var memo = {};
  return {
    byProductId: {},
    byMatchKey: {},
    byNameNumberKey: {},
    find: function(query) {
      query = query || {};
      var productId = String(query.productId || "").trim();
      var matchKey = buildSauTcgMatchKey_(query.name, query.expansion, query.number);
      var nameNumberKey = buildSauTcgNameNumberKey_(query.name, query.number);
      var memoKey = [productId, matchKey, nameNumberKey].join("::");
      if (memo.hasOwnProperty(memoKey)) return memo[memoKey];

      var item = null;
      if (productId) item = findSauTcgCachePreferredByText_(sheet, 1, productId);
      if (!item && matchKey) item = findSauTcgCachePreferredByText_(sheet, 19, matchKey);
      if (!item && nameNumberKey) item = findSauTcgCachePreferredByText_(sheet, 20, nameNumberKey);
      memo[memoKey] = item;
      return item;
    }
  };
}

function findSauTcgCacheItem_(cache, query) {
  query = query || {};
  if (cache && typeof cache.find === "function") return cache.find(query);
  var productId = String(query.productId || "").trim();
  if (productId && cache.byProductId[productId]) return cache.byProductId[productId];
  var matchKey = buildSauTcgMatchKey_(query.name, query.expansion, query.number);
  if (matchKey && cache.byMatchKey[matchKey]) return cache.byMatchKey[matchKey];
  var nameNumberKey = buildSauTcgNameNumberKey_(query.name, query.number);
  return nameNumberKey ? cache.byNameNumberKey[nameNumberKey] : null;
}

function findSauTcgCachePreferredByText_(sheet, column, text) {
  var finder = sheet
    .getRange(2, column, Math.max(1, sheet.getLastRow() - 1), 1)
    .createTextFinder(String(text))
    .matchEntireCell(true);
  var found = finder.findAll();
  if (!found || !found.length) return null;

  var best = null;
  var productId = "";
  for (var i = 0; i < found.length; i++) {
    var values = sheet.getRange(found[i].getRow(), 1, 1, 21).getValues()[0];
    var item = buildSauTcgCacheItemFromRow_(values);
    if (column === 20) {
      if (!productId) productId = item.productId;
      if (productId && item.productId && productId !== item.productId) return null;
    }
    if (!best || scoreSauTcgItem_(item) > scoreSauTcgItem_(best)) best = item;
  }
  return best;
}

function buildSauTcgCacheItemFromRow_(values) {
  return {
    productId: String(values[0] || "").trim(),
    groupId: String(values[1] || "").trim(),
    groupName: String(values[2] || "").trim(),
    productName: String(values[4] || "").trim(),
    cleanName: String(values[5] || "").trim(),
    number: String(values[6] || "").trim(),
    rarity: String(values[8] || "").trim(),
    subtype: String(values[9] || "").trim(),
    marketUsd: Number(values[10]) || 0,
    lowUsd: Number(values[11]) || 0,
    midUsd: Number(values[12]) || 0,
    highUsd: Number(values[13]) || 0,
    directLowUsd: Number(values[14]) || 0,
    tcgplayerUrl: normalizeSauUrl_(values[15]),
    imageUrl: normalizeSauUrl_(values[16]),
    updatedAt: values[17],
    matchKey: String(values[18] || "").trim(),
    nameNumberKey: String(values[19] || "").trim()
  };
}

function addPreferredSauTcgItem_(map, key, item) {
  if (!key) return;
  if (!map[key] || scoreSauTcgItem_(item) > scoreSauTcgItem_(map[key])) map[key] = item;
}

function addSauTcgNameNumberItem_(index, item) {
  var key = item.nameNumberKey;
  if (!key) return;
  var productId = item.productId || "";
  if (!index.nameNumberProductIds[key]) index.nameNumberProductIds[key] = productId;
  if (index.nameNumberProductIds[key] && index.nameNumberProductIds[key] !== productId) {
    index.nameNumberProductIds[key] = "";
    index.byNameNumberKey[key] = null;
    return;
  }
  addPreferredSauTcgItem_(index.byNameNumberKey, key, item);
}

function scoreSauTcgItem_(item) {
  if (!item) return -9999;
  var subtype = String(item.subtype || "").toLowerCase();
  var score = 0;
  if (item.marketUsd) score += 1000;
  else if (item.lowUsd) score += 500;
  if (subtype === "normal") score += 90;
  else if (subtype === "holofoil") score += 80;
  else if (subtype.indexOf("reverse") >= 0) score += 20;
  else score += 50;
  score += Math.min(99, Number(item.marketUsd || item.lowUsd || 0));
  return score;
}

function fillSauStockRowFromTcgCache_(row, item) {
  row[SAU.STOCK_COL.TCGPLAYER_ID - 1] = item.productId || "";
  row[SAU.STOCK_COL.TCGPLAYER_MARKET_USD - 1] = item.marketUsd || item.lowUsd || "";
  row[SAU.STOCK_COL.TCGPLAYER_SUBTYPE - 1] = item.subtype || "";
  row[SAU.STOCK_COL.TCGPLAYER_UPDATED_AT - 1] = new Date();
  if (item.tcgplayerUrl) row[SAU.STOCK_COL.TCGPLAYER_URL - 1] = item.tcgplayerUrl;
}

function buildSauTcgMatchKey_(name, expansion, number) {
  return [normalizeSauTcgMatchText_(name), normalizeSauTcgExpansion_(expansion), normalizeSauTcgCardNumber_(number)].join("|");
}

function buildSauTcgNameNumberKey_(name, number) {
  return [normalizeSauTcgMatchText_(name), normalizeSauTcgCardNumber_(number)].join("|");
}

function normalizeSauTcgExpansion_(value) {
  return normalizeSauTcgMatchText_(value)
    .replace(/\bpokemon\b/g, "")
    .replace(/\bsv\b/g, "")
    .replace(/\bsword shield\b/g, "")
    .replace(/\bscarlet violet\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSauTcgMatchText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSauTcgCardNumber_(value) {
  var text = String(value || "").trim();
  if (text.indexOf("/") >= 0) text = text.split("/")[0];
  text = text.toLowerCase().replace(/^#/, "").trim();
  if (/^\d+$/.test(text)) return String(Number(text));
  return text.replace(/[^a-z0-9]+/g, "");
}

function PCC_LIKE_COL_PC_ID_() {
  return 1;
}

function PCC_LIKE_COL_CANONICAL_URL_() {
  return 2;
}

function findSauCacheItem_(cache, pcId, pcUrl) {
  if (cache && typeof cache.find === "function") return cache.find(pcId, pcUrl);
  if (pcId && cache.byId[String(pcId)]) return cache.byId[String(pcId)];
  var canonical = canonicalSauUrl_(pcUrl);
  return canonical ? cache.byUrl[canonical] : null;
}

function buildSauStockIndex_(stockSheet) {
  var values = stockSheet.getLastRow() >= 2 ? stockSheet.getRange(2, 1, stockSheet.getLastRow() - 1, SAU.STOCK_COL.ULTIMA_COMPRA_USD).getValues() : [];
  var index = { bySku: {}, byPcId: {}, byUrl: {} };
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var item = {
      row: i + 2,
      sku: String(row[SAU.STOCK_COL.SKU - 1] || "").trim(),
      pcId: String(row[SAU.STOCK_COL.PC_ID - 1] || "").trim(),
      url: canonicalSauUrl_(row[SAU.STOCK_COL.PC_URL - 1])
    };
    if (item.sku) index.bySku[item.sku] = item;
    if (item.pcId) index.byPcId[item.pcId] = item;
    if (item.url) index.byUrl[item.url] = item;
  }
  return index;
}

function fillSauStockRowFromCache_(row, item, config, now) {
  var usdArs = Number(config.usd_ars || 1510);
  var roundTo = Number(config.round_to || 500);
  var minPrice = Number(config.min_price || 800);
  var pcId = String(row[SAU.STOCK_COL.PC_ID - 1] || item.pcId || "").trim();
  var originalPcUrl = normalizeSauUrl_(row[SAU.STOCK_COL.PC_URL - 1]);
  var bestPcUrl = buildSauPriceChartingUrlFromItem_(item) || normalizeSauUrl_(item.pcUrl);

  if (!row[SAU.STOCK_COL.SKU - 1] && pcId) row[SAU.STOCK_COL.SKU - 1] = buildSauSku_(pcId);
  if (!row[SAU.STOCK_COL.NOMBRE - 1]) row[SAU.STOCK_COL.NOMBRE - 1] = item.nombre || item.nombrePc || "";
  if (!row[SAU.STOCK_COL.EXPANSION - 1]) row[SAU.STOCK_COL.EXPANSION - 1] = item.expansion || item.expansionPc || "";
  if (!row[SAU.STOCK_COL.NUMERO - 1]) row[SAU.STOCK_COL.NUMERO - 1] = item.numero || "";
  if (!row[SAU.STOCK_COL.IDIOMA - 1]) row[SAU.STOCK_COL.IDIOMA - 1] = String(config.default_idioma || "EN");
  if (!row[SAU.STOCK_COL.CONDICION - 1]) row[SAU.STOCK_COL.CONDICION - 1] = String(config.default_condicion || "NM");
  if (!row[SAU.STOCK_COL.UBICACION - 1]) row[SAU.STOCK_COL.UBICACION - 1] = String(config.default_ubicacion || "");
  if (bestPcUrl && (config.force_product_url || !isSauExactPriceChartingProductUrl_(row[SAU.STOCK_COL.PC_URL - 1]))) {
    row[SAU.STOCK_COL.PC_URL - 1] = bestPcUrl;
  } else if (!row[SAU.STOCK_COL.PC_URL - 1]) {
    row[SAU.STOCK_COL.PC_URL - 1] = bestPcUrl || item.pcUrl || "";
  }
  row[SAU.STOCK_COL.PC_ID - 1] = pcId || item.pcId || "";
  if (!row[SAU.STOCK_COL.TCGPLAYER_URL - 1]) {
    row[SAU.STOCK_COL.TCGPLAYER_URL - 1] = buildSauTcgplayerSearchUrl_(row[SAU.STOCK_COL.NOMBRE - 1], row[SAU.STOCK_COL.EXPANSION - 1], row[SAU.STOCK_COL.NUMERO - 1]);
  }
  if (config.force_image || !row[SAU.STOCK_COL.IMAGEN_URL - 1]) {
    var imageUrl = item.imageUrl || "";
    var pcUrlForImage = pickSauExactPriceChartingUrl_(bestPcUrl, row[SAU.STOCK_COL.PC_URL - 1], originalPcUrl, item.pcUrl);
    if (!imageUrl && toSauBoolean_(config.fetch_image_if_missing) && pcUrlForImage) {
      try {
        imageUrl = fetchSauPriceChartingImageUrl_(pcUrlForImage);
        Utilities.sleep(Number(config.image_fetch_delay_ms || 350));
      } catch (err) {
        row[SAU.STOCK_COL.NOTAS - 1] = [row[SAU.STOCK_COL.NOTAS - 1], "Imagen no encontrada: " + String(err && err.message ? err.message : err)].filter(Boolean).join(" | ");
      }
    }
    row[SAU.STOCK_COL.IMAGEN_URL - 1] = imageUrl;
  }

  var usd = Number(item.usd) || 0;
  row[SAU.STOCK_COL.PC_USD - 1] = usd || "";
  row[SAU.STOCK_COL.DOLAR_USADO - 1] = usdArs;
  if (usd) row[SAU.STOCK_COL.PRECIO_SUGERIDO_ARS - 1] = roundSauPrice_(usd * usdArs, roundTo, minPrice);
  row[SAU.STOCK_COL.PRECIO_FINAL_ARS - 1] = row[SAU.STOCK_COL.PRECIO_MANUAL_ARS - 1] || row[SAU.STOCK_COL.PRECIO_SUGERIDO_ARS - 1] || "";
  row[SAU.STOCK_COL.ULTIMA_ACTUALIZACION - 1] = now;
  if (row[SAU.STOCK_COL.ACTIVO - 1] === "") row[SAU.STOCK_COL.ACTIVO - 1] = true;
}

function buildSauMovementItem_(data) {
  var cacheItem = data.cacheItem || {};
  var pcId = String(data.pcId || cacheItem.pcId || "").trim();
  var name = String(data.name || cacheItem.nombre || cacheItem.nombrePc || "").trim();
  var expansion = String(data.expansion || cacheItem.expansion || cacheItem.expansionPc || "").trim();
  return {
    sku: String(data.sku || (pcId ? buildSauSku_(pcId) : "")).trim(),
    name: name,
    expansion: expansion,
    number: cacheItem.numero || "",
    quantity: Number(data.quantity) || 1,
    pcUrl: normalizeSauUrl_(data.pcUrl || cacheItem.pcUrl || ""),
    pcId: pcId,
    imageUrl: cacheItem.imageUrl || "",
    usd: cacheItem.usd || "",
    language: data.language || "",
    condition: data.condition || "",
    location: data.location || "",
    lastPurchaseUsd: Number(data.lastPurchaseUsd) || "",
    note: data.note || ""
  };
}

function appendOrIncrementSauStock_(stock, stockIndex, item, quantity, config, lastPurchaseUsd) {
  var match = findSauStockMatch_(stockIndex, item);
  if (!match) return appendSauStockRow_(stock, stockIndex, item, config, quantity);

  var qtyCell = stock.getRange(match.row, SAU.STOCK_COL.CANTIDAD);
  var current = Number(qtyCell.getValue()) || 0;
  qtyCell.setValue(current + quantity);
  stock.getRange(match.row, SAU.STOCK_COL.ULTIMA_ACTUALIZACION).setValue(new Date());
  if (lastPurchaseUsd) stock.getRange(match.row, SAU.STOCK_COL.ULTIMA_COMPRA_USD).setValue(lastPurchaseUsd);
  match.beforeQuantity = current;
  match.afterQuantity = current + quantity;
  return match;
}

function findOrCreateSauStock_(stock, stockIndex, item, config) {
  return findSauStockMatch_(stockIndex, item) || appendSauStockRow_(stock, stockIndex, item, config, 0);
}

function findSauStockMatch_(stockIndex, item) {
  if (item.sku && stockIndex.bySku[item.sku]) return stockIndex.bySku[item.sku];
  if (item.pcId && stockIndex.byPcId[item.pcId]) return stockIndex.byPcId[item.pcId];
  var url = canonicalSauUrl_(item.pcUrl);
  if (url && stockIndex.byUrl[url]) return stockIndex.byUrl[url];
  return null;
}

function appendSauStockRow_(stock, stockIndex, item, config, initialQuantity) {
  var row = new Array(SAU.STOCK_COL.TCGPLAYER_UPDATED_AT);
  for (var i = 0; i < row.length; i++) row[i] = "";
  var usd = Number(item.usd) || 0;
  var usdArs = Number((config || {}).usd_ars || 1510);
  var roundTo = Number((config || {}).round_to || 500);
  var minPrice = Number((config || {}).min_price || 800);

  row[SAU.STOCK_COL.SKU - 1] = item.sku || ("PKM-MANUAL-" + Utilities.getUuid().slice(0, 8).toUpperCase());
  row[SAU.STOCK_COL.NOMBRE - 1] = item.name;
  row[SAU.STOCK_COL.EXPANSION - 1] = item.expansion;
  row[SAU.STOCK_COL.NUMERO - 1] = item.number;
  row[SAU.STOCK_COL.IDIOMA - 1] = String(item.language || config.default_idioma || "EN");
  row[SAU.STOCK_COL.CONDICION - 1] = String(item.condition || config.default_condicion || "NM");
  row[SAU.STOCK_COL.UBICACION - 1] = String(item.location || config.default_ubicacion || "");
  row[SAU.STOCK_COL.CANTIDAD - 1] = Number(initialQuantity) || 0;
  row[SAU.STOCK_COL.PC_URL - 1] = item.pcUrl;
  row[SAU.STOCK_COL.PC_ID - 1] = item.pcId;
  row[SAU.STOCK_COL.TCGPLAYER_URL - 1] = buildSauTcgplayerSearchUrl_(item.name, item.expansion, item.number);
  row[SAU.STOCK_COL.IMAGEN_URL - 1] = item.imageUrl;
  row[SAU.STOCK_COL.PC_USD - 1] = usd || "";
  row[SAU.STOCK_COL.DOLAR_USADO - 1] = usdArs;
  if (usd) {
    row[SAU.STOCK_COL.PRECIO_SUGERIDO_ARS - 1] = roundSauPrice_(usd * usdArs, roundTo, minPrice);
    row[SAU.STOCK_COL.PRECIO_FINAL_ARS - 1] = row[SAU.STOCK_COL.PRECIO_SUGERIDO_ARS - 1];
  }
  row[SAU.STOCK_COL.ULTIMA_ACTUALIZACION - 1] = new Date();
  row[SAU.STOCK_COL.ACTIVO - 1] = true;
  row[SAU.STOCK_COL.NOTAS - 1] = item.note;
  row[SAU.STOCK_COL.ULTIMA_COMPRA_USD - 1] = item.lastPurchaseUsd || "";
  var targetRow = findFirstEmptySauKeyRow_(stock, SAU.STOCK_COL.SKU);
  var range = stock.getRange(targetRow, 1, 1, row.length);
  range.setValues([row]);

  var saved = {
    row: targetRow,
    sku: row[SAU.STOCK_COL.SKU - 1],
    pcId: item.pcId,
    url: canonicalSauUrl_(item.pcUrl),
    beforeQuantity: 0,
    afterQuantity: Number(initialQuantity) || 0
  };
  stockIndex.bySku[saved.sku] = saved;
  if (saved.pcId) stockIndex.byPcId[saved.pcId] = saved;
  if (saved.url) stockIndex.byUrl[saved.url] = saved;
  return saved;
}

function decrementSauStock_(stock, row, quantity) {
  var cell = stock.getRange(row, SAU.STOCK_COL.CANTIDAD);
  var current = Number(cell.getValue()) || 0;
  cell.setValue(Math.max(0, current - quantity));
  stock.getRange(row, SAU.STOCK_COL.ULTIMA_ACTUALIZACION).setValue(new Date());
}

function buildSauRowsByOrder_(sheet, orderCol) {
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, orderCol, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var orderId = String(values[i][0] || "").trim();
    if (!orderId) continue;
    if (!out[orderId]) out[orderId] = [];
    out[orderId].push(i + 2);
  }
  return out;
}

function buildSauSyncStatusByOrder_(sheet, orderCol, syncCol) {
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var width = Math.max(orderCol, syncCol);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  for (var i = 0; i < values.length; i++) {
    var orderId = String(values[i][orderCol - 1] || "").trim();
    if (!orderId) continue;
    if (!out[orderId]) out[orderId] = { total: 0, synced: 0 };
    out[orderId].total++;
    if (String(values[i][syncCol - 1] || "").trim()) out[orderId].synced++;
  }
  return out;
}

function isSauOrderFullySynced_(orderId, salesStatus, freeStatus) {
  var sales = salesStatus[orderId];
  var frees = freeStatus[orderId];
  if (sales && sales.synced < sales.total) return false;
  if (frees && frees.synced < frees.total) return false;
  return !!sales || !!frees;
}

function appendSauRows_(sheet, rows) {
  if (!rows.length) return;
  var startRow = findFirstEmptySauKeyRow_(sheet, 1);
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function findFirstEmptySauKeyRow_(sheet, keyCol) {
  var maxRows = Math.max(2, sheet.getMaxRows());
  var values = sheet.getRange(2, keyCol, maxRows - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (isSauEmptyAppendCell_(values[i][0])) return i + 2;
  }
  return maxRows + 1;
}

function isSauEmptyAppendCell_(value) {
  if (value === false || value === "" || value === null || value === undefined) return true;
  var text = String(value).trim().toLowerCase();
  return text === "" || text === "false";
}

function updateSauSalesStatusForOrder_(sales, rows, paid, packed, delivered) {
  for (var i = 0; i < rows.length; i++) {
    sales.getRange(rows[i], SAU.VENTA_COL.PAGADO, 1, 3).setValues([[paid, packed, delivered]]);
  }
}

function updateSauFreesDeliveredForOrder_(frees, rows) {
  if (!frees) return;
  for (var i = 0; i < rows.length; i++) {
    frees.getRange(rows[i], SAU.FREE_COL.ENTREGADO).setValue(true);
  }
}

function appendMissingSauConfig_(sheet, defaults) {
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) if (values[i][0]) existing[String(values[i][0])] = true;
  }
  var append = defaults.filter(function(row) { return !existing[row[0]]; });
  if (append.length) sheet.getRange(sheet.getLastRow() + 1, 1, append.length, 2).setValues(append);
}

function readSauConfig_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAU.SHEETS.CONFIG);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) if (values[i][0]) out[String(values[i][0])] = values[i][1];
  return out;
}

function buildSauSku_(pcId) {
  return "PKM-PC-" + pcId;
}

function extractSauPcIdFromSku_(sku) {
  var match = String(sku || "").match(/^PKM-PC-(\d+)$/i);
  return match ? match[1] : "";
}

function buildSauTcgplayerSearchUrl_(name, expansion, number) {
  var query = [name, expansion, number].filter(Boolean).join(" ");
  return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=" + encodeURIComponent(query);
}

function fetchSauPriceChartingImageUrl_(url) {
  var candidates = buildSauFetchUrlCandidates_(url);
  var lastError = "";
  for (var i = 0; i < candidates.length; i++) {
    var response = UrlFetchApp.fetch(candidates[i], {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0 StockAdministrationUnified/2.0" }
    });
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      lastError = "HTTP " + status;
      continue;
    }
    var html = response.getContentText();
    var imageUrl = extractFirstSau_(html, /(https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'<>\s]+\/1600\.jpg)/i)
      || extractFirstSau_(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
      || extractFirstSau_(html, /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    if (imageUrl) return imageUrl;
    lastError = "Imagen no encontrada";
  }
  throw new Error(lastError || "Imagen no encontrada");
}

function roundSauPrice_(value, roundTo, minPrice) {
  var rounded = Math.ceil(value / roundTo) * roundTo;
  return Math.max(Number(minPrice) || 0, rounded);
}

function extractSauSpreadsheetId_(input) {
  var text = String(input || "").trim();
  var match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = text.match(/^[a-zA-Z0-9-_]{20,}$/);
  return match ? match[0] : "";
}

function extractSauPriceChartingId_(url) {
  var match = String(url || "").match(/[?&]id=(\d+)/i);
  return match ? match[1] : "";
}

function normalizeSauUrl_(value) {
  var text = String(value || "").trim();
  var match = text.match(/https?:\/\/[^\s\])]+/i);
  return match ? match[0] : text;
}

function isSauExactPriceChartingProductUrl_(value) {
  var text = normalizeSauUrl_(value).split("#")[0].split("?")[0].replace(/\/+$/g, "");
  return /^https?:\/\/www\.pricecharting\.com\/game\/[^\/]+\/[^\/]+$/i.test(text);
}

function canonicalSauUrl_(url) {
  var text = normalizeSauUrl_(url);
  if (!text) return "";
  text = text.replace(/^http:\/\//i, "https://").split("#")[0].split("?")[0].replace(/\/+$/g, "").toLowerCase();
  var match = text.match(/^(https:\/\/www\.pricecharting\.com\/game\/)([^\/]+)\/([^\/]+)$/i);
  if (match) {
    return match[1].toLowerCase() + slugSau_(decodeURIComponentSafeSau_(match[2])) + "/" + slugSau_(decodeURIComponentSafeSau_(match[3]));
  }
  return text;
}

function buildSauPriceChartingUrlFromItem_(item) {
  item = item || {};
  var expansion = item.expansionPc || item.expansion || "";
  var product = item.nombrePc || item.nombre || "";
  if (!product && item.nombre && item.numero) product = item.nombre + " #" + item.numero;
  if (!expansion || !product) return "";
  return "https://www.pricecharting.com/game/" + slugSauPriceChartingPath_(expansion) + "/" + slugSauPriceChartingPath_(product);
}

function pickSauExactPriceChartingUrl_() {
  for (var i = 0; i < arguments.length; i++) {
    var url = normalizeSauUrl_(arguments[i]);
    if (url && isSauExactPriceChartingProductUrl_(url)) return url;
  }
  return "";
}

function buildSauFetchUrlCandidates_(url) {
  var out = [];
  var seen = {};
  var base = normalizeSauUrl_(url);
  [base, base.replace(/['\u2019]/g, "%27")].forEach(function(candidate) {
    if (candidate && !seen[candidate]) {
      seen[candidate] = true;
      out.push(candidate);
    }
  });
  return out;
}

function extractFirstSau_(text, regex) {
  var match = String(text || "").match(regex);
  return match ? match[1] : "";
}

function decodeURIComponentSafeSau_(text) {
  try {
    return decodeURIComponent(String(text || ""));
  } catch (err) {
    return String(text || "");
  }
}

function slugSau_(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugSauPriceChartingPath_(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['\u2019]/g, "%27")
    .replace(/[^a-z0-9%]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toSauBoolean_(value) {
  if (value === true) return true;
  var text = String(value || "").toLowerCase().trim();
  return text === "true" || text === "si" || text === "1" || text === "ok";
}

function formatSauDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
}

function formatSauMoneyArs_(value) {
  return "$" + Math.round(Number(value) || 0);
}

function formatSauMoneyUsd_(value) {
  var n = Number(value) || 0;
  return "USD " + (Math.round(n * 100) / 100);
}

function extractSauSellerFromNotes_(notes) {
  var match = String(notes || "").match(/(?:^|\|\s*)Vendedor:\s*([^|]+)/i);
  return match ? String(match[1] || "").trim() : "";
}

function buildSauWeekWindow_() {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var start = new Date(now);
  start.setHours(0, 0, 0, 0);
  var mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  var end = new Date(start);
  end.setDate(end.getDate() + 7);
  var labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  var days = [];
  for (var i = 0; i < 7; i++) {
    var day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push({
      key: Utilities.formatDate(day, tz, "yyyy-MM-dd"),
      label: labels[i]
    });
  }
  return { start: start, end: end, days: days };
}

function logSau_(origin, message) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAU.SHEETS.LOG);
  if (sheet) sheet.appendRow([new Date(), origin, message]);
}
