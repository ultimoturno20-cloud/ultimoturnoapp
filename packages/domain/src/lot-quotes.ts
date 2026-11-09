export type LotQuoteLine = {
  id: string; name: string; expansion: string; number: string; language: string;
  condition: string; finish: string; quantity: number; referencePrice: number | null;
  unitPrice: number | null; imageUrl: string; sourceUrl: string; sourceName: string;
  sourceUpdatedAt: string; notes: string;
};
export type LotQuoteDraft = {
  name: string; notes: string; status: "draft" | "archived"; currency: "ARS" | "USD";
  exchangeRate: number; purchasePercent: number; lines: LotQuoteLine[];
};
export type LotQuote = LotQuoteDraft & { id: string; version: number; createdAt: string; updatedAt: string };
export type LotQuoteSummary = Omit<LotQuote, "lines"> & { lineCount: number };
export type LotQuotePage = { items: LotQuoteSummary[]; total: number; offset: number; limit: number };
export type SaveLotQuote = { version: number; requestId: string; draft: LotQuoteDraft };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isLotQuoteId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
function invalid(message: string): never { throw Object.assign(new Error(message), { statusCode: 400 }); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Datos del presupuesto invalidos.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) invalid("Texto del presupuesto invalido o demasiado largo.");
  return value.trim();
}
function decimal(value: unknown, max: number, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || Math.abs(value * 100 - Math.round(value * 100)) > 0.0001) invalid("Importe, porcentaje o cotizacion invalido (hasta dos decimales).");
  return Math.round(value * 100) / 100;
}
function url(value: unknown, image = false) {
  const result = text(value, 2048);
  if (!result) return "";
  if (image && /^\/(?:api\/)?pricecharting-images\/files\/[a-zA-Z0-9._-]+$/.test(result)) return result;
  try { if (!["https:", "http:"].includes(new URL(result).protocol)) invalid("Enlace invalido."); }
  catch { invalid("Usa un enlace http o https completo."); }
  return result;
}
export function normalizeLotQuote(value: unknown): LotQuoteDraft {
  const input = record(value);
  if (typeof input.currency !== "string" || !["ARS", "USD"].includes(input.currency) || typeof input.status !== "string" || !["draft", "archived"].includes(input.status)) invalid("Moneda o estado invalido.");
  if (!Array.isArray(input.lines) || input.lines.length > 1000) invalid("El presupuesto admite hasta 1000 filas.");
  const ids = new Set<string>();
  const lines = input.lines.map(value => {
    const row = record(value);
    if (!isLotQuoteId(row.id) || ids.has(row.id)) invalid("Cada fila requiere un identificador unico.");
    const id = row.id.toLowerCase();
    if (ids.has(id)) invalid("Cada fila requiere un identificador unico.");
    ids.add(id);
    if (!Number.isInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 10000) invalid("La cantidad debe ser un entero entre 1 y 10000.");
    return {
      id, name: text(row.name, 240, true), expansion: text(row.expansion, 240), number: text(row.number, 80),
      language: text(row.language, 40), condition: text(row.condition, 40), finish: text(row.finish, 80), quantity: Number(row.quantity),
      referencePrice: row.referencePrice === null ? null : decimal(row.referencePrice, 100_000_000),
      unitPrice: row.unitPrice === null ? null : decimal(row.unitPrice, 100_000_000),
      imageUrl: url(row.imageUrl, true), sourceUrl: url(row.sourceUrl), sourceName: text(row.sourceName, 80),
      sourceUpdatedAt: text(row.sourceUpdatedAt, 80), notes: text(row.notes, 1000)
    };
  });
  const draft: LotQuoteDraft = {
    name: text(input.name, 160, true), notes: text(input.notes, 4000), status: input.status as LotQuoteDraft["status"],
    currency: input.currency as LotQuoteDraft["currency"], exchangeRate: decimal(input.exchangeRate, 1_000_000, 0.01),
    purchasePercent: decimal(input.purchasePercent, 100), lines
  };
  const totals = lotQuoteTotals(draft);
  if (totals.referenceTotal > 10_000_000_000 || totals.saleTotal > 10_000_000_000) invalid("El total supera el limite del presupuesto.");
  if (new TextEncoder().encode(JSON.stringify(draft)).byteLength > 3_500_000) invalid("El presupuesto supera 3,5 MB. Acorta notas o enlaces para guardarlo.");
  return draft;
}
export function normalizeLotQuoteSave(value: unknown): SaveLotQuote {
  const input = record(value);
  if (!isLotQuoteId(input.requestId) || !Number.isInteger(input.version) || Number(input.version) < 0 || Number(input.version) > 2_000_000_000) invalid("Version o solicitud invalida.");
  return { requestId: input.requestId.toLowerCase(), version: Number(input.version), draft: normalizeLotQuote(input.draft) };
}
export function lotQuoteTotals(draft: LotQuoteDraft) {
  let referenceCents = 0, saleCents = 0, units = 0, missingReference = 0, missingSale = 0;
  for (const row of draft.lines) {
    units += row.quantity;
    if (row.referencePrice === null) missingReference += row.quantity;
    else referenceCents += Math.round(row.referencePrice * 100) * row.quantity;
    if (row.unitPrice === null) missingSale += row.quantity;
    else saleCents += Math.round(row.unitPrice * 100) * row.quantity;
  }
  const basisPoints = Math.round(draft.purchasePercent * 100);
  const purchaseCents = Number.isSafeInteger(referenceCents) && Number.isSafeInteger(basisPoints)
    ? Number((BigInt(referenceCents) * BigInt(basisPoints) + 5000n) / 10000n)
    : Math.round(referenceCents * basisPoints / 10000);
  return { units, referenceTotal: referenceCents / 100, saleTotal: saleCents / 100,
    purchaseTotal: purchaseCents / 100,
    missingReference, missingSale };
}
// Every cell is quoted, and formula-leading text is neutralized for spreadsheet apps.
export function lotQuoteCsv(draft: LotQuoteDraft): string {
  const totals = lotQuoteTotals(draft);
  const rows: Array<Array<string | number | null>> = [
    ["Presupuesto", draft.name], ["Moneda", draft.currency], ["ARS por USD", draft.exchangeRate],
    ["Porcentaje de compra", draft.purchasePercent], ["Notas", draft.notes], [],
    ["Carta", "Expansion", "Numero", "Idioma", "Condicion", "Acabado", "Cantidad", "Referencia unitaria", "Venta unitaria", "Referencia total", "Venta total", "Fuente", "Enlace", "Imagen", "Fecha fuente", "Notas"],
    ...draft.lines.map(row => [row.name, row.expansion, row.number, row.language, row.condition, row.finish, row.quantity,
      row.referencePrice, row.unitPrice, row.referencePrice === null ? null : Math.round(row.referencePrice * 100) * row.quantity / 100,
      row.unitPrice === null ? null : Math.round(row.unitPrice * 100) * row.quantity / 100, row.sourceName, row.sourceUrl, row.imageUrl, row.sourceUpdatedAt, row.notes]),
    [], ["Unidades", totals.units], ["Referencia conocida", totals.referenceTotal], ["Oferta de compra", totals.purchaseTotal],
    ["Venta conocida", totals.saleTotal], ["Unidades sin referencia", totals.missingReference], ["Unidades sin precio de venta", totals.missingSale]
  ];
  return "\uFEFF" + rows.map(row => row.map(cell => {
    let value = cell === null ? "" : String(cell);
    if (typeof cell === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(value)) value = "'" + value;
    return '"' + value.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");
}
