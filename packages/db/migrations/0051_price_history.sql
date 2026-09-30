begin;

-- Daily market prices per card. The daily job stores a point only when the price
-- changed, so a card's price on a given day is its latest point on or before it.
create table if not exists price_history (
  snapshot_date date not null,
  pricecharting_id text not null,
  finish text not null default '',
  condition text not null default '',
  source text not null check (source in ('pricecharting', 'tcgplayer', 'coolstuff', 'tcgapi')),
  price_usd numeric(12, 2) not null check (price_usd > 0),
  recorded_at timestamptz not null default now(),
  primary key (pricecharting_id, finish, condition, source, snapshot_date)
);

create index if not exists idx_price_history_snapshot_date on price_history (snapshot_date);

commit;
