const args = new Set(process.argv.slice(2));
const apiBase = String(process.env.ULTIMOTURNO_API_BASE_URL || "https://ultimoturnoapp-api.vercel.app/api").replace(/\/+$/, "");
const accessKey = String(process.env.ULTIMOTURNO_ACCESS_KEY || "").trim();
const apply = args.has("--apply") || process.env.ULTIMOTURNO_RESTORE_APPLY === "true" || process.env.npm_config_apply === "true";
const confirmed = args.has("--confirm") || process.env.npm_config_confirm === "true" || process.env.ULTIMOTURNO_RESTORE_CONFIRM === "RESTAURAR STOCK PILOTO";

if (!accessKey) {
  throw new Error("Falta ULTIMOTURNO_ACCESS_KEY. El script no imprime ni pide la clave; cargala en el entorno antes de ejecutarlo.");
}

if (apply && !confirmed) {
  throw new Error("Operacion protegida. Para aplicar usa ULTIMOTURNO_RESTORE_APPLY=true con ULTIMOTURNO_RESTORE_CONFIRM=RESTAURAR STOCK PILOTO.");
}

function buildUrl(path: string) {
  return `${apiBase}/dispatch?path=${encodeURIComponent(path)}`;
}

async function callRestore(body: unknown) {
  const response = await fetch(buildUrl("/inventory/restore-pilot-stock"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-UltimoTurno-Access-Key": accessKey
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status}: ${payload.error || response.statusText}`);
  }
  return payload;
}

const payload = apply
  ? await callRestore({ apply: true, confirmation: "RESTAURAR STOCK PILOTO" })
  : await callRestore({});

console.log(JSON.stringify(payload, null, 2));