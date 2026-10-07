begin;

create table if not exists collections (
  id uuid primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  collection_type text not null default 'collection'
    check (collection_type in ('collection', 'deck', 'sealed', 'other')),
  description text not null default '',
  sellable boolean not null default false,
  counts_in_valuation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_users(id)
);

create index if not exists idx_collections_business
  on collections (business_id, created_at desc);

create table if not exists collection_items (
  id uuid primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  pricecharting_id text not null references pricecharting_cache_entries(pricecharting_id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  source text not null default 'manual' check (source in ('manual', 'expansion')),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id),
  unique (collection_id, pricecharting_id)
);

create index if not exists idx_collection_items_collection
  on collection_items (collection_id, created_at desc);

commit;
