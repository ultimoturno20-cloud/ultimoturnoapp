import { useEffect, useState } from "react";
import { defaultMaultSyncConfig, inventoryTags, type MaultSyncConfig, type MaultCopyView } from "@ultimoturno/domain";
import type { ApiOptions } from "./admin-api.js";
import "./mault-panel.css";

type Status = { configured: boolean; config: MaultSyncConfig; version: number; baselineComplete: boolean; lastSyncAt: string | null; morePages: boolean; totals: Record<string, number> };
type Page = { copies: MaultCopyView[]; totals: Record<string, number>; offset: number; limit: number };
type Request = <T>(path: string, options?: ApiOptions) => Promise<T>;
const labels: Record<string, string> = { baseline: "Histórico", pending: "Pendiente", ready: "Preparada", review: "Revisar", imported: "Ingresada" };
export function MaultPanel({ request }: { request: Request }) {
  const [status, setStatus] = useState<Status | null>(null), [draft, setDraft] = useState(defaultMaultSyncConfig);
  const [version, setVersion] = useState(0), [page, setPage] = useState<Page | null>(null);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [filter, setFilter] = useState("all"), [offset, setOffset] = useState(0), [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState(false), [condition, setCondition] = useState(false);
  const [tagTexts, setTagTexts] = useState<Record<string,string>>({});
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  async function refresh(loadDraft = false) {
    const result = await request<Status>("/integrations/mault/status"); setStatus(result);
    if (loadDraft) { setDraft(result.config); setVersion(result.version); setTagTexts({}); }
    setPage(await request<Page>(`/integrations/mault/preview?status=${filter}&offset=${offset}`));
  }
  useEffect(() => {
    const controller = new AbortController();
    void request<Status>("/integrations/mault/status", { signal: controller.signal }).then(result => {
      setStatus(result); setDraft(result.config); setVersion(result.version);
    }).catch(error => { if (!controller.signal.aborted) setFeedback(error instanceof Error ? error.message : "No se pudo consultar Mault."); });
    return () => controller.abort();
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    void request<Page>(`/integrations/mault/preview?status=${filter}&offset=${offset}`, { signal: controller.signal }).then(setPage)
      .catch(error => { if (!controller.signal.aborted) setFeedback(error instanceof Error ? error.message : "No se pudo cargar la página."); });
    return () => controller.abort();
  }, [filter, offset, request]);
  async function act(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setFeedback("");
    try { await action(); } catch (error) { setFeedback(error instanceof Error ? error.message.replace(/^(GET|PUT|POST) .+ -> \d+: /, "") : "No se pudo completar. Recargá para comprobar el estado."); }
    finally { setBusy(false); }
  }
  const total = page ? filter === "all" ? Object.values(page.totals).reduce((a,b) => a+b,0) : page.totals[filter] || 0 : 0;
  return <section className="panel mault-panel" aria-label="Integración Mault">
    <div className="section-heading"><div><h3>Mault · ingreso de cartas</h3><p>{status?.configured ? "Conexión configurada" : "Conexión pendiente de configurar"}</p></div>
      <button type="button" className="secondary-action" disabled={busy} onClick={() => void act(() => refresh())}>Actualizar Mault</button></div>
    <p>Las copias nuevas se ingresan una sola vez cuando cumplen las condiciones. El histórico requiere selección y confirmación.</p>
    {feedback && <p className="mault-feedback" role="status">{feedback}</p>}
    {!status && <p>Cargando conexión…</p>}
    {status && <>
      <details><summary>Configurar conexión y colecciones</summary>
        <form onSubmit={event => { event.preventDefault(); void act(async () => {
          await request("/integrations/mault/config", { method: "PUT", body: { version, config: draft } });
          await refresh(true); setFeedback("Configuración guardada.");
        }); }}><fieldset disabled={busy}>
          <div className="mault-options">{([
            ["enabled", "Habilitar lectura de Mault"], ["autoImport", "Ingresar automáticamente copias nuevas preparadas"],
            ["requireReviewed", "Exigir aprobación en Mault"], ["requireStorage", "Exigir ubicación en storage"],
            ["acceptRecordedCondition", "Acepto la condición registrada en Mault (puede ser NM por defecto)"],
          ] as const).map(([key, label]) => <label className="mault-check" key={key}><input type="checkbox" checked={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.checked })}/>{label}</label>)}</div>
          <label>Precio único ARS para cartas nuevas (opcional)<input type="number" min={800} step={100} value={draft.newItemPriceArs ?? ""}
            onChange={event => setDraft({ ...draft, newItemPriceArs: event.target.value ? Number(event.target.value) : null })}/></label>
          <p>Solo completalo si querés ese mismo precio para todas las cartas nuevas. Si queda vacío, se conservan los precios existentes y las nuevas necesitan revisión.</p>
          <button type="button" className="secondary-action" disabled={!status.configured} onClick={() => void act(async () => {
            setCollections((await request<{ collections: Array<{ id: string; name: string }> }>("/integrations/mault/collections")).collections);
          })}>Consultar colecciones</button>
          <div className="mault-collections">{[...collections, ...draft.collections.filter(c => !collections.some(v => v.id === c.id)).map(c => ({ id: c.id, name: c.label }))].map(c => {
            const rule = draft.collections.find(r => r.id === c.id);
            return <div key={c.id}><label className="mault-check"><input type="checkbox" checked={Boolean(rule)} onChange={event => setDraft({ ...draft,
              collections: event.target.checked ? [...draft.collections, { id: c.id, label: c.name, tags: [c.name.toLowerCase()] }] : draft.collections.filter(r => r.id !== c.id) })}/>{c.name}</label>
              {rule && <label>Etiquetas para {c.name}<input value={tagTexts[c.id] ?? rule.tags.join(", ")} onChange={event => { const text = event.target.value;
                setTagTexts(previous => ({ ...previous, [c.id]: text })); setDraft({ ...draft, collections: draft.collections.map(r => r.id === c.id ? { ...r, tags: inventoryTags(text) } : r) }); }}/></label>}</div>;
          })}</div>
          <button type="submit" className="primary-action">Guardar Mault</button>
          <button type="button" className="secondary-action" onClick={() => void act(() => refresh(true))}>Descartar cambios</button>
        </fieldset></form>
      </details>
      <div className="mault-summary">{Object.entries(status.totals).map(([key, count]) => <span key={key}>{labels[key] || key}: <strong>{count}</strong></span>)}</div>
      <div className="mault-toolbar">
        <button type="button" className="primary-action" disabled={busy || !status.configured || !status.config.enabled} onClick={() => void act(async () => {
          const result = await request<{ imported: number; more: boolean }>("/integrations/mault/run", { method: "POST" });
          await refresh(); setFeedback(`${result.imported} copia(s) ingresadas. ${result.more ? "Quedan páginas por leer; podés continuar." : "Lectura al día."}`);
        })}>Sincronizar un lote</button>
        <label>Mostrar<select disabled={busy} value={filter} onChange={event => { setFilter(event.target.value); setOffset(0); }}><option value="all">Todas</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <p>{selected.length} seleccionada(s), máximo 10 por lote. La primera lectura no suma el histórico al stock.</p>
      <div className="mault-review-options"><label className="mault-check"><input type="checkbox" checked={condition} onChange={event => setCondition(event.target.checked)}/>Confirmo la condición de la selección</label>
        <label className="mault-check"><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)}/>Autorizar ingreso del histórico seleccionado</label></div>
      <div className="mault-toolbar"><button type="button" className="secondary-action" disabled={busy || !selected.length} onClick={() => void act(async () => {
        await request("/integrations/mault/prepare", { method: "POST", body: { copyIds: selected, conditionConfirmed: condition } }); await refresh(); setFeedback("Imágenes y datos de la selección comprobados. Revisá los pendientes.");
      })}>Verificar selección sin ingresar</button>
        <button type="button" className="primary-action" disabled={busy || !selected.length} onClick={() => void act(async () => {
          const result = await request<{ imported: number; repeated: number }>("/integrations/mault/apply", { method: "POST", body: { copyIds: selected, confirmHistory: history, conditionConfirmed: condition } });
          setSelected([]); await refresh(); setFeedback(`${result.imported} ingresada(s); ${result.repeated} ya estaban ingresadas.`);
        })}>Ingresar selección</button></div>
      {!page && <p>Cargando copias…</p>}
      <div className="mault-copy-list">{page?.copies.map(row => <article key={row.copyId}>
        <label className="mault-check"><input type="checkbox" aria-label={`Seleccionar ${row.copy.name}`} checked={selected.includes(row.copyId)} disabled={busy || (!selected.includes(row.copyId) && selected.length >= 10)}
          onChange={event => setSelected(previous => event.target.checked ? [...previous, row.copyId] : previous.filter(id => id !== row.copyId))}/>
          <strong>{row.copy.name}</strong></label>
        <div className="mault-copy-detail">{row.resolved && !failedImages.has(row.resolved.imageUrl) ? <img loading="lazy" src={row.resolved.imageUrl} alt={`${row.copy.name} · ${row.copy.language}`} onError={() => setFailedImages(previous => new Set([...previous, row.resolved!.imageUrl]))}/> : <span className="mault-no-image">{row.resolved ? "No se pudo cargar la imagen" : "Imagen pendiente"}</span>}
          <div><p>{row.copy.setName || row.copy.setCode} · {row.copy.number}</p><p>{row.copy.language} · {row.copy.condition} · {row.copy.sourceFoilType || "Normal"}{row.copy.stamp ? ` · ${row.copy.stamp}` : ""}</p>
            <p>Etiquetas de colección: {status.config.collections.find(c => c.id === row.copy.collectionId)?.tags.join(", ") || "Colección no habilitada"}</p>
            <p>{row.copy.location ? `${row.copy.location.name} · posición ${row.copy.location.position ?? "—"}` : "Sin storage"}</p>
            <p><strong>{labels[row.status] || row.status}</strong>{row.reasons.length ? ` · ${row.reasons.map(reason => ({ source_approval_required: "Falta aprobar en Mault", source_storage_required: "Falta asignar storage", condition_confirmation_required: "Falta confirmar condición", source_needs_review: "Mault pide revisión", unsupported_game: "Juego no compatible", import_requires_review: "Revisar precio o datos antes de ingresar", stamp_not_reported: "Mault no informó la estampa", collection_not_enabled: "Colección no habilitada", source_unavailable: "No se pudo consultar esta copia en Mault", identity_changed_after_import: "La identidad cambió después del ingreso" }[reason] || reason)).join(", ")}` : ""}</p></div>
        </div>
        {!row.appliedAt && <MaultManualImage row={row} request={request} busy={busy} act={act} refresh={() => refresh()}/>}
      </article>)}</div>
      {page && !page.copies.length && <p>No hay copias en esta vista.</p>}
      <div className="mault-toolbar"><button type="button" className="secondary-action" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Anterior</button>
        <span>{total ? `${offset + 1}–${Math.min(offset + 50, total)} de ${total}` : "0 copias"}</span>
        <button type="button" className="secondary-action" disabled={busy || offset + 50 >= total} onClick={() => setOffset(offset + 50)}>Siguiente</button></div>
    </>}
  </section>;
}

function MaultManualImage({ row, request, busy, act, refresh }: { row: MaultCopyView; request: Request; busy: boolean; act: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  const [url, setUrl] = useState(""), [confirmed, setConfirmed] = useState(false);
  return <details><summary>Confirmar imagen manualmente</summary><label>URL de imagen del idioma correcto<input type="url" value={url} onChange={event => setUrl(event.target.value)}/></label>
    <label className="mault-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Verifiqué edición, idioma, acabado y estampa de esta imagen</label>
    <button type="button" className="secondary-action" disabled={busy || !url || !confirmed} onClick={() => void act(async () => {
      await request("/integrations/mault/verify-image", { method: "POST", body: { copyId: row.copyId, imageUrl: url, confirmIdentity: true, stamp: row.copy.stamp } });
      setConfirmed(false); await refresh();
    })}>Confirmar imagen</button></details>;
}
