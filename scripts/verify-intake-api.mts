import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.PGLITE_DATA_DIR=await mkdtemp(path.join(tmpdir(),'ut-mobile-api-test-'));
process.env.API_PORT='4097';
process.env.ULTIMOTURNO_DATA_PROFILE='TEST AISLADO';
process.env.ULTIMOTURNO_ALLOW_EXAMPLES='false';
process.env.PRICECHARTING_AUTO_REFRESH_ENABLED='false';
process.env.TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED='false';
const {startServer}=await import('../apps/api/src/server.ts');
const server=startServer();
await new Promise<void>(resolve=>server.once('listening',()=>resolve()));
async function api(route:string,body?:unknown,method='POST') {
 const r=await fetch('http://localhost:4097'+route,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const json=await r.json(); assert.equal(r.ok,true,JSON.stringify(json));return json;
}
try {
 const entry=(await api('/mobile-intake/entries',{name:'Mobile Test Alpha',expansion:'Isolated Test',number:'97',language:'EN',condition:'NM',finish:'normal',quantityOnHand:3})).entry;
 const responses=await Promise.all([api('/mobile-intake/apply',{ids:[entry.id]}),api('/mobile-intake/apply',{ids:[entry.id]})]);
 assert.equal(responses.reduce((sum,r)=>sum+r.result.unitsApplied,0),3);
 assert.equal((await api('/mobile-intake/apply',{ids:[entry.id]})).result.unitsApplied,0);
 await api('/mobile-intake/entries/'+entry.id+'/status',{status:'pending'},'PUT');
 assert.equal((await api('/mobile-intake/apply',{ids:[entry.id]})).result.unitsApplied,0);
 const second=(await api('/mobile-intake/entries',{name:'Mobile Test Beta',expansion:'Isolated Test',number:'98',language:'EN',condition:'NM',finish:'normal',quantityOnHand:2})).entry;
 assert.equal((await api('/mobile-intake/apply',{ids:[second.id]})).result.unitsApplied,2);
 const third=(await api('/mobile-intake/entries',{name:'Cross Route Gamma',expansion:'Unrelated Gamma',number:'966',language:'EN',condition:'NM',finish:'normal',quantityOnHand:4})).entry;
 const csv='mobileEntryId,name,expansion,number,language,condition,finish,quantityOnHand,priceArs\n'+third.id+',Cross Route Gamma,Unrelated Gamma,966,EN,NM,normal,4,20';
 const csvResult=await api('/imports/snapshot/apply',{csvText:csv,confirm:true});
 assert.equal(csvResult.applied,1);
 assert.equal((await api('/mobile-intake/apply',{ids:[third.id]})).result.unitsApplied,0);
 const fourth=(await api('/mobile-intake/entries',{name:'Cross Route Delta',expansion:'Unrelated Delta',number:'965',language:'EN',condition:'NM',finish:'normal',quantityOnHand:5})).entry;
 await api('/mobile-intake/apply',{ids:[fourth.id]});
 const csv2='mobileEntryId,name,expansion,number,language,condition,finish,quantityOnHand,priceArs\n'+fourth.id+',Cross Route Delta,Unrelated Delta,965,EN,NM,normal,5,20';
 assert.equal((await api('/imports/snapshot/apply',{csvText:csv2,confirm:true})).skipped,1);
 console.log('PASS: CSV then mobile, mobile then CSV, shared receipts across both routes.');
 console.log('PASS: mobile parallel apply, retry, reopened applied entry, independent batch. Isolated data only.');
 server.close(()=>process.exit(0));
}catch(error){console.error(error);server.close(()=>process.exit(1));}
