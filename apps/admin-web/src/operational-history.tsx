import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { historyRequestPath, type HistoryPage, type HistoryQuery } from "@ultimoturno/domain";
import type { ApiOptions } from "./admin-api.js";
import { WorkspaceToolbar } from "./workspace-toolbar.js";
import "./operational-history.css";

export type OperationalHistoryHandle = { refresh: (reset?: boolean) => Promise<void> };
type Props = {
  request: <T>(path: string, options?: ApiOptions) => Promise<T>;
  readAndApply: <T>(load: () => Promise<T>, apply: (value: T) => void) => Promise<void>;
  revision: () => number;
  invalidate: () => void;
  movementLabel: (value: string) => string;
  auditLabel: (value: string) => string;
};
type Controls = Pick<HistoryQuery, "kind" | "query" | "action" | "from" | "to" | "limit"> & { cursors: Array<string | null> };
const initialControls: Controls = { kind: "stock", query: "", action: "", from: "", to: "", limit: 50, cursors: [null] };
const formatDate = (value: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const formatDelta = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("es-AR")}`;

function HistoryPagination({ page, controls, busy, navigate, compact = false }: { page: HistoryPage | null; controls: Controls; busy: boolean; navigate: (next: boolean) => void; compact?: boolean }) {
  const start = (controls.cursors.length - 1) * controls.limit;
  return <nav className={`history-pagination ${compact ? "compact" : ""}`} aria-label={compact ? "Navegacion del historial" : "Paginas del historial"}>
    {!compact ? <span>{page?.items.length ? `${start + 1} - ${start + page.items.length} de ${page.matchedTotal.toLocaleString("es-AR")}` : ""}</span> : null}
    <div><button type="button" className="icon-action" title="Pagina anterior" aria-label="Pagina anterior" disabled={busy || controls.cursors.length < 2} onClick={() => navigate(false)}><ChevronLeft size={18} /></button><span>Pagina {controls.cursors.length}</span><button type="button" className="icon-action" title="Pagina siguiente" aria-label="Pagina siguiente" disabled={busy || !page?.nextCursor} onClick={() => navigate(true)}><ChevronRight size={18} /></button></div>
  </nav>;
}

export const OperationalHistoryView = forwardRef<OperationalHistoryHandle, Props>(function OperationalHistoryView(props, ref) {
  const [controls, setControls] = useState<Controls>(initialControls);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState<HistoryPage | null>(null);
  const boundary = useRef("");
  const pending = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadNonce, setLoadNonce] = useState(0);
  const configKey = JSON.stringify(controls);
  const results = useRef<HTMLDivElement>(null);
  const scrollAfterNavigation = useRef(false);

  const load = useCallback(() => {
    const current = controlsRef.current;
    const key = JSON.stringify([current, props.revision()]);
    if (pending.current?.key === key) return pending.current.promise;
    pending.current?.controller.abort();
    const controller = new AbortController();
    const entry = { key, controller, promise: Promise.resolve() };
    pending.current = entry;
    setBusy(true); setError("");
    const path = historyRequestPath({ ...current, asOf: boundary.current, cursor: current.cursors[current.cursors.length - 1] });
    entry.promise = props.readAndApply(() => props.request<HistoryPage>(path, { signal: controller.signal }), (value) => {
      if (pending.current !== entry || controller.signal.aborted || JSON.stringify(controlsRef.current) !== JSON.stringify(current)) return;
      boundary.current = value.asOf;
      setPage(value);
      if (scrollAfterNavigation.current) {
        scrollAfterNavigation.current = false;
        window.requestAnimationFrame(() => results.current?.scrollIntoView({ block: "start" }));
      }
    }).catch((failure: unknown) => {
      if (pending.current === entry && !controller.signal.aborted && !(failure instanceof Error && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "No se pudo cargar el historial.");
      throw failure;
    }).finally(() => {
      if (pending.current === entry) { pending.current = null; setBusy(false); }
    });
    return entry.promise;
  }, [props.request, props.readAndApply, props.revision]);

  const refresh = useCallback((reset = false) => {
    if (reset) {
      pending.current?.controller.abort(); pending.current = null;
      scrollAfterNavigation.current = false;
      controlsRef.current = { ...controlsRef.current, cursors: [null] };
      setControls(controlsRef.current);
      setPage(null);
    }
    if (reset || controlsRef.current.cursors.length === 1) boundary.current = "";
    return load();
  }, [load]);
  useImperativeHandle(ref, () => ({ refresh }), [refresh]);
  useEffect(() => { void load().catch(() => undefined); }, [configKey, loadNonce, load]);
  useEffect(() => () => { pending.current?.controller.abort(); pending.current = null; }, []);

  const change = useCallback((patch: Partial<Controls>) => {
    pending.current?.controller.abort(); pending.current = null;
    boundary.current = "";
    scrollAfterNavigation.current = false;
    controlsRef.current = { ...controlsRef.current, ...patch, cursors: [null] };
    setControls(controlsRef.current); setPage(null); setError("");
    setLoadNonce(value => value + 1);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (draft.trim() !== controlsRef.current.query) change({ query: draft.trim() }); }, 250);
    return () => window.clearTimeout(timer);
  }, [change, draft]);
  const navigate = (next: boolean) => {
    if (busy || (next && !page?.nextCursor)) return;
    const cursors = next ? [...controls.cursors, page!.nextCursor] : controls.cursors.slice(0, -1);
    if (!cursors.length) return;
    pending.current?.controller.abort(); pending.current = null;
    scrollAfterNavigation.current = true;
    controlsRef.current = { ...controls, cursors };
    setControls(controlsRef.current); setPage(null);
  };
  const retry = () => { props.invalidate(); void refresh(true).catch(() => undefined); };
  const label = controls.kind === "stock" ? props.movementLabel : props.auditLabel;

  return <section className="view operational-history" aria-busy={busy}>
    <div className="section-heading">
      <h2>Movimientos</h2>
      <div className="mode-toggle activity-toggle" role="tablist" aria-label="Historial">
        <button role="tab" aria-selected={controls.kind === "stock"} className={controls.kind === "stock" ? "active" : ""} onClick={() => change({ kind: "stock", action: "" })}>Stock</button>
        <button role="tab" aria-selected={controls.kind === "system"} className={controls.kind === "system" ? "active" : ""} onClick={() => change({ kind: "system", action: "" })}>Cambios del sistema</button>
      </div>
    </div>
    <WorkspaceToolbar className="history-toolbar" label="Filtros del historial"
      search={<label className="history-search"><Search size={16} aria-hidden="true" /><input aria-label="Buscar en historial" maxLength={160} placeholder={controls.kind === "stock" ? "Carta, SKU o nota..." : "Actor, entidad o referencia..."} value={draft} onChange={event => setDraft(event.target.value)} /></label>}
      actions={<button type="button" className="icon-action" title="Restablecer filtros" aria-label="Restablecer filtros del historial" onClick={() => { setDraft(""); change({ ...initialControls, kind: controls.kind }); }}><RotateCcw size={16} /></button>}>
      <label>Tipo<select aria-label="Tipo de movimiento" value={controls.action} onChange={event => change({ action: event.target.value })}><option value="">Todos</option>{(page?.actions || []).map(action => <option key={action.value} value={action.value}>{label(action.value)} ({action.count})</option>)}{controls.action && !page?.actions.some(action => action.value === controls.action) ? <option value={controls.action}>{label(controls.action)}</option> : null}</select></label>
      <label>Desde<input type="date" aria-label="Historial desde" value={controls.from} onChange={event => change({ from: event.target.value })} /></label>
      <label>Hasta<input type="date" aria-label="Historial hasta" value={controls.to} onChange={event => change({ to: event.target.value })} /></label>
      <label>Por pagina<select aria-label="Registros por pagina" value={controls.limit} onChange={event => change({ limit: Number(event.target.value) })}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
    </WorkspaceToolbar>
    <div className="history-summary" aria-live="polite">
      <span>{page ? `${page.matchedTotal.toLocaleString("es-AR")} ${page.matchedTotal === 1 ? "resultado" : "resultados"} de ${page.total.toLocaleString("es-AR")} ${page.total === 1 ? "registro" : "registros"}` : busy ? "Cargando..." : ""}</span>
      {page?.netQuantity !== null && page?.netQuantity !== undefined ? <span>Variacion neta: <strong>{formatDelta(page.netQuantity)}</strong></span> : null}
      <HistoryPagination compact page={page} controls={controls} busy={busy} navigate={navigate} />
    </div>
    {error ? <div className="history-error" role="alert"><span>{error}</span><button type="button" className="secondary-action" disabled={busy} onClick={retry}><RotateCcw size={16} />Reintentar</button></div> : null}
    <div ref={results} className="history-results" role="tabpanel" aria-label={controls.kind === "stock" ? "Movimientos de stock" : "Cambios del sistema"}>
      {!page && busy ? <div className="history-empty" role="status"><LoaderCircle className="history-spinner" size={22} />Cargando historial...</div> : page && !page.items.length ? <div className="history-empty">Sin resultados</div> : page ? <div className="history-table-scroll"><table className="history-table">
        <thead><tr><th>{controls.kind === "stock" ? "Movimiento / carta" : "Cambio / entidad"}</th><th>{controls.kind === "stock" ? "Cantidad" : "Usuario"}</th><th>Fecha</th><th>{controls.kind === "stock" ? "Nota" : "Referencia"}</th></tr></thead>
        <tbody>{page.items.map(row => <tr key={row.id} data-history-id={row.id}>
          <td><strong>{label(row.action)}</strong><span>{controls.kind === "stock" ? row.itemName || row.sku : row.entityType}</span>{controls.kind === "stock" ? <small>{row.sku}</small> : null}</td>
          <td className={row.quantityDelta !== null ? `history-quantity ${row.quantityDelta > 0 ? "positive" : row.quantityDelta < 0 ? "negative" : ""}` : ""}>{row.quantityDelta === null ? row.actorName || "Sistema" : formatDelta(row.quantityDelta)}</td>
          <td><time dateTime={new Date(row.createdAt).toISOString()}>{formatDate(row.createdAt)}</time></td>
          <td>{controls.kind === "stock" ? row.note || "Sin nota" : row.entityId}</td>
        </tr>)}</tbody>
      </table></div> : null}
    </div>
    <HistoryPagination page={page} controls={controls} busy={busy} navigate={navigate} />
  </section>;
});
