import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { defaultMaultSyncConfig, normalizeMaultSyncConfig, normalizeMaultCopy, maultCopyFingerprint,
  maultCategoryTags, maultInventoryFinish, maultNumberKey, type MaultSyncConfig, type MaultIntakeCopy, type MaultResolvedImage, type MaultCopyView } from "@ultimoturno/domain";
import { inventoryTransaction, addInventoryStock, listStockForBusiness, type AuthenticatedUser } from "./index.js";

function fail(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }
export function requireMaultAdmin(actor: AuthenticatedUser) {
  if (!actor.businessId || !actor.roles?.includes("admin")) fail("Se requiere administrador para integrar Mault.", 403);
}
export type MaultConnection = { config: MaultSyncConfig; version: number; baseline_complete: boolean; watermark: string | null;
  next_page: string | null; cycle_watermark: string | null; last_sync_at: string | null };
type CopyRow = { copy_id: string; status: string; payload: MaultIntakeCopy; resolved: MaultResolvedImage | null;
  observed_fingerprint: string; imported_fingerprint: string | null; reasons: string[]; inventory_item_id: string | null; applied_at: string | null };
const columns = "copy_id,status,payload,resolved,observed_fingerprint,imported_fingerprint,reasons,inventory_item_id,applied_at::text";
const view = (r: CopyRow): MaultCopyView => ({ copyId: r.copy_id, status: r.status, copy: r.payload, resolved: r.resolved,
  reasons: r.reasons, inventoryItemId: r.inventory_item_id, appliedAt: r.applied_at });

async function ensure(db: PGlite, actor: AuthenticatedUser) {
  requireMaultAdmin(actor);
  await db.query("insert into mault_connections(business_id,config) values($1,$2::jsonb) on conflict do nothing", [actor.businessId, JSON.stringify(defaultMaultSyncConfig())]);
}
export async function getMaultConnection(db: PGlite, actor: AuthenticatedUser): Promise<MaultConnection> {
  await ensure(db, actor);
  return (await db.query<MaultConnection>("select config,version,baseline_complete,watermark,next_page,cycle_watermark,last_sync_at::text from mault_connections where business_id=$1", [actor.businessId])).rows[0];
}
export async function saveMaultConnection(db: PGlite, actor: AuthenticatedUser, body: unknown, version: number) {
  requireMaultAdmin(actor);
  const config = normalizeMaultSyncConfig(body);
  if (!Number.isSafeInteger(version) || version < 1) fail("Version Mault invalida.");
  await ensure(db, actor);
  const result = await db.query(`update mault_connections set config=$2::jsonb,version=version+1,
    baseline_complete=case when config->'collections'=$2::jsonb->'collections' then baseline_complete else false end,
    watermark=case when config->'collections'=$2::jsonb->'collections' then watermark else null end,
    next_page=null,cycle_watermark=null,updated_at=clock_timestamp()
    where business_id=$1 and version=$3 and (lease_until is null or lease_until<clock_timestamp()) returning version`, [actor.businessId, JSON.stringify(config), version]);
  if (!result.rows.length) fail("La conexion cambio o esta sincronizando. Recarga y reintenta.", 409);
  return getMaultConnection(db, actor);
}
export async function claimMaultLease(db: PGlite, actor: AuthenticatedUser) {
  await ensure(db, actor);
  const token = crypto.randomUUID();
  const row = await db.query<MaultConnection>(`update mault_connections set lease_token=$2,lease_until=clock_timestamp()+interval '90 seconds'
    where business_id=$1 and (lease_until is null or lease_until<clock_timestamp())
    returning config,version,baseline_complete,watermark,next_page,cycle_watermark,last_sync_at::text`, [actor.businessId, token]);
  if (!row.rows[0]) fail("Mault ya esta sincronizando. Reintenta despues.", 409);
  return { token, connection: row.rows[0] };
}
export async function releaseMaultLease(db: PGlite, actor: AuthenticatedUser, token: string) {
  await db.query("update mault_connections set lease_token=null,lease_until=null where business_id=$1 and lease_token=$2", [actor.businessId, token]);
}
export async function stageMaultPage(db: PGlite, actor: AuthenticatedUser, token: string,
  page: { cards: unknown[]; nextPage: string | null; nextSince: string }, checkpoint = true) {
  requireMaultAdmin(actor);
  if (page.cards.length > 500 || !Number.isFinite(Date.parse(page.nextSince))) fail("Pagina Mault invalida.");
  return inventoryTransaction(db, async tx => {
    const locked = await tx.query<MaultConnection>("select * from mault_connections where business_id=$1 and lease_token=$2 and lease_until>clock_timestamp() for update", [actor.businessId, token]);
    const connection = locked.rows[0];
    if (!connection) fail("La sincronizacion Mault vencio. Reintenta.", 409);
    const selected = new Set(connection.config.collections.map(c => c.id));
    const data = page.cards.map(normalizeMaultCopy).filter(copy => selected.has(copy.collectionId)).map(copy => {
      if (!copy.sourceUpdatedAt) fail("Una copia Mault no informa fecha de modificacion.");
      return { copy_id: copy.copyId, payload: copy, fingerprint: maultCopyFingerprint(copy), source_updated_at: copy.sourceUpdatedAt };
    });
    if (data.length) await tx.query(`insert into mault_copies(business_id,copy_id,payload,observed_fingerprint,source_updated_at,status)
      select $1,x.copy_id,x.payload,x.fingerprint,x.source_updated_at,$3 from jsonb_to_recordset($2::jsonb)
        as x(copy_id text,payload jsonb,fingerprint text,source_updated_at timestamptz)
      on conflict(business_id,copy_id) do update set payload=excluded.payload,observed_fingerprint=excluded.observed_fingerprint,
        source_updated_at=excluded.source_updated_at,
        resolved=case when mault_copies.observed_fingerprint=excluded.observed_fingerprint then mault_copies.resolved else null end,
        status=case when mault_copies.applied_at is not null then
          case when mault_copies.imported_fingerprint=excluded.observed_fingerprint then 'imported' else 'review' end
          when mault_copies.status='baseline' then 'baseline' else 'pending' end,
        reasons=case when mault_copies.applied_at is not null and mault_copies.imported_fingerprint<>excluded.observed_fingerprint
          then '["identity_changed_after_import"]'::jsonb else '[]'::jsonb end,updated_at=clock_timestamp()
      where excluded.source_updated_at>=mault_copies.source_updated_at and excluded.payload is distinct from mault_copies.payload`, [actor.businessId, JSON.stringify(data), connection.baseline_complete ? "pending" : "baseline"]);
    if (!checkpoint) return { staged: data.length, more: Boolean(connection.next_page) };
    const cycle = connection.cycle_watermark && Date.parse(connection.cycle_watermark) < Date.parse(page.nextSince) ? connection.cycle_watermark : page.nextSince;
    await tx.query(`update mault_connections set next_page=$3,cycle_watermark=case when $3::text is null then null else $4 end,
      watermark=case when $3::text is null then $4 else watermark end,
      baseline_complete=case when $3::text is null then true else baseline_complete end,last_sync_at=clock_timestamp()
      where business_id=$1 and lease_token=$2`, [actor.businessId, token, page.nextPage, cycle]);
    return { staged: data.length, more: Boolean(page.nextPage) };
  });
}
export async function listMaultCopies(db: PGlite, actor: AuthenticatedUser, input: { status?: string; offset?: number; ids?: string[] } = {}) {
  requireMaultAdmin(actor);
  const statuses = ["all", "baseline", "pending", "ready", "review", "imported"];
  const status = input.status || "all", offset = input.offset || 0;
  if (!statuses.includes(status) || !Number.isSafeInteger(offset) || offset < 0) fail("Filtro Mault invalido.");
  if (input.ids && (!input.ids.length || input.ids.length > 10 || input.ids.some(id => typeof id !== "string" || !id || id.length > 200))) fail("Seleccion Mault invalida (1 a 10 copias).");
  const rows = await db.query<CopyRow>(`select ${columns} from mault_copies where business_id=$1 and ($2='all' or status=$2)
    and ($3::text[] is null or copy_id=any($3)) order by updated_at,copy_id limit 50 offset $4`, [actor.businessId, status, input.ids || null, offset]);
  const totals = await db.query<{ status: string; count: number }>("select status,count(*)::integer as count from mault_copies where business_id=$1 group by status", [actor.businessId]);
  return { copies: rows.rows.map(view), totals: Object.fromEntries(totals.rows.map(r => [r.status, Number(r.count)])), offset, limit: 50 };
}
export async function recordMaultResolution(db: PGlite, actor: AuthenticatedUser, copy: MaultIntakeCopy,
  resolved: MaultResolvedImage | null, reasons: string[], allowHistory = false) {
  requireMaultAdmin(actor);
  const fingerprint = maultCopyFingerprint(copy);
  const result = await db.query(`update mault_copies set resolved=$3::jsonb,reasons=$4::jsonb,
    status=case when status='baseline' then 'baseline' when $3::jsonb is not null and jsonb_array_length($4::jsonb)=0 then 'ready' else 'review' end,
    updated_at=clock_timestamp() where business_id=$1 and copy_id=$2 and observed_fingerprint=$5 and applied_at is null
    and (status<>'baseline' or $6) returning copy_id`, [actor.businessId, copy.copyId, JSON.stringify(resolved), JSON.stringify(reasons), fingerprint, allowHistory]);
  if (!result.rows.length) fail("La copia cambio mientras se verificaba. Recarga y reintenta.", 409);
}
export async function listMaultQueue(db: PGlite, actor: AuthenticatedUser) {
  requireMaultAdmin(actor);
  return (await db.query<CopyRow>(`select ${columns} from mault_copies where business_id=$1
    and status in ('pending','ready','review') and applied_at is null order by updated_at,copy_id limit 2`, [actor.businessId])).rows.map(view);
}
export function maultPolicyReasons(copy: MaultIntakeCopy, config: MaultSyncConfig, conditionConfirmed = false) {
  const reasons = [...copy.issues];
  if (copy.game !== "pokemon") reasons.push("unsupported_game");
  if (!config.collections.some(c => c.id === copy.collectionId)) reasons.push("collection_not_enabled");
  if (config.requireReviewed && !copy.reviewed) reasons.push("source_approval_required");
  if (config.requireStorage && !copy.location) reasons.push("source_storage_required");
  if (!config.acceptRecordedCondition && !conditionConfirmed) reasons.push("condition_confirmation_required");
  return reasons;
}
export async function applyMaultCopies(db: PGlite, actor: AuthenticatedUser, ids: string[], options: { confirmHistory: boolean; conditionConfirmed: boolean; leaseToken?: string }) {
  requireMaultAdmin(actor);
  await listMaultCopies(db, actor, { ids });
  return inventoryTransaction(db, async tx => {
    const configRow = (await tx.query<MaultConnection & { lease_token: string | null; lease_until: string | null }>("select * from mault_connections where business_id=$1 for update", [actor.businessId])).rows[0];
    if (!configRow?.config.enabled) fail("La conexion Mault esta deshabilitada.", 409);
    if (options.leaseToken && (configRow.lease_token !== options.leaseToken || !configRow.lease_until || Date.parse(configRow.lease_until) <= Date.now())) fail("La sincronizacion vencio. Reintenta.", 409);
    const rows = (await tx.query<CopyRow>(`select ${columns} from mault_copies where business_id=$1 and copy_id=any($2::text[]) order by copy_id for update`, [actor.businessId, ids])).rows;
    if (rows.length !== new Set(ids).size) fail("Una copia Mault no pertenece al negocio.", 404);
    let imported = 0, repeated = 0;
    const receipts = [];
    for (const row of rows) {
      const copy = row.payload;
      if (row.applied_at) {
        if (row.imported_fingerprint !== row.observed_fingerprint) fail("Una copia ingresada cambio de identidad; requiere revision.", 409);
        repeated++; receipts.push({ copyId: row.copy_id, inventoryItemId: row.inventory_item_id, repeated: true }); continue;
      }
      if (!configRow.baseline_complete) fail("Completa la primera lectura antes de importar.", 409);
      if (row.status === "baseline" && !options.confirmHistory) fail("El historico requiere confirmacion explicita.", 409);
      const reasons = maultPolicyReasons(copy, configRow.config, options.conditionConfirmed);
      if (!row.resolved || row.resolved.verifiedFingerprint !== row.observed_fingerprint) reasons.push("verified_image_required");
      if (reasons.length) fail("La copia requiere revision: " + [...new Set(reasons)].join(", "), 409);
      const asset = row.resolved!;
      const finish = maultInventoryFinish(copy);
      // Serializes all Mault writes in this business; the per-copy receipt is locked above.
      const stock = await listStockForBusiness(tx, actor.businessId);
      const same = (a: unknown, b: unknown) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
      const matches = stock.items.filter(i => !i.ownerUserId && i.itemKind !== "folder" && same(i.product.name, asset.name)
        && same(i.product.expansion, asset.expansion) && maultNumberKey(i.product.number || "") === maultNumberKey(copy.number) && same(i.variant.language, copy.language)
        && same(i.variant.condition, copy.condition) && same(i.variant.finish, finish)
        && !i.variant.gradingCompany && !i.variant.grade && same(i.location, copy.location?.name));
      if (matches.length > 1) fail("Hay varios items existentes para esta identidad; requiere revision.", 409);
      const existing = matches[0];
      if (existing) await tx.query("select id from inventory_items where business_id=$1 and id=$2 for update", [actor.businessId, existing.id]);
      const currentPrice = existing ? (await tx.query<{ price_ars: number; price_usd: number | null }>("select price_ars,price_usd from current_prices where business_id=$1 and inventory_item_id=$2 for update", [actor.businessId, existing.id])).rows[0] : null;
      const storedImage = existing ? (await tx.query<{ image_url: string | null }>("select image_url from card_products where business_id=$1 and id=$2", [actor.businessId, existing.product.id])).rows[0]?.image_url : null;
      const price = existing ? Number(currentPrice?.price_ars || 0) : configRow.config.newItemPriceArs;
      if (!price) fail("Falta precio de venta configurado para una carta nueva.", 409);
      const tags = maultCategoryTags(copy, actor.businessId, configRow.config.collections.map(c => ({ businessId: actor.businessId,
        sourceKind: "collection" as const, sourceId: c.id, tags: c.tags })), existing?.tags || "").join(", ");
      const item = await addInventoryStock(tx, { name: existing?.product.name || asset.name, expansion: existing?.product.expansion || asset.expansion, number: existing?.product.number || copy.number,
        language: copy.language, condition: copy.condition, finish, quantityOnHand: 1, priceArs: price,
        priceUsd: currentPrice?.price_usd ?? null, imageUrl: storedImage ? undefined : asset.imageUrl,
        location: existing?.location || copy.location?.name || "", tags, stockMovementReferenceType: "mault",
        stockMovementNote: "Ingreso Mault por copia" }, actor);
      if (item.variant.finish !== finish) fail("El nombre de la carta contradice su acabado; requiere revision.", 409);
      await tx.query(`update mault_copies set status='imported',imported_fingerprint=observed_fingerprint,
        inventory_item_id=$3,applied_at=clock_timestamp(),reasons='[]',updated_at=clock_timestamp() where business_id=$1 and copy_id=$2`, [actor.businessId, row.copy_id, item.id]);
      await tx.query(`insert into audit_log(id,business_id,actor_user_id,action,entity_type,entity_id,after_data)
        values($1,$2,$3,'mault.import','inventory_item',$4,$5::jsonb)`, [crypto.randomUUID(), actor.businessId, actor.id, item.id,
        JSON.stringify({ sourceCopyId: row.copy_id, stamp: copy.stamp, conditionConfirmed: options.conditionConfirmed, imageVerification: asset.verifiedBy })]);
      imported++; receipts.push({ copyId: row.copy_id, inventoryItemId: item.id, repeated: false });
    }
    if (imported) await tx.query("update stock_read_snapshots set refreshed_at='1970-01-01',refresh_started_at=null where business_id=$1", [actor.businessId]);
    return { imported, repeated, receipts };
  });
}
