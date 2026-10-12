import type { StoreCatalogItem, StoreOrderInput } from "@ultimoturno/domain";
export type StoreCartLine = { item: StoreCatalogItem; quantity: number };
export function remainingStoreCartQuantity(lines: StoreCartLine[], item: StoreCatalogItem) {
  return Math.max(0,Math.min(99,item.availableQuantity)-(lines.find(line=>line.item.id===item.id)?.quantity||0));
}
export function addStoreCartQuantity(lines: StoreCartLine[], item: StoreCatalogItem, quantity: number): {ok:true;lines:StoreCartLine[]}|{ok:false;error:string} {
  if (!Number.isInteger(quantity) || quantity<1 || quantity>99) return {ok:false,error:"Cantidad invalida. Selecciona entre 1 y 99 unidades."};
  if (quantity>remainingStoreCartQuantity(lines,item)) return {ok:false,error:"Alcanzaste las unidades disponibles o el limite por articulo."};
  const current=lines.find(line=>line.item.id===item.id);
  if (!current && lines.length>=30) return {ok:false,error:"El carrito admite hasta 30 articulos distintos."};
  return {ok:true,lines:current?lines.map(line=>line.item.id===item.id?{item,quantity:line.quantity+quantity}:line):[...lines,{item,quantity}]};
}
export const storeCartKey = "ultimoturno.public-cart.v1";
export const pendingStoreOrderKey = "ultimoturno.public-order.pending.v1";
export function readPendingStoreOrder(storage: Pick<Storage,"getItem">): StoreOrderInput|null {
  try {
    const value=JSON.parse(storage.getItem(pendingStoreOrderKey)||'null');
    if(!value || !/^[0-9a-f-]{36}$/i.test(value.idempotencyKey) || ![value.customerName,value.email,value.phone,value.address].every(text=>typeof text==='string'&&text.length<=300) || !['pickup','shipping'].includes(value.fulfillment) || !Array.isArray(value.lines) || !value.lines.length || value.lines.length>30) return null;
    if(value.lines.some((line:StoreOrderInput["lines"][number])=>!line||!/^[0-9a-f-]{36}$/i.test(line.inventoryItemId)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99||!Number.isFinite(line.expectedPriceArs)||line.expectedPriceArs<=0))return null;
    return value;
  } catch {return null;}
}
export function readStoreCart(storage: Pick<Storage, "getItem">): StoreCartLine[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(storeCartKey) || "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.slice(0,30).filter((line): line is StoreCartLine => {
      const item=line?.item;
      if (!item || typeof item.id!=="string" || !/^[0-9a-f-]{36}$/i.test(item.id) || seen.has(item.id) || typeof item.name!=="string" || !Number.isFinite(item.priceArs) || item.priceArs<=0 || !Number.isInteger(item.availableQuantity) || item.availableQuantity<0 || !Number.isInteger(line.quantity) || line.quantity<1 || line.quantity>99) return false;
      if (![item.imageUrl,item.expansion,item.language,item.condition,item.finish].every(value=>typeof value==="string")) return false;
      if (item.imageUrl && !/^https?:\/\//i.test(item.imageUrl)) return false;
      seen.add(item.id);return true;
    });
  } catch { return []; }
}
export function writeStoreCart(storage: Pick<Storage,"setItem">, lines: StoreCartLine[]) {
  try { storage.setItem(storeCartKey, JSON.stringify(lines)); } catch { /* El carrito sigue funcionando sin almacenamiento. */ }
}
export function storeCartTotal(lines: StoreCartLine[]) { return lines.reduce((total,line)=>total+Math.round(line.item.priceArs*100)*line.quantity,0)/100; }
