import { maultCopyFingerprint, type MaultIntakeCopy, type MaultResolvedImage } from "@ultimoturno/domain";

type Fetcher = typeof fetch;
const error = (message: string): never => { throw new Error(message); };
async function bytes(response: Response, limit: number) {
  if (!response.body || Number(response.headers.get("content-length") || 0) > limit) error("Respuesta del proveedor demasiado grande.");
  const reader = response.body!.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  try { for (;;) { const chunk = await reader.read(); if (chunk.done) break;
    total += chunk.value.length; if (total > limit) error("Respuesta del proveedor demasiado grande."); chunks.push(chunk.value); }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks);
}
async function json(url: URL, fetcher: Fetcher, headers: Record<string, string> = {}) {
  let response: Response;
  try { response = await fetcher(url.href, { method: "GET", headers: { Accept: "application/json", ...headers }, redirect: "error", signal: AbortSignal.timeout(8000) }); }
  catch { return error("No se pudo conectar al proveedor."); }
  if (!response.ok) error(`Proveedor HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.includes("application/json")) error("El proveedor no devolvio JSON.");
  const body = await bytes(response, 2_000_000);
  try { return JSON.parse(body.toString("utf8")); } catch { return error("JSON de proveedor invalido."); }
}
export function maultSource(options: { baseUrl: string; apiKey: string }, fetcher: Fetcher = fetch) {
  const base = new URL(options.baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash
    || !options.apiKey.startsWith("mv_") || /\s/.test(options.apiKey)) error("Configuracion privada Mault invalida.");
  const root = base.href.replace(/\/$/, "") + "/v1/";
  const target = (value: string, endpoint: string) => {
    const u = new URL(value, root), path = new URL(root + endpoint).pathname;
    const alias = path.startsWith("/api/v1/") ? path.slice(4) : path;
    if (u.origin !== base.origin || u.username || u.password || u.hash || ![path, alias].includes(u.pathname)) error("Paginacion Mault fuera de alcance.");
    u.pathname = path; return u;
  };
  const list = async (url: URL) => {
    const body = await json(url, fetcher, { "X-API-Key": options.apiKey });
    if (!body || body.object !== "list" || !Array.isArray(body.data) || typeof body.has_more !== "boolean") error("Lista Mault invalida.");
    return body;
  };
  return {
    async card(id: string): Promise<unknown> {
      if (!id || id.length > 200) error("Identificador de copia invalido.");
      const body = await json(new URL(root + "cards/" + encodeURIComponent(id)), fetcher, { "X-API-Key": options.apiKey });
      if (!body || body.object !== "scanned_card" || body.id !== id) error("La copia fuente no coincide.");
      return body;
    },
    async collections(): Promise<Array<{ id: string; name: string }>> {
      const body = await list(new URL(root + "collections"));
      if (body.has_more || body.data.some((c: { id?: unknown; name?: unknown }) => !c || typeof c.id !== "string" || typeof c.name !== "string")) error("Colecciones Mault invalidas.");
      return body.data;
    },
    async page(nextPage: string | null, since: string | null) {
      const first = new URL(root + "cards"); first.searchParams.set("limit", "200"); if (since) first.searchParams.set("since", since);
      const url = nextPage ? target(nextPage, "cards") : first;
      if (url.searchParams.get("limit") !== "200" || (url.searchParams.get("since") || null) !== since) error("Paginacion Mault cambio sus filtros.");
      const body = await list(url);
      if (body.data.length > 200 || !Number.isFinite(Date.parse(body.next_since))) error("Pagina Mault invalida.");
      let following: string | null = null;
      if (body.has_more) {
        if (typeof body.next_page !== "string") error("Falta la pagina siguiente de Mault.");
        const next = target(body.next_page, "cards");
        if (next.href === url.href || next.searchParams.get("limit") !== "200" || (next.searchParams.get("since") || null) !== since) error("Paginacion Mault invalida.");
        following = next.href;
      }
      return { cards: body.data as unknown[], nextPage: following, nextSince: new Date(body.next_since).toISOString() };
    },
  };
}

export async function verifyMaultImage(imageUrl: string, sourceLanguage: string, fetcher: Fetcher = fetch) {
  let url: URL;
  try { url = new URL(imageUrl); } catch { return error("URL de imagen invalida."); }
  if (url.protocol !== "https:" || url.hostname !== "assets.tcgdex.net" || url.port || url.username || url.password
    || url.search || url.hash || url.pathname.split("/")[1] !== sourceLanguage) error("Imagen fuera del proveedor o idioma permitido.");
  let response: Response;
  try { response = await fetcher(url.href, { redirect: "error", signal: AbortSignal.timeout(8000) }); }
  catch { return error("No se pudo verificar la imagen."); }
  if (!response.ok) error(`Imagen HTTP ${response.status}.`);
  const mime = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const body = await bytes(response, 8_000_000);
  const valid = (mime === "image/webp" && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP")
    || (mime === "image/png" && body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    || (mime === "image/jpeg" && body[0] === 255 && body[1] === 216 && body[2] === 255);
  if (!valid || body.length < 20) error("El archivo no es una imagen valida.");
  return url.href;
}
const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export async function resolveMaultImage(copy: MaultIntakeCopy, fetcher: Fetcher = fetch): Promise<MaultResolvedImage> {
  if (copy.sourceGame !== "pokemon") error("Catalogo japones requiere verificacion manual de imagen.");
  const card = await json(new URL(`https://api.tcgdex.net/v2/${encodeURIComponent(copy.sourceLanguage)}/cards/${encodeURIComponent(copy.cardId)}`), fetcher);
  if (card.id !== copy.cardId || typeof card.name !== "string" || key(card.name) !== key(copy.name)
    || !card.set || key(String(card.set.id)) !== key(copy.setCode) || key(String(card.localId).replace(/^0+(?=\d)/, "")) !== key(copy.number.replace(/^0+(?=\d)/, ""))
    || typeof card.set.name !== "string" || typeof card.image !== "string") error("El catalogo no coincide exactamente con la carta fuente.");
  if (copy.stamp) error("La imagen de una estampa requiere confirmacion manual.");
  const imageUrl = await verifyMaultImage(`${card.image}/high.webp`, copy.sourceLanguage, fetcher);
  return { imageUrl, name: card.name, expansion: card.set.name, verifiedFingerprint: maultCopyFingerprint(copy), verifiedBy: "tcgdex" };
}
