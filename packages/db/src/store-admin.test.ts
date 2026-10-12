import assert from "node:assert/strict";
import crypto from "node:crypto";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {it} from "node:test";
import {createOperationalDatabase,getDefaultOperationalUser,createManagedUser,upsertInventoryItem,setStorefrontPublication,getStoreAdminPrice,updateStoreAdminPrice,listStoreCatalog,listStockForBusiness,createSale,saveStoreSettings,createStoreOrder} from "./index.js";

it("store admin price edits preserve operational data and enforce roles, scope and concurrency",async t=>{
  const db=await createOperationalDatabase({dataDir:await mkdtemp(path.join(tmpdir(),'ultimoturno-store-admin-'))});t.after(()=>db.close());
  const actor={...await getDefaultOperationalUser(db),roles:['admin']};
  const user=await createManagedUser(db,{displayName:'Segundo admin local',email:'store-admin-2@test.local',password:'local-test-only',role:'admin'},actor);
  const otherAdmin={...actor,id:user.id,displayName:user.displayName};
  const item=await upsertInventoryItem(db,{sku:'STORE-ADMIN-PRICE',name:'Carta precio Web',expansion:'151',number:'1',language:'EN',condition:'NM',finish:'normal',quantityOnHand:6,quantityReserved:1,priceArs:1200,priceUsd:1.2,purchaseCost:700},actor);
  await setStorefrontPublication(db,{inventoryItemIds:[item.id],published:true},actor);
  const reservation=await createSale(db,{customerName:'Reserva previa local',saleType:'reservation',channel:'web',lines:[{inventoryItemId:item.id,quantity:1,unitPriceArs:1200}]},actor);
  const state=async()=>({inventory:(await db.query('select * from inventory_items order by id')).rows,products:(await db.query('select * from card_products order by id')).rows,variants:(await db.query('select * from card_variants order by id')).rows,sales:(await db.query('select * from sales order by id')).rows,lines:(await db.query('select * from sale_items order by id')).rows,reservations:(await db.query('select * from reservations order by id')).rows,movements:(await db.query('select * from inventory_movements order by id')).rows});
  const before=await state();
  await t.test('only real admin roles can read/edit; no owner, reseller, missing role or different business',async()=>{
    for(const roles of [undefined,[],['stock_owner'],['reseller']]){
      await assert.rejects(getStoreAdminPrice(db,item.id,{...actor,roles}),{statusCode:403});
      await assert.rejects(updateStoreAdminPrice(db,item.id,{priceArs:1300,expectedPriceArs:1200},{...actor,roles},1000),{statusCode:403});
    }
    await assert.rejects(getStoreAdminPrice(db,item.id,{...actor,businessId:crypto.randomUUID()}),{statusCode:404});
    await assert.rejects(getStoreAdminPrice(db,'invalid',actor),{statusCode:400});
    for(const priceArs of [-1,0,100,NaN,Infinity,'1300',1e12])await assert.rejects(updateStoreAdminPrice(db,item.id,{priceArs:priceArs as number,expectedPriceArs:1200},actor,1000),{statusCode:400});
    await assert.rejects(updateStoreAdminPrice(db,item.id,{priceArs:1300,expectedPriceArs:1200},actor,0),{statusCode:503});
    assert.deepEqual(await state(),before);
  });
  await t.test('any admin updates central ARS and converted USD; retries do not duplicate audit',async()=>{
    await db.query("insert into stock_read_snapshots(business_id,refreshed_at) values($1,now()) on conflict(business_id) do update set refreshed_at=now()",[actor.businessId]);
    const result=await updateStoreAdminPrice(db,item.id,{priceArs:1250,expectedPriceArs:1200},otherAdmin,1000);
    assert.equal(result.priceArs,1300);assert.equal(result.priceUsd,1.3);
    assert.deepEqual(await updateStoreAdminPrice(db,item.id,{priceArs:1250,expectedPriceArs:1200},otherAdmin,1100),result);
    const audits=await db.query<{actor_user_id:string}>('select actor_user_id from audit_log where action=$1',['inventory.store_price.update']);assert.equal(audits.rows.length,1);assert.equal(audits.rows[0].actor_user_id,otherAdmin.id);
    const price=(await db.query<{manual_override:boolean}>('select manual_override from current_prices where inventory_item_id=$1',[item.id])).rows[0];assert.equal(price.manual_override,true);
    assert.equal((await listStoreCatalog(db)).items.find(row=>row.id===item.id)?.priceArs,1300);
    assert.equal((await listStockForBusiness(db,actor.businessId)).items.find(row=>row.id===item.id)?.priceArs,1300);
    const snapshot=await db.query<{stale:boolean}>("select refreshed_at<'2000-01-01'::timestamptz as stale from stock_read_snapshots where business_id=$1",[actor.businessId]);assert.equal(snapshot.rows[0].stale,true);
    assert.deepEqual(await state(),before);
  });
  await t.test('optimistic locking rejects stale writers and concurrent different prices',async()=>{
    await assert.rejects(updateStoreAdminPrice(db,item.id,{priceArs:1400,expectedPriceArs:1200},actor,1000),{statusCode:409});
    const results=await Promise.allSettled([updateStoreAdminPrice(db,item.id,{priceArs:1400,expectedPriceArs:1300},actor,1000),updateStoreAdminPrice(db,item.id,{priceArs:1500,expectedPriceArs:1300},otherAdmin,1000)]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);assert.deepEqual(await state(),before);
  });
  await t.test('unpublished, inactive and No venta items cannot be edited through the store',async()=>{
    await setStorefrontPublication(db,{inventoryItemIds:[item.id],published:false},actor);await assert.rejects(getStoreAdminPrice(db,item.id,actor),{statusCode:404});await setStorefrontPublication(db,{inventoryItemIds:[item.id],published:true},actor);
    await db.query('update inventory_items set active=false where id=$1',[item.id]);await assert.rejects(getStoreAdminPrice(db,item.id,actor),{statusCode:404});await db.query('update inventory_items set active=true where id=$1',[item.id]);
    await db.query("update inventory_items set inventory_status='not_for_sale' where id=$1",[item.id]);await assert.rejects(getStoreAdminPrice(db,item.id,actor),{statusCode:404});await db.query("update inventory_items set inventory_status='available' where id=$1",[item.id]);
    assert.equal((await db.query<{unit_price_ars:string}>('select unit_price_ars from sale_items where sale_id=$1',[reservation.id])).rows[0].unit_price_ars,'1200.00');
  });
  await t.test('checkout refuses a stale cart instead of charging an admin-edited price silently',async()=>{
    await saveStoreSettings(db,{enabled:true,reservationMinutes:30,pickup:true,shipping:false,paymentInstructions:'Solo prueba local',contactInstructions:'Solo prueba local'},actor);
    await assert.rejects(createStoreOrder(db,{idempotencyKey:crypto.randomUUID(),customerName:'Prueba local',email:'stale-price@test.local',phone:'123456789',fulfillment:'pickup',address:'',lines:[{inventoryItemId:item.id,quantity:1,expectedPriceArs:1200}]},'local-price-test'),{statusCode:409});
    assert.equal((await db.query('select sale_id from store_orders')).rows.length,0);
  });
});
