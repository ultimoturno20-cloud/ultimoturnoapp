begin;

-- Independent valuation drafts: no inventory, sale or claim relationships.
create table if not exists lot_quotes (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  created_by uuid not null references app_users(id),
  version integer not null check (version > 0),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  last_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lot_quotes_business_updated on lot_quotes (business_id, updated_at desc, id);

commit;
