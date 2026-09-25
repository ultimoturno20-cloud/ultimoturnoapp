begin;

create index if not exists idx_pricecharting_cache_card_number_primary
  on pricecharting_cache_entries (
    regexp_replace(lower(split_part(card_number, '/', 1)), '^0+', '')
  );

create index if not exists idx_pricecharting_cache_language_group
  on pricecharting_cache_entries (language_group);

commit;
