begin;

alter table inventory_items add column if not exists tags text not null default '';

create index if not exists idx_inventory_items_business_tags
  on inventory_items (business_id, tags)
  where tags <> '';

commit;
