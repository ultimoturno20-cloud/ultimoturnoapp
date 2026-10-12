import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { defaultStoreCatalogQuery, normalizeStoreCatalogQuery, type StoreCatalogItem, type StoreCatalogPage, type StoreCatalogQuery } from "@ultimoturno/domain";
import "./storefront.css";
import { retireLegacyStockWorker } from "./legacy-stock-worker.js";

const typeLabels: Record<string, string> = { pokemon: "Pokemon", supporter: "Supporter", item: "Item", stadium: "Stadium", tool: "Tool", energy: "Energy", unknown: "Sin clasificar" };
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const variant = (item: StoreCatalogItem) => [item.language, item.condition, item.finish, [item.gradingCompany, item.grade].filter(Boolean).join(" ")].filter(Boolean).join(" / ");

function StoreImage({ item }: { item: StoreCatalogItem }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.imageUrl]);
  return item.imageUrl && !failed ? <img src={item.imageUrl} alt={item.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span className="shop-image-missing">Sin imagen</span>;
}

function Storefront() {
  const [query, setQuery] = useState<StoreCatalogQuery>(() => normalizeStoreCatalogQuery(Object.fromEntries(new URLSearchParams(window.location.search))));
  const [page, setPage] = useState<StoreCatalogPage | null>(null);
  const [facets, setFacets] = useState<StoreCatalogPage["facets"]>({ expansions: [], languages: [], conditions: [], cardTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<StoreCatalogItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [field, value] of Object.entries(query)) {
      if (value === defaultStoreCatalogQuery[field as keyof StoreCatalogQuery]) url.searchParams.delete(field);
      else url.searchParams.set(field, String(value));
    }
    window.history.replaceState({}, "", url);
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true); setError(""); setPage(null);
      try {
        const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
        const response = await fetch(`/api/store/catalog?${params}`, { credentials: "omit", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo cargar el catalogo.");
        const data: StoreCatalogPage = await response.json();
        if (controller.signal.aborted) return;
        if (query.offset > 0 && query.offset >= data.total) { setQuery(current => ({ ...current, offset: 0 })); return; }
        setPage(data);
        setFacets(data.facets);
      } catch (nextError) { if (!controller.signal.aborted) setError(nextError instanceof Error ? nextError.message : "No se pudo cargar el catalogo."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 240);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, refreshKey]);
  useEffect(() => {
    const onBack = () => setQuery(normalizeStoreCatalogQuery(Object.fromEntries(new URLSearchParams(window.location.search))));
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected) dialog.current?.close();
  }, [selected]);
  const change = (patch: Partial<StoreCatalogQuery>) => setQuery(current => ({ ...current, ...patch, offset: 0 }));
  const facetSelect = (field: "expansion" | "language" | "condition" | "cardType", label: string, values: string[]) => <label>{label}<select aria-label={label} value={query[field]} onChange={event => change({ [field]: event.target.value })}><option value="all">{field === "language" || field === "cardType" ? "Todos" : "Todas"}</option>{values.map(value => <option value={value} key={value}>{field === "cardType" ? typeLabels[value] || value : value}</option>)}</select></label>;
  return <>
    <header className="shop-header"><div><a className="shop-brand" href="/"><img src="/brand/ultimo-turno-logo.jpeg" width="48" height="48" alt="" /><h1>UltimoTurno</h1></a><span>Tienda</span></div></header>
    <main className="shop-main">
      <div className="shop-heading"><h2>Catalogo</h2><span className="shop-order-state">Pedidos online no habilitados</span></div>
      <form className="shop-controls" aria-label="Filtros de catalogo" onSubmit={event => event.preventDefault()}>
        <label className="shop-search">Buscar<input type="search" aria-label="Buscar en la tienda" maxLength={120} placeholder="Carta, expansion o numero" value={query.query} onChange={event => change({ query: event.target.value })} /></label>
        <label>Orden<select aria-label="Ordenar catalogo" value={query.sort} onChange={event => change({ sort: event.target.value as StoreCatalogQuery["sort"] })}><option value="name">Nombre</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option></select></label>
        <button type="button" className="shop-reset" onClick={() => setQuery({ ...defaultStoreCatalogQuery })}>Restablecer</button>
        <div className="shop-filters">
          {facetSelect("expansion", "Expansion", facets.expansions)}
          {facetSelect("language", "Idioma", facets.languages)}
          {facetSelect("condition", "Condicion", facets.conditions)}
          {facetSelect("cardType", "Tipo de carta", facets.cardTypes)}
        </div>
      </form>
      <div className="shop-result-count" role="status">{loading ? "Cargando catalogo..." : page?.items.length ? `${page.offset + 1}-${page.offset + page.items.length} de ${page.total} articulos` : "0 articulos"}</div>
      {error ? <div className="shop-empty" role="alert"><h3>No pudimos cargar el catalogo</h3><p>Intenta nuevamente en unos momentos.</p><button type="button" onClick={() => setRefreshKey(key => key + 1)}>Reintentar</button></div> : null}
      {!loading && !error && page && !page.items.length ? <section className="shop-empty"><h3>{query.query || [query.expansion, query.language, query.condition, query.cardType].some(value => value !== "all") ? "Sin coincidencias" : "Sin articulos disponibles"}</h3></section> : null}
      <section className="shop-grid" aria-label="Articulos" aria-busy={loading}>
        {page?.items.map(item => <article className="shop-product" key={item.id}>
          <button className="shop-product-preview" type="button" aria-label={`Ver ${item.name}`} onClick={() => setSelected(item)}>
            <div className="shop-product-image"><StoreImage item={item} /></div>
            <h3>{item.name}</h3><span className="shop-product-expansion">{item.expansion}{item.number ? ` #${item.number}` : ""}</span><small>{variant(item)}</small>
          </button>
          <div className="shop-product-price"><strong>{money.format(item.priceArs)}</strong><span>{item.availableQuantity} disponible{item.availableQuantity === 1 ? "" : "s"}</span></div>
        </article>)}
      </section>
      {page && page.total > page.pageSize ? <nav className="shop-pagination" aria-label="Paginas de catalogo"><button type="button" disabled={loading || page.offset === 0} onClick={() => setQuery(current => ({ ...current, offset: Math.max(0, current.offset - page.pageSize) }))}>Anterior</button><span>Pagina {Math.floor(page.offset / page.pageSize) + 1} de {Math.ceil(page.total / page.pageSize)}</span><button type="button" disabled={loading || page.offset + page.pageSize >= page.total} onClick={() => setQuery(current => ({ ...current, offset: current.offset + page.pageSize }))}>Siguiente</button></nav> : null}
    </main>
    <footer className="shop-footer"><span>UltimoTurno</span><span>Catalogo en ARS</span></footer>
    <dialog ref={dialog} className="shop-detail" aria-label="Detalle del articulo" onCancel={() => setSelected(null)} onClose={() => setSelected(null)}>
      <button type="button" className="shop-close" aria-label="Cerrar detalle" onClick={() => setSelected(null)} autoFocus>&times;</button>
      {selected ? <div className="shop-detail-content"><div className="shop-detail-image"><StoreImage item={selected} /></div><div><h2>{selected.name}</h2><p>{selected.expansion}{selected.number ? ` #${selected.number}` : ""}</p><dl><div><dt>Idioma</dt><dd>{selected.language}</dd></div><div><dt>Condicion</dt><dd>{selected.condition}</dd></div><div><dt>Acabado</dt><dd>{selected.finish}</dd></div><div><dt>Tipo</dt><dd>{selected.itemKind === "folder" ? "Carpeta" : typeLabels[selected.cardType] || selected.cardType}</dd></div>{selected.grade ? <div><dt>Grading</dt><dd>{selected.gradingCompany} {selected.grade}</dd></div> : null}</dl><strong className="shop-detail-price">{money.format(selected.priceArs)}</strong><span>{selected.availableQuantity} disponible{selected.availableQuantity === 1 ? "" : "s"}</span></div></div> : null}
    </dialog>
  </>;
}

void retireLegacyStockWorker().catch(() => undefined);
createRoot(document.getElementById("root") as HTMLElement).render(<Storefront />);
