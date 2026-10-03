begin;

-- Open orders without a due date never show as overdue. New reservations default
-- to +7 days in application code; this backfills the ones already open.
update sales
set payment_due_at = ((created_at at time zone 'America/Argentina/Buenos_Aires')::date + 7)
where payment_due_at is null
  and sale_type = 'reservation'
  and status not in ('cancelled', 'paid', 'delivered');

update claim_sessions
set payment_due_at = ((created_at at time zone 'America/Argentina/Buenos_Aires')::date + 7)
where payment_due_at is null
  and status = 'open';

commit;
