export async function callHubApi(config, action, body = {}) {
  const apiUrl = String(config.apiUrl || "").trim();
  const token = String(config.apiToken || "").trim();

  if (!apiUrl) throw new Error("Falta URL de Web App.");
  if (!token) throw new Error("Falta token.");

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = Math.max(3000, Number(config.requestTimeoutMs) || 12000);
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        token,
        sessionToken: String(config.sessionToken || "").trim(),
        ...body
      }),
      ...(controller ? { signal: controller.signal } : {})
    });
  } catch (err) {
    if (err && err.name === "AbortError") throw new Error("Timeout de API. La accion quedo lista para reintentar.");
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error("La API no devolvio JSON. Revisa la URL publicada.");
  }

  if (!json.ok) throw new Error(json.error || "Error de API.");
  return json.data;
}

async function callHubApiWithActionAliases(config, actions, body = {}) {
  let lastError = null;
  let unrecognizedCount = 0;
  for (const action of actions) {
    try {
      return await callHubApi(config, action, body);
    } catch (err) {
      lastError = err;
      if (!isUnrecognizedActionError(err)) throw err;
      unrecognizedCount += 1;
    }
  }
  if (unrecognizedCount === actions.length) {
    throw new Error("El Web App publicado del HUB no tiene el importador de scanner. Copia el Apps Script actualizado y crea una nueva version del deployment.");
  }
  throw lastError || new Error("Accion no reconocida.");
}

function isUnrecognizedActionError(err) {
  return String(err && err.message ? err.message : err)
    .toLowerCase()
    .includes("accion no reconocida");
}

export function searchStock(config, query, limit = 30) {
  return callHubApi(config, "searchStock", { q: query, limit });
}

export function authenticateUser(config, payload) {
  return callHubApi({ ...config, sessionToken: "" }, "authenticateUser", { payload });
}

export function listStock(config, options = {}) {
  return callHubApi(config, "listStock", options);
}

export function getStockCatalog(config) {
  return callHubApi({ ...config, requestTimeoutMs: 30000 }, "getStockCatalog");
}

export function updateStock(config, payload) {
  return callHubApi(config, "updateStock", { payload });
}

export function getCardDetails(config, sku) {
  return callHubApi(config, "getCardDetails", { sku });
}

export function closeSale(config, payload) {
  return callHubApi(config, "closeSale", { payload });
}

export function getDashboard(config, limit = 6) {
  return callHubApi(config, "getDashboard", { limit });
}

export function listOrders(config, options = {}) {
  return callHubApi(config, "listOrders", options);
}

export function updateOrder(config, payload) {
  return callHubApi(config, "updateOrder", { payload });
}

export function recordOrderPayment(config, payload) {
  return callHubApi(config, "recordOrderPayment", { payload });
}

export function completeOrder(config, payload) {
  return callHubApi(config, "completeOrder", { payload });
}

export function updatePackingLine(config, payload) {
  return callHubApi(config, "updatePackingLine", { payload });
}

export function listTodaySales(config, options = {}) {
  return callHubApi(config, "listTodaySales", options);
}

export function listSales(config, options = {}) {
  return callHubApi(config, "listSales", options);
}

export function cancelSale(config, payload) {
  return callHubApi(config, "cancelSale", { payload });
}

export function listPurchases(config, options = {}) {
  return callHubApi(config, "listPurchases", options);
}

export function createPurchase(config, payload) {
  return callHubApi(config, "createPurchase", { payload });
}

export function receivePurchase(config, payload) {
  return callHubApi(config, "receivePurchase", { payload });
}

export function importScannerStock(config, payload) {
  return callHubApiWithActionAliases(config, [
    "importScannerStock",
    "mobileImportScannerStock",
    "scannerImportStock",
    "importStockFromScanner"
  ], { payload });
}

export function getClaimWorkspace(config) {
  return callHubApi({ ...config, requestTimeoutMs: 30000 }, "getClaimWorkspace");
}

export function configureClaimGenerator(config, payload) {
  return callHubApi({ ...config, requestTimeoutMs: 30000 }, "configureClaimGenerator", { payload });
}

export function prepareClaim(config, payload) {
  return callHubApi({ ...config, requestTimeoutMs: 120000 }, "prepareClaim", { payload });
}

export function updateClaimCard(config, payload) {
  return callHubApi({ ...config, requestTimeoutMs: 30000 }, "updateClaimCard", { payload });
}

export function generateClaimGrid(config, payload = {}) {
  return callHubApi({ ...config, requestTimeoutMs: 30000 }, "generateClaimGrid", { payload });
}

export function saveClaimGrid(config, payload) {
  return callHubApi({ ...config, requestTimeoutMs: 120000 }, "saveClaimGrid", { payload });
}

export function finishClaim(config, payload) {
  return callHubApi({ ...config, requestTimeoutMs: 120000 }, "finishClaim", { payload });
}

export function resetClaim(config, payload = {}) {
  return callHubApi({ ...config, requestTimeoutMs: 30000 }, "resetClaim", { payload });
}

export function pingApi(config) {
  return callHubApi(config, "ping");
}

export function getSystemHealth(config) {
  return callHubApi(config, "getSystemHealth");
}

export function resetRemoteUserPassword(config, payload) {
  return callHubApi(config, "resetUserPassword", { payload });
}
