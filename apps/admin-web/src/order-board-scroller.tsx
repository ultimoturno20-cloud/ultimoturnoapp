import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { orderBoardScrollMetrics } from "./order-board-scroll.js";
import "./order-board-scroller.css";

export function OrderBoardScroller({ boardKey, label, children }: { boardKey: string; label: string; children: ReactNode }) {
  const board = useRef<HTMLDivElement>(null);
  const id = useId();
  const [scroll, setScroll] = useState({ maximum: 0, position: 0 });

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    element.scrollLeft = 0;
    const update = () => {
      const next = orderBoardScrollMetrics(element);
      setScroll(current => current.maximum === next.maximum && current.position === next.position ? current : next);
    };
    const resize = new ResizeObserver(update);
    const observe = () => {
      resize.disconnect();
      resize.observe(element);
      for (const column of element.children) resize.observe(column);
      update();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(element, { childList: true });
    element.addEventListener("scroll", update, { passive: true });
    observe();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [boardKey]);

  const move = (direction: number) => {
    const element = board.current;
    if (!element) return;
    const width = element.firstElementChild?.getBoundingClientRect().width || element.clientWidth;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * (width + gap), behavior: "instant" });
  };

  return <div className="order-board-scroller">
    <div className="order-board-scroll-controls" hidden={scroll.maximum <= 0} role="group" aria-label="Desplazamiento del tablero">
      <button type="button" className="icon-action" aria-label="Columnas anteriores" title="Columnas anteriores" disabled={scroll.position <= 0} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
      <input type="range" aria-label="Desplazar columnas de ordenes" aria-controls={id} aria-valuetext={`${Math.round(scroll.maximum ? scroll.position / scroll.maximum * 100 : 0)}% del tablero`} min={0} max={Math.max(1, scroll.maximum)} step={1} value={scroll.position} onChange={event => { if (board.current) { board.current.scrollLeft = Number(event.target.value); setScroll(orderBoardScrollMetrics(board.current)); } }} />
      <button type="button" className="icon-action" aria-label="Columnas siguientes" title="Columnas siguientes" disabled={scroll.position >= scroll.maximum} onClick={() => move(1)}><ChevronRight size={18} /></button>
    </div>
    <div className="trello-board" ref={board} id={id} role="region" aria-label={label} tabIndex={scroll.maximum > 0 ? 0 : undefined}>{children}</div>
  </div>;
}
