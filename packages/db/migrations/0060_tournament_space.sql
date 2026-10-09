begin;
create table if not exists tournament_accounts (
  id uuid primary key,
  display_name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists tournament_sessions (
  token_hash text primary key,
  account_id uuid not null references tournament_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists tournament_sessions_account on tournament_sessions(account_id);
create table if not exists tournament_auth_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text not null,
  action text not null check (action in ('login','register')),
  attempted_at timestamptz not null default now()
);
create index if not exists tournament_auth_attempts_time on tournament_auth_attempts(attempted_at);
create table if not exists account_tournaments (
  id uuid primary key,
  account_id uuid not null references tournament_accounts(id),
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists account_tournaments_updated on account_tournaments(account_id, updated_at desc);
alter table tournament_accounts enable row level security;
alter table tournament_sessions enable row level security;
alter table tournament_auth_attempts enable row level security;
alter table account_tournaments enable row level security;
commit;
