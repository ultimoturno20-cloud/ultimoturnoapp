import { useCallback, useEffect, useRef, useState } from "react";
import { mobileIntakeRequestPath, type MobileIntakePage, type MobileIntakeStatus } from "@ultimoturno/domain";
import type { ApiOptions } from "./admin-api.js";

type Props = {
  active: boolean; scope: string;
  request: <T>(path: string, options?: ApiOptions) => Promise<T>;
  readAndApply: <T>(load: () => Promise<T>, apply: (value: T) => void) => Promise<void>;
  revision: () => number;
};
type Controls = { scope: string; status: MobileIntakeStatus; query: string; limit: number; cursors: Array<string | null> };
const initial = (scope: string): Controls => ({ scope, status: "all", query: "", limit: 25, cursors: [null] });

export function useMobileIntakePage(props: Props) {
  const [controls, setControls] = useState<Controls>(() => initial(props.scope));
  const current = controls.scope === props.scope ? controls : initial(props.scope);
  const config = useRef({ props, current }); config.current = { props, current };
  const [result, setResult] = useState<{ key: string; page: MobileIntakePage } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const boundary = useRef({ scope: props.scope, value: "" });
  const pending = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const applied = useRef("");
  const key = JSON.stringify(current);

  const load = useCallback((reset = false) => {
    const { props: input, current: chosen } = config.current;
    if (!input.active) return Promise.resolve();
    const target = reset ? { ...chosen, cursors: [null] } : chosen;
    if (reset) { config.current.current = target; setControls(target); }
    if (reset || target.cursors.length === 1 || boundary.current.scope !== input.scope) boundary.current = { scope: input.scope, value: "" };
    const targetKey = JSON.stringify(target);
    const requestKey = JSON.stringify([targetKey, input.revision()]);
    if (pending.current?.key === requestKey) return pending.current.promise;
    pending.current?.controller.abort();
    const controller = new AbortController();
    const entry = { key: requestKey, controller, promise: Promise.resolve() };
    pending.current = entry; setBusy(true); setError("");
    const path = mobileIntakeRequestPath({ ...target, asOf: boundary.current.value, cursor: target.cursors[target.cursors.length - 1] });
    entry.promise = input.readAndApply(() => input.request<MobileIntakePage>(path, { signal: controller.signal }), page => {
      if (pending.current !== entry || controller.signal.aborted || !config.current.props.active || JSON.stringify(config.current.current) !== targetKey) return;
      boundary.current = { scope: input.scope, value: page.asOf };
      setResult({ key: targetKey, page }); applied.current = requestKey;
    }).catch((failure: unknown) => {
      if (pending.current === entry && !controller.signal.aborted && !(failure instanceof Error && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "No se pudo cargar la pre-base.");
      throw failure;
    }).finally(() => { if (pending.current === entry) { pending.current = null; setBusy(false); } });
    return entry.promise;
  }, []);

  useEffect(() => {
    if (!props.active) { pending.current?.controller.abort(); pending.current = null; applied.current = ""; setBusy(false); return; }
    if (applied.current !== JSON.stringify([key, props.revision()])) void load().catch(() => undefined);
  }, [key, props.active, props.revision, load]);
  useEffect(() => () => { pending.current?.controller.abort(); pending.current = null; }, []);

  const change = useCallback((patch: Partial<Pick<Controls, "status" | "query" | "limit">>) => {
    pending.current?.controller.abort(); pending.current = null; applied.current = "";
    boundary.current = { scope: config.current.props.scope, value: "" };
    config.current.current = { ...config.current.current, ...patch, cursors: [null] };
    setControls(config.current.current); setResult(null); setError("");
  }, []);
  const page = result?.key === key ? result.page : null;
  const navigate = (next: boolean) => {
    if (busy || (next && !page?.nextCursor)) return;
    const cursors = next ? [...current.cursors, page!.nextCursor] : current.cursors.slice(0, -1);
    if (!cursors.length) return;
    pending.current?.controller.abort(); pending.current = null;
    config.current.current = { ...current, cursors }; setControls(config.current.current); setResult(null); setError("");
  };
  return { page, controls: current, busy: props.active && (busy || (!page && !error)), error, change, navigate, refresh: load };
}
