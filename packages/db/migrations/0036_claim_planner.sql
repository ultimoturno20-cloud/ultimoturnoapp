begin;

alter table claim_cards
  add column if not exists stock_origin text not null default 'claim_added'
  check (stock_origin in ('claim_added', 'existing'));

create table if not exists claim_plans (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  target_date date,
  ai_prompt text not null default '',
  published_claim_id uuid references claim_sessions(id) on delete set null,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists claim_plan_items (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  plan_id uuid not null references claim_plans(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  section_name text not null default '',
  final_price_ars numeric(12, 2) not null default 0,
  tags text not null default '',
  ai_reason text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, inventory_item_id)
);

create index if not exists idx_claim_plans_business_status
  on claim_plans (business_id, status, updated_at desc);

create index if not exists idx_claim_plan_items_plan_sort
  on claim_plan_items (plan_id, sort_order, created_at);

commit;
