import assert from "node:assert/strict";
import {test} from "node:test";
import type { StoreCatalogItem } from "@ultimoturno/domain";
import {groupStoreSearchResults,readStoreResultView,resolveStoreResultView,storeConditionLabel} from "../src/store-search-results.js";
import {addStoreCartQuantity,remainingStoreCartQuantity,type StoreCartLine} from "../src/store-cart-state.js";
const item:StoreCatalogItem={id:'11111111-1111-4111-8111-111111111111',name:'Hilda',expansion:'White Flare',number:'171',imageUrl:'https://example.com/card.jpg',language:'EN',condition:'NM',finish:'normal',gradingCompany:'',grade:'',cardType:'supporter',category:'singles',itemKind:'standard',priceArs:1200.25,availableQuantity:12};
const other={...item,id:'22222222-2222-4222-8222-222222222222',condition:'LP',priceArs:1100,availableQuantity:1};
test('identical public print metadata groups condition offers without merging stock, price or IDs',()=>{
  const items=[item,other],before=structuredClone(items),groups=groupStoreSearchResults(items);
  assert.equal(groups.length,1);assert.deepEqual(groups[0].offers,items);assert.equal(groups[0].offers[0].availableQuantity,12);assert.equal(groups[0].offers[1].priceArs,1100);assert.deepEqual(items,before);
});
test('different print, language, finish, image, grading or category remain separate',()=>{
  for(const patch of [{name:'Hilda [Reverse Holo]'},{expansion:'Other'},{number:'164'},{language:'JP'},{finish:'reverse holo'},{imageUrl:'https://example.com/other.jpg'},{gradingCompany:'PSA'},{grade:'9'},{cardType:'pokemon'},{category:'other' as const}]){
    assert.equal(groupStoreSearchResults([item,{...other,...patch}]).length,2);
  }
});
test('folders remain unique and grouping preserves incoming sort and offer order',()=>{
  assert.equal(groupStoreSearchResults([{...item,itemKind:'folder'},{...other,itemKind:'folder'}]).length,2);
  const third={...item,id:'33333333-3333-4333-8333-333333333333',name:'Another card'};
  const groups=groupStoreSearchResults([other,third,item]);assert.deepEqual(groups.map(group=>group.item.id),[other.id,third.id]);assert.deepEqual(groups[0].offers.map(offer=>offer.id),[other.id,item.id]);
});
test('catalog and search default to list while explicit views survive and unknown values are not trusted',()=>{
  assert.equal(resolveStoreResultView(null),'list');assert.equal(resolveStoreResultView('grid'),'grid');assert.equal(resolveStoreResultView('list'),'list');
  assert.equal(resolveStoreResultView(readStoreResultView(null)),'list');assert.equal(resolveStoreResultView(readStoreResultView('invalid')),'list');
  assert.equal(readStoreResultView('grid'),'grid');assert.equal(readStoreResultView('list'),'list');assert.equal(readStoreResultView('admin'),null);assert.equal(readStoreResultView(null),null);
});
test('condition labels expand known codes and retain unknown source values',()=>{
  assert.equal(storeConditionLabel('NM'),'Near Mint');assert.equal(storeConditionLabel('LP'),'Lightly Played');assert.equal(storeConditionLabel('Unknown'),'Unknown');
});
test('quantity add is atomic, uses cents/current offer and keeps different conditions separate',()=>{
  const result=addStoreCartQuantity([],item,3);assert.equal(result.ok,true);if(!result.ok)return;
  const next=addStoreCartQuantity(result.lines,other,1);assert.equal(next.ok,true);if(!next.ok)return;
  assert.deepEqual(next.lines.map(line=>[line.item.id,line.quantity]),[[item.id,3],[other.id,1]]);
  const changed=addStoreCartQuantity(next.lines,{...item,priceArs:1500.50},2);assert.equal(changed.ok,true);if(changed.ok){assert.equal(changed.lines[0].quantity,5);assert.equal(changed.lines[0].item.priceArs,1500.50);}
  assert.equal(result.lines[0].quantity,3);assert.equal(remainingStoreCartQuantity(next.lines,item),9);
});
test('invalid or excessive quantities fail without partial additions or mutation',()=>{
  const lines:StoreCartLine[]=[{item,quantity:10}],before=structuredClone(lines);
  for(const quantity of [0,-1,1.5,100,NaN,Infinity,3])assert.equal(addStoreCartQuantity(lines,item,quantity).ok,false);
  assert.deepEqual(lines,before);assert.equal(addStoreCartQuantity([],{...item,availableQuantity:0},1).ok,false);
  assert.equal(remainingStoreCartQuantity(lines,{...item,availableQuantity:4}),0);
  assert.equal(remainingStoreCartQuantity([],{...item,availableQuantity:200}),99);
});
test('thirty item limit still allows increasing an existing line but not introducing another',()=>{
  const lines=Array.from({length:30},(_,n)=>({item:{...item,id:String(n)},quantity:1}));
  assert.equal(addStoreCartQuantity(lines,item,1).ok,false);assert.equal(addStoreCartQuantity(lines,{...item,id:'0'},2).ok,true);assert.equal(lines[0].quantity,1);
});
