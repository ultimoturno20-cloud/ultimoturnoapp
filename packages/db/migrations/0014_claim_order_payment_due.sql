begin;

alter table claim_sessions
  add column if not exists payment_due_at date;

alter table sales
  add column if not exists payment_due_at date;

commit;
