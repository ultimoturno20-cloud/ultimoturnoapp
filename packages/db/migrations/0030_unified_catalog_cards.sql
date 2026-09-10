begin;

create or replace view unified_catalog_cards as
select
  pce.pricecharting_id as catalog_id,
  pce.pricecharting_id,
  coalesce(nullif(direct_cie.tcgplayer_product_id, ''), nullif(tcg_match.tcgplayer_product_id, ''), '') as tcgplayer_product_id,
  pce.canonical_url as pricecharting_url,
  coalesce(nullif(direct_cie.tcgplayer_url, ''), nullif(tcg_match.tcgplayer_url, ''), '') as tcgplayer_url,
  pce.product_name,
  pce.normalized_name,
  pce.expansion_name,
  pce.normalized_expansion,
  pce.card_number,
  pce.language_group,
  pce.loose_price_usd as pricecharting_price_usd,
  tcg_price.tcgplayer_price_usd,
  tcg_price.tcgplayer_subtype,
  coalesce(
    nullif(pic.public_url, ''),
    nullif(pic.source_image_url, ''),
    nullif(pce.image_url, ''),
    nullif(direct_cie.image_url, ''),
    nullif(tcg_match.image_url, ''),
    ''
  ) as image_url,
  case
    when coalesce(nullif(pic.public_url, ''), nullif(pic.source_image_url, ''), nullif(pce.image_url, ''), nullif(direct_cie.image_url, ''), nullif(tcg_match.image_url, ''), '') <> '' then true
    else false
  end as has_image,
  case
    when pce.loose_price_usd is not null then true
    else false
  end as has_pricecharting_price,
  case
    when tcg_price.tcgplayer_price_usd is not null then true
    else false
  end as has_tcgplayer_price,
  pce.search_key,
  pce.imported_at,
  greatest(
    coalesce(pce.imported_at, timestamp with time zone 'epoch'),
    coalesce(direct_cie.updated_at, timestamp with time zone 'epoch'),
    coalesce(tcg_match.updated_at, timestamp with time zone 'epoch')
  ) as updated_at
from pricecharting_cache_entries pce
left join pricecharting_image_cache pic using (pricecharting_id)
left join card_index_entries direct_cie on direct_cie.pricecharting_id = pce.pricecharting_id
left join lateral (
  select cie.image_url, cie.tcgplayer_product_id, cie.tcgplayer_url, cie.updated_at
  from card_index_entries cie
  where cie.pricecharting_id like 'tcgcsv-%'
    and (coalesce(cie.image_url, '') <> '' or coalesce(cie.tcgplayer_product_id, '') <> '')
    and cie.language_group = pce.language_group
    and cie.normalized_expansion = pce.normalized_expansion
    and regexp_replace(lower(split_part(coalesce(cie.card_number, ''), '/', 1)), '^0+', '') =
        regexp_replace(lower(split_part(coalesce(pce.card_number, ''), '/', 1)), '^0+', '')
  order by case when coalesce(cie.image_url, '') <> '' then 0 else 1 end, cie.updated_at desc
  limit 1
) tcg_match on true
left join lateral (
  select coalesce(tpce.market_price_usd, tpce.mid_price_usd, tpce.low_price_usd, tpce.direct_low_price_usd, tpce.high_price_usd) as tcgplayer_price_usd,
    tpce.sub_type_name as tcgplayer_subtype
  from tcgplayer_price_cache_entries tpce
  where tpce.tcgplayer_product_id = coalesce(nullif(direct_cie.tcgplayer_product_id, ''), nullif(tcg_match.tcgplayer_product_id, ''))
    and coalesce(tpce.market_price_usd, tpce.mid_price_usd, tpce.low_price_usd, tpce.direct_low_price_usd, tpce.high_price_usd) is not null
  order by case when lower(tpce.sub_type_name) in ('', 'normal') then 0 else 1 end,
    tpce.market_price_usd desc nulls last
  limit 1
) tcg_price on true;

commit;
