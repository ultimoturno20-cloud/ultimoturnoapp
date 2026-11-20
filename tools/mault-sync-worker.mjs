// Target API credentials only. The Mault key stays on the API server.
const base = new URL(process.env.ULTIMOTURNO_API_URL || "http://127.0.0.1:4000/");
if (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname))) throw new Error("La API destino debe usar HTTPS.");
if (base.username || base.password || base.search || base.hash) throw new Error("URL destino invalida.");
const accessKey = process.env.ULTIMOTURNO_ACCESS_KEY;
if (!accessKey) throw new Error("Falta ULTIMOTURNO_ACCESS_KEY del destino.");
const stop = new AbortController();
process.on("SIGINT", () => stop.abort()); process.on("SIGTERM", () => stop.abort());
const once = process.argv.includes("--once");
do {
  try {
    const url = new URL(base.href.replace(/\/$/, "") + "/integrations/mault/run");
    const response = await fetch(url, { method: "POST", headers: { "X-UltimoTurno-Access-Key": accessKey }, redirect: "error", signal: AbortSignal.timeout(55000) });
    if (response.ok) {
      const data = await response.json();
      console.log(JSON.stringify({ imported: data.imported, staged: data.staged, morePages: data.more }));
    } else {
      console.error(`Sincronizacion Mault HTTP ${response.status}. No se imprime la respuesta privada.`);
      if (once) process.exitCode = 1;
    }
  } catch { if (!stop.signal.aborted) { console.error("No se pudo consultar la API destino."); if (once) process.exitCode = 1; } }
  if (once || stop.signal.aborted) break;
  await new Promise(resolve => {
    const finish = () => { clearTimeout(timeout); stop.signal.removeEventListener("abort", finish); resolve(); };
    const timeout = setTimeout(finish, 60000);
    stop.signal.addEventListener("abort", finish, { once: true });
  });
} while (!stop.signal.aborted);
