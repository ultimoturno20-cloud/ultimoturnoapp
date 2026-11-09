import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Calculator, Check, Copy, Download, FilePlus2, ImageOff, LoaderCircle, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { catalogSourceLabel, cleanCatalogPickerName, isLotQuoteId, lotQuoteCsv, lotQuoteTotals, normalizeLotQuote, normalizeLotQuoteSave, type CatalogPickerEntry, type LotQuote, type LotQuoteDraft, type LotQuoteLine, type LotQuotePage, type SaveLotQuote } from "@ultimoturno/domain";
import type { ApiOptions } from "./admin-api.js";
import "./lot-quotes.css";

type Request = <T>(path: string, options?: ApiOptions) => Promise<T>;
type Envelope = { id: string; version: number; draft: LotQuoteDraft; saved: string; pending: SaveLotQuote | null };
export type LotQuotesHandle = { refresh: (force?: boolean) => Promise<void> };
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
function fresh(rate: number): Envelope {
  return { id: crypto.randomUUID(), version: 0, saved: "", pending: null, draft: {
    name: "Nuevo lote", notes: "", status: "draft", currency: "ARS", exchangeRate: round(rate), purchasePercent: 70, lines: []
  } };
}
function restore(scope: string, rate: number): Envelope {
  try {
    const raw = JSON.parse(sessionStorage.getItem(`ut-lot-quote:${scope}`) || "null") as Envelope | null;
    if (raw && isLotQuoteId(raw.id) && Number.isInteger(raw.version) && raw.version >= 0) {
      // Keep incomplete form fields too (e.g. quantity temporarily blank). Full
      // validation still runs before save/export; structural checks protect rendering.
      if (typeof raw.saved !== "string" || typeof raw.draft.exchangeRate !== "number" || typeof raw.draft.purchasePercent !== "number") throw new Error("Invalid draft");
      normalizeLotQuote({ ...raw.draft, name: raw.draft.name || "Lote", exchangeRate: 1, purchasePercent: 0,
        lines: raw.draft.lines.map(row => {
          if (typeof row.quantity !== "number" || (row.referencePrice !== null && typeof row.referencePrice !== "number") || (row.unitPrice !== null && typeof row.unitPrice !== "number") || typeof row.imageUrl !== "string" || typeof row.sourceUrl !== "string") throw new Error("Invalid row");
          return { ...row, name: row.name || "Carta", quantity: 1, referencePrice: null, unitPrice: null, imageUrl: "", sourceUrl: "" };
        }) });
      if (raw.pending) normalizeLotQuoteSave(raw.pending);
      return raw;
    }
  } catch { /* Unavailable storage or invalid draft: start a clean, unsaved quote. */ }
  return fresh(rate);
}
const money = (value: number, currency: string) => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const date = (value: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }) : "Sin fecha de fuente";
function QuoteImage({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const usable = /^https?:\/\//i.test(url) || /^\/(?:api\/)?pricecharting-images\/files\/[a-zA-Z0-9._-]+$/.test(url);
  return usable && !failed ? <img src={url} alt={name} loading="lazy" onError={() => setFailed(true)} /> : <span className="quote-no-image" aria-label="Sin imagen"><ImageOff size={22} /></span>;
}
function blankLine(name: string): LotQuoteLine {
  return { id: crypto.randomUUID(), name, expansion: "", number: "", language: "EN", condition: "NM", finish: "normal", quantity: 1,
    referencePrice: null, unitPrice: null, imageUrl: "", sourceUrl: "", sourceName: "Manual", sourceUpdatedAt: "", notes: "" };
}

export const LotQuotesView = forwardRef<LotQuotesHandle, { request: Request; scope: string; currentRate: number }>(function LotQuotesView({ request, scope, currentRate }, ref) {
  const [editor, setEditor] = useState(() => restore(scope, currentRate));
  const latest = useRef(editor); latest.current = editor;
  const [page, setPage] = useState<LotQuotePage | null>(null);
  const [offset, setOffset] = useState(0);
  const [listBusy, setListBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const listSerial = useRef(0);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [results, setResults] = useState<CatalogPickerEntry[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const search = useRef<AbortController | null>(null);
  const [manualName, setManualName] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(editor.draft) !== editor.saved;
  const locked = busy || Boolean(editor.pending);
  const totals = lotQuoteTotals(editor.draft);
  const format = (value: number) => money(value, editor.draft.currency);

  useEffect(() => {
    try { sessionStorage.setItem(`ut-lot-quote:${scope}`, JSON.stringify(editor)); } catch { /* Explicit save remains available. */ }
  }, [scope, editor]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => search.current?.abort(), []);

  async function loadList(nextOffset = offset, signal?: AbortSignal) {
    const serial = ++listSerial.current;
    setListBusy(true); setListError("");
    try { const result = await request<LotQuotePage>(`/lot-quotes?offset=${nextOffset}`, { signal }); if (!signal?.aborted && serial === listSerial.current) setPage(result); }
    catch (next) { if (!signal?.aborted && serial === listSerial.current) setListError(next instanceof Error ? next.message : "No se pudieron leer los presupuestos."); }
    finally { if (!signal?.aborted && serial === listSerial.current) setListBusy(false); }
  }
  useEffect(() => { const controller = new AbortController(); void loadList(offset, controller.signal); return () => controller.abort(); }, [offset]);
  useImperativeHandle(ref, () => ({ refresh: async (force = false) => {
    await loadList();
    // Background refresh never replaces a quote being edited or an uncertain save.
    if (force && !busyRef.current && !latest.current.pending && latest.current.version && JSON.stringify(latest.current.draft) === latest.current.saved) await open(latest.current.id, false);
  } }));

  function update(patch: Partial<LotQuoteDraft>) {
    if (busyRef.current || latest.current.pending) return;
    setEditor(value => ({ ...value, draft: { ...value.draft, ...patch } })); setMessage("");
  }
  function editLine(id: string, patch: Partial<LotQuoteLine>) {
    update({ lines: latest.current.draft.lines.map(row => row.id === id ? { ...row, ...patch } : row) });
  }
  function discardAllowed() {
    return !busyRef.current && ((!dirty && !editor.pending) || window.confirm("Hay cambios sin guardar o un guardado sin confirmar. ¿Descartar el borrador local y abrir otro presupuesto?"));
  }
  async function open(id: string, ask = true) {
    if (ask && !discardAllowed()) return;
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const value = await request<LotQuote>(`/lot-quotes/${id}`);
      const { id: quoteId, version, createdAt: _created, updatedAt: _updated, ...draft } = value;
      setEditor({ id: quoteId, version, draft, saved: JSON.stringify(draft), pending: null });
      setMessage("Presupuesto guardado abierto."); setResults(null);
    } catch (next) { setError(next instanceof Error ? next.message : "No se pudo abrir el presupuesto."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function save() {
    if (busyRef.current) return;
    let body: SaveLotQuote;
    try { body = latest.current.pending || { requestId: crypto.randomUUID(), version: latest.current.version, draft: normalizeLotQuote(latest.current.draft) }; }
    catch (next) { setError(next instanceof Error ? next.message : "Revisa los datos."); return; }
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    setEditor(value => ({ ...value, pending: body }));
    try {
      const value = await request<LotQuote>(`/lot-quotes/${latest.current.id}`, { method: "PUT", body });
      const { id, version, createdAt: _created, updatedAt: _updated, ...draft } = value;
      setEditor({ id, version, draft, saved: JSON.stringify(draft), pending: null });
      setMessage("Presupuesto guardado."); void loadList();
    } catch (next) {
      setError(`${next instanceof Error ? next.message : "No se pudo confirmar el guardado."} Reintenta el mismo guardado; tu borrador se conserva. Para resolver un conflicto, exportalo y abri la version guardada.`);
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function find(event: React.FormEvent) {
    event.preventDefault(); search.current?.abort();
    if (query.trim().length < 2) { setSearchError("Escribi al menos dos caracteres."); return; }
    const controller = new AbortController(); search.current = controller; setSearchBusy(true); setSearchError(""); setResults(null);
    try {
      const result = await request<{ entries: CatalogPickerEntry[] }>(`/catalog-cards?query=${encodeURIComponent(query.trim())}&languageGroup=${language}&limit=30&includeStatus=false`, { signal: controller.signal });
      if (!controller.signal.aborted) setResults(result.entries);
    } catch (next) { if (!controller.signal.aborted) setSearchError(next instanceof Error ? next.message : "No se pudo buscar. Intenta nuevamente."); }
    finally { if (!controller.signal.aborted) setSearchBusy(false); }
  }
  function add(entry: CatalogPickerEntry) {
    if (editor.draft.lines.length >= 1000) { setError("El presupuesto admite hasta 1000 filas."); return; }
    const price = entry.loosePriceUsd === null ? null : round(entry.loosePriceUsd * (editor.draft.currency === "ARS" ? editor.draft.exchangeRate : 1));
    const row: LotQuoteLine = { ...blankLine(cleanCatalogPickerName(entry)), expansion: entry.expansionName, number: entry.cardNumber,
      language: entry.language || (entry.languageGroup === "japanese" ? "JA" : entry.languageGroup === "chinese" ? "ZH" : "EN"),
      finish: entry.finish || entry.tcgplayerSubtype || "normal", imageUrl: entry.imageUrl || entry.imageFallbackUrl || "",
      sourceUrl: entry.canonicalUrl, sourceName: catalogSourceLabel(entry), sourceUpdatedAt: entry.importedAt || "", referencePrice: price, unitPrice: price };
    update({ lines: [...latest.current.draft.lines, row] });
    setMessage(`${row.name} agregada al lote.`);
  }
  function changeCurrency(currency: "ARS" | "USD") {
    const old = editor.draft;
    if (currency === old.currency) return;
    if (!Number.isFinite(old.exchangeRate) || old.exchangeRate <= 0) { setError("Ingresa una cotizacion valida antes de convertir."); return; }
    if (old.lines.length && !window.confirm(`¿Convertir los precios actuales a ${currency} usando ${old.exchangeRate} ARS por USD?`)) return;
    const factor = currency === "ARS" ? old.exchangeRate : 1 / old.exchangeRate;
    update({ currency, lines: old.lines.map(row => ({ ...row, referencePrice: row.referencePrice === null ? null : round(row.referencePrice * factor), unitPrice: row.unitPrice === null ? null : round(row.unitPrice * factor) })) });
  }
  function exportCsv() {
    try {
      const csv = lotQuoteCsv(normalizeLotQuote(editor.draft));
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `presupuesto-${editor.id}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (next) { setError(next instanceof Error ? next.message : "Revisa el presupuesto antes de exportar."); }
  }
  async function copy() {
    try {
      const draft = normalizeLotQuote(editor.draft), total = lotQuoteTotals(draft);
      const lines = draft.lines.map(row => `• ${row.quantity}x ${row.name}${row.number ? ` #${row.number}` : ""}${row.expansion ? ` — ${row.expansion}` : ""} (${row.language}/${row.condition}/${row.finish}): ${row.unitPrice === null ? "precio pendiente" : format(row.unitPrice) + " c/u"}${row.sourceUrl ? `\n${row.sourceUrl}` : ""}`);
      await navigator.clipboard.writeText(`${draft.name}\n\n${lines.join("\n")}\n\nReferencia${total.missingReference ? " parcial" : ""}: ${format(total.referenceTotal)}\nOferta de compra (${draft.purchasePercent}%): ${format(total.purchaseTotal)}\nVenta${total.missingSale ? " parcial" : ""}: ${format(total.saleTotal)}\n${total.units} unidades${total.missingReference || total.missingSale ? " · Hay precios pendientes" : ""}\nCambio guardado: ${draft.exchangeRate} ARS/USD${draft.notes ? `\n${draft.notes}` : ""}`);
      setMessage("Resumen copiado.");
    } catch (next) { setError(next instanceof Error ? next.message : "No se pudo copiar. Usa Exportar CSV."); }
  }

  return <section className="view lot-quotes" aria-labelledby="quote-heading">
    <header className="quote-heading"><div><span className="quote-eyebrow">MESA DE COTIZACION</span><h2 id="quote-heading"><Calculator size={25} />Presupuestador de lotes</h2><p>Arma el lote, revisa su valor y defini cuanto ofrecer o cobrar.</p></div>
      <button className="secondary-action" disabled={busy} onClick={() => { if (discardAllowed()) { setEditor(fresh(currentRate)); setError(""); setMessage(""); setResults(null); titleInput.current?.focus(); } }}><FilePlus2 size={17} />Nuevo lote</button></header>
    <div className="quote-workspace">
      <aside className="quote-saved panel"><div className="quote-saved-title"><h3>Presupuestos</h3><button className="icon-action" aria-label="Actualizar presupuestos" disabled={listBusy} onClick={() => void loadList()}><RotateCcw size={16} /></button></div>
        {listBusy ? <p role="status">Cargando presupuestos…</p> : null}
        {listError ? <p role="alert" className="quote-error">{listError} <button onClick={() => void loadList()}>Reintentar</button></p> : null}
        {page?.items.length ? <ul>{page.items.map(item => <li key={item.id}><button disabled={busy} className={editor.id === item.id ? "selected" : ""} onClick={() => void open(item.id)}><strong>{item.name}</strong><span>{item.lineCount} filas · {item.currency}{item.status === "archived" ? " · Archivado" : ""}</span><small>{date(item.updatedAt)}</small></button></li>)}</ul> : !listBusy && !listError ? <p className="muted">Todavia no hay presupuestos guardados.</p> : null}
        <div className="quote-pages"><button className="secondary-action" disabled={listBusy || !offset} onClick={() => setOffset(Math.max(0, offset - 30))}>Anterior</button><span>{page?.total || 0}</span><button className="secondary-action" disabled={listBusy || !page || offset + page.limit >= page.total} onClick={() => setOffset(offset + 30)}>Siguiente</button></div>
      </aside>
      <div className="quote-main">
        <section className="panel quote-editor">
          <div className="quote-editor-top"><div><h3>{editor.draft.name || "Lote sin nombre"}</h3><span className={`quote-save-state ${dirty ? "unsaved" : ""}`}>{dirty ? "Cambios sin guardar" : <><Check size={13} />Guardado · version {editor.version}</>}</span></div><div className="quote-actions"><button className="secondary-action" onClick={exportCsv}><Download size={16} />CSV</button><button className="secondary-action" onClick={() => void copy()}><Copy size={16} />Copiar resumen</button><button className="primary-action" disabled={busy || (!dirty && !editor.pending)} onClick={() => void save()}>{busy ? <LoaderCircle className="quote-spin" size={16} /> : <Save size={16} />}{editor.pending && !busy ? "Reintentar guardado" : "Guardar presupuesto"}</button></div></div>
          {error ? <div role="alert" className="quote-error">{error}{editor.version || editor.pending ? <button className="secondary-action" disabled={busy} onClick={() => void open(editor.id)}>Abrir version guardada</button> : null}</div> : null}
          {message ? <p role="status" className="quote-message">{message}</p> : null}
          <fieldset disabled={locked} className="quote-settings"><label>Nombre del lote<input ref={titleInput} maxLength={160} value={editor.draft.name} onChange={event => update({ name: event.target.value })} /></label><label>Moneda<select value={editor.draft.currency} onChange={event => changeCurrency(event.target.value as "ARS" | "USD")}><option value="ARS">ARS</option><option value="USD">USD</option></select></label><label>ARS por USD<input type="number" min="0.01" max="1000000" step="0.01" value={editor.draft.exchangeRate || ""} onChange={event => update({ exchangeRate: Number(event.target.value) })} /></label><label>Oferta de compra (%)<input type="number" min="0" max="100" step="0.01" value={editor.draft.purchasePercent} onChange={event => update({ purchasePercent: Number(event.target.value) })} /></label></fieldset>
          <p className="quote-help">El porcentaje se aplica a la referencia del lote. Cambiar la cotizacion afecta las nuevas cartas; los precios ya cargados se conservan. Cambiar la moneda convierte todos los importes.</p>
          <div className="quote-totals"><div><span>Unidades</span><strong>{totals.units.toLocaleString("es-AR")}</strong><small>{editor.draft.lines.length} filas</small></div><div><span>Valor de referencia{totals.missingReference ? " · parcial" : ""}</span><strong>{format(totals.referenceTotal)}</strong><small>{totals.missingReference ? `${totals.missingReference} unidades sin referencia` : "Referencia del lote completo"}</small></div><div className="quote-offer"><span>Oferta de compra · {editor.draft.purchasePercent}%{totals.missingReference ? " · parcial" : ""}</span><strong>{format(totals.purchaseTotal)}</strong><small>Sobre la referencia conocida</small></div><div><span>Presupuesto de venta{totals.missingSale ? " · parcial" : ""}</span><strong>{format(totals.saleTotal)}</strong><small>{totals.missingSale ? `${totals.missingSale} unidades sin precio` : "Suma de precios de venta"}</small></div></div>
        </section>
        <section className="panel quote-add"><h3>Agregar al lote</h3><form className="quote-search" onSubmit={event => void find(event)}><label>Buscar carta, expansion o numero<input value={query} maxLength={160} placeholder="Ej.: Pikachu 025" onChange={event => { search.current?.abort(); setSearchBusy(false); setResults(null); setQuery(event.target.value); }} /></label><label>Idioma<select value={language} onChange={event => { search.current?.abort(); setSearchBusy(false); setResults(null); setLanguage(event.target.value); }}><option value="all">Todos</option><option value="english">Ingles</option><option value="japanese">Japones</option><option value="chinese">Chino</option></select></label><button className="secondary-action" disabled={searchBusy || query.trim().length < 2}><Search size={16} />{searchBusy ? "Buscando…" : "Buscar"}</button></form>
          {searchError ? <p role="alert" className="quote-error">{searchError}</p> : null}
          {results ? <div className="quote-search-results" aria-live="polite">{results.length ? results.map((entry, index) => <article key={`${entry.priceChartingId}-${index}`}><QuoteImage url={entry.imageUrl} name={entry.productName} /><div><strong>{entry.productName}</strong><span>{entry.expansionName} #{entry.cardNumber} · {entry.language || entry.languageGroup} · {entry.finish || entry.tcgplayerSubtype || "normal"}</span><small>{catalogSourceLabel(entry)} · {entry.loosePriceUsd === null ? "Sin precio" : money(entry.loosePriceUsd, "USD")} · {date(entry.importedAt)}</small></div><button className="secondary-action" disabled={locked} onClick={() => add(entry)} aria-label={`Agregar ${entry.productName}`}><Plus size={16} />Agregar</button></article>) : <p>Sin resultados. Proba otra busqueda o agrega una fila manual.</p>}</div> : null}
          <form className="quote-manual" onSubmit={event => { event.preventDefault(); if (!manualName.trim() || locked) return; if (editor.draft.lines.length >= 1000) { setError("El presupuesto admite hasta 1000 filas."); return; } update({ lines: [...latest.current.draft.lines, blankLine(manualName.trim())] }); setManualName(""); }}><label>O agregar una carta / producto manual<input maxLength={240} placeholder="Nombre de la carta o producto" value={manualName} disabled={locked} onChange={event => setManualName(event.target.value)} /></label><button className="secondary-action" disabled={locked || !manualName.trim()}><Plus size={16} />Fila manual</button></form>
          <p className="quote-help">Precios del catalogo guardados como referencia, con fuente y fecha. Revisa edicion, acabado e idioma; no son una tasacion en vivo.</p>
        </section>
        <section className="panel quote-lines"><div className="quote-lines-heading"><h3>Contenido del lote <span>{editor.draft.lines.length}</span></h3><span>Importes unitarios en {editor.draft.currency}</span></div>
          {!editor.draft.lines.length ? <div className="quote-empty"><Calculator size={36} /><h3>Tu proximo lote empieza aca</h3><p>Busca cartas en el catalogo o agrega una fila manual. Vas a ver cada imagen y el valor total mientras lo armas.</p></div> : editor.draft.lines.map((row, index) => <article className="quote-line" key={row.id} aria-label={`Fila ${index + 1}: ${row.name}`}>
            <div className="quote-line-image"><QuoteImage url={row.imageUrl} name={row.name} /></div>
            <div className="quote-line-identity"><strong>{row.name}</strong><span>{row.expansion || "Sin expansion"}{row.number ? ` #${row.number}` : ""}</span><small>{row.language} / {row.condition} / {row.finish}</small>{/^https?:\/\//i.test(row.sourceUrl) ? <a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName || "Fuente"} ↗</a> : <small>{row.sourceName}</small>}<small>{date(row.sourceUpdatedAt)}</small></div>
            <fieldset disabled={locked} className="quote-line-prices"><label>Cantidad<input aria-label={`Cantidad fila ${index + 1}`} type="number" min="1" max="10000" step="1" value={row.quantity || ""} onChange={event => editLine(row.id, { quantity: Number(event.target.value) })} /></label><label>Referencia c/u<input aria-label={`Referencia fila ${index + 1}`} type="number" min="0" step="0.01" max="100000000" placeholder="Pendiente" value={row.referencePrice ?? ""} onChange={event => editLine(row.id, { referencePrice: event.target.value === "" ? null : Number(event.target.value) })} /></label><label>Venta c/u<input aria-label={`Venta fila ${index + 1}`} type="number" min="0" step="0.01" max="100000000" placeholder="Pendiente" value={row.unitPrice ?? ""} onChange={event => editLine(row.id, { unitPrice: event.target.value === "" ? null : Number(event.target.value) })} /></label></fieldset>
            <div className="quote-line-total"><small>Venta subtotal</small><strong>{row.unitPrice === null ? "Pendiente" : format(round(row.unitPrice * row.quantity))}</strong><button className="icon-action" disabled={locked} aria-label={`Quitar fila ${index + 1}`} onClick={() => update({ lines: editor.draft.lines.filter(item => item.id !== row.id) })}><Trash2 size={16} /></button></div>
            <details className="quote-line-details"><summary>Editar identidad, imagen y notas</summary><fieldset disabled={locked}>{([['name', 'Nombre'], ['expansion', 'Expansion'], ['number', 'Numero'], ['language', 'Idioma'], ['condition', 'Condicion'], ['finish', 'Acabado'], ['imageUrl', 'URL de imagen'], ['sourceUrl', 'Enlace de fuente'], ['notes', 'Notas de la fila']] as const).map(([key, label]) => <label key={key}>{label}<input type={key.endsWith("Url") ? "url" : "text"} value={row[key]} onChange={event => editLine(row.id, { [key]: event.target.value })} /></label>)}</fieldset></details>
          </article>)}
          <fieldset className="quote-final-settings" disabled={locked}><label>Notas del presupuesto<textarea maxLength={4000} rows={3} placeholder="Vendedor, condiciones, vigencia o aclaraciones" value={editor.draft.notes} onChange={event => update({ notes: event.target.value })} /></label><label>Estado<select value={editor.draft.status} onChange={event => update({ status: event.target.value as LotQuoteDraft["status"] })}><option value="draft">Borrador</option><option value="archived">Archivado</option></select></label></fieldset>
        </section>
      </div>
    </div>
  </section>;
});
