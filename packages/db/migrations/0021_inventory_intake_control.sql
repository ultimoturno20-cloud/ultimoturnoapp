begin;

alter table inventory_items add column if not exists intake_batch text not null default '';
alter table inventory_items add column if not exists inventory_status text not null default 'available';

alter table import_runs add column if not exists batch_name text not null default '';
alter table import_runs add column if not exists default_location text not null default '';
alter table import_runs add column if not exists note text not null default '';
alter table import_runs add column if not exists summary_json jsonb not null default '{}'::jsonb;

create index if not exists idx_inventory_items_business_intake_batch
  on inventory_items (business_id, intake_batch)
  where intake_batch <> '';

create index if not exists idx_inventory_items_business_status
  on inventory_items (business_id, inventory_status);

commit;
