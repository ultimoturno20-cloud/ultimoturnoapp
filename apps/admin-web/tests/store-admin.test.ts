import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {readSharedAdminSession,sharedAdminSessionKey,storePricePreview,notifyStorePriceChange,storePriceChangeKey} from "../src/store-admin-state.js";
test('store admin uses only the shared opaque admin-session key and tolerates unavailable storage',()=>{
  const token='a'.repeat(64);assert.equal(readSharedAdminSession({getItem:key=>{assert.equal(key,sharedAdminSessionKey);return token;}}),token);
  assert.equal(readSharedAdminSession({getItem:()=>'{roles:[admin]}'}),'');assert.equal(readSharedAdminSession({getItem:()=>{throw new Error();}}),'');
});
test('preview keeps existing manual-price floor/rounding and rejects invalid inputs',()=>{
  assert.equal(storePricePreview('1250'),1300);assert.equal(storePricePreview('800'),800);
  for(const value of ['','0','799','no','Infinity','1000000000000'])assert.equal(storePricePreview(value),null);
});
test('price-change notification carries no token, customer or private inventory payload',()=>{
  notifyStorePriceChange({setItem:(key,value)=>{assert.equal(key,storePriceChangeKey);assert.match(value,/^\d+:[0-9a-f-]{36}$/);}});
  notifyStorePriceChange({setItem:()=>{throw new Error();}});
});
test('Vercel forwards nested store admin session, login and item price routes to the API',()=>{
  const config=JSON.parse(readFileSync(new URL('../../../vercel.json',import.meta.url),'utf8'));
  const route=config.rewrites.find((route:{source:string})=>route.source==='/api/store-admin/:path*');
  assert.equal(route?.destination,'/api/dispatch?path=/store-admin/:path*');
});
