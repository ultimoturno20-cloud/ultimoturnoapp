begin;

alter table sales
  add column if not exists assigned_reseller_user_id uuid references app_users(id),
  add column if not exists assigned_reseller_at timestamptz,
  add column if not exists assigned_reseller_by uuid references app_users(id);

create index if not exists idx_sales_assigned_reseller
  on sales (business_id, assigned_reseller_user_id, created_at desc)
  where assigned_reseller_user_id is not null;

commit;
