begin;

create table if not exists reseller_stock_requests (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  reseller_user_id uuid not null references app_users(id),
  inventory_item_id uuid not null references inventory_items(id),
  quantity_requested integer not null check (quantity_requested > 0),
  price_ars_snapshot numeric(14,2) not null default 0 check (price_ars_snapshot >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_quantity integer check (resolved_quantity is null or resolved_quantity > 0),
  resolved_price_ars numeric(14,2) check (resolved_price_ars is null or resolved_price_ars >= 0),
  reviewed_by uuid references app_users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_reseller_stock_requests_pending
  on reseller_stock_requests (business_id, reseller_user_id, inventory_item_id)
  where status = 'pending';

create index if not exists idx_reseller_stock_requests_admin
  on reseller_stock_requests (business_id, status, created_at desc);

create index if not exists idx_reseller_stock_requests_reseller
  on reseller_stock_requests (business_id, reseller_user_id, created_at desc);

commit;
