begin;

alter table claim_cards
  add column if not exists inventory_item_id uuid references inventory_items(id) on delete set null;

alter table claim_cards
  add column if not exists stocked_quantity integer not null default 0 check (stocked_quantity >= 0);

create index if not exists idx_claim_cards_inventory_item on claim_cards (inventory_item_id);

commit;
