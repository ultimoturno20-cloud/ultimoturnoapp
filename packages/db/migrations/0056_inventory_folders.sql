begin;

alter table inventory_items
  add column if not exists item_kind text not null default 'standard'
  check (item_kind in ('standard', 'folder'));

do $$
begin
  alter table inventory_items add constraint inventory_folder_single_unit
    check (item_kind <> 'folder' or quantity_on_hand <= 1);
exception when duplicate_object then null;
end $$;

create table if not exists inventory_folder_entries (
  id uuid primary key,
  business_id uuid not null references businesses(id),
  inventory_item_id uuid not null references inventory_items(id),
  entry_key text not null,
  pricecharting_id text,
  name text not null,
  expansion text not null default '',
  card_number text not null default '',
  finish text not null default 'normal',
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (inventory_item_id, entry_key)
);

create index if not exists idx_inventory_folder_business
  on inventory_folder_entries (business_id, inventory_item_id);

create index if not exists idx_inventory_folder_pricecharting
  on inventory_folder_entries (pricecharting_id);

commit;
