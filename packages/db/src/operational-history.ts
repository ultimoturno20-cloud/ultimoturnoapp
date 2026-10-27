import type { PGlite } from "@electric-sql/pglite";
import { normalizeHistoryQuery, type HistoryEntry, type HistoryPage } from "@ultimoturno/domain";
import type { AuthenticatedUser } from "./index.js";
import { canReadAdmin } from "@ultimoturno/domain";

export async function listOperationalHistory(db: PGlite, actor: AuthenticatedUser, input: Record<string, unknown> = {}): Promise<HistoryPage> {
  if (!canReadAdmin(actor.roles)) throw Object.assign(new Error("Se requiere acceso al panel."), { statusCode: 403 });
  const query = normalizeHistoryQuery(input);
  const stock = query.kind === "stock";
  const source = stock ? `
    select m.id, m.created_at, m.movement_type as action, 'inventory_item'::text as entity_type,
      m.inventory_item_id::text as entity_id, coalesce(u.display_name, '') as actor_name,
      m.inventory_item_id::text, ii.sku, p.name as item_name, m.quantity_delta, m.note
    from inventory_movements m
    join inventory_items ii on ii.id=m.inventory_item_id and ii.business_id=m.business_id
    join card_products p on p.id=ii.product_id and p.business_id=m.business_id
    left join app_users u on u.id=m.created_by and u.business_id=m.business_id
    cross join boundary b
    where m.business_id=$1 and m.created_at <= b.as_of
  ` : `
    select a.id, a.created_at, a.action, a.entity_type, a.entity_id,
      coalesce(u.display_name, '') as actor_name, ''::text as inventory_item_id,
      ''::text as sku, ''::text as item_name, null::integer as quantity_delta, ''::text as note
    from audit_log a
    left join app_users u on u.id=a.actor_user_id and u.business_id=a.business_id
    cross join boundary b
    where a.business_id=$1 and a.created_at <= b.as_of
  `;
  // Counts and bounded rows use one statement/snapshot. Cursor timestamps retain SQL microseconds.
  const result = await db.query<{
    as_of: string; total: number; matched_total: number; net_quantity: number | null;
    actions: Array<{ value: string; count: number }>; items: Array<Record<string, unknown>>;
  }>(`
    with boundary as (select coalesce(nullif($2::text, '')::timestamptz, statement_timestamp()) as as_of),
    scoped as (${source}),
    filtered as (
      select * from scoped
      where ($3::text='' or action=$3)
        and ($4::text='' or position(lower($4) in lower(concat_ws(' ', sku, item_name, note, actor_name, entity_type, entity_id, action))) > 0)
        and ($5::text='' or created_at >= (nullif($5, '')::date::timestamp at time zone 'America/Argentina/Buenos_Aires'))
        and ($6::text='' or created_at < ((nullif($6, '')::date + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'))
    ), page as (
      select * from filtered
      where ($7::text='' or (created_at, id) < (nullif($7, '')::timestamptz, $8::uuid))
      order by created_at desc, id desc limit $9
    )
    select b.as_of::text,
      (select count(*)::integer from scoped) as total,
      (select count(*)::integer from filtered) as matched_total,
      (select sum(quantity_delta)::bigint from filtered) as net_quantity,
      coalesce((select json_agg(x order by x.value) from (select action as value, count(*)::integer as count from scoped group by action) x), '[]'::json) as actions,
      coalesce((select jsonb_agg(to_jsonb(page) || jsonb_build_object('created_at', created_at::text) order by created_at desc, id desc) from page), '[]'::jsonb) as items
    from boundary b
  `, [actor.businessId, query.asOf, query.action, query.query, query.from, query.to, query.cursor?.at || "", query.cursor?.id || null, query.limit + 1]);
  const row = result.rows[0];
  const items: HistoryEntry[] = row.items.slice(0, query.limit).map((entry) => ({
    id: String(entry.id), createdAt: String(entry.created_at), action: String(entry.action),
    entityType: String(entry.entity_type), entityId: String(entry.entity_id), actorName: String(entry.actor_name),
    inventoryItemId: String(entry.inventory_item_id), sku: String(entry.sku), itemName: String(entry.item_name),
    quantityDelta: entry.quantity_delta === null ? null : Number(entry.quantity_delta), note: String(entry.note)
  }));
  const last = items[items.length - 1];
  return {
    items, total: Number(row.total), matchedTotal: Number(row.matched_total),
    netQuantity: stock ? Number(row.net_quantity || 0) : null, actions: row.actions,
    limit: query.limit, asOf: row.as_of,
    nextCursor: row.items.length > query.limit && last ? JSON.stringify({ at: last.createdAt, id: last.id }) : null
  };
}
