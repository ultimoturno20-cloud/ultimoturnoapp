begin;

alter table claim_cards
  add column if not exists quantity integer not null default 1 check (quantity > 0);

commit;
