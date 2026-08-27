begin;

alter table sale_items alter column inventory_item_id drop not null;
alter table sale_items add column if not exists display_name text not null default '';
alter table sale_items add column if not exists sku_snapshot text not null default '';
alter table sale_items add column if not exists source_reference text not null default '';

create table if not exists claim_sessions (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  name text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  source_note text not null default '',
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_sale_ids jsonb not null default '[]'::jsonb
);

create table if not exists claim_cards (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  claim_id uuid not null references claim_sessions(id) on delete cascade,
  pricecharting_id text not null,
  canonical_url text not null default '',
  product_name text not null,
  expansion_name text not null default '',
  card_number text not null default '',
  image_url text not null default '',
  pc_price_usd numeric(12, 2),
  suggested_ars numeric(12, 2) not null default 0,
  final_price_ars numeric(12, 2) not null default 0,
  final_price_usd numeric(12, 2) not null default 0,
  final_name text not null default '',
  buyer text not null default '',
  tags text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ready', 'sold', 'ignored')),
  grid_batch text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_id, pricecharting_id)
);

create table if not exists claim_frees (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  claim_id uuid not null references claim_sessions(id) on delete cascade,
  buyer text not null default '',
  final_name text not null,
  product_name text not null default '',
  expansion_name text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  pricecharting_id text not null default '',
  canonical_url text not null default '',
  tags text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists claim_grids (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  claim_id uuid not null references claim_sessions(id) on delete cascade,
  batch_name text not null,
  card_ids jsonb not null default '[]'::jsonb,
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_claim_sessions_business_status on claim_sessions (business_id, status, created_at desc);
create index if not exists idx_claim_cards_claim_sort on claim_cards (claim_id, sort_order, created_at);
create index if not exists idx_claim_cards_buyer on claim_cards (claim_id, buyer);
create index if not exists idx_claim_frees_claim on claim_frees (claim_id, buyer);
create index if not exists idx_claim_grids_claim on claim_grids (claim_id, created_at desc);

commit;
