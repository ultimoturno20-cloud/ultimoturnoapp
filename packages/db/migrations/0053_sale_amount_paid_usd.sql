begin;

alter table sales
  add column if not exists amount_paid_usd numeric(12, 2) not null default 0;

commit;
