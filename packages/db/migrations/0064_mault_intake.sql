create table if not exists mault_connections (
  business_id uuid primary key references businesses(id),
  config jsonb not null,
  version integer not null default 1,
  baseline_complete boolean not null default false,
  watermark text,
  next_page text,
  cycle_watermark text,
  lease_token uuid,
  lease_until timestamptz,
  last_sync_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists mault_copies (
  business_id uuid not null references businesses(id),
  copy_id text not null,
  payload jsonb not null,
  observed_fingerprint text not null,
  source_updated_at timestamptz not null,
  status text not null check(status in ('baseline','pending','ready','review','imported')),
  resolved jsonb,
  reasons jsonb not null default '[]'::jsonb,
  imported_fingerprint text,
  inventory_item_id uuid references inventory_items(id),
  applied_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(business_id,copy_id),
  check ((applied_at is null and imported_fingerprint is null and inventory_item_id is null)
    or (applied_at is not null and imported_fingerprint is not null and inventory_item_id is not null))
);
create index if not exists mault_copies_queue on mault_copies(business_id,status,updated_at,copy_id);
