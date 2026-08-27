begin;

alter table sales
  add column if not exists message_sent_at timestamptz;

commit;
