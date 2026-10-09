begin;
create table if not exists tournaments (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  created_by uuid not null references app_users(id),
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tournaments_business_updated on tournaments(business_id, updated_at desc);
-- Acceso únicamente por la API autenticada; no exposición directa mediante Supabase.
alter table tournaments enable row level security;
commit;
