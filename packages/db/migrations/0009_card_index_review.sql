begin;

alter table card_index_entries
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'manual'));

alter table card_index_entries
  add column if not exists review_note text not null default '';

alter table card_index_entries
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_card_index_review
  on card_index_entries (review_status, reviewed_at desc);

commit;
