begin;

alter table pricecharting_cache_entries
  add column if not exists language_group text not null default 'english';

alter table card_index_entries
  add column if not exists language_group text not null default 'english';

update pricecharting_cache_entries
set language_group = case
  when lower(coalesce(expansion_name, '') || ' ' || coalesce(product_name, '') || ' ' || coalesce(canonical_url, '')) similar to '%(chinese|china|simplified|traditional|taiwan|hong-kong|zh-cn|zh-tw)%' then 'chinese'
  when lower(coalesce(expansion_name, '') || ' ' || coalesce(product_name, '') || ' ' || coalesce(canonical_url, '')) similar to '%(japanese|japan|korean|korea|indonesia|indonesian|thai|thailand|vietnam|asia|jp|ja|kr|ko)%' then 'japanese'
  else 'english'
end
where language_group = 'english';

update card_index_entries
set language_group = case
  when lower(coalesce(canonical_expansion, '') || ' ' || coalesce(canonical_name, '') || ' ' || coalesce(pricecharting_url, '')) similar to '%(chinese|china|simplified|traditional|taiwan|hong-kong|zh-cn|zh-tw)%' then 'chinese'
  when lower(coalesce(canonical_expansion, '') || ' ' || coalesce(canonical_name, '') || ' ' || coalesce(pricecharting_url, '')) similar to '%(japanese|japan|korean|korea|indonesia|indonesian|thai|thailand|vietnam|asia|jp|ja|kr|ko)%' then 'japanese'
  else 'english'
end
where language_group = 'english';

alter table pricecharting_cache_entries
  drop constraint if exists pricecharting_cache_entries_language_group_check;

alter table pricecharting_cache_entries
  add constraint pricecharting_cache_entries_language_group_check
  check (language_group in ('english', 'chinese', 'japanese'));

alter table card_index_entries
  drop constraint if exists card_index_entries_language_group_check;

alter table card_index_entries
  add constraint card_index_entries_language_group_check
  check (language_group in ('english', 'chinese', 'japanese'));

create index if not exists idx_pricecharting_cache_language_group
  on pricecharting_cache_entries (language_group, normalized_expansion, card_number);

create index if not exists idx_card_index_language_group
  on card_index_entries (language_group, match_status, match_confidence desc);

commit;
