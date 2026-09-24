begin;

create index if not exists idx_pricecharting_cache_search_fts
  on pricecharting_cache_entries using gin (
    to_tsvector('simple', search_key || ' ' || lower(pricecharting_id))
  );

commit;
