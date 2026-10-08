begin;

alter table inventory_items add column if not exists card_type_override text
  check (card_type_override in ('pokemon', 'supporter', 'item', 'stadium', 'tool', 'energy', 'unknown'));

-- Invalidate only derived read caches; operational stock/orders/claims are untouched.
update stock_read_snapshots set refreshed_at = '1970-01-01'::timestamptz;

commit;
