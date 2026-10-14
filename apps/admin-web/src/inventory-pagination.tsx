import { ChevronLeft, ChevronRight } from "lucide-react";
export function InventoryPagination(props: {
  offset: number; limit: number; total: number; busy: boolean;
  navigate: (offset: number) => void; changeLimit: (limit: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(props.total / props.limit));
  return <nav className="inventory-pagination" aria-label="Paginas de inventario">
    <span>{props.total ? `${props.offset + 1} - ${Math.min(props.offset + props.limit, props.total)} de ${props.total.toLocaleString("es-AR")}` : "0 resultados"}</span>
    <div>
      <label>Por pagina<select aria-label="Cartas por pagina" value={props.limit} disabled={props.busy} onChange={event => props.changeLimit(Number(event.target.value))}><option value={24}>24</option><option value={48}>48</option><option value={96}>96</option></select></label>
      <button className="icon-action" type="button" title="Pagina anterior" aria-label="Pagina anterior" disabled={props.busy || props.offset === 0} onClick={() => props.navigate(props.offset - props.limit)}><ChevronLeft size={18} /></button>
      <span>{Math.floor(props.offset / props.limit) + 1} / {pages}</span>
      <button className="icon-action" type="button" title="Pagina siguiente" aria-label="Pagina siguiente" disabled={props.busy || props.offset + props.limit >= props.total} onClick={() => props.navigate(props.offset + props.limit)}><ChevronRight size={18} /></button>
    </div>
  </nav>;
}
