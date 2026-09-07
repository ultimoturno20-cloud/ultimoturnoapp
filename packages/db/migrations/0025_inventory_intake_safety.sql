alter table inventory_items add column if not exists purchase_cost numeric(14,2) check (purchase_cost >= 0);
alter table inventory_items add column if not exists purchase_currency text not null default 'ARS' check (purchase_currency in ('ARS', 'USD'));
alter table mobile_inventory_entries add column if not exists applied_at timestamptz;
create index if not exists import_runs_request_key on import_runs (business_id, (summary_json->>'requestKey')) where status = 'completed';
