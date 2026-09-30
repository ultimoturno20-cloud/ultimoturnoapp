begin;

-- Failed logins, used to throttle password guessing across serverless instances.
create table if not exists auth_login_failures (
  id uuid primary key,
  email text not null,
  ip text not null default '',
  attempted_at timestamptz not null default now()
);

create index if not exists idx_auth_login_failures_email on auth_login_failures (lower(email), attempted_at);
create index if not exists idx_auth_login_failures_ip on auth_login_failures (ip, attempted_at);

commit;
