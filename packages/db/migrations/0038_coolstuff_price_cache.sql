begin;

create table if not exists coolstuff_price_cache (
  pricecharting_id text not null references pricecharting_cache_entries(pricecharting_id) on delete cascade,
  condition text not null default 'NM',
  finish text not null default 'normal',
  status text not null check (status in ('matched', 'not_found', 'ambiguous', 'failed')),
  coolstuff_url text not null default '',
  product_name text not null default '',
  expansion_name text not null default '',
  card_number text not null default '',
  source_condition text not null default '',
  price_usd numeric(12, 2),
  quantity integer not null default 0,
  confidence integer not null default 0,
  error_message text not null default '',
  last_attempt_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pricecharting_id, condition, finish)
);

create index if not exists idx_coolstuff_price_cache_next_attempt
  on coolstuff_price_cache (next_attempt_at, status);

create index if not exists idx_coolstuff_price_cache_url
  on coolstuff_price_cache (coolstuff_url);

commit;
