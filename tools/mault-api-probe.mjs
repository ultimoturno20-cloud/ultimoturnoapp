import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && value.trim().length > 0;

export function createMaultReader(config, { fetchImpl = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("La URL base debe ser HTTPS y no contener credenciales ni parametros.");
  if (!text(config.apiKey) || !config.apiKey.startsWith("mv_") || /\s/.test(config.apiKey)) throw new Error("Configura una clave Mault valida en apiKey.");
  const root = base.href.replace(/\/$/, "") + "/v1/";
  function pageUrl(value, current, expectedPath) {
    const target = new URL(value, current);
    // Hosted Mault emits /v1 links although its reverse proxy serves /api/v1.
    // Rebase only this exact same-origin endpoint; never forward the key elsewhere.
    const publicPath = expectedPath.startsWith("/api/v1/") ? expectedPath.slice(4) : expectedPath;
    if (target.origin !== base.origin || target.username || target.password || target.hash
      || ![expectedPath, publicPath].includes(target.pathname)) throw new Error("Mault devolvio una pagina fuera del endpoint permitido.");
    target.pathname = expectedPath;
    return target;
  }
  let requests = 0;
  async function get(url, expectedPath) {
    const target = new URL(url);
    if (target.origin !== base.origin || target.pathname !== expectedPath || target.username || target.password || target.hash) throw new Error("Mault devolvio una pagina fuera del endpoint permitido.");
    if (requests++) await pause(1100);
    let response;
    try {
      response = await fetchImpl(target, { method: "GET", headers: { "X-API-Key": config.apiKey, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
    } catch { throw new Error("No se pudo leer Mault: conexion, redireccion o tiempo agotado. No se modifico stock."); }
    if (!response.ok) {
      const hint = { 401: "Clave invalida o revocada.", 403: "Sin acceso API para esta clave o plan.", 429: "Limite de consultas; espera antes de reintentar." }[response.status] || "Error del servidor Mault.";
      throw new Error(`Mault HTTP ${response.status}. ${hint}`);
    }
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("La URL no devuelve JSON. Revisa baseUrl.");
    let body;
    try { body = await response.json(); } catch { throw new Error("Mault devolvio JSON invalido."); }
    if (!plain(body) || body.object !== "list" || !Array.isArray(body.data) || typeof body.has_more !== "boolean") throw new Error("Respuesta de lista Mault invalida.");
    if (body.has_more && !text(body.next_page)) throw new Error("Lista incompleta: falta next_page.");
    return body;
  }
  async function list(endpoint, params = {}) {
    const first = new URL(root + endpoint);
    for (const [key, value] of Object.entries(params)) if (value) first.searchParams.set(key, value);
    let url = first.href;
    const seen = new Set();
    const data = [];
    while (url) {
      if (seen.size >= 120 || seen.has(url)) throw new Error("Paginacion incompleta o ciclica: no se emitira un informe parcial.");
      seen.add(url);
      const page = await get(url, first.pathname);
      data.push(...page.data);
      if (page.has_more) {
        const next = pageUrl(page.next_page, url, first.pathname);
        for (const [key, value] of Object.entries(params)) {
          if (value && next.searchParams.get(key) !== value) throw new Error("Mault cambio los filtros de paginacion; informe cancelado.");
        }
        url = next.href;
      } else url = null;
    }
    return data;
  }
  return {
    collections: () => list("collections"),
    cards: collection => list("cards", { limit: "500", collection }),
  };
}

export function analyzeCards(cards) {
  const ids = new Set();
  const byLanguage = Object.create(null);
  const byFinish = Object.create(null);
  const pendingReasons = Object.create(null);
  let pending = 0, stored = 0, productIds = 0, duplicates = 0;
  const unique = [];
  for (const card of cards) {
    if (!plain(card) || card.object !== "scanned_card" || !text(card.id)) throw new Error("Copia Mault sin identidad valida; informe cancelado.");
    if (ids.has(card.id)) { duplicates++; continue; }
    ids.add(card.id);
    unique.push(card);
  }
  for (const card of unique) {
    const reasons = [];
    if (card.game !== "pokemon") reasons.push("otro_juego");
    if (!text(card.lang) || ["unknown", "und"].includes(card.lang.toLowerCase())) reasons.push("sin_idioma");
    if (!text(card.card_id) || !text(card.set) || !text(card.collector_number) || !text(card.name)) reasons.push("identidad_incompleta");
    if (card.needs_review !== false) reasons.push("revision_pendiente_o_desconocida");
    if (!["NM", "LP", "MP", "HP", "DMG"].includes(card.condition)) reasons.push("condicion_desconocida");
    if (!["foil", "nonfoil"].includes(card.finish)) reasons.push("acabado_desconocido");
    if (card.finish === "foil" && !text(card.foil_type)) reasons.push("foil_sin_subtipo");
    if (card.finish === "nonfoil" && text(card.foil_type)) reasons.push("acabado_contradictorio");
    if (reasons.length) pending++;
    for (const reason of reasons) pendingReasons[reason] = (pendingReasons[reason] || 0) + 1;
    const lang = text(card.lang) ? card.lang : "sin_idioma";
    const finish = text(card.foil_type) ? card.foil_type : card.finish || "sin_acabado";
    byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    byFinish[finish] = (byFinish[finish] || 0) + 1;
    if (plain(card.location) && text(card.location.id)) stored++;
    if (Number.isInteger(card.tcgplayer_product_id) && card.tcgplayer_product_id > 0) productIds++;
  }
  return { physicalCopies: unique.length, duplicateRecordsIgnored: duplicates, withTcgplayerProductId: productIds, withStorageLocation: stored, pendingReview: pending, withBasicFieldsComplete: unique.length - pending, byLanguage, byFinish, pendingReasons, catalogMatchingPerformed: false, inventoryWrites: 0, conditionNote: "NM puede ser el valor inicial de Mault; no certifica condicion fisica." };
}

export async function probe(config, dependencies) {
  const client = createMaultReader(config, dependencies);
  const collections = await client.collections();
  if (config.collectionId && !collections.some(row => row.id === config.collectionId)) throw new Error("La coleccion indicada no pertenece a esta clave.");
  const cards = await client.cards(config.collectionId || undefined);
  return { mode: "read_only", collectionCount: collections.length, scope: config.collectionId ? "selected_collection" : "all_collections", ...analyzeCards(cards) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const file = process.argv[2];
    if (!file) throw new Error("Uso: node tools/mault-api-probe.mjs RUTA_CONFIG_PRIVADA.json");
    let config;
    try { config = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, "")); }
    catch { throw new Error("No se pudo leer la configuracion JSON privada."); }
    if (!plain(config) || !text(config.baseUrl)) throw new Error("Falta baseUrl en la configuracion privada.");
    console.log(JSON.stringify(await probe(config), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Fallo la prueba Mault.");
    process.exitCode = 1;
  }
}
