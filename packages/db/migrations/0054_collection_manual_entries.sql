begin;

create table if not exists collection_manual_entries (
  id uuid primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  collection_key text not null,
  pricecharting_id text not null references pricecharting_cache_entries(pricecharting_id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references app_users(id),
  unique (business_id, collection_key, pricecharting_id)
);

create index if not exists idx_collection_manual_entries_collection
  on collection_manual_entries (business_id, collection_key, created_at desc);

commit;
