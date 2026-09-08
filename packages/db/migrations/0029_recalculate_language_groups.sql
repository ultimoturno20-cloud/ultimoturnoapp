begin;

with normalized as (
  select
    pricecharting_id,
    regexp_replace(lower(coalesce(expansion_name, '') || ' ' || coalesce(product_name, '') || ' ' || coalesce(canonical_url, '')), '[^a-z0-9]+', ' ', 'g') as text
  from pricecharting_cache_entries
)
update pricecharting_cache_entries pce
set language_group = case
  when (' ' || normalized.text || ' ') like '% chinese %'
    or (' ' || normalized.text || ' ') like '% china %'
    or (' ' || normalized.text || ' ') like '% simplified %'
    or (' ' || normalized.text || ' ') like '% traditional %'
    or (' ' || normalized.text || ' ') like '% taiwan %'
    or (' ' || normalized.text || ' ') like '% hong kong %'
    or (' ' || normalized.text || ' ') like '% zh cn %'
    or (' ' || normalized.text || ' ') like '% zh tw %'
    or (' ' || normalized.text || ' ') like '% cn %'
    or (' ' || normalized.text || ' ') like '% chs %'
    or (' ' || normalized.text || ' ') like '% cht %'
  then 'chinese'
  when (' ' || normalized.text || ' ') like '% japanese %'
    or (' ' || normalized.text || ' ') like '% japan %'
    or (' ' || normalized.text || ' ') like '% korean %'
    or (' ' || normalized.text || ' ') like '% korea %'
    or (' ' || normalized.text || ' ') like '% indonesia %'
    or (' ' || normalized.text || ' ') like '% indonesian %'
    or (' ' || normalized.text || ' ') like '% thai %'
    or (' ' || normalized.text || ' ') like '% thailand %'
    or (' ' || normalized.text || ' ') like '% vietnam %'
    or (' ' || normalized.text || ' ') like '% vietnamese %'
    or (' ' || normalized.text || ' ') like '% asia %'
    or (' ' || normalized.text || ' ') like '% asian %'
    or (' ' || normalized.text || ' ') like '% jp %'
    or (' ' || normalized.text || ' ') like '% ja %'
    or (' ' || normalized.text || ' ') like '% kr %'
    or (' ' || normalized.text || ' ') like '% ko %'
  then 'japanese'
  else 'english'
end
from normalized
where normalized.pricecharting_id = pce.pricecharting_id;

with normalized as (
  select
    id,
    regexp_replace(lower(coalesce(canonical_expansion, '') || ' ' || coalesce(canonical_name, '') || ' ' || coalesce(pricecharting_url, '')), '[^a-z0-9]+', ' ', 'g') as text
  from card_index_entries
)
update card_index_entries cie
set language_group = case
  when (' ' || normalized.text || ' ') like '% chinese %'
    or (' ' || normalized.text || ' ') like '% china %'
    or (' ' || normalized.text || ' ') like '% simplified %'
    or (' ' || normalized.text || ' ') like '% traditional %'
    or (' ' || normalized.text || ' ') like '% taiwan %'
    or (' ' || normalized.text || ' ') like '% hong kong %'
    or (' ' || normalized.text || ' ') like '% zh cn %'
    or (' ' || normalized.text || ' ') like '% zh tw %'
    or (' ' || normalized.text || ' ') like '% cn %'
    or (' ' || normalized.text || ' ') like '% chs %'
    or (' ' || normalized.text || ' ') like '% cht %'
  then 'chinese'
  when (' ' || normalized.text || ' ') like '% japanese %'
    or (' ' || normalized.text || ' ') like '% japan %'
    or (' ' || normalized.text || ' ') like '% korean %'
    or (' ' || normalized.text || ' ') like '% korea %'
    or (' ' || normalized.text || ' ') like '% indonesia %'
    or (' ' || normalized.text || ' ') like '% indonesian %'
    or (' ' || normalized.text || ' ') like '% thai %'
    or (' ' || normalized.text || ' ') like '% thailand %'
    or (' ' || normalized.text || ' ') like '% vietnam %'
    or (' ' || normalized.text || ' ') like '% vietnamese %'
    or (' ' || normalized.text || ' ') like '% asia %'
    or (' ' || normalized.text || ' ') like '% asian %'
    or (' ' || normalized.text || ' ') like '% jp %'
    or (' ' || normalized.text || ' ') like '% ja %'
    or (' ' || normalized.text || ' ') like '% kr %'
    or (' ' || normalized.text || ' ') like '% ko %'
  then 'japanese'
  else 'english'
end
from normalized
where normalized.id = cie.id;

commit;
