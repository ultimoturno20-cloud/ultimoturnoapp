begin;

create table if not exists mobile_inventory_entries (
  id uuid primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'rejected')),
  helper_name text not null default '',
  source text not null default 'mobile',
  match_type text not null default 'manual' check (match_type in ('inventory', 'card_index', 'manual')),
  inventory_item_id uuid references inventory_items(id) on delete set null,
  pricecharting_id text not null default '',
  sku text not null default '',
  name text not null default '',
  expansion text not null default '',
  card_number text not null default '',
  language text not null default 'EN',
  condition text not null default 'NM',
  finish text not null default 'normal',
  grading_company text not null default '',
  grade text not null default '',
  location text not null default '',
  intake_batch text not null default '',
  quantity_on_hand integer not null default 1 check (quantity_on_hand > 0),
  price_ars numeric(14, 2) not null default 0,
  price_usd numeric(12, 2),
  image_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references app_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_mobile_inventory_entries_business_status
  on mobile_inventory_entries (business_id, status, created_at desc);

create index if not exists idx_mobile_inventory_entries_business_helper
  on mobile_inventory_entries (business_id, helper_name, created_at desc);

create index if not exists idx_mobile_inventory_entries_pricecharting
  on mobile_inventory_entries (pricecharting_id)
  where pricecharting_id <> '';

commit;
