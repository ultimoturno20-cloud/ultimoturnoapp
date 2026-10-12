begin;

create table if not exists store_settings (
  business_id uuid primary key references businesses(id),
  enabled boolean not null default false,
  reservation_minutes integer not null default 30 check (reservation_minutes between 5 and 1440),
  pickup boolean not null default true,
  shipping boolean not null default true,
  payment_instructions text not null default '',
  contact_instructions text not null default ''
);

create table if not exists store_orders (
  sale_id uuid primary key references sales(id),
  business_id uuid not null references businesses(id),
  idempotency_key uuid not null,
  request_hash text not null,
  receipt jsonb not null,
  customer_email text not null,
  customer_phone text not null,
  fulfillment text not null check (fulfillment in ('pickup','shipping')),
  address text not null default '',
  expires_at timestamptz not null,
  expired_at timestamptz,
  unique (business_id,idempotency_key)
);
create index if not exists idx_store_orders_expiry on store_orders(business_id,expires_at) where expired_at is null;

create table if not exists store_checkout_attempts (
  business_id uuid not null references businesses(id),
  ip_hash text not null,
  email_hash text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_store_checkout_attempts_window on store_checkout_attempts(business_id,attempted_at);

-- La misma fila de stock coordina checkout y nuevas incorporaciones al claim.
create or replace function prevent_claim_with_web_reservation() returns trigger language plpgsql as $$
declare item_id uuid;
begin
  if exists(select 1 from claim_sessions where id=new.claim_id and business_id=new.business_id and status='open') then
    for item_id in
      select ii.id from inventory_items ii
      where ii.business_id=new.business_id and (
        ii.id=new.inventory_item_id or new.pricecharting_id='inventory:'||ii.id::text or exists(
          select 1 from external_identifiers ei join external_sources es on es.id=ei.source_id and es.name='pricecharting'
          where ei.business_id=ii.business_id and ei.product_id=ii.product_id and (ei.variant_id is null or ei.variant_id=ii.variant_id) and ei.external_id=new.pricecharting_id
        )
      ) order by ii.id for update of ii
    loop
      if exists(select 1 from reservations r join store_orders w on w.sale_id::text=r.external_cart_id and w.business_id=r.business_id join sales s on s.id=w.sale_id and s.business_id=w.business_id where r.business_id=new.business_id and r.inventory_item_id=item_id and r.status='active' and s.status in ('pending','packed')) then
        raise exception 'Hay unidades reservadas por un pedido web. Resuelve esa orden antes de agregar la carta al claim.';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists claim_web_reservation_guard on claim_cards;
create trigger claim_web_reservation_guard before insert or update of inventory_item_id,pricecharting_id on claim_cards for each row execute function prevent_claim_with_web_reservation();

commit;
