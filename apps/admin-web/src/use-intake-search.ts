import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogPickerEntry, IntakeSearchQuery, IntakeSearchResult } from "@ultimoturno/domain";
import type { ApiOptions } from "./admin-api.js";

type Props = IntakeSearchQuery & {
  active: boolean; revision: string;
  request: <T>(path: string, options?: ApiOptions) => Promise<T>;
  readAndApply: <T>(load: () => Promise<T>, apply: (value: T) => void) => Promise<void>;
};
export function useIntakeSearch(props: Props) {
  const key = JSON.stringify([props.query.trim(), props.languageGroup, props.revision]);
  const config = useRef({ props, key }); config.current = { props, key };
  const [result, setResult] = useState<{ key: string; entries: CatalogPickerEntry[]; error: string; warning: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const search = useCallback(() => {
    window.clearTimeout(timer.current); timer.current = undefined;
    const { props: input, key: chosen } = config.current;
    if (!input.active || input.query.trim().length < 2) return Promise.resolve();
    if (pending.current?.key === chosen) return pending.current.promise;
    pending.current?.controller.abort();
    const controller = new AbortController(), entry = { key: chosen, controller, promise: Promise.resolve() };
    pending.current = entry; setBusy(true);
    setResult({ key: chosen, entries: [], error: "", warning: "" });
    const params = new URLSearchParams({ query: input.query.trim(), languageGroup: input.languageGroup });
    entry.promise = input.readAndApply(() => input.request<IntakeSearchResult>("/inventory/intake-search?" + params, { signal: controller.signal }), value => {
      if (pending.current !== entry || controller.signal.aborted || config.current.key !== chosen || !config.current.props.active) return;
      setResult({ key: chosen, entries: value.entries, warning: value.warning || "", error: "" });
    }).catch((failure: unknown) => {
      if (pending.current === entry && !controller.signal.aborted && config.current.key === chosen && !(failure instanceof Error && failure.name === "AbortError")) {
        setResult({ key: chosen, entries: [], warning: "", error: failure instanceof Error ? failure.message : "No se pudo buscar. Volve a intentar." });
      }
    }).finally(() => { if (pending.current === entry) { pending.current = null; setBusy(false); } });
    return entry.promise;
  }, []);
  useEffect(() => {
    pending.current?.controller.abort(); pending.current = null; setBusy(false);
    if (!props.active) setResult(null);
    if (props.active && props.query.trim().length >= 2) timer.current = window.setTimeout(() => { void search(); }, 100);
    return () => { window.clearTimeout(timer.current); pending.current?.controller.abort(); pending.current = null; };
  }, [key, props.active, search]);
  const current = result?.key === key ? result : null;
  const valid = props.query.trim().length >= 2;
  return {
    entries: props.active && valid ? current?.entries || [] : [],
    busy: props.active && valid && (busy || !current),
    error: props.active ? valid ? current?.error || "" : props.query.trim() ? "Escribi al menos 2 caracteres." : "" : "",
    warning: props.active && valid ? current?.warning || "" : "", search
  };
}
