begin;

insert into businesses (id, name, slug, default_currency) values
  ('11111111-1111-4111-8111-111111111111', 'UltimoTurno Demo', 'ultimoturno-demo', 'ARS');

insert into app_users (id, business_id, display_name, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Seb Demo', 'seb.demo@example.invalid'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Mesa Demo', 'mesa.demo@example.invalid');

insert into roles (id, business_id, name, description) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111', 'admin', 'Admin ficticio'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111', 'stock_reader', 'Lectura de stock');

insert into user_roles (user_id, role_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');

insert into external_sources (id, name, kind, base_url) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'PriceCharting Demo', 'price_reference', 'https://example.invalid/pricecharting'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'TCGplayer Demo', 'price_reference', 'https://example.invalid/tcgplayer'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'MonPrice Demo', 'scanner_import', 'https://example.invalid/monprice');

insert into card_products (id, business_id, name, expansion, card_number, image_url, notes) values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Pikachu Demo', 'Sample Sparks', '025', '', 'Producto ficticio'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Charizard Demo', 'Sample Flames', '006', '', 'Producto ficticio'),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 'Eevee Demo', 'Sample Eeveelutions', '133', '', 'Producto ficticio');

insert into card_variants (id, business_id, product_id, language, condition, finish) values
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'EN', 'NM', 'holo'),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'JA', 'LP', 'normal'),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223', 'CHS', 'NM', 'reverse');

insert into external_identifiers (id, business_id, source_id, product_id, variant_id, external_id, external_url) values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '22222222-2222-4222-8222-222222222221', null, 'demo-pikachu-025', 'https://example.invalid/pikachu'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '22222222-2222-4222-8222-222222222222', null, 'demo-charizard-006', 'https://example.invalid/charizard'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '22222222-2222-4222-8222-222222222223', null, 'scan-eevee-133', null);

insert into inventory_items (id, business_id, sku, product_id, variant_id, location, quantity_on_hand, quantity_reserved, active) values
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', 'DEMO-PC-025-EN-NM-HOLO', '22222222-2222-4222-8222-222222222221', '33333333-3333-4333-8333-333333333331', 'Carpeta demo', 4, 1, true),
  ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', 'DEMO-CZ-006-JA-LP', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333332', 'Vitrina demo', 1, 0, true),
  ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', 'DEMO-EE-133-CHS-NM-REV', '22222222-2222-4222-8222-222222222223', '33333333-3333-4333-8333-333333333333', 'Caja scanner demo', 8, 0, true);

insert into price_snapshots (id, business_id, inventory_item_id, product_id, source_id, price_ars, price_usd, exchange_rate, note) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 2500, 2, 1250, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 18000, 12, 1500, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222223', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 1200, null, null, 'Precio ficticio');

insert into current_prices (inventory_item_id, business_id, price_ars, price_usd, manual_override, source_snapshot_id) values
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', 2500, 2, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', 18000, 12, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),
  ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', 1200, null, true, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3');

insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by) values
  ('55555555-5555-4555-8555-555555555551', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444441', 'initial_seed', 4, 'seed', 'demo', 'seed-pikachu', 'Carga ficticia inicial', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('55555555-5555-4555-8555-555555555552', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444442', 'initial_seed', 1, 'seed', 'demo', 'seed-charizard', 'Carga ficticia inicial', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('55555555-5555-4555-8555-555555555553', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444443', 'import', 8, 'import_run', '66666666-6666-4666-8666-666666666661', 'seed-eevee-import', 'Importacion ficticia MonPrice', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');

insert into import_runs (id, business_id, source, status, file_name, total_rows, review_rows, applied_rows, created_by) values
  ('66666666-6666-4666-8666-666666666661', '11111111-1111-4111-8111-111111111111', 'monprice_csv', 'needs_review', 'demo-monprice.csv', 12, 2, 10, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');

insert into import_rows (id, business_id, import_run_id, row_number, status, raw_payload, matched_product_id, matched_variant_id, matched_inventory_item_id, review_reason) values
  ('77777777-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666661', 1, 'matched', '{"name":"Eevee Demo","count":8}', '22222222-2222-4222-8222-222222222223', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444443', ''),
  ('77777777-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666661', 2, 'review', '{"name":"Missing Demo","count":1}', null, null, null, 'Sin match ficticio');

insert into reservations (id, business_id, inventory_item_id, quantity, status, channel, external_cart_id, expires_at, idempotency_key) values
  ('88888888-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444441', 1, 'active', 'future_ecommerce', 'demo-cart-001', '2026-08-03 13:00:00+00', 'reservation-demo-pikachu');

insert into audit_log (id, business_id, actor_user_id, action, entity_type, entity_id, after_data) values
  ('99999999-9999-4999-8999-999999999991', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'seed_database', 'business', '11111111-1111-4111-8111-111111111111', '{"demo":true}');

insert into idempotency_keys (business_id, key, action, request_hash, response_payload) values
  ('11111111-1111-4111-8111-111111111111', 'seed-pikachu', 'initial_seed', 'demo', '{"ok":true}');

commit;
