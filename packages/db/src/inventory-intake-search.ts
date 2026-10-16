import type { PGlite } from "@electric-sql/pglite";
import { inventoryLanguageGroup, normalizeIntakeSearchQuery, parseUiSearchQuery, scoreStockSearch, stockRowToCatalogEntry, uiSearchTokenVariants, type CatalogPickerEntry, type InventoryQueryItem } from "@ultimoturno/domain";
import { getInventoryItemsForActor, type AuthenticatedUser } from "./index.js";

function normalizedSql(expression: string) {
  return `trim(regexp_replace(replace(replace(lower(regexp_replace(normalize(coalesce(${expression},''),NFD), U&'[\\0300-\\036f]', '', 'g')),chr(39),''),chr(8217),''),'[^a-z0-9]+',' ','g'))`;
}

export async function searchInventoryIntakeCandidates(db: PGlite, actor: AuthenticatedUser, input: Record<string, unknown>, limit = 30): Promise<CatalogPickerEntry[]> {
  if (!actor.roles?.some(role => role === "admin" || role === "stock_owner")) throw Object.assign(new Error("No autorizado."), { statusCode: 403 });
  if (!Number.isInteger(limit) || limit < 1 || limit > 60) throw Object.assign(new Error("Limite de candidatos invalido."), { statusCode: 400 });
  const { query: text, languageGroup } = normalizeIntakeSearchQuery(input);
  const query = parseUiSearchQuery(text);
  const params: unknown[] = [actor.businessId, actor.roles.includes("admin") ? null : actor.id];
  const filters: string[] = [];
  for (const token of query.textTokens) {
    params.push(uiSearchTokenVariants(token));
    filters.push(`exists(select 1 from unnest($${params.length}::text[]) token where position(token in search_text)>0)`);
  }
  for (const token of query.numberTokens) {
    params.push(token);
    filters.push(`(position($${params.length} in replace(${normalizedSql("card_number")},' ',''))>0 or position($${params.length} in ${normalizedSql("sku")})>0)`);
  }
  // Only matching search metadata crosses SQL here. Expensive stock/price/folder joins run for selected IDs below.
  const result = await db.query<Record<string, unknown>>(`
    with scoped as (
      select ii.id,ii.sku,ii.location,ii.tags,p.name,p.expansion,p.card_number,
        v.language,v.condition,v.finish,v.grading_company,v.grade,v.grading_cert,
        coalesce(identifier_data.identifiers,'[]'::json) as identifiers,
        coalesce(pc_identifier.external_id,'') as pricecharting_id,
        ${normalizedSql("concat_ws(' ',p.name,p.expansion,ii.sku,v.language,v.condition,v.finish,v.grading_company,v.grade,v.grading_cert,ii.location,ii.tags,identifier_data.search_text)")} as search_text
      from inventory_items ii
      join card_products p on p.id=ii.product_id and p.business_id=ii.business_id
      join card_variants v on v.id=ii.variant_id and v.business_id=ii.business_id
      left join lateral (
        select json_agg(json_build_object('source',es.name,'externalId',ei.external_id,'url',ei.external_url) order by es.name,ei.id) as identifiers,
          string_agg(concat_ws(' ',es.name,ei.external_id,ei.external_url),' ' order by es.name,ei.id) as search_text
        from external_identifiers ei join external_sources es on es.id=ei.source_id
        where ei.business_id=ii.business_id and ei.product_id=p.id
      ) identifier_data on true
      left join lateral (
        select ei.external_id from external_identifiers ei join external_sources es on es.id=ei.source_id
        where ei.business_id=ii.business_id and es.name='pricecharting' and (ei.product_id=p.id or ei.variant_id=v.id)
        order by case when ei.variant_id=v.id then 0 else 1 end,ei.id limit 1
      ) pc_identifier on true
      where ii.business_id=$1 and ($2::uuid is null or ii.owner_user_id=$2)
    ) select * from scoped ${filters.length ? "where " + filters.join(" and ") : ""}
    order by name,language,condition
  `, params);
  const ranked = result.rows.map(row => {
    const item: Pick<InventoryQueryItem, "sku" | "location" | "tags" | "product" | "variant"> = {
      sku: String(row.sku), location: String(row.location || ""), tags: String(row.tags || ""),
      product: { name: String(row.name), expansion: String(row.expansion || ""), number: String(row.card_number || ""), identifiers: row.identifiers as InventoryQueryItem["product"]["identifiers"] },
      variant: { language: String(row.language), condition: String(row.condition), finish: String(row.finish), gradingCompany: String(row.grading_company || ""), grade: String(row.grade || ""), gradingCert: String(row.grading_cert || "") }
    };
    return { id: String(row.id), key: String(row.pricecharting_id || item.product.identifiers.find(value => value.source === "pricecharting")?.externalId || item.sku), item, score: scoreStockSearch(item, query) };
  }).filter(({ item, score }) => score > 0 && (languageGroup === "all" || inventoryLanguageGroup(item.variant.language) === languageGroup))
    .sort((a, b) => b.score - a.score || a.item.product.name.localeCompare(b.item.product.name, "es", { numeric: true }));
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const candidate of ranked) {
    if (seen.has(candidate.key)) continue;
    seen.add(candidate.key); ids.push(candidate.id);
    if (ids.length >= limit) break;
  }
  if (!ids.length) return [];
  return (await getInventoryItemsForActor(db, ids, actor)).map(stockRowToCatalogEntry);
}
