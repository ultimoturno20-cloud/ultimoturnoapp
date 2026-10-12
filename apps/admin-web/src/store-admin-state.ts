export const sharedAdminSessionKey = "ultimoturno_admin_session";
export const storePriceChangeKey = "ultimoturno.inventory.prices.changed.v1";
export function readSharedAdminSession(storage: Pick<Storage,"getItem">) {
  try { const token=storage.getItem(sharedAdminSessionKey)||""; return /^[0-9a-f]{64}$/i.test(token)?token:""; } catch { return ""; }
}
export function storePricePreview(value: string) {
  const number=Number(value);
  return value.trim()&&Number.isFinite(number)&&number>=800&&number<=9999999900?Math.ceil(number/100)*100:null;
}
export function notifyStorePriceChange(storage: Pick<Storage,"setItem">) {
  try { storage.setItem(storePriceChangeKey,`${Date.now()}:${crypto.randomUUID()}`); } catch { /* El panel tambien sincroniza al recuperar foco. */ }
}
