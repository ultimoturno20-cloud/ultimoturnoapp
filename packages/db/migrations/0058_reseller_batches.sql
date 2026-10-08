begin;

create table if not exists reseller_batch_receipts (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  actor_user_id uuid not null references app_users(id),
  idempotency_key uuid not null,
  request_hash text not null,
  created_at timestamptz not null default now(),
  unique (business_id, actor_user_id, idempotency_key)
);

commit;
