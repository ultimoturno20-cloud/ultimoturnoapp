begin;

create table businesses (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  default_currency text not null default 'ARS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_users (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  display_name text not null,
  email text,
  external_auth_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, display_name)
);

create table roles (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  name text not null,
  description text not null default '',
  unique (business_id, name)
);

create table user_roles (
  user_id uuid not null references app_users(id),
  role_id uuid not null references roles(id),
  primary key (user_id, role_id)
);

create table card_products (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  name text not null,
  expansion text not null,
  card_number text,
  image_url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table card_variants (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  product_id uuid not null references card_products(id),
  language text not null default 'EN',
  condition text not null default 'NM',
  finish text not null default 'normal',
  grading_company text,
  grade text
);

create table external_sources (
  id uuid primary key,
  name text not null unique,
  kind text not null,
  base_url text,
  active boolean not null default true
);

create table external_identifiers (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  source_id uuid not null references external_sources(id),
  product_id uuid references card_products(id),
  variant_id uuid references card_variants(id),
  external_id text not null,
  external_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  unique (business_id, source_id, external_id)
);

create table inventory_items (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  sku text not null,
  product_id uuid not null references card_products(id),
  variant_id uuid not null references card_variants(id),
  location text not null default '',
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku),
  check (quantity_reserved <= quantity_on_hand)
);

create table price_snapshots (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  inventory_item_id uuid references inventory_items(id),
  product_id uuid references card_products(id),
  source_id uuid references external_sources(id),
  price_ars numeric(12, 2),
  price_usd numeric(12, 2),
  exchange_rate numeric(12, 4),
  captured_at timestamptz not null default now(),
  note text not null default ''
);

create table current_prices (
  inventory_item_id uuid primary key references inventory_items(id),
  business_id uuid not null references businesses(id),
  price_ars numeric(12, 2),
  price_usd numeric(12, 2),
  manual_override boolean not null default false,
  source_snapshot_id uuid references price_snapshots(id),
  updated_at timestamptz not null default now()
);

create table inventory_movements (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  inventory_item_id uuid not null references inventory_items(id),
  movement_type text not null,
  quantity_delta integer not null,
  unit_cost_ars numeric(12, 2),
  unit_cost_usd numeric(12, 2),
  reference_type text,
  reference_id text,
  idempotency_key text,
  note text not null default '',
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table import_runs (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  source text not null,
  status text not null,
  file_name text not null,
  total_rows integer not null default 0,
  review_rows integer not null default 0,
  applied_rows integer not null default 0,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table import_rows (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  import_run_id uuid not null references import_runs(id),
  row_number integer not null,
  status text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  matched_product_id uuid references card_products(id),
  matched_variant_id uuid references card_variants(id),
  matched_inventory_item_id uuid references inventory_items(id),
  review_reason text not null default '',
  unique (import_run_id, row_number)
);

create table reservations (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  inventory_item_id uuid not null references inventory_items(id),
  quantity integer not null check (quantity > 0),
  status text not null,
  channel text not null default 'admin',
  external_cart_id text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  released_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table audit_log (
  id uuid primary key,
  business_id uuid references businesses(id),
  actor_user_id uuid references app_users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table idempotency_keys (
  business_id uuid not null references businesses(id),
  key text not null,
  action text not null,
  request_hash text not null default '',
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id, key)
);

create index idx_card_products_business_name on card_products (business_id, name);
create unique index idx_card_variants_unique_identity
  on card_variants (business_id, product_id, language, condition, finish, coalesce(grading_company, ''), coalesce(grade, ''));
create index idx_inventory_items_business_product on inventory_items (business_id, product_id);
create index idx_inventory_movements_item_created on inventory_movements (inventory_item_id, created_at desc);
create index idx_import_rows_run_status on import_rows (import_run_id, status);
create index idx_reservations_item_status on reservations (inventory_item_id, status);
create index idx_audit_log_entity on audit_log (entity_type, entity_id);

commit;
