begin;

-- A PriceCharting card can back several products (for example the English and Spanish copy).
-- The old unique key moved the identifier to the newest product and unlinked the others.
do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'external_identifiers'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (business_id, source_id, external_id)';
  if constraint_name is not null then
    execute format('alter table external_identifiers drop constraint %I', constraint_name);
  end if;
end $$;

create unique index if not exists idx_external_identifiers_product_external
  on external_identifiers (business_id, source_id, external_id, product_id);

create index if not exists idx_external_identifiers_external_lookup
  on external_identifiers (business_id, source_id, external_id);

commit;
