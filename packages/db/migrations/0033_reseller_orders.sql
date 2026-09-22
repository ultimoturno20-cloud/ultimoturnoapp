begin;

create table if not exists reseller_orders (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  reseller_user_id uuid not null references app_users(id),
  customer_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'converted', 'cancelled')),
  total_ars numeric(14,2) not null default 0 check (total_ars >= 0),
  notes text not null default '',
  converted_sale_id uuid references reseller_sales(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists idx_reseller_orders_user
  on reseller_orders (business_id, reseller_user_id, created_at desc);

create table if not exists reseller_order_items (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  order_id uuid not null references reseller_orders(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity integer not null check (quantity > 0),
  unit_price_ars numeric(14,2) not null check (unit_price_ars >= 0),
  line_total_ars numeric(14,2) not null check (line_total_ars >= 0)
);

create index if not exists idx_reseller_order_items_order on reseller_order_items (order_id);

alter table reseller_sales add column if not exists reseller_order_id uuid references reseller_orders(id);
create unique index if not exists idx_reseller_sales_order on reseller_sales (reseller_order_id) where reseller_order_id is not null;

commit;
