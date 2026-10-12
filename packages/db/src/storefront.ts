import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { resolveStoreCategory, storeCatalogPage, type StoreCatalogItem, type StoreCatalogQuery } from "@ultimoturno/domain";
import { classifyCatalogReferences, inventoryTransaction, type AuthenticatedUser } from "./index.js";
import { isCardType } from "./card-types.js";

export async function setStorefrontPublication(db: PGlite, input: { inventoryItemIds: string[]; published: boolean }, actor: AuthenticatedUser) {
  if (!actor.roles?.includes("admin")) throw Object.assign(new Error("Se requiere rol administrador."), { statusCode: 403 });
  if (!input || !Array.isArray(input.inventoryItemIds) || !input.inventoryItemIds.length || input.inventoryItemIds.length > 5000 || typeof input.published !== "boolean") throw Object.assign(new Error("Selecciona entre 1 y 5000 items y un estado de publicacion valido."), { statusCode: 400 });
  const ids = input.inventoryItemIds.map(id => {
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw Object.assign(new Error("Item de publicacion invalido."), { statusCode: 400 });
    return id.toLowerCase();
  }).sort();
  if (new Set(ids).size !== ids.length) throw Object.assign(new Error("Hay items repetidos en la seleccion."), { statusCode: 400 });
  return inventoryTransaction(db, async connection => {
    const before = await connection.query<{ id: string; storefront_published: boolean }>("select id, storefront_published from inventory_items where business_id = $1 and id = any($2::uuid[]) order by id for update", [actor.businessId, ids]);
    if (before.rows.length !== ids.length) throw Object.assign(new Error("Uno de los items ya no existe o pertenece a otro negocio."), { statusCode: 400 });
    const changed = before.rows.filter(row => row.storefront_published !== input.published);
    if (changed.length) {
      await connection.query("update inventory_items set storefront_published = $1, updated_at = now() where business_id = $2 and id = any($3::uuid[])", [input.published, actor.businessId, changed.map(row => row.id)]);
      await connection.query(`insert into audit_log (id, business_id, actor_user_id, action, entity_type, entity_id, before_data, after_data) values ($1,$2,$3,'inventory.storefront_publication','inventory',$4,$5::jsonb,$6::jsonb)`, [crypto.randomUUID(), actor.businessId, actor.id, crypto.randomUUID(), JSON.stringify(changed), JSON.stringify({ inventoryItemIds: changed.map(row => row.id), published: input.published })]);
      await connection.query("update stock_read_snapshots set refreshed_at = '1970-01-01'::timestamptz where business_id = $1", [actor.businessId]);
    }
    return { items: ids.map(id => ({ id, storefrontPublished: input.published })), changedCount: changed.length };
  });
}

export async function listStoreCatalog(db: PGlite, query: Partial<StoreCatalogQuery> = {}, businessSlug = "ultimoturno") {
  const rows = await db.query<Record<string, unknown>>(`
    select ii.id, ii.item_kind, ii.card_type_override, ii.tags, p.name, p.expansion, coalesce(p.card_number, '') as card_number,
      v.language, v.condition, v.finish, coalesce(v.grading_company, '') as grading_company, coalesce(v.grade, '') as grade,
      cp.price_ars,
      greatest(0, ii.quantity_on_hand - ii.quantity_reserved - greatest(0, coalesce(assigned.remaining, 0) - coalesce(assigned_orders.reserved, 0)))::integer as free_quantity,
      coalesce(case when p.image_url ~ '^https?://' then p.image_url end, case when pic.public_url ~ '^https?://' then pic.public_url end, case when pce.image_url ~ '^https?://' then pce.image_url end, '') as image_url,
      coalesce(pc.external_id, '') as pricecharting_id
    from inventory_items ii
    join businesses b on b.id = ii.business_id and b.slug = $1
    join card_products p on p.id = ii.product_id and p.business_id = ii.business_id
    join card_variants v on v.id = ii.variant_id and v.business_id = ii.business_id
    join current_prices cp on cp.inventory_item_id = ii.id and cp.business_id = ii.business_id
    left join lateral (select sum(greatest(0, a.quantity_assigned - a.quantity_sold - a.quantity_returned)) as remaining from reseller_stock_assignments a where a.business_id = ii.business_id and a.inventory_item_id = ii.id) assigned on true
    left join lateral (select sum(si.quantity) as reserved from sales s join sale_items si on si.sale_id = s.id and si.business_id = s.business_id where s.business_id = ii.business_id and si.inventory_item_id = ii.id and s.sale_type = 'reservation' and s.status in ('pending','packed') and s.assigned_reseller_user_id is not null) assigned_orders on true
    left join lateral (select ei.external_id from external_identifiers ei join external_sources es on es.id = ei.source_id and es.name = 'pricecharting' where ei.business_id = ii.business_id and ei.product_id = p.id and (ei.variant_id is null or ei.variant_id = v.id) order by case when ei.variant_id = v.id then 0 else 1 end, ei.id limit 1) pc on true
    left join pricecharting_image_cache pic on pic.pricecharting_id = pc.external_id
    left join pricecharting_cache_entries pce on pce.pricecharting_id = pc.external_id
    where ii.storefront_published = true and ii.active = true and ii.inventory_status = 'available' and cp.price_ars > 0
      and ii.quantity_on_hand - ii.quantity_reserved - greatest(0, coalesce(assigned.remaining, 0) - coalesce(assigned_orders.reserved, 0)) > 0
      and not exists (
        select 1 from claim_cards cc join claim_sessions cs on cs.id = cc.claim_id and cs.business_id = cc.business_id and cs.status = 'open'
        where cc.business_id = ii.business_id and (
          cc.inventory_item_id = ii.id or cc.pricecharting_id = 'inventory:' || ii.id::text or exists (
            select 1 from external_identifiers ei join external_sources es on es.id = ei.source_id and es.name = 'pricecharting'
            where ei.business_id = ii.business_id and ei.product_id = p.id and (ei.variant_id is null or ei.variant_id = v.id) and ei.external_id = cc.pricecharting_id
          )
        )
      )
    order by p.name, ii.id
  `, [businessSlug]);
  const classifications = await classifyCatalogReferences(db, rows.rows.map(row => ({ name: String(row.name), expansion: String(row.expansion), number: String(row.card_number), priceChartingId: String(row.pricecharting_id), languageGroup: ({ EN: "english", JA: "japanese", JP: "japanese", CHS: "chinese", CH: "chinese", CN: "chinese", ZH: "chinese" } as Record<string, string>)[String(row.language).toUpperCase()] })));
  const items: StoreCatalogItem[] = rows.rows.map((row, index): StoreCatalogItem => {
    const cardType = isCardType(row.card_type_override) ? row.card_type_override : classifications[index].cardType;
    return {
      id: String(row.id), name: String(row.name), expansion: String(row.expansion), number: String(row.card_number), imageUrl: String(row.image_url),
      language: String(row.language), condition: String(row.condition), finish: String(row.finish), gradingCompany: String(row.grading_company), grade: String(row.grade),
      cardType,
      category: resolveStoreCategory({ itemKind: String(row.item_kind), cardType, number: String(row.card_number), tags: String(row.tags || "").split(",") }),
      itemKind: row.item_kind === "folder" ? "folder" : "standard", priceArs: Number(row.price_ars), availableQuantity: Number(row.free_quantity)
    };
  }).filter(item => Number.isFinite(item.priceArs) && item.priceArs > 0);
  return storeCatalogPage(items, query);
}
