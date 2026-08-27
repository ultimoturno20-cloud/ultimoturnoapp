begin;

alter table pricecharting_image_cache
  drop constraint if exists pricecharting_image_cache_status_check;

alter table pricecharting_image_cache
  add constraint pricecharting_image_cache_status_check
  check (status in ('pending', 'url_found', 'downloaded', 'failed'));

commit;
