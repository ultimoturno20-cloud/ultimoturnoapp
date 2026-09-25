begin;

create table if not exists stock_read_snapshots (
  business_id uuid primary key references businesses(id) on delete cascade,
  payload jsonb,
  refreshed_at timestamptz not null default timestamp with time zone 'epoch',
  refresh_started_at timestamptz
);

commit;
