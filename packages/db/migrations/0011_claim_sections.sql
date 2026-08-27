begin;

create table if not exists claim_sections (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  claim_id uuid not null references claim_sessions(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_id, name)
);

alter table claim_cards
  add column if not exists section_id uuid references claim_sections(id) on delete set null;

create index if not exists idx_claim_sections_claim_sort on claim_sections (claim_id, sort_order, created_at);
create index if not exists idx_claim_cards_section on claim_cards (claim_id, section_id, sort_order);

commit;
