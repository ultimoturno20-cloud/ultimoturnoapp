import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCoolstuffExpansionLinks, parseCoolstuffPageCount, parseCoolstuffProducts } from "../packages/importers/src/index.js";

// Public sources only. Never connects to the operational API or changes sale prices.
const args = new Map(process.argv.slice(2).map((arg) => {
  const [name, ...value] = arg.replace(/^--/, "").split("=");
  return [name, value.join("=")];
}));
const source = args.get("source") || "tcg";
if (!["tcg", "coolstuff"].includes(source)) throw new Error("Use --source=tcg o --source=coolstuff.");
const output = path.resolve(args.get("output") || "outputs/price-source-audit");
await mkdir(output, { recursive: true });
let lastRequestAt = 0;
let requests = 0;
async function cachedText(url: string, filename: string, delayMs: number) {
  const file = path.join(output, filename);
  try {
    const cached = JSON.parse(await readFile(file, "utf8"));
    if (cached.url === url && Date.now() - Date.parse(cached.fetchedAt) < 86400000 && typeof cached.body === "string") return cached.body as string;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, delayMs - (Date.now() - lastRequestAt))));
  const response = await fetch(url, {
    headers: { "User-Agent": "UltimoTurnoPriceAudit/1.0 (daily cached price collection)" },
    signal: AbortSignal.timeout(30000)
  });
  lastRequestAt = Date.now();
  requests++;
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const bytes = await response.arrayBuffer();
  const body = new TextDecoder(source === "coolstuff" ? "windows-1252" : "utf-8").decode(bytes);
  if (!body.trim()) throw new Error(`Respuesta vacia: ${url}`);
  if (source === "tcg") {
    const payload = JSON.parse(body);
    if (payload.success !== true || !Array.isArray(payload.results)) throw new Error(`Respuesta TCGCSV invalida: ${url}`);
  } else if (!parseCoolstuffProducts(body).length && !parseCoolstuffExpansionLinks(body).length) {
    throw new Error(`CoolStuff no devolvio un catalogo reconocible: ${url}`);
  }
  await writeFile(`${file}.tmp`, JSON.stringify({ url, fetchedAt: new Date().toISOString(), body }));
  await rename(`${file}.tmp`, file);
  return body;
}
async function jsonResults(url: string, filename: string) {
  const payload = JSON.parse(await cachedText(url, filename, 150));
  if (payload.success !== true || !Array.isArray(payload.results)) throw new Error(`Respuesta TCGCSV invalida: ${url}`);
  return payload.results;
}
let summary: Record<string, unknown>;
if (source === "tcg") {
  const groups = await jsonResults("https://tcgcsv.com/tcgplayer/3/groups", "tcg-groups.json");
  const products = new Set<number>();
  let priceRows = 0;
  let marketRows = 0;
  let pricedRows = 0;
  const expansions = [];
  for (const group of groups) {
    const rows = await jsonResults(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/prices`, `tcg-${group.groupId}-prices.json`);
    const valid = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
    for (const row of rows) {
      priceRows++;
      if (valid(row.marketPrice)) marketRows++;
      if ([row.marketPrice, row.midPrice, row.lowPrice, row.highPrice, row.directLowPrice].some(valid)) {
        pricedRows++;
        products.add(row.productId);
      }
    }
    expansions.push({ groupId: group.groupId, name: group.name, rows: rows.length });
    console.log(`${expansions.length}/${groups.length} ${group.name}: ${rows.length}`);
  }
  summary = { source: "TCGCSV Pokemon category 3", groups: groups.length, priceRows, marketRows, pricedRows, productsWithPrice: products.size, expansions };
} else if (!args.get("group")) {
  const html = await cachedText("https://www.coolstuffinc.com/pokemon/", "coolstuff-groups.json", 10000);
  const groups = parseCoolstuffExpansionLinks(html).map((entry) => ({ ...entry, groupId: new URL(entry.url).pathname.split("/").pop() }));
  summary = { source: "CoolStuff expansion index", groups: groups.length, expansions: groups };
} else {
  const groupId = args.get("group");
  if (!groupId || !/^\d+$/.test(groupId)) throw new Error("CoolStuff requiere --group=ID (por ejemplo 9126).");
  const products = new Map<string, ReturnType<typeof parseCoolstuffProducts>[number]>();
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const url = `https://www.coolstuffinc.com/page/${groupId}?sh=1&page=${page}`;
    const html = await cachedText(url, `coolstuff-${groupId}-${page}.json`, 10000);
    if (page === 1) pages = parseCoolstuffPageCount(html, url);
    const parsed = parseCoolstuffProducts(html);
    if (!parsed.length) throw new Error(`Pagina sin productos reconocibles: ${url}`);
    const before = products.size;
    for (const product of parsed) products.set(product.url, product);
    if (products.size === before) throw new Error(`Paginacion repetida: ${url}`);
    console.log(`${page}/${pages}: ${parsed.length} productos`);
  }
  const rows = [...products.values()];
  summary = { source: "CoolStuff", groupId, pages, products: rows.length, offers: rows.reduce((sum, product) => sum + product.offers.length, 0), inStockOffers: rows.reduce((sum, product) => sum + product.offers.filter((offer) => offer.quantity > 0).length, 0) };
  await writeFile(path.join(output, `coolstuff-${groupId}-products.json`), JSON.stringify(rows, null, 2));
}
summary.completedAt = new Date().toISOString();
summary.networkRequests = requests;
const report = path.join(output, `${source}${args.get("group") ? `-${args.get("group")}` : ""}-summary.json`);
await writeFile(report, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, expansions: undefined, report }, null, 2));
