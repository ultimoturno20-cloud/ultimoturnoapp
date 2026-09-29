import { pathToFileURL } from "node:url";

type Options = { apiBaseUrl: string; accessKey: string; groupOffset: number };

export function parseOptions(argv: string[]): Options {
  const rawOffset = argv.find((arg) => arg.startsWith("--group-offset="))?.split("=")[1] ?? "0";
  const groupOffset = Number(rawOffset);
  if (!rawOffset.trim() || !Number.isSafeInteger(groupOffset) || groupOffset < 0) {
    throw new Error("--group-offset debe ser un entero mayor o igual a cero.");
  }
  return {
    apiBaseUrl: (process.env.ULTIMOTURNO_API_URL || "https://ultimoturnoapp-api.vercel.app/api").replace(/\/+$/, ""),
    accessKey: process.env.ULTIMOTURNO_ACCESS_KEY || "",
    groupOffset
  };
}

export async function syncInventory(options: Options) {
  const base = new URL(options.apiBaseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || (!local && base.protocol !== "https:") || !["http:", "https:"].includes(base.protocol)) {
    throw new Error("ULTIMOTURNO_API_URL debe ser HTTPS (HTTP solo en localhost), sin credenciales ni parametros.");
  }
  if (!local && !options.accessKey) throw new Error("Falta ULTIMOTURNO_ACCESS_KEY.");
  const route = "/card-index/sync-tcgcsv";
  const url = local ? `${options.apiBaseUrl}${route}` : `${options.apiBaseUrl}/dispatch?path=${encodeURIComponent(route)}`;
  let offset = options.groupOffset;
  let matched = 0;
  while (true) {
    console.log(`TCGCSV: grupo ${offset}. Si se interrumpe, retomar con --group-offset=${offset}.`);
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json", ...(options.accessKey ? { "X-UltimoTurno-Access-Key": options.accessKey } : {}) },
      body: JSON.stringify({ groupOffset: offset, groupLimit: 1, inventoryOnly: true, seedMissing: false }),
      signal: AbortSignal.timeout(310000)
    });
    if (!response.ok) throw new Error(`API HTTP ${response.status}. Retomar con --group-offset=${offset}.`);
    const result = await response.json() as { nextGroupOffset?: number | null; rowsMatched?: number; complete?: boolean };
    const next = result.nextGroupOffset;
    if (!Number.isSafeInteger(result.rowsMatched) || result.rowsMatched! < 0 ||
        (next === null ? result.complete !== true : !Number.isSafeInteger(next) || next! <= offset || result.complete !== false)) {
      throw new Error(`Respuesta de paginacion invalida en grupo ${offset}; proceso detenido.`);
    }
    matched += result.rowsMatched!;
    console.log(`Grupo ${offset}: ${result.rowsMatched} coincidencias.`);
    if (next === null) break;
    offset = next!;
  }
  console.log(`Recorrido terminado: ${matched} coincidencias procesadas (no necesariamente vinculos nuevos).`);
  return matched;
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log(`Vincula el inventario existente con TCGCSV mediante la API.
Uso: npm run prices:link-tcg -- --group-offset=0
Requiere ULTIMOTURNO_ACCESS_KEY; ULTIMOTURNO_API_URL es opcional.
Procesa una expansion por pedido hasta terminar. Ante un error se detiene e
indica el grupo para retomar; no reintenta escrituras automaticamente.
Actualiza referencias del catalogo. No crea cartas ni cambia precios de venta
o cantidades. El cron de precios existente actualiza las cotizaciones.`);
    return;
  }
  await syncInventory(parseOptions(process.argv.slice(2)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
