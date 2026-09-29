import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const state=path.resolve('.work/stock-offline');
const {email,password}=JSON.parse(await readFile(path.join(state,'access.json'),'utf8'));
const base='http://127.0.0.1:4010';
const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});
if(!login.ok)throw new Error(`Login local HTTP ${login.status}`);
const {token}=await login.json();
async function api(route,body){
 const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(600000)});
 const data=await response.json();
 if(!response.ok)throw new Error(`HTTP ${response.status}: ${data.error||route}`);
 return data;
}
const health=await api('/health');
if(health.environment.dbDriver!=='pglite'||health.environment.dataProfile!=='COPIA LOCAL - PRUEBAS')throw new Error('La API no es la copia local esperada.');
const before=await api('/stock');
console.log('Actualizando referencias TCGplayer desde TCGCSV. Puede tardar unos minutos.');
const jobs=process.argv.includes('--verify-concurrency')?2:1;
const results=await Promise.all(Array.from({length:jobs},()=>api('/tcgplayer-prices/refresh',{force:false})));
if(jobs===2&&results[0].status.lastRun.id!==results[1].status.lastRun.id)throw new Error('Las solicitudes concurrentes no compartieron la corrida.');
// The stock endpoint retains a short read cache.
await new Promise(resolve=>setTimeout(resolve,16000));
const after=await api('/stock');
const baseline=new Map(before.items.map(r=>[r.sku,r]));
const changed=after.items.filter(r=>['quantityOnHand','quantityReserved','priceArs','priceUsd'].some(k=>r[k]!==baseline.get(r.sku)?.[k]));
if(changed.length||before.items.length!==after.items.length)throw new Error('El inventario cambio durante la actualizacion; revisar antes de continuar.');
const counts=items=>({rows:items.length,priced:items.filter(r=>r.priceReferences.tcgplayer.usd>0).length,inStockPriced:items.filter(r=>r.quantityOnHand>0&&r.priceReferences.tcgplayer.usd>0).length});
const report={checkedAt:new Date().toISOString(),before:counts(before.items),after:counts(after.items),status:results[0].status,automation:await api('/tcgplayer-prices/auto-refresh/status'),concurrentRequests:jobs,salePricesAndQuantitiesUnchanged:true};
await writeFile(path.join(state,'tcg-refresh-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
