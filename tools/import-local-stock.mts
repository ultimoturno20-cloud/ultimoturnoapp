import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createOperationalDatabase, getDefaultOperationalUser, inventoryTransaction, listStockForBusiness } from '../packages/db/src/index.js';

// This importer deliberately has no remote database or API option.
const root = process.cwd();
const dataDir = path.join(root, '.data', 'stock-offline');
const snapshotPath = path.resolve(process.argv[2] || 'outputs/price-source-audit/tcg-stock-before.json');
try { await access(dataDir); throw new Error('La base stock-offline ya existe. No se sobrescribe.'); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
if (!Array.isArray(snapshot.items) || !snapshot.items.length) throw new Error('Snapshot de stock invalido.');
const skus = new Set();
for (const row of snapshot.items) {
  if (!row.sku || skus.has(row.sku) || !row.product?.name || !row.variant?.language || !Number.isInteger(row.quantityOnHand) || row.quantityOnHand < 0 || !Number.isInteger(row.quantityReserved) || row.quantityReserved < 0 || row.quantityReserved > row.quantityOnHand) throw new Error(`Fila invalida: ${row.sku}`);
  skus.add(row.sku);
}
const password = crypto.randomBytes(16).toString('base64url');
const email = 'local@ultimoturno.test';
const stateDir = path.join(root, '.work', 'stock-offline');
await mkdir(stateDir, { recursive: true });
await writeFile(path.join(stateDir, 'access.json'), JSON.stringify({ email, password, usage: 'Solo base local de pruebas' }, null, 2));
const db = await createOperationalDatabase({ driver:'pglite', dataDir, adminEmail:email, adminPassword:password, adminName:'Admin pruebas local' });
try {
  const actor = await getDefaultOperationalUser(db);
  await inventoryTransaction(db, async connection => {
    await connection.exec('create temporary table offline_snapshot (r jsonb) on commit drop');
    await connection.query('insert into offline_snapshot select value from jsonb_array_elements($1::jsonb)',[JSON.stringify(snapshot.items)]);
    await connection.query(`insert into app_users (id,business_id,display_name,active)
      select distinct on (r->>'ownerUserId') (r->>'ownerUserId')::uuid,$1,r->>'ownerName',true from offline_snapshot where coalesce(r->>'ownerUserId','')<>''`,[actor.businessId]);
    await connection.query(`insert into user_roles (user_id,role_id) select u.id,roles.id from app_users u join roles on roles.business_id=u.business_id and roles.name='stock_owner' where u.business_id=$1 and u.email is null`,[actor.businessId]);
    await connection.query(`insert into card_products (id,business_id,name,expansion,card_number,image_url,notes)
      select distinct on (r#>>'{product,id}') (r#>>'{product,id}')::uuid,$1,r#>>'{product,name}',r#>>'{product,expansion}',r#>>'{product,number}',r#>>'{product,imageUrl}','Copia local del inventario'
      from offline_snapshot`,[actor.businessId]);
    await connection.query(`insert into card_variants (id,business_id,product_id,language,condition,finish,grading_company,grade,grading_cert)
      select distinct on (r#>>'{variant,id}') (r#>>'{variant,id}')::uuid,$1,(r#>>'{product,id}')::uuid,r#>>'{variant,language}',r#>>'{variant,condition}',r#>>'{variant,finish}',r#>>'{variant,gradingCompany}',r#>>'{variant,grade}',r#>>'{variant,gradingCert}' from offline_snapshot`,[actor.businessId]);
    await connection.query(`insert into inventory_items (id,business_id,owner_user_id,sku,product_id,variant_id,location,intake_batch,inventory_status,tags,quantity_on_hand,quantity_reserved,active,purchase_cost,purchase_currency)
      select (r->>'id')::uuid,$1,nullif(r->>'ownerUserId','')::uuid,r->>'sku',(r#>>'{product,id}')::uuid,(r#>>'{variant,id}')::uuid,coalesce(r->>'location',''),coalesce(r->>'intakeBatch',''),coalesce(r->>'inventoryStatus',''),coalesce(r->>'tags',''),(r->>'quantityOnHand')::integer,(r->>'quantityReserved')::integer,(r->>'active')::boolean,(r->>'purchaseCost')::numeric,coalesce(r->>'purchaseCurrency','ARS') from offline_snapshot`,[actor.businessId]);
    await connection.query(`insert into current_prices (inventory_item_id,business_id,price_ars,price_usd,manual_override)
      select (r->>'id')::uuid,$1,(r->>'priceArs')::numeric,(r->>'priceUsd')::numeric,true from offline_snapshot`,[actor.businessId]);
    await connection.query(`insert into external_sources (id,name,kind)
      select gen_random_uuid(),source,'catalog' from (select distinct i->>'source' as source from offline_snapshot cross join lateral jsonb_array_elements(r#>'{product,identifiers}') i where coalesce(i->>'source','')<>'') sources
      on conflict (name) do nothing`);
    await connection.query(`insert into external_identifiers (id,business_id,source_id,product_id,variant_id,external_id,external_url)
      select distinct on (s.id,i->>'externalId') gen_random_uuid(),$1,s.id,(r#>>'{product,id}')::uuid,(r#>>'{variant,id}')::uuid,i->>'externalId',i->>'url'
      from offline_snapshot cross join lateral jsonb_array_elements(r#>'{product,identifiers}') i join external_sources s on s.name=i->>'source' where coalesce(i->>'externalId','')<>''`,[actor.businessId]);
    await connection.query(`insert into inventory_movements (id,business_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note,created_by)
      select gen_random_uuid(),$1,(r->>'id')::uuid,'manual_adjustment',(r->>'quantityOnHand')::integer,'local_snapshot',(r->>'id')::uuid,'local-snapshot-'||(r->>'id'),'Copia local; no representa una compra nueva',$2 from offline_snapshot where (r->>'quantityOnHand')::integer>0`,[actor.businessId,actor.id]);
  });
  const local = await listStockForBusiness(db,actor.businessId);
  const bySku = new Map(local.items.map(row=>[row.sku,row]));
  const mismatches = snapshot.items.filter(row=>{
    const copy=bySku.get(row.sku);
    return !copy || ['quantityOnHand','quantityReserved','priceArs','priceUsd'].some(key=>copy[key]!==row[key]) || copy.priceReferences.priceCharting.priceChartingId !== row.priceReferences.priceCharting.priceChartingId;
  });
  if(mismatches.length || local.items.length!==snapshot.items.length) throw new Error(`Verificacion fallo: ${mismatches.length} diferencias`);
  const report={ source:snapshotPath, importedAt:new Date().toISOString(), rows:local.items.length, summary:local.summary, verified:true, limits:'No incluye ordenes, ventas ni historial. Reservas son cantidades del snapshot. Referencias externas permanecen en JSON original; imagenes conservan URL remota.' };
  await writeFile(path.join(stateDir,'import-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await db.close(); }
