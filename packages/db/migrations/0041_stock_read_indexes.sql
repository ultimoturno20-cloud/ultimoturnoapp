begin;

create index if not exists idx_external_identifiers_product_lookup
  on external_identifiers (business_id, product_id, source_id, id)
  where product_id is not null;

create index if not exists idx_external_identifiers_variant_lookup
  on external_identifiers (business_id, variant_id, source_id, id)
  where variant_id is not null;

create index if not exists idx_purchase_items_inventory_purchase
  on purchase_items (inventory_item_id, purchase_id);

commit;
