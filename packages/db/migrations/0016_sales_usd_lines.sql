begin;

alter table sales
  add column if not exists total_usd numeric(12, 2) not null default 0;

alter table sale_items
  add column if not exists unit_price_usd numeric(12, 2) not null default 0,
  add column if not exists line_total_usd numeric(12, 2) not null default 0,
  add column if not exists price_currency text not null default 'ARS';

alter table sale_items
  drop constraint if exists sale_items_price_currency_check;

alter table sale_items
  add constraint sale_items_price_currency_check check (price_currency in ('ARS', 'USD', 'FREE'));

commit;
