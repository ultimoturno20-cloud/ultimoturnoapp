import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { createOperationalDatabase, getDefaultOperationalUser, upsertInventoryItem, setStorefrontPublication, getStoreSettings, saveStoreSettings, createStoreOrder, expireStoreOrders, listSales, listStoreCatalog, completeReservationSale, cancelReservationSale, updateSalePayment, mergeDuplicateCustomerOrders, updateReservationSaleLines, createSale, getOrderBoards, createReseller, assignResellerStockBatch } from "./index.js";
import type { StoreOrderInput } from "@ultimoturno/domain";

it("web checkout reserves atomically, remains private and expires only unpaid web orders",async t=>{
  const db=await createOperationalDatabase({dataDir:await mkdtemp(path.join(tmpdir(),'ultimoturno-web-orders-'))});t.after(()=>db.close());
  const admin={...await getDefaultOperationalUser(db),roles:['admin']};
  const settings={enabled:true,reservationMinutes:30,pickup:true,shipping:true,paymentInstructions:'Pago de prueba local',contactInstructions:'Contacto de prueba local'};
  let n=0;
  async function card(quantity=3){const item=await upsertInventoryItem(db,{sku:`WEB-TEST-${++n}`,name:`Carta Web ${n}`,expansion:'151',number:String(n),priceChartingId:`web-test-${n}`,language:'EN',condition:'NM',finish:'normal',quantityOnHand:quantity,priceArs:1250.5},admin);await setStorefrontPublication(db,{inventoryItemIds:[item.id],published:true},admin);await db.query("update current_prices set price_ars=1250.5 where inventory_item_id=$1",[item.id]);return item;}
  const input=(ids:string[],email=`${crypto.randomUUID()}@test.local`):StoreOrderInput=>({idempotencyKey:crypto.randomUUID(),customerName:'Comprador local',email,phone:'+54 11 1234 5678',fulfillment:'pickup',address:'',lines:ids.map(id=>({inventoryItemId:id,quantity:1,expectedPriceArs:1250.5}))});
  const checkout=(request:StoreOrderInput)=>createStoreOrder(db,request,request.email);
  async function saleId(key:string){return (await db.query<{sale_id:string}>('select sale_id from store_orders where idempotency_key=$1',[key])).rows[0].sale_id;}
  async function expire(key:string){await db.query("update store_orders set expires_at=now()-interval '1 minute' where idempotency_key=$1",[key]);}
  async function quantity(id:string){return (await db.query<{quantity_on_hand:number;quantity_reserved:number}>('select quantity_on_hand,quantity_reserved from inventory_items where id=$1',[id])).rows[0];}

  await t.test('starts paused; only admins can open with real payment and delivery settings',async()=>{
    assert.equal((await getStoreSettings(db)).enabled,false);
    const item=await card();await assert.rejects(checkout(input([item.id])),{statusCode:503});
    await assert.rejects(saveStoreSettings(db,settings,{...admin,roles:['stock_owner']}),{statusCode:403});
    await assert.rejects(saveStoreSettings(db,{...settings,paymentInstructions:''},admin),{statusCode:400});
    await saveStoreSettings(db,settings,admin);
  });
  await t.test('current price, public eligibility, duplicate IDs and quantities are validated before writes',async()=>{
    const a=await card(),b=await card();const before=await quantity(a.id);
    const request=input([a.id,b.id]);request.lines[1].quantity=99;await assert.rejects(checkout(request),{statusCode:409});
    assert.deepEqual(await quantity(a.id),before);
    for(const bad of [0,-1,1.5,'2']){const value=input([a.id]);value.lines[0].quantity=bad as number;await assert.rejects(checkout(value),{statusCode:400});}
    const duplicate=input([a.id,a.id]);await assert.rejects(checkout(duplicate),{statusCode:400});
    const wrong=input([a.id]);wrong.lines[0].expectedPriceArs=100;await assert.rejects(checkout(wrong),{statusCode:409});
    await setStorefrontPublication(db,{inventoryItemIds:[b.id],published:false},admin);await assert.rejects(checkout(input([b.id])),{statusCode:409});
    assert.deepEqual(await quantity(a.id),before);
    assert.equal((await db.query('select sale_id from store_orders')).rows.length,0);
  });
  await t.test('retries recover one receipt even after pausing; private DTO carries contact and board shows Web',async()=>{
    const item=await card(),request=input([item.id]);request.fulfillment='shipping';request.address='Direccion local 123, localidad 1000';
    const receipt=await checkout(request);assert.equal(receipt.totalArs,1250.5);
    assert.deepEqual(await quantity(item.id),{quantity_on_hand:3,quantity_reserved:1});
    assert.deepEqual(await checkout(request),receipt);
    await assert.rejects(checkout({...request,customerName:'Otra persona'}),{statusCode:409});
    const id=await saleId(request.idempotencyKey),sale=(await listSales(db,admin.businessId,id)).sales[0];
    assert.equal(sale.channel,'web');assert.equal(sale.paymentDueAt,undefined);assert.equal(sale.webOrder?.email,request.email);assert.equal(sale.webOrder?.address,request.address);
    assert.ok((await getOrderBoards(db,admin.businessId)).cards.some(card=>card.saleId===id));
    assert.ok(!JSON.stringify(await listStoreCatalog(db)).includes(request.email));assert.ok(!('saleId' in receipt));
    await saveStoreSettings(db,{...settings,enabled:false},admin);assert.deepEqual(await checkout(request),receipt);await saveStoreSettings(db,settings,admin);
    const [again,also]=await Promise.all([checkout(request),checkout(request)]);assert.equal(again.reference,also.reference);assert.equal((await quantity(item.id)).quantity_reserved,1);
  });
  await t.test('last-unit concurrency permits one order and rolls back the other',async()=>{
    const item=await card(1);const requests=[input([item.id]),input([item.id])];
    const results=await Promise.allSettled(requests.map(checkout));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.deepEqual(await quantity(item.id),{quantity_on_hand:1,quantity_reserved:1});
  });
  await t.test('expiry releases only new unpaid web reserves once, never legacy reservations',async()=>{
    const item=await card(5),request=input([item.id]);await checkout(request);
    const legacy=await createSale(db,{customerName:'Reserva existente',saleType:'reservation',channel:'claim',lines:[{inventoryItemId:item.id,quantity:1,unitPriceArs:1250.5}]},admin);
    await expire(request.idempotencyKey);assert.equal(await expireStoreOrders(db,admin.businessId),1);assert.equal(await expireStoreOrders(db,admin.businessId),0);
    assert.deepEqual(await quantity(item.id),{quantity_on_hand:5,quantity_reserved:1});
    assert.equal((await listSales(db,admin.businessId,legacy.id)).sales[0].status,'pending');assert.equal((await checkout(request)).status,'cancelled');
    await assert.rejects(completeReservationSale(db,await saleId(request.idempotencyKey),admin),{statusCode:409});
  });
  await t.test('partial payments protect reserves; full payment consumes stock exactly once',async()=>{
    const item=await card(),request=input([item.id]);await checkout(request);const id=await saleId(request.idempotencyKey);
    await updateSalePayment(db,id,500,admin);await expire(request.idempotencyKey);assert.equal(await expireStoreOrders(db,admin.businessId),0);
    assert.equal((await checkout(request)).status,'payment_recorded');await completeReservationSale(db,id,admin);
    assert.deepEqual(await quantity(item.id),{quantity_on_hand:2,quantity_reserved:0});assert.equal((await checkout(request)).status,'paid');
    await assert.rejects(completeReservationSale(db,id,admin));assert.equal(await expireStoreOrders(db,admin.businessId),0);
  });
  await t.test('admin cancellation frees stock and web orders are not merged or edited',async()=>{
    const item=await card(),request=input([item.id]);await checkout(request);const id=await saleId(request.idempotencyKey);
    const second=input([item.id]);await checkout(second);assert.equal((await mergeDuplicateCustomerOrders(db,admin)).merged,0);
    await assert.rejects(updateReservationSaleLines(db,id,{lines:[{inventoryItemId:item.id,quantity:2,priceCurrency:'ARS',unitPriceArs:1250.5}]},admin),{statusCode:409});
    await cancelReservationSale(db,id,admin);await assert.rejects(cancelReservationSale(db,id,admin));assert.equal((await quantity(item.id)).quantity_reserved,1);assert.equal((await checkout(request)).status,'cancelled');
  });
  await t.test('reseller assignments and open claims cannot be purchased; a new claim cannot steal a web reserve',async()=>{
    const item=await card(1),reseller=await createReseller(db,{displayName:'Revendedor local',email:'web-reseller@test.local',password:'local-test-only',commissionPercent:20},admin);
    await assignResellerStockBatch(db,reseller.reseller.userId,{idempotencyKey:crypto.randomUUID(),lines:[{inventoryItemId:item.id,quantity:1}]},admin);await assert.rejects(checkout(input([item.id])),{statusCode:409});
    const claimed=await card(),reserved=await card(),claimId=crypto.randomUUID();
    await db.query("insert into claim_sessions(id,business_id,name) values($1,$2,'Claim local Web')",[claimId,admin.businessId]);
    await db.query("insert into claim_cards(id,business_id,claim_id,pricecharting_id,product_name,inventory_item_id) values($1,$2,$3,$4,'Carta local',$5)",[crypto.randomUUID(),admin.businessId,claimId,`inventory:${claimed.id}`,claimed.id]);await assert.rejects(checkout(input([claimed.id])),{statusCode:409});
    const request=input([reserved.id]);await checkout(request);
    await assert.rejects(db.query("insert into claim_cards(id,business_id,claim_id,pricecharting_id,product_name,inventory_item_id) values($1,$2,$3,$4,'Carta local',$5)",[crypto.randomUUID(),admin.businessId,claimId,`inventory:${reserved.id}`,reserved.id]),/pedido web/);
    await cancelReservationSale(db,await saleId(request.idempotencyKey),admin);
    await db.query("insert into claim_cards(id,business_id,claim_id,pricecharting_id,product_name,inventory_item_id) values($1,$2,$3,$4,'Carta local',$5)",[crypto.randomUUID(),admin.businessId,claimId,`inventory:${reserved.id}`,reserved.id]);
  });
  await t.test('failed attempts consume persistent email/IP limits without stock mutations',async()=>{
    const item=await card(),email='limit@test.local';
    for(let n=0;n<5;n++){const request=input([item.id],email);request.lines[0].expectedPriceArs=1;await assert.rejects(checkout(request),{statusCode:409});}
    await assert.rejects(checkout(input([item.id],email)),{statusCode:429});assert.deepEqual(await quantity(item.id),{quantity_on_hand:3,quantity_reserved:0});
  });
});
