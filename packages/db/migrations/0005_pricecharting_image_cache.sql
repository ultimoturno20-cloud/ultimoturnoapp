begin;

create table if not exists pricecharting_image_cache (
  pricecharting_id text primary key references pricecharting_cache_entries(pricecharting_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'downloaded', 'failed')),
  priority integer not null default 100,
  source_page_url text not null default '',
  source_image_url text not null default '',
  local_path text not null default '',
  public_url text not null default '',
  content_type text not null default '',
  byte_size integer not null default 0,
  content_hash text not null default '',
  attempts integer not null default 0,
  error_message text not null default '',
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pricecharting_image_cache_queue
  on pricecharting_image_cache (status, next_attempt_at, priority, updated_at);

create index if not exists idx_pricecharting_image_cache_priority
  on pricecharting_image_cache (priority, status);

commit;
