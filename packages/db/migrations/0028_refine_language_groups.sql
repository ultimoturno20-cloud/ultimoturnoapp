begin;

update pricecharting_cache_entries
set language_group = case
  when lower(coalesce(expansion_name, '') || ' ' || coalesce(product_name, '') || ' ' || coalesce(canonical_url, '')) similar to '%(chinese|china|simplified|traditional|taiwan|hong-kong|zh-cn|zh-tw)%' then 'chinese'
  when lower(coalesce(expansion_name, '') || ' ' || coalesce(product_name, '') || ' ' || coalesce(canonical_url, '')) similar to '%(japanese|japan|korean|korea|indonesia|indonesian|thai|thailand|vietnam|vietnamese|asia|asian)%' then 'japanese'
  else 'english'
end;

update card_index_entries
set language_group = case
  when lower(coalesce(canonical_expansion, '') || ' ' || coalesce(canonical_name, '') || ' ' || coalesce(pricecharting_url, '')) similar to '%(chinese|china|simplified|traditional|taiwan|hong-kong|zh-cn|zh-tw)%' then 'chinese'
  when lower(coalesce(canonical_expansion, '') || ' ' || coalesce(canonical_name, '') || ' ' || coalesce(pricecharting_url, '')) similar to '%(japanese|japan|korean|korea|indonesia|indonesian|thai|thailand|vietnam|vietnamese|asia|asian)%' then 'japanese'
  else 'english'
end;

commit;
