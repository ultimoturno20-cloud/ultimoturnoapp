begin;

alter table reseller_orders
  add column if not exists fulfillment_status text not null default 'to_pack';

alter table reseller_orders
  add column if not exists payment_status text not null default 'pending';

alter table reseller_orders
  add column if not exists packed_at timestamptz;

alter table reseller_orders
  add column if not exists delivered_at timestamptz;

alter table reseller_orders
  add column if not exists paid_at timestamptz;

alter table reseller_orders
  drop constraint if exists reseller_orders_fulfillment_status_check;

alter table reseller_orders
  add constraint reseller_orders_fulfillment_status_check
  check (fulfillment_status in ('to_pack', 'to_deliver', 'delivered'));

alter table reseller_orders
  drop constraint if exists reseller_orders_payment_status_check;

alter table reseller_orders
  add constraint reseller_orders_payment_status_check
  check (payment_status in ('pending', 'paid'));

create index if not exists idx_reseller_orders_workflow
  on reseller_orders (business_id, reseller_user_id, fulfillment_status, payment_status);

commit;
