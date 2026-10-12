import assert from "node:assert/strict";
import {test} from "node:test";
import {readStoreCart,writeStoreCart,storeCartTotal,storeCartKey,readPendingStoreOrder,pendingStoreOrderKey} from "../src/store-cart-state.js";
const item={id:'11111111-1111-4111-8111-111111111111',name:'Carta',imageUrl:'https://example.com/card.jpg',expansion:'151',language:'EN',condition:'NM',finish:'normal',priceArs:1200.25,availableQuantity:2};
test('cart persistence tolerates corrupt or unavailable storage and rejects unsafe images/duplicates',()=>{
  assert.deepEqual(readStoreCart({getItem:()=>'{bad'}),[]);assert.deepEqual(readStoreCart({getItem:()=>{throw new Error();}}),[]);
  const lines=[{item,quantity:1},{item,quantity:1},{item:{...item,id:'22222222-2222-4222-8222-222222222222',imageUrl:'javascript:alert(1)'},quantity:1}];
  assert.equal(readStoreCart({getItem:key=>{assert.equal(key,storeCartKey);return JSON.stringify(lines);}}).length,1);
  writeStoreCart({setItem:()=>{throw new Error();}},[]);
});
test('cart totals use cents; pending payload recovers only from its independent session key',()=>{
  assert.equal(storeCartTotal([{item:item as never,quantity:2}]),2400.5);
  const pending={idempotencyKey:item.id,customerName:'Local',email:'local@test.local',phone:'123456789',fulfillment:'pickup',address:'',lines:[{inventoryItemId:item.id,quantity:1,expectedPriceArs:1200.25}]};
  assert.deepEqual(readPendingStoreOrder({getItem:key=>{assert.equal(key,pendingStoreOrderKey);return JSON.stringify(pending);}}),pending);
  assert.equal(readPendingStoreOrder({getItem:()=>JSON.stringify({...pending,lines:[{quantity:-1}]})}),null);
});
