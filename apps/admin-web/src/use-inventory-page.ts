import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inventoryRequestPath, type InventoryFilters, type InventoryPage, type InventoryQueryItem } from "@ultimoturno/domain";
import type { ApiOptions } from "./admin-api.js";
import { inventoryPageStorage, readInventoryPagePosition, writeInventoryPagePosition } from "./inventory-page-position.js";

type Props<T> = {
  active: boolean; scope: string; filters: InventoryFilters; keepIds: string[]; fallback: T[];
  request: <R>(path: string, options?: ApiOptions) => Promise<R>;
  readAndApply: <R>(load: () => Promise<R>, apply: (value: R) => void) => Promise<void>;
  revision: () => number;
};
export function useInventoryPage<T extends InventoryQueryItem>(props: Props<T>) {
  const filterKey = JSON.stringify([props.scope, props.filters]);
  const [controls, setControls] = useState(() => ({ scope: props.scope, ...readInventoryPagePosition(inventoryPageStorage(), props.scope, filterKey) }));
  const current = controls.scope !== props.scope
    ? { scope: props.scope, ...readInventoryPagePosition(inventoryPageStorage(), props.scope, filterKey) }
    : { ...controls, filterKey, offset: controls.filterKey === filterKey ? controls.offset : 0 };
  const config = useRef({ props, current }); config.current = { props, current };
  const [page, setPage] = useState<InventoryPage<T> | null>(null);
  const [remembered, setRemembered] = useState<Map<string, T>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const applied = useRef("");
  const memoryScope = useRef(props.scope);
  const sameScope = memoryScope.current === props.scope;
  useEffect(() => {
    if (memoryScope.current === props.scope) return;
    pending.current?.controller.abort(); pending.current = null; applied.current = "";
    memoryScope.current = props.scope;
    setPage(null); setRemembered(new Map());
  }, [props.scope]);

  const readItems = useCallback(async (ids: string[], signal?: AbortSignal) => {
    const unique = [...new Set(ids)];
    const result: T[] = [];
    for (let offset = 0; offset < unique.length; offset += 64) {
      const data = await config.current.props.request<{ items: T[] }>("/inventory/items?ids=" + encodeURIComponent(unique.slice(offset, offset + 64).join(",")), { signal });
      result.push(...data.items);
    }
    return result;
  }, []);
  const remember = useCallback((item: T) => {
    setRemembered(previous => new Map(previous).set(item.id, item));
    setPage(previous => {
      if (!previous?.items.some(row => row.id === item.id && row !== item)) return previous;
      const next = { ...previous, items: previous.items.map(row => row.id === item.id ? item : row) };
      return next;
    });
  }, []);
  const keepKey = JSON.stringify(props.keepIds);
  useEffect(() => {
    const keep = new Set<string>(JSON.parse(keepKey));
    setRemembered(previous => {
      if ([...previous.keys()].every(id => keep.has(id))) return previous;
      return new Map([...previous].filter(([id]) => keep.has(id)));
    });
  }, [keepKey]);

  const load = useCallback((fresh = false) => {
    const { props: input, current: chosen } = config.current;
    if (!input.active) return Promise.resolve();
    const target = { ...chosen };
    const key = JSON.stringify([target, input.revision(), fresh]);
    if (pending.current?.key === key) return pending.current.promise;
    pending.current?.controller.abort();
    const controller = new AbortController();
    const entry = { key, controller, promise: Promise.resolve() };
    pending.current = entry;
    setBusy(true); setError("");
    entry.promise = input.readAndApply(async () => {
      // Each response is a complete fresh page; the API clamps an obsolete offset.
      const value = await input.request<InventoryPage<T>>(inventoryRequestPath(input.filters, target.offset, target.limit) + (fresh ? "&fresh=1" : ""), { signal: controller.signal });
      const keep = config.current.props.keepIds.filter(id => !value.items.some(item => item.id === id));
      const retained = await readItems(keep, controller.signal);
      return { value, retained };
    }, ({ value, retained }) => {
      if (pending.current !== entry || controller.signal.aborted || !config.current.props.active ||
        config.current.current.filterKey !== target.filterKey || config.current.current.offset !== chosen.offset ||
        config.current.current.limit !== target.limit) return;
      const next = { ...target, offset: value.offset };
      config.current.current = next;
      setControls(next); setPage(value);
      setRemembered(previous => {
        const next = new Map(previous);
        for (const item of [...retained, ...value.items]) if (config.current.props.keepIds.includes(item.id)) next.set(item.id, item);
        return next;
      });
      applied.current = JSON.stringify([next, input.revision(), false]);
    }).catch((failure: unknown) => {
      if (pending.current === entry && !controller.signal.aborted && !(failure instanceof Error && failure.name === "AbortError")) {
        setError(failure instanceof Error ? failure.message : "No se pudo cargar el inventario.");
      }
      throw failure;
    }).finally(() => { if (pending.current === entry) { pending.current = null; setBusy(false); } });
    return entry.promise;
  }, [readItems]);

  const configKey = JSON.stringify(current);
  useEffect(() => {
    if (props.active) writeInventoryPagePosition(inventoryPageStorage(), props.scope, current);
  }, [props.active, props.scope, configKey]);
  useEffect(() => {
    if (!props.active) {
      pending.current?.controller.abort(); pending.current = null; applied.current = ""; setBusy(false);
      return;
    }
    const key = JSON.stringify([config.current.current, props.revision(), false]);
    if (applied.current !== key) void load().catch(() => undefined);
  }, [props.active, configKey, load, props.revision]);
  useEffect(() => () => { pending.current?.controller.abort(); pending.current = null; }, []);

  const contextItems = useMemo(() => {
    if (!sameScope) return [];
    const keep = new Set(props.keepIds);
    const rows = new Map(props.fallback.filter(item => keep.has(item.id)).map(item => [item.id, item]));
    for (const item of page?.items || []) rows.set(item.id, item);
    for (const [id, item] of remembered) if (keep.has(id)) rows.set(id, item);
    return [...rows.values()];
  }, [keepKey, props.fallback, remembered, page, sameScope]);

  const navigate = (offset: number) => {
    if (busy) return;
    const next = { ...config.current.current, offset: Math.max(0, offset) };
    pending.current?.controller.abort(); pending.current = null;
    config.current.current = next; setControls(next);
  };
  const changeLimit = (limit: number) => {
    const next = { ...config.current.current, offset: 0, limit };
    pending.current?.controller.abort(); pending.current = null;
    config.current.current = next; setControls(next);
  };
  const scope = async <R,>(kind: "ids" | "all") => {
    const input = config.current.props;
    const expected = config.current.current.filterKey;
    let result!: R;
    await input.readAndApply(() => input.request<R>(inventoryRequestPath(input.filters, 0, 24, kind)), value => {
      if (config.current.current.filterKey !== expected || !config.current.props.active) throw new DOMException("Busqueda reemplazada.", "AbortError");
      result = value;
    });
    return result;
  };
  const currentPage = page && controls.filterKey === filterKey && page.offset === current.offset && page.limit === current.limit ? page : null;
  const visibleError = sameScope ? error : "";
  return {
    page: sameScope ? currentPage : null, metadata: sameScope ? page?.metadata : undefined, contextItems,
    busy: busy || (props.active && !currentPage && !visibleError), error: visibleError,
    matchedTotal: page && controls.filterKey === filterKey ? page.matchedTotal : 0,
    total: sameScope ? page?.total || 0 : 0,
    offset: current.offset, limit: current.limit, navigate, changeLimit, remember, readItems,
    refresh: load,
    readFreshItems: async (ids: string[]) => {
      let items: T[] = [];
      await config.current.props.readAndApply(() => readItems(ids), value => { items = value; });
      return items;
    },
    selectAll: () => scope<{ ids: string[] }>("ids").then(value => value.ids),
    exportAll: () => scope<{ items: T[] }>("all").then(value => value.items)
  };
}
