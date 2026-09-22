begin;

insert into roles (id, business_id, name, description)
select gen_random_uuid(), b.id, 'reseller', 'Revendedor en consignacion'
from businesses b
where not exists (
  select 1 from roles r where r.business_id = b.id and r.name = 'reseller'
);

create table if not exists reseller_profiles (
  user_id uuid primary key references app_users(id),
  business_id uuid not null references businesses(id),
  commission_percent numeric(5,2) not null default 20 check (commission_percent >= 0 and commission_percent <= 100),
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reseller_profiles_business on reseller_profiles (business_id, updated_at desc);

create table if not exists reseller_stock_assignments (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  reseller_user_id uuid not null references app_users(id),
  inventory_item_id uuid not null references inventory_items(id),
  quantity_assigned integer not null default 0 check (quantity_assigned >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  quantity_returned integer not null default 0 check (quantity_returned >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reseller_user_id, inventory_item_id),
  check (quantity_sold + quantity_returned <= quantity_assigned)
);

create index if not exists idx_reseller_assignments_reseller on reseller_stock_assignments (business_id, reseller_user_id, updated_at desc);
create index if not exists idx_reseller_assignments_item on reseller_stock_assignments (business_id, inventory_item_id);

create table if not exists reseller_stock_events (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  reseller_user_id uuid not null references app_users(id),
  inventory_item_id uuid not null references inventory_items(id),
  event_type text not null check (event_type in ('assign', 'return', 'sale', 'sale_cancel')),
  quantity integer not null check (quantity > 0),
  reference_type text not null default '',
  reference_id uuid,
  note text not null default '',
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_reseller_stock_events_user on reseller_stock_events (business_id, reseller_user_id, created_at desc);

create table if not exists reseller_sales (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  reseller_user_id uuid not null references app_users(id),
  customer_name text not null default '',
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  gross_total_ars numeric(14,2) not null default 0 check (gross_total_ars >= 0),
  commission_percent numeric(5,2) not null check (commission_percent >= 0 and commission_percent <= 100),
  commission_ars numeric(14,2) not null default 0 check (commission_ars >= 0),
  net_due_ars numeric(14,2) not null default 0 check (net_due_ars >= 0),
  notes text not null default '',
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references app_users(id)
);

create index if not exists idx_reseller_sales_user on reseller_sales (business_id, reseller_user_id, sold_at desc);

create table if not exists reseller_sale_items (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  sale_id uuid not null references reseller_sales(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity integer not null check (quantity > 0),
  unit_price_ars numeric(14,2) not null check (unit_price_ars >= 0),
  line_total_ars numeric(14,2) not null check (line_total_ars >= 0)
);

create index if not exists idx_reseller_sale_items_sale on reseller_sale_items (sale_id);

create table if not exists reseller_settlements (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  reseller_user_id uuid not null references app_users(id),
  amount_ars numeric(14,2) not null check (amount_ars > 0),
  note text not null default '',
  settled_at timestamptz not null default now(),
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_reseller_settlements_user on reseller_settlements (business_id, reseller_user_id, settled_at desc);

commit;
