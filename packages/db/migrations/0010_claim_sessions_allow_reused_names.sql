begin;

alter table claim_sessions
  drop constraint if exists claim_sessions_business_id_name_key;

commit;
