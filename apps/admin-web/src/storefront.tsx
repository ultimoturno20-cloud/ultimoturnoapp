import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDownRight, ArrowLeft, ArrowRight, Banknote, Check, ChevronDown, Grid2X2, List, RotateCcw, Search, ShoppingCart, SlidersHorizontal, X } from "lucide-react";
import { defaultStoreCatalogQuery, normalizeStoreCatalogQuery, storeCategories, storeCategoryLabels, type StoreCategory, type StoreCatalogItem, type StoreCatalogPage, type StoreCatalogQuery } from "@ultimoturno/domain";
import { activeStoreFilters, matchingStoreExpansions, removeStoreFilter, storeLanguageLabel, storeTypeLabels } from "./storefront-filters.js";
import "./storefront.css";
import { retireLegacyStockWorker } from "./legacy-stock-worker.js";
import { useStoreCart, StoreCartButton, StoreCartDialog } from "./store-cart.js";
import { useStoreAdmin, StoreAdminAccess, StoreEditPriceButton, StorePriceEditor } from "./store-admin.js";
import { storePriceChangeKey } from "./store-admin-state.js";
import type { StoreAdminPrice } from "@ultimoturno/domain";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const variant = (item: StoreCatalogItem) => [item.language, item.condition, item.finish, [item.gradingCompany, item.grade].filter(Boolean).join(" ")].filter(Boolean).join(" / ");

function StoreImage({ item }: { item: StoreCatalogItem }) {
  const [image,setImage] = useState<{url: string | null; status: "loading" | "ready" | "failed"}>({url:item.imageUrl,status:"loading"});
  const status=image.url===item.imageUrl?image.status:"loading";
  return item.imageUrl && status!=="failed" ? <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={status==="ready"?"shop-image-loaded":"shop-image-loading"} onLoad={()=>setImage({url:item.imageUrl,status:"ready"})} onError={()=>setImage({url:item.imageUrl,status:"failed"})} /> : <span className="shop-image-missing">Sin imagen</span>;
}

function CatalogFilters({ query, facets, change, reset }: { query: StoreCatalogQuery; facets: StoreCatalogPage["facets"]; change: (patch: Partial<StoreCatalogQuery>) => void; reset: () => void }) {
  const [expansionSearch, setExpansionSearch] = useState("");
  const expansions = query.expansion !== "all" && !facets.expansions.includes(query.expansion) ? [query.expansion, ...facets.expansions] : facets.expansions;
  const facetSelect = (field: "language" | "condition" | "cardType", label: string, values: string[]) => {
    const options = query[field] !== "all" && !values.includes(query[field]) ? [query[field], ...values] : values;
    return <label className="shop-filter-select"><span className={field === "cardType" ? "shop-sr-only" : undefined}>{label}</span><select aria-label={label} value={query[field]} onChange={event => change({ [field]: event.target.value })}><option value="all">{field === "condition" ? "Todas" : "Todos"}</option>{options.map(value => <option value={value} key={value}>{field === "cardType" ? storeTypeLabels[value] || value : field === "language" ? storeLanguageLabel(value) : value}</option>)}</select></label>;
  };
  return <form className="shop-filter-form" aria-label="Filtros de catalogo" onSubmit={event => event.preventDefault()}>
    <details open className="shop-filter-group"><summary>Expansion<ChevronDown aria-hidden="true" /></summary>
      <label className="shop-expansion-search"><Search aria-hidden="true" /><input type="search" aria-label="Buscar expansion" maxLength={120} placeholder="Buscar expansion..." value={expansionSearch} onChange={event => setExpansionSearch(event.target.value)} /></label>
      <fieldset className="shop-expansion-options"><legend className="shop-sr-only">Expansion</legend>
        <label><input type="radio" name="expansion" value="all" checked={query.expansion === "all"} onChange={() => change({ expansion: "all" })} /><span>Todas las expansiones</span></label>
        {matchingStoreExpansions(expansions, expansionSearch).map(value => <label key={value}><input type="radio" name="expansion" value={value} checked={query.expansion === value} onChange={() => change({ expansion: value })} /><span>{value}</span></label>)}
      </fieldset>
      {expansionSearch && !matchingStoreExpansions(expansions, expansionSearch).length ? <p className="shop-filter-empty">Sin coincidencias</p> : null}
    </details>
    <details open className="shop-filter-group"><summary>Variante<ChevronDown aria-hidden="true" /></summary>{facetSelect("language", "Idioma", facets.languages)}{facetSelect("condition", "Condicion", facets.conditions)}</details>
    {query.category === "singles" ? <details open className="shop-filter-group"><summary>Tipo de carta<ChevronDown aria-hidden="true" /></summary>{facetSelect("cardType", "Tipo de carta", facets.cardTypes)}</details> : null}
    <button type="button" className="shop-reset" onClick={() => { setExpansionSearch(""); reset(); }}><RotateCcw aria-hidden="true" />Restablecer</button>
  </form>;
}

function Storefront() {
  const cart = useStoreCart();
  const access = useStoreAdmin();
  const [priceItem,setPriceItem] = useState<StoreCatalogItem|null>(null);
  const returnDetail = useRef<StoreCatalogItem|null>(null);
  const [query, setQuery] = useState<StoreCatalogQuery>(() => normalizeStoreCatalogQuery(Object.fromEntries(new URLSearchParams(window.location.search))));
  const [page, setPage] = useState<StoreCatalogPage | null>(null);
  const [facets, setFacets] = useState<StoreCatalogPage["facets"]>({ expansions: [], languages: [], conditions: [], cardTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<StoreCatalogItem | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const filtersDialog = useRef<HTMLDialogElement>(null);
  const catalog = useRef<HTMLElement>(null);
  const activeFilters = activeStoreFilters(query);
  function openPrice(item:StoreCatalogItem,fromDetail=false){returnDetail.current=fromDetail?item:null;setSelected(null);setPriceItem(item);}
  function closePrice(){setPriceItem(null);if(returnDetail.current){setSelected(returnDetail.current);returnDetail.current=null;}}
  function savedPrice(price:StoreAdminPrice){
    setPage(page=>page?{...page,items:page.items.map(item=>item.id===price.id?{...item,priceArs:price.priceArs}:item)}:page);
    if(returnDetail.current?.id===price.id)returnDetail.current={...returnDetail.current,priceArs:price.priceArs};
    if(!cart.pending)cart.setLines(lines=>lines.map(line=>line.item.id===price.id?{...line,item:{...line.item,priceArs:price.priceArs}}:line));
    cart.setNotice(`Precio guardado: ${money.format(price.priceArs)}.`);setRefreshKey(value=>value+1);
  }
  useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===storePriceChangeKey)setRefreshKey(value=>value+1);};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
  useEffect(()=>{if(!access.admin){setPriceItem(null);returnDetail.current=null;}},[access.admin]);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [field, value] of Object.entries(query)) {
      if (value === defaultStoreCatalogQuery[field as keyof StoreCatalogQuery]) url.searchParams.delete(field);
      else url.searchParams.set(field, String(value));
    }
    window.history.replaceState({}, "", url);
    const controller = new AbortController();
    setLoading(true); setError("");
    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
        const response = await fetch(`/api/store/catalog?${params}`, { credentials: "omit", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo cargar el catalogo.");
        const data: StoreCatalogPage = await response.json();
        if (controller.signal.aborted) return;
        if (query.offset > 0 && query.offset >= data.total) { setQuery(current => ({ ...current, offset: 0 })); return; }
        setPage(data); setFacets(data.facets);
      } catch (nextError) { if (!controller.signal.aborted) setError(nextError instanceof Error ? nextError.message : "No se pudo cargar el catalogo."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 240);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, refreshKey]);
  useEffect(() => {
    const onBack = () => { setSelected(null); setQuery(normalizeStoreCatalogQuery(Object.fromEntries(new URLSearchParams(window.location.search)))); };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const onResize = () => { setNarrow(media.matches); if (!media.matches) setFiltersOpen(false); };
    media.addEventListener("change", onResize);
    return () => media.removeEventListener("change", onResize);
  }, []);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected) dialog.current?.close();
  }, [selected]);
  useEffect(() => {
    if (filtersOpen && narrow && !filtersDialog.current?.open) filtersDialog.current?.showModal();
    else if (!filtersOpen) filtersDialog.current?.close();
  }, [filtersOpen, narrow]);
  useEffect(() => {
    if (!selected && !filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [selected, filtersOpen]);
  const change = (patch: Partial<StoreCatalogQuery>) => setQuery(current => normalizeStoreCatalogQuery({ ...current, ...patch, offset: 0 }));
  const reset = () => setQuery({ ...defaultStoreCatalogQuery });
  const goToCatalog = () => catalog.current?.scrollIntoView({ block: "start" });
  const selectCategory = (category: StoreCategory | "all") => { setQuery({ ...defaultStoreCatalogQuery, category }); goToCatalog(); };
  const filters = <CatalogFilters query={query} facets={facets} change={change} reset={reset} />;
  return <>
    <div className="shop-announcement"><span>Pokemon TCG · Cartas y coleccion</span><span>{cart.settings.enabled ? "Pedidos web · Pago manual" : "Pedidos web pausados"}</span></div>
    <header className="shop-header"><div className="shop-header-inner">
      <a className="shop-brand" href="/"><img src="/brand/ultimo-turno-logo.jpeg" width="56" height="56" alt="" /><span><strong>ULTIMO TURNO</strong><small>POKEMON TCG</small></span></a>
      <form className="shop-search" role="search" onSubmit={event => { event.preventDefault(); goToCatalog(); }}><Search aria-hidden="true" /><input type="search" aria-label="Buscar en la tienda" maxLength={120} placeholder="Buscar cartas, expansiones o sets..." value={query.query} onChange={event => change({ query: event.target.value })} /><button className="shop-icon-button" type="submit" aria-label="Buscar en el catalogo" title="Buscar en el catalogo"><ArrowRight aria-hidden="true" /></button></form>
      <div className="shop-header-actions"><span className="shop-currency"><Banknote aria-hidden="true" /><span>Moneda<strong>ARS</strong></span></span><StoreCartButton cart={cart}/><StoreAdminAccess access={access}/></div>
    </div>
      <nav className="shop-nav" aria-label="Categorias del catalogo"><div><button type="button" aria-current={query.category === "all" ? "page" : undefined} onClick={() => selectCategory("all")}>Todo el catalogo</button>{storeCategories.map(category => <button type="button" key={category} aria-current={query.category === category ? "page" : undefined} onClick={() => selectCategory(category)}>{storeCategoryLabels[category]}</button>)}<a href="/torneos">Torneos<ArrowDownRight aria-hidden="true" /></a></div></nav>
    </header>
    <main>
      <section className="shop-hero" aria-label="UltimoTurno Pokemon TCG"><div className="shop-hero-inner"><div className="shop-hero-copy"><span className="shop-eyebrow">POKEMON TRADING CARD GAME</span><h1>UltimoTurno</h1><p>Cartas para tu proxima jugada.<br />Piezas para tu coleccion.</p><a className="shop-primary-action" href="#catalogo">Explorar catalogo<ArrowDownRight aria-hidden="true" /></a></div></div></section>
      <section ref={catalog} id="catalogo" className="shop-main" aria-labelledby="shop-catalog-title">
        <div className="shop-heading"><div><span className="shop-eyebrow">LA SELECCION DE ULTIMO TURNO</span><h2 id="shop-catalog-title">Catalogo</h2></div><span className="shop-stock-note"><Check aria-hidden="true" />Stock disponible</span></div>
        <div className="shop-catalog-layout">
          {!narrow ? <aside className="shop-sidebar" aria-label="Filtrar catalogo"><div className="shop-sidebar-heading"><SlidersHorizontal aria-hidden="true" /><h3>Filtros</h3></div>{filters}</aside> : null}
          <div className="shop-results">
            <div className="shop-result-bar" data-loading={loading}><div className="shop-result-count" role="status">{loading ? "Cargando catalogo..." : error ? "Catalogo no disponible" : `${page?.total || 0} articulo${page?.total === 1 ? "" : "s"}`}{!loading && !error && page?.items.length ? <small>{page.offset + 1}-{page.offset + page.items.length} de {page.total}</small> : null}</div>
              <div className="shop-result-tools">{narrow ? <button type="button" className="shop-filter-toggle" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><SlidersHorizontal aria-hidden="true" />Filtros{activeFilters.length ? <span>{activeFilters.length}</span> : null}</button> : null}
                <div className="shop-view-control" role="group" aria-label="Vista del catalogo"><button type="button" className="shop-icon-button" aria-label="Vista en grilla" title="Vista en grilla" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 aria-hidden="true" /></button><button type="button" className="shop-icon-button" aria-label="Vista en lista" title="Vista en lista" aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" /></button></div>
                <label className="shop-order-label"><span className="shop-sr-only">Orden</span><select aria-label="Ordenar catalogo" value={query.sort} onChange={event => change({ sort: event.target.value as StoreCatalogQuery["sort"] })}><option value="name">Nombre</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option></select></label>
              </div>
            </div>
            {activeFilters.length ? <div className="shop-active-filters" aria-label="Filtros activos">{activeFilters.map(filter => <button type="button" key={filter.field} onClick={() => change(removeStoreFilter(filter.field))} title={`Quitar ${filter.label}`} aria-label={`Quitar filtro: ${filter.label}`}><span>{filter.label}</span><X aria-hidden="true" /></button>)}<button type="button" className="shop-clear-filters" onClick={reset}>Limpiar filtros</button></div> : null}
            {error ? <div className="shop-empty" role="alert"><h3>No pudimos cargar el catalogo</h3><p>Intenta nuevamente en unos momentos.</p><button type="button" className="shop-primary-action" onClick={() => setRefreshKey(key => key + 1)}><RotateCcw aria-hidden="true" />Reintentar</button></div> : null}
            {!loading && !error && page && !page.items.length ? <section className="shop-empty"><h3>{activeFilters.length ? "Sin coincidencias" : "Sin articulos disponibles"}</h3>{activeFilters.length ? <button type="button" className="shop-reset" onClick={reset}><RotateCcw aria-hidden="true" />Restablecer</button> : null}</section> : null}
            {!error ? <section className={`shop-grid ${view === "list" ? "shop-list" : ""}`} aria-label="Articulos" aria-busy={loading}>
              {!page && loading ? Array.from({ length: 6 }, (_, n) => <div className="shop-skeleton" aria-hidden="true" key={n}><span /><span /><span /></div>) : null}
              {page?.items.map((item,index) => <article className="shop-product" key={item.id} style={{"--shop-entry-delay":`${(index%6)*20}ms`} as React.CSSProperties}>
                <button className="shop-product-preview" type="button" disabled={loading} aria-label={`Ver ${item.name}`} onClick={() => setSelected(item)}><div className="shop-product-image"><StoreImage item={item} /></div></button>
                <div className="shop-product-copy"><div className="shop-product-badges"><span>{item.itemKind === "folder" ? "Carpeta" : item.language}</span>{item.finish && item.finish !== "normal" ? <span className="shop-finish">{item.finish}</span> : null}</div><h3 title={item.name}>{item.name}</h3><span className="shop-product-expansion">{item.expansion}{item.number ? ` #${item.number}` : ""}</span><small>{variant(item)}</small></div>
                <div className="shop-product-price"><strong>{money.format(item.priceArs)}</strong><div className="shop-product-availability"><span>{item.availableQuantity} disponible{item.availableQuantity === 1 ? "" : "s"}</span>{access.admin?<StoreEditPriceButton item={item} disabled={loading||access.checking} onClick={()=>openPrice(item)}/>:null}</div><div className="shop-product-actions"><button type="button" disabled={loading} className="shop-product-detail" onClick={() => setSelected(item)}>Ver detalle<ArrowRight aria-hidden="true" /></button><button type="button" className="shop-icon-button shop-add-cart" data-added={cart.feedback?.id===item.id} disabled={loading} title={cart.feedback?.id===item.id?"Agregado al carrito":"Agregar al carrito"} aria-label={`Agregar ${item.name} al carrito`} onClick={()=>cart.add(item)}>{cart.feedback?.id===item.id?<Check key={cart.feedback.version} aria-hidden="true"/>:<ShoppingCart aria-hidden="true"/>}</button></div></div>
              </article>)}
            </section> : null}
            {page && !error && page.total > page.pageSize ? <nav className="shop-pagination" aria-label="Paginas de catalogo"><button type="button" disabled={loading || page.offset === 0} onClick={() => { setQuery(current => ({ ...current, offset: Math.max(0, current.offset - page.pageSize) })); goToCatalog(); }}><ArrowLeft aria-hidden="true" />Anterior</button><span>Pagina {Math.floor(page.offset / page.pageSize) + 1} de {Math.ceil(page.total / page.pageSize)}</span><button type="button" disabled={loading || page.offset + page.pageSize >= page.total} onClick={() => { setQuery(current => ({ ...current, offset: current.offset + page.pageSize })); goToCatalog(); }}>Siguiente<ArrowRight aria-hidden="true" /></button></nav> : null}
          </div>
        </div>
      </section>
    </main>
    <footer className="shop-footer"><div><strong>ULTIMO TURNO</strong><span>Pokemon TCG · Cartas y coleccion</span></div><div><span>Precios en ARS</span><a href="#catalogo">Volver al catalogo<ArrowRight aria-hidden="true" /></a></div></footer>
    {narrow ? <dialog ref={filtersDialog} className="shop-filters-dialog" aria-label="Filtros del catalogo" onCancel={() => setFiltersOpen(false)} onClose={() => setFiltersOpen(false)}><div className="shop-modal-heading"><h2>Filtros</h2><button type="button" className="shop-icon-button" aria-label="Cerrar filtros" title="Cerrar filtros" autoFocus onClick={() => setFiltersOpen(false)}><X aria-hidden="true" /></button></div>{filters}<button type="button" className="shop-primary-action shop-apply-filters" onClick={() => setFiltersOpen(false)}>Ver resultados<ArrowRight aria-hidden="true" /></button></dialog> : null}
    <dialog ref={dialog} className="shop-detail" aria-label="Detalle del articulo" onCancel={() => setSelected(null)} onClose={() => setSelected(null)}>
      <button type="button" className="shop-close shop-icon-button" aria-label="Cerrar detalle" title="Cerrar detalle" onClick={() => setSelected(null)} autoFocus><X aria-hidden="true" /></button>
      {selected ? <div className="shop-detail-content"><div className="shop-detail-image"><StoreImage item={selected} /></div><div><span className="shop-eyebrow">{selected.itemKind === "folder" ? "CARPETA" : "POKEMON TCG"}</span><h2>{selected.name}</h2><p>{selected.expansion}{selected.number ? ` #${selected.number}` : ""}</p><dl><div><dt>Idioma</dt><dd>{storeLanguageLabel(selected.language)}</dd></div><div><dt>Condicion</dt><dd>{selected.condition}</dd></div><div><dt>Acabado</dt><dd>{selected.finish}</dd></div><div><dt>Tipo</dt><dd>{selected.itemKind === "folder" ? "Carpeta" : storeTypeLabels[selected.cardType] || selected.cardType}</dd></div>{selected.grade ? <div><dt>Grading</dt><dd>{selected.gradingCompany} {selected.grade}</dd></div> : null}</dl><span className="shop-detail-currency">Precio en ARS</span><div className="shop-detail-price-actions"><strong className="shop-detail-price">{money.format(selected.priceArs)}</strong>{access.admin?<StoreEditPriceButton item={selected} disabled={access.checking} onClick={()=>openPrice(selected,true)}/>:null}</div><span className="shop-detail-availability"><Check aria-hidden="true" />{selected.availableQuantity} disponible{selected.availableQuantity === 1 ? "" : "s"}</span></div></div> : null}
      {selected ? <button type="button" className="shop-primary-action" onClick={()=>{cart.add(selected);setSelected(null);}}><ShoppingCart/>Agregar al carrito</button> : null}
    </dialog>
    <StoreCartDialog cart={cart}/>
    {priceItem&&access.admin?<StorePriceEditor key={priceItem.id} item={priceItem} access={access} onClose={closePrice} onSaved={savedPrice}/>:null}
    {cart.notice?<div className="shop-cart-notice" role="status"><span>{cart.notice}</span><button type="button" className="shop-icon-button" aria-label="Cerrar aviso" title="Cerrar aviso" onClick={()=>cart.setNotice('')}><X/></button></div>:null}
  </>;
}

void retireLegacyStockWorker().catch(() => undefined);
createRoot(document.getElementById("root") as HTMLElement).render(<Storefront />);
