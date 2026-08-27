begin;

create table if not exists card_index_entries (
  id uuid primary key,
  pricecharting_id text not null unique references pricecharting_cache_entries(pricecharting_id) on delete cascade,
  canonical_name text not null,
  canonical_expansion text not null default '',
  card_number text not null default '',
  normalized_name text not null,
  normalized_expansion text not null default '',
  pricecharting_url text not null default '',
  pricecharting_image_url text not null default '',
  tcgplayer_product_id text not null default '',
  tcgplayer_url text not null default '',
  tcgplayer_image_url text not null default '',
  coolstuff_url text not null default '',
  image_url text not null default '',
  image_source text not null default '',
  match_confidence integer not null default 0,
  match_status text not null default 'pricecharting_only'
    check (match_status in ('pricecharting_only', 'matched', 'weak_match', 'conflict', 'manual')),
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz
);

create table if not exists card_source_links (
  id uuid primary key,
  card_index_id uuid not null references card_index_entries(id) on delete cascade,
  source text not null,
  external_id text not null default '',
  url text not null default '',
  raw_name text not null default '',
  raw_expansion text not null default '',
  raw_number text not null default '',
  raw_variant text not null default '',
  image_url text not null default '',
  confidence integer not null default 0,
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_index_id, source)
);

create table if not exists card_index_sync_runs (
  id uuid primary key,
  source text not null,
  status text not null check (status in ('completed', 'failed')),
  rows_seen integer not null default 0,
  rows_matched integer not null default 0,
  rows_weak integer not null default 0,
  rows_conflict integer not null default 0,
  error_message text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists idx_card_index_search
  on card_index_entries (normalized_name, normalized_expansion, card_number);

create index if not exists idx_card_index_tcgplayer
  on card_index_entries (tcgplayer_product_id);

create index if not exists idx_card_index_status
  on card_index_entries (match_status, match_confidence desc);

create index if not exists idx_card_source_links_source
  on card_source_links (source, external_id);

commit;
