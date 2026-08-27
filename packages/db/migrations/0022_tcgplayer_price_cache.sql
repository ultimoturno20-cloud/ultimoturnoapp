begin;

create table if not exists tcgplayer_price_cache_runs (
  id uuid primary key,
  source text not null default 'tcgcsv',
  category_id text not null default '3',
  source_version text not null default '',
  status text not null check (status in ('completed', 'failed', 'skipped')),
  groups_seen integer not null default 0,
  rows_received integer not null default 0,
  rows_imported integer not null default 0,
  rows_skipped integer not null default 0,
  error_message text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create table if not exists tcgplayer_price_cache_entries (
  tcgplayer_product_id text not null,
  sub_type_name text not null default '',
  low_price_usd numeric(12, 2),
  mid_price_usd numeric(12, 2),
  high_price_usd numeric(12, 2),
  market_price_usd numeric(12, 2),
  direct_low_price_usd numeric(12, 2),
  source_group_id text not null default '',
  sync_run_id uuid references tcgplayer_price_cache_runs(id) on delete set null,
  imported_at timestamptz not null default now(),
  primary key (tcgplayer_product_id, sub_type_name)
);

create index if not exists idx_tcgplayer_price_cache_market
  on tcgplayer_price_cache_entries (market_price_usd desc nulls last);

create index if not exists idx_tcgplayer_price_cache_run
  on tcgplayer_price_cache_entries (sync_run_id);

commit;
