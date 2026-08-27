begin;

alter table sales
  add column if not exists internal_note text not null default '';

commit;
