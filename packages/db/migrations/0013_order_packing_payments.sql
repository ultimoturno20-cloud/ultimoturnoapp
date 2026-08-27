begin;

alter table sales
  drop constraint if exists sales_status_check;

alter table sales
  add constraint sales_status_check check (status in ('pending', 'packed', 'paid', 'cancelled'));

alter table sales
  add column if not exists amount_paid_ars numeric(12, 2) not null default 0;

alter table sale_items
  add column if not exists packed_at timestamptz;

commit;
