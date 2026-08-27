alter table card_variants add column if not exists grading_company text;
alter table card_variants add column if not exists grade text;

drop index if exists idx_card_variants_unique_identity;
create unique index if not exists idx_card_variants_unique_identity
  on card_variants (business_id, product_id, language, condition, finish, coalesce(grading_company, ''), coalesce(grade, ''));
