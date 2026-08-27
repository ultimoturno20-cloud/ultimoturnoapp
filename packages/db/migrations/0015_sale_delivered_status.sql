begin;

alter table sales
  drop constraint if exists sales_status_check;

alter table sales
  add constraint sales_status_check check (status in ('pending', 'packed', 'paid', 'delivered', 'cancelled'));

commit;
