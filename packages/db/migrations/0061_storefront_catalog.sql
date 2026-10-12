begin;

alter table inventory_items add column if not exists storefront_published boolean not null default false;
create index if not exists inventory_storefront_published_idx on inventory_items (business_id, id) where storefront_published and active;
create index if not exists claim_cards_inventory_lookup_idx on claim_cards (business_id, inventory_item_id, claim_id);

-- Only derived read snapshots are invalidated; no quantities, prices or orders change.
update stock_read_snapshots set refreshed_at = '1970-01-01'::timestamptz;

commit;
