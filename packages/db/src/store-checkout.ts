import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { defaultStoreSettings, type StoreSettings, type StoreOrderInput, type StoreOrderReceipt } from "@ultimoturno/domain";
import { inventoryTransaction, getOperationalDatabaseDriver, moveSaleToRuleColumn, type AuthenticatedUser } from "./index.js";
import { listStoreCatalog } from "./storefront.js";

function fail(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
function text(value: unknown, label: string, max: number, required = true) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()) || /[\x00-\x1f]/.test(value)) fail(`${label} invalido.`);
  return value.trim();
}
function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail("Identificador invalido.");
  return value.toLowerCase();
}
function normalize(input: StoreOrderInput): StoreOrderInput {
  if (!input || !Array.isArray(input.lines) || !input.lines.length || input.lines.length > 30) fail("El carrito debe tener entre 1 y 30 articulos.");
  if(typeof input.idempotencyKey!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey))fail("Clave de pedido invalida.");
  const lines = input.lines.map(line => {
    if (!line || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99 || !Number.isFinite(line.expectedPriceArs) || line.expectedPriceArs <= 0) fail("Cantidad o precio invalido.");
    return { inventoryItemId: uuid(line.inventoryItemId), quantity: line.quantity, expectedPriceArs: line.expectedPriceArs };
  }).sort((a,b) => a.inventoryItemId.localeCompare(b.inventoryItemId));
  if (new Set(lines.map(line => line.inventoryItemId)).size !== lines.length) fail("Hay articulos repetidos.");
  const email = text(input.email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Email invalido.");
  const phone = text(input.phone, "Telefono", 40);
  if (!/^[+\d\s()-]{7,40}$/.test(phone) || phone.replace(/\D/g, "").length < 7) fail("Telefono invalido.");
  if (input.fulfillment !== "pickup" && input.fulfillment !== "shipping") fail("Entrega invalida.");
  return { idempotencyKey: uuid(input.idempotencyKey), customerName: text(input.customerName, "Nombre", 100), email, phone, fulfillment: input.fulfillment, address: input.fulfillment === "shipping" ? text(input.address, "Direccion", 300) : "", lines };
}
export async function getStoreSettings(db: PGlite, businessSlug = "ultimoturno", businessId?: string): Promise<StoreSettings> {
  const result = await db.query<Record<string, unknown>>("select ss.* from store_settings ss join businesses b on b.id=ss.business_id where ($2::uuid is not null and b.id=$2) or ($2::uuid is null and b.slug=$1)", [businessSlug,businessId||null]);
  const row = result.rows[0];
  return row ? { enabled: row.enabled === true, reservationMinutes: Number(row.reservation_minutes), pickup: row.pickup === true, shipping: row.shipping === true, paymentInstructions: String(row.payment_instructions), contactInstructions: String(row.contact_instructions) } : { ...defaultStoreSettings };
}
export async function saveStoreSettings(db: PGlite, input: StoreSettings, actor: AuthenticatedUser) {
  if (!actor.roles?.includes("admin")) fail("Se requiere rol administrador.", 403);
  if (!input || typeof input.enabled !== "boolean" || typeof input.pickup !== "boolean" || typeof input.shipping !== "boolean" || !Number.isInteger(input.reservationMinutes) || input.reservationMinutes < 5 || input.reservationMinutes > 1440) fail("Configuracion de tienda invalida.");
  for (const value of [input.paymentInstructions, input.contactInstructions]) if (typeof value !== "string" || value.length > 2000) fail("Instrucciones demasiado largas.");
  if (input.enabled && (!input.paymentInstructions.trim() || !input.contactInstructions.trim() || (!input.pickup && !input.shipping))) fail("Completa pago, contacto y al menos una forma de entrega antes de abrir pedidos.");
  return inventoryTransaction(db, async connection => {
    await connection.query("insert into store_settings(business_id,enabled,reservation_minutes,pickup,shipping,payment_instructions,contact_instructions) values($1,$2,$3,$4,$5,$6,$7) on conflict(business_id) do update set enabled=excluded.enabled,reservation_minutes=excluded.reservation_minutes,pickup=excluded.pickup,shipping=excluded.shipping,payment_instructions=excluded.payment_instructions,contact_instructions=excluded.contact_instructions", [actor.businessId,input.enabled,input.reservationMinutes,input.pickup,input.shipping,input.paymentInstructions.trim(),input.contactInstructions.trim()]);
    await connection.query("insert into audit_log(id,business_id,actor_user_id,action,entity_type,entity_id,after_data) values($1,$2,$3,'store.settings','business',$5,$4::jsonb)", [crypto.randomUUID(),actor.businessId,actor.id,JSON.stringify({enabled:input.enabled,reservationMinutes:input.reservationMinutes,pickup:input.pickup,shipping:input.shipping}),actor.businessId]);
    return input;
  });
}
async function throttle(db: PGlite, businessId: string, email: string, ip: string) {
  return inventoryTransaction(db, async connection => {
    const ipHash=hash(ip),emailHash=hash(email);
    if (getOperationalDatabaseDriver(db) === "postgres") for (const key of [`store-ip:${ipHash}`,`store-email:${emailHash}`].sort()) await connection.query("select pg_advisory_xact_lock(hashtext($1))",[key]);
    await connection.query("delete from store_checkout_attempts where attempted_at < now()-interval '1 day'");
    const result=await connection.query<{ip_count:string;email_count:string}>("select count(*) filter(where ip_hash=$2)::text as ip_count,count(*) filter(where email_hash=$3)::text as email_count from store_checkout_attempts where business_id=$1 and attempted_at>now()-interval '15 minutes'",[businessId,ipHash,emailHash]);
    if(Number(result.rows[0].ip_count)>=20 || Number(result.rows[0].email_count)>=5) fail("Demasiados intentos. Espera 15 minutos.",429);
    await connection.query("insert into store_checkout_attempts(business_id,ip_hash,email_hash) values($1,$2,$3)",[businessId,ipHash,emailHash]);
  });
}
async function replay(db:PGlite,businessId:string,key:string,requestHash:string):Promise<StoreOrderReceipt|null> {
  const result=await db.query<{request_hash:string;receipt:StoreOrderReceipt;status:string;amount_paid_ars:string}>("select w.request_hash,w.receipt,s.status,s.amount_paid_ars from store_orders w join sales s on s.id=w.sale_id and s.business_id=w.business_id where w.business_id=$1 and w.idempotency_key=$2",[businessId,key]);
  const row=result.rows[0];if(!row)return null;
  if(row.request_hash!==requestHash)fail("Este intento pertenece a otro pedido. No cambies los datos al reintentar.",409);
  return {...row.receipt,status:Number(row.amount_paid_ars)>0&&['pending','packed'].includes(row.status)?'payment_recorded':row.status};
}
export async function createStoreOrder(db:PGlite,raw:StoreOrderInput,ip:string,businessSlug="ultimoturno"):Promise<StoreOrderReceipt> {
  const input=normalize(raw),requestHash=hash(JSON.stringify(input));
  const business=await db.query<{id:string}>("select id from businesses where slug=$1",[businessSlug]);
  const businessId=business.rows[0]?.id;if(!businessId)fail("Tienda no disponible.",503);
  await expireStoreOrders(db,businessId);
  const previous=await replay(db,businessId,input.idempotencyKey,requestHash);if(previous)return previous;
  if(!(await getStoreSettings(db,businessSlug)).enabled)fail("Los pedidos web estan pausados.",503);
  await throttle(db,businessId,input.email,ip);
  return inventoryTransaction(db,async connection=>{
    if(getOperationalDatabaseDriver(db)==="postgres")await connection.query("select pg_advisory_xact_lock(hashtext($1))",[`store-order:${businessId}:${input.idempotencyKey}`]);
    const existing=await replay(connection,businessId,input.idempotencyKey,requestHash);if(existing)return existing;
    await connection.query("select business_id from store_settings where business_id=$1 for share",[businessId]);
    const settings=await getStoreSettings(connection,businessSlug);
    if(!settings.enabled)fail("Los pedidos web estan pausados.",503);
    if(input.fulfillment==='pickup'?!settings.pickup:!settings.shipping)fail("La entrega seleccionada ya no esta habilitada.",409);
    const ids=input.lines.map(line=>line.inventoryItemId);
    await connection.query("select ii.id from inventory_items ii join current_prices cp on cp.inventory_item_id=ii.id and cp.business_id=ii.business_id where ii.business_id=$1 and ii.id=any($2::uuid[]) order by ii.id for update of ii,cp",[businessId,ids]);
    const catalog=await listStoreCatalog(connection,{},businessSlug,ids);
    let totalCents=0;
    for(const line of input.lines){
      const item=catalog.items.find(item=>item.id===line.inventoryItemId);
      if(!item || item.availableQuantity<line.quantity)fail("Una carta ya no esta disponible con esa cantidad. Actualiza el carrito.",409);
      if(Math.round(item.priceArs*100)!==Math.round(line.expectedPriceArs*100))fail("Cambio el precio de una carta. Actualiza el carrito antes de confirmar.",409);
      totalCents+=Math.round(item.priceArs*100)*line.quantity;
    }
    if(!Number.isSafeInteger(totalCents)||totalCents>999999999999)fail("El total supera el limite del pedido.");
    const saleId=crypto.randomUUID(),expiresAt=new Date(Date.now()+settings.reservationMinutes*60000).toISOString();
    const receipt:StoreOrderReceipt={reference:`UT-${saleId.slice(-12).toUpperCase()}`,totalArs:totalCents/100,expiresAt,paymentInstructions:settings.paymentInstructions,contactInstructions:settings.contactInstructions,status:'pending'};
    await connection.query("insert into sales(id,business_id,customer_name,sale_type,status,channel,total_ars,total_usd) values($1,$2,$3,'reservation','pending','web',$4,0)",[saleId,businessId,input.customerName,receipt.totalArs]);
    await connection.query("insert into store_orders(sale_id,business_id,idempotency_key,request_hash,receipt,customer_email,customer_phone,fulfillment,address,expires_at) values($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)",[saleId,businessId,input.idempotencyKey,requestHash,JSON.stringify(receipt),input.email,input.phone,input.fulfillment,input.address,expiresAt]);
    for(const line of input.lines){
      const item=catalog.items.find(item=>item.id===line.inventoryItemId)!;
      await connection.query("insert into sale_items(id,business_id,sale_id,inventory_item_id,owner_user_id,quantity,unit_price_ars,line_total_ars,display_name,sku_snapshot) select $1,$2,$3,ii.id,ii.owner_user_id,$4,$5,$6,$7,ii.sku from inventory_items ii where ii.id=$8 and ii.business_id=$2",[crypto.randomUUID(),businessId,saleId,line.quantity,item.priceArs,Math.round(item.priceArs*100)*line.quantity/100,`${item.name} - ${item.language} / ${item.condition} / ${item.finish}`,item.id]);
      await connection.query("update inventory_items set quantity_reserved=quantity_reserved+$1,updated_at=now() where id=$2 and business_id=$3",[line.quantity,item.id,businessId]);
      await connection.query("insert into reservations(id,business_id,inventory_item_id,quantity,status,channel,external_cart_id,idempotency_key,expires_at) values($1,$2,$3,$4,'active','web',$5,$6,$7)",[crypto.randomUUID(),businessId,item.id,line.quantity,saleId,`web-${saleId}-${item.id}`,expiresAt]);
      await connection.query("insert into inventory_movements(id,business_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note) values($1,$2,$3,'reservation',0,'sale',$4,$5,'Pedido web')",[crypto.randomUUID(),businessId,item.id,saleId,`web-reserve-${saleId}-${item.id}`]);
    }
    await connection.query("insert into audit_log(id,business_id,action,entity_type,entity_id,after_data) values($1,$2,'store.order.create','sale',$3,$4::jsonb)",[crypto.randomUUID(),businessId,saleId,JSON.stringify({reference:receipt.reference,totalArs:receipt.totalArs,expiresAt})]);
    await moveSaleToRuleColumn(connection,businessId,saleId,true);
    await invalidate(connection,businessId);return receipt;
  });
}
async function invalidate(db:PGlite,businessId:string){await db.query("update stock_read_snapshots set refreshed_at='1970-01-01'::timestamptz, refresh_started_at=null where business_id=$1",[businessId]);}
export async function expireStoreOrders(db:PGlite,businessId?:string) {
  if(!businessId){const business=await db.query<{id:string}>("select id from businesses where slug='ultimoturno'");businessId=business.rows[0]?.id;if(!businessId)return 0;}
  return inventoryTransaction(db,async connection=>{
    const expired=await connection.query<{id:string;business_id:string}>("select s.id,s.business_id from sales s join store_orders w on w.sale_id=s.id and w.business_id=s.business_id where ($1::uuid is null or s.business_id=$1) and w.expired_at is null and w.expires_at<=now() and s.status in ('pending','packed') and s.amount_paid_ars=0 and s.amount_paid_usd=0 and s.assigned_reseller_user_id is null order by s.id for update of s",[businessId||null]);
    for(const sale of expired.rows){
      const lines=await connection.query<{id:string;inventory_item_id:string;quantity:number}>("select r.id,r.inventory_item_id,r.quantity from reservations r where r.business_id=$1 and r.external_cart_id=$2 and r.status='active' order by r.inventory_item_id for update",[sale.business_id,sale.id]);
      for(const line of lines.rows){
        await connection.query("update inventory_items set quantity_reserved=greatest(0,quantity_reserved-$1),updated_at=now() where id=$2 and business_id=$3",[line.quantity,line.inventory_item_id,sale.business_id]);
        await connection.query("update reservations set status='released',released_at=now() where id=$1",[line.id]);
        await connection.query("insert into inventory_movements(id,business_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note) values($1,$2,$3,'reservation_release',0,'sale',$4,$5,'Pedido web vencido')",[crypto.randomUUID(),sale.business_id,line.inventory_item_id,sale.id,`web-expire-${line.id}`]);
      }
      await connection.query("update sales set status='cancelled',cancelled_at=now() where id=$1 and business_id=$2",[sale.id,sale.business_id]);
      await connection.query("update store_orders set expired_at=now() where sale_id=$1",[sale.id]);
      await moveSaleToRuleColumn(connection,sale.business_id,sale.id,true);
      await connection.query("insert into audit_log(id,business_id,action,entity_type,entity_id) values($1,$2,'store.order.expire','sale',$3)",[crypto.randomUUID(),sale.business_id,sale.id]);
      await invalidate(connection,sale.business_id);
    }
    return expired.rows.length;
  });
}
export async function guardStoreOrder(db:PGlite,saleId:string,businessId:string,editing=false){
  const result=await db.query<{expired:boolean;status:string}>("select s.status,(w.expires_at<=now() and s.amount_paid_ars=0 and s.amount_paid_usd=0) as expired from sales s join store_orders w on w.sale_id=s.id and w.business_id=s.business_id where s.id=$1 and s.business_id=$2 for update of s",[saleId,businessId]);
  const row=result.rows[0];if(!row)return false;
  if(editing)fail("El pedido web conserva sus lineas y entrega originales. Cancelalo para reemplazarlo.",409);
  if(!['pending','packed','paid'].includes(row.status)||row.expired&&row.status!=='paid')fail("El pedido web vencio o ya esta cerrado. Recarga las ordenes.",409);
  return true;
}
