begin;

create table if not exists sales (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  customer_name text not null default '',
  sale_type text not null check (sale_type in ('sale', 'reservation')),
  status text not null check (status in ('pending', 'paid', 'cancelled')),
  channel text not null default 'mostrador',
  total_ars numeric(12, 2) not null default 0,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists sale_items (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  sale_id uuid not null references sales(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity integer not null check (quantity > 0),
  unit_price_ars numeric(12, 2) not null check (unit_price_ars >= 0),
  line_total_ars numeric(12, 2) not null check (line_total_ars >= 0)
);

create table if not exists purchases (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  seller_name text not null default '',
  status text not null default 'received' check (status in ('received', 'cancelled')),
  total_ars numeric(12, 2) not null default 0,
  note text not null default '',
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table if not exists purchase_items (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  purchase_id uuid not null references purchases(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity integer not null check (quantity > 0),
  unit_cost_ars numeric(12, 2) not null check (unit_cost_ars >= 0),
  line_total_ars numeric(12, 2) not null check (line_total_ars >= 0)
);

create index if not exists idx_sales_business_created on sales (business_id, created_at desc);
create index if not exists idx_sales_business_status on sales (business_id, status, sale_type);
create index if not exists idx_sale_items_sale on sale_items (sale_id);
create index if not exists idx_purchases_business_created on purchases (business_id, created_at desc);
create index if not exists idx_purchase_items_purchase on purchase_items (purchase_id);

commit;
