begin;

alter table stock_read_snapshots
  add column if not exists payload_compressed text;

commit;
