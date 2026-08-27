begin;

create table if not exists pricecharting_cache_runs (
  id uuid primary key,
  category text not null,
  status text not null check (status in ('completed', 'failed')),
  rows_received integer not null default 0,
  rows_imported integer not null default 0,
  rows_skipped integer not null default 0,
  source_hash text not null default '',
  error_message text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create table if not exists pricecharting_cache_entries (
  pricecharting_id text primary key,
  canonical_url text not null default '',
  source_url text not null default '',
  product_name text not null,
  normalized_name text not null,
  expansion_name text not null default '',
  normalized_expansion text not null default '',
  card_number text not null default '',
  loose_price_usd numeric(12, 2),
  image_url text not null default '',
  search_key text not null,
  sync_run_id uuid not null references pricecharting_cache_runs(id),
  imported_at timestamptz not null default now()
);

create index if not exists idx_pricecharting_cache_search
  on pricecharting_cache_entries (search_key);

create index if not exists idx_pricecharting_cache_expansion_number
  on pricecharting_cache_entries (normalized_expansion, card_number);

create index if not exists idx_pricecharting_runs_completed
  on pricecharting_cache_runs (completed_at desc);

commit;
