import { ChevronLeft, ChevronRight } from "lucide-react";
import type { useMobileIntakePage } from "./use-mobile-intake-page.js";
import "./mobile-intake-pagination.css";

export type MobileIntakePaging = ReturnType<typeof useMobileIntakePage>;
export function MobileIntakePagination({ paging }: { paging: MobileIntakePaging }) {
  const { controls, page, busy, navigate } = paging;
  const start = (controls.cursors.length - 1) * controls.limit;
  return <nav className="mobile-intake-pagination" aria-label="Paginas de capturas">
    <span>{page ? page.entries.length ? `${start + 1} - ${start + page.entries.length} de ${page.matchedTotal} capturas` : "0 capturas" : busy ? "Cargando capturas..." : ""}</span>
    <div>
      <button type="button" className="icon-action" aria-label="Pagina anterior de capturas" title="Pagina anterior" disabled={busy || controls.cursors.length < 2} onClick={() => navigate(false)}><ChevronLeft size={18} /></button>
      <span>Pagina {controls.cursors.length}</span>
      <button type="button" className="icon-action" aria-label="Pagina siguiente de capturas" title="Pagina siguiente" disabled={busy || !page?.nextCursor} onClick={() => navigate(true)}><ChevronRight size={18} /></button>
    </div>
  </nav>;
}
