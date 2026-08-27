begin;

alter table app_users add column if not exists password_hash text not null default '';
alter table app_users add column if not exists last_login_at timestamptz;

create unique index if not exists idx_app_users_business_email
  on app_users (business_id, lower(email))
  where email is not null;

create table if not exists app_sessions (
  token_hash text primary key,
  business_id uuid not null references businesses(id),
  user_id uuid not null references app_users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_user_expires on app_sessions (user_id, expires_at desc);

create index if not exists idx_inventory_items_business_sku on inventory_items (business_id, sku);
create index if not exists idx_current_prices_business on current_prices (business_id, updated_at desc);

commit;
