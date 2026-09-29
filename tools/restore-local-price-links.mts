import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createOperationalDatabase,replacePriceChartingCache,refreshCardIndexFromPriceCharting,reviewCardIndexEntry} from '../packages/db/src/index.js';
const root=process.cwd();
const read=async (name:string)=>JSON.parse(await readFile(path.join(root,'outputs/price-source-audit',name),'utf8'));
const {items}=await read('tcg-stock-before.json');
const groups=JSON.parse((await read('tcg-groups.json')).body).results;
const plan=await read('tcg-link-plan.json');
const norm=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const set=(s:string)=>norm(s.replace(/^[a-z]{1,5}\d*\s*:\s*/i,'').replace(/^SM\s*-\s*/i,''));
const name=(s:string)=>norm(s.replace(/\s*\[(Reverse Holo|Holo)\]\s*$/i,'').replace(/\s*-\s*[a-z]*\d+(?:\/[a-z]*\d+)?\s*$/i,''));
const number=(s:string)=>String(s||'').toLowerCase().split('/').map(p=>p.replace(/^0+(?=\d)/,'')).join('/');
const english=items.filter(r=>r.variant.language==='EN'&&r.priceReferences.priceCharting.priceChartingId);
const unique=[...new Map(english.map(r=>[r.priceReferences.priceCharting.priceChartingId,r])).values()] as any[];
// Fixed local database only. Stop the local API before running this one-time restore.
const db=await createOperationalDatabase({driver:'pglite',dataDir:path.join(root,'.data/stock-offline')});
try{
 if(Number((await db.query<{n:number}>('select count(*) as n from card_index_entries')).rows[0].n))throw new Error('El indice local ya contiene datos. No se reemplaza.');
 await replacePriceChartingCache(db,{category:'local-stock-snapshot',sourceHash:'stock-snapshot-before-vercel-block',rowsReceived:unique.length,rowsSkipped:0,pruneMissing:false,rows:unique.map(r=>({priceChartingId:r.priceReferences.priceCharting.priceChartingId,canonicalUrl:r.priceReferences.priceCharting.url,sourceUrl:r.priceReferences.priceCharting.url,productName:r.product.name,normalizedName:norm(r.product.name),expansionName:r.product.expansion,normalizedExpansion:norm(r.product.expansion),cardNumber:r.product.number||'',loosePriceUsd:r.priceReferences.priceCharting.usd,imageUrl:r.product.imageUrl||'',languageGroup:'english',searchKey:norm(r.product.name+' '+r.product.expansion+' '+r.product.number)}))});
 await refreshCardIndexFromPriceCharting(db);
 const entries=(await db.query<{id:string;pricecharting_id:string;tcgplayer_product_id:string}>('select id,pricecharting_id,tcgplayer_product_id from card_index_entries')).rows;
 const index=new Map(entries.map(e=>[String(e.pricecharting_id),e]));
 let restored=0;
 for(const row of unique){
   const id=row.priceReferences.tcgplayer.productId;
   if(!id)continue;
   await db.query("update card_index_entries set tcgplayer_product_id=$1,tcgplayer_url=$2,evidence_json=$3::jsonb where id=$4",[id,`https://www.tcgplayer.com/product/${id}`,JSON.stringify({source:'local-stock-snapshot',note:'Vinculo previo; no implica nueva validacion de identidad'}),index.get(row.priceReferences.priceCharting.priceChartingId)!.id]);
   restored++;
 }
 const reviewed=[];
 for(const {candidate,source} of plan.candidates){
   const row=english.find(r=>r.sku===candidate.sku);
   const product=source?.product;
   const group=groups.find(g=>String(g.groupId)===String(source?.groupId));
   const n=product?.extendedData?.find(e=>e.name==='Number')?.value;
   const a=number(row?.product.number),b=number(n);
   if(!row||row.variant.grade||row.variant.gradingCompany||!product||!group||name(row.product.name)!==name(product.name)||set(row.product.expansion)!==set(group.name)||!a||!b||a.split('/')[0]!==b.split('/')[0]||(a.includes('/')&&b.includes('/')&&a!==b)||String(product.productId)!==String(candidate.tcgProductId)){reviewed.push({sku:candidate.sku,status:'needs_review'});continue;}
   const old=row.priceReferences.tcgplayer.productId;
   if(old&&String(old)!==String(product.productId)){reviewed.push({sku:row.sku,status:'conflict'});continue;}
   await reviewCardIndexEntry(db,String(index.get(row.priceReferences.priceCharting.priceChartingId)!.id),{action:'manual',tcgplayerProductId:String(product.productId),tcgplayerUrl:`https://www.tcgplayer.com/product/${product.productId}`,note:'Revision local: idioma EN, nombre, edicion y numero exactos contra catalogo TCGCSV. Precio agregado, no por condicion.'});
   reviewed.push({sku:row.sku,productId:product.productId,status:'linked'});
 }
 const report={restored,catalogueEntries:unique.length,reviewed};
 await writeFile(path.join(root,'.work/stock-offline/tcg-links.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({restored,catalogueEntries:unique.length,candidates:reviewed.length,linked:reviewed.filter(r=>r.status==='linked').length}));
}finally{await db.close();}
