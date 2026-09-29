begin;

alter table reseller_profiles
  add column if not exists credit_limit_ars numeric(14,2)
  check (credit_limit_ars is null or credit_limit_ars >= 0);

commit;
