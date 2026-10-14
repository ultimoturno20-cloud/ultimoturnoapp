export type ApiOptions = { token?: string; method?: string; body?: unknown; signal?: AbortSignal; skipSession?: boolean };

type RevalidatedRead = { etag: string; payload: unknown };

export function createAdminApi(config: { url: (path: string) => string; session: () => string; fetch?: typeof fetch }) {
  const fetchRequest = config.fetch ?? globalThis.fetch.bind(globalThis);
  const pending = new Map<string, Promise<unknown>>();
  const revalidated = new Map<string, RevalidatedRead>();
  const writes = new Set<Promise<void>>();
  let revision = 0;
  let freshStock = false;

  function invalidate() {
    revision += 1;
    freshStock = true;
    revalidated.clear();
    pending.clear();
  }

  function checkSession(session: string, options: ApiOptions) {
    options.signal?.throwIfAborted();
    if (!options.skipSession && !options.token && config.session() !== session) {
      throw new DOMException("La sesion cambio durante la lectura.", "AbortError");
    }
  }

  async function waitForWrites(signal?: AbortSignal) {
    while (writes.size) {
      signal?.throwIfAborted();
      const settled = Promise.all([...writes]);
      if (!signal) { await settled; continue; }
      await new Promise<void>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        settled.then(() => resolve()).finally(() => signal.removeEventListener("abort", abort));
        if (signal.aborted) abort();
      });
    }
    signal?.throwIfAborted();
  }

  async function send(path: string, options: ApiOptions, token: string, cached?: RevalidatedRead) {
    const method = options.method || "GET";
    const url = config.url(path);
    const response = await fetchRequest(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal
    });
    if (response.status === 304 && cached) return { payload: cached.payload, etag: cached.etag };
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`${method} ${url} -> ${response.status}: ${String(payload.error || response.statusText || `Error ${response.status}`)}`);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    return { payload, etag: response.headers.get("etag") || "" };
  }

  async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const session = options.skipSession ? "" : config.session();
    const token = options.token || session;
    if ((options.method || "GET") !== "GET") {
      // Writes are never replayed, including failures with an unknown commit outcome.
      invalidate();
      let finish!: () => void;
      const barrier = new Promise<void>((resolve) => { finish = resolve; });
      writes.add(barrier);
      try { return (await send(path, options, token)).payload as T; }
      finally { invalidate(); writes.delete(barrier); finish(); }
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await waitForWrites(options.signal);
      checkSession(session, options);
      const startedAt = revision;
      const readPath = path === "/stock" && freshStock ? "/stock?fresh=1" : path;
      const cacheKey = JSON.stringify([config.url("/stock"), token]);
      const cached = readPath === "/stock" ? revalidated.get(cacheKey) : undefined;
      const key = JSON.stringify([config.url(readPath), token, startedAt]);
      const existing = options.signal ? undefined : pending.get(key);
      const read = existing ?? send(readPath, options, token, cached).then((result) => {
        checkSession(session, options);
        if (revision === startedAt && (readPath === "/stock" || readPath === "/stock?fresh=1")) {
          if (result.etag) revalidated.set(cacheKey, result);
          freshStock = false;
        }
        return result.payload;
      });
      if (!existing && !options.signal) pending.set(key, read);
      try {
        const result = await read;
        checkSession(session, options);
        if (revision === startedAt) return result as T;
      } catch (error) {
        checkSession(session, options);
        if (revision === startedAt) throw error;
      } finally {
        if (pending.get(key) === read) pending.delete(key);
      }
    }
    throw new Error("Los datos cambiaron durante la recarga. Volve a actualizar el sector.");
  }

  async function readAndApply<T>(load: () => Promise<T>, apply: (value: T) => void) {
    const session = config.session();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await waitForWrites();
      checkSession(session, {});
      const startedAt = revision;
      const result = await load();
      checkSession(session, {});
      // A batch can contain a member resolved before a write while another was pending.
      if (revision !== startedAt) continue;
      apply(result);
      return;
    }
    throw new Error("Los datos cambiaron durante la recarga. Volve a actualizar el sector.");
  }

  return { request, readAndApply, invalidate, revision: () => revision };
}
