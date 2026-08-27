begin;

insert into card_products (id, business_id, name, expansion, card_number, image_url, notes) values
  ('22222222-2222-4222-8222-222222222224', '11111111-1111-4111-8111-111111111111', 'Mewtwo Archivo', 'Poder Psiquico', '150', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222225', '11111111-1111-4111-8111-111111111111', 'Bulbasaur Base', 'Bosque Inicial', '001', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222226', '11111111-1111-4111-8111-111111111111', 'Squirtle Sellado', 'Agua Clara', '007', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222227', '11111111-1111-4111-8111-111111111111', 'Gengar Master', 'Sombras Urbanas', '094', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222228', '11111111-1111-4111-8111-111111111111', 'Dragonite Holo', 'Cielos Antiguos', '149', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222229', '11111111-1111-4111-8111-111111111111', 'Snorlax Vitrina', 'Descanso Total', '143', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222230', '11111111-1111-4111-8111-111111111111', 'Lucario Promo', 'Fuerza Metal', '448', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222231', '11111111-1111-4111-8111-111111111111', 'Rayquaza Gold', 'Cielos Antiguos', '384', '', 'Producto ficticio ampliado'),
  ('22222222-2222-4222-8222-222222222232', '11111111-1111-4111-8111-111111111111', 'Charmander Caja', 'Llamas del Sur', '004', '', 'Producto ficticio ampliado');

insert into card_variants (id, business_id, product_id, language, condition, finish) values
  ('33333333-3333-4333-8333-333333333334', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222224', 'ES', 'MP', 'holo'),
  ('33333333-3333-4333-8333-333333333335', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222225', 'EN', 'LP', 'normal'),
  ('33333333-3333-4333-8333-333333333336', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222226', 'JA', 'SEALED', 'normal'),
  ('33333333-3333-4333-8333-333333333337', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222227', 'EN', 'NM', 'masterball'),
  ('33333333-3333-4333-8333-333333333338', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222228', 'ES', 'HP', 'holo'),
  ('33333333-3333-4333-8333-333333333339', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222229', 'CHS', 'DMG', 'normal'),
  ('33333333-3333-4333-8333-333333333340', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222230', 'ES', 'NM', 'pokeball'),
  ('33333333-3333-4333-8333-333333333341', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222231', 'JA', 'NM', 'holo'),
  ('33333333-3333-4333-8333-333333333342', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222232', 'EN', 'MP', 'normal');

insert into external_identifiers (id, business_id, source_id, product_id, variant_id, external_id, external_url) values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '22222222-2222-4222-8222-222222222224', null, 'demo-mewtwo-150', 'https://example.invalid/mewtwo'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd5', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '22222222-2222-4222-8222-222222222226', null, 'scan-squirtle-007', null),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd6', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '22222222-2222-4222-8222-222222222227', null, 'demo-gengar-094', 'https://example.invalid/gengar'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd7', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '22222222-2222-4222-8222-222222222228', null, 'demo-dragonite-149', 'https://example.invalid/dragonite'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd8', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '22222222-2222-4222-8222-222222222230', null, 'scan-lucario-448', null),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd9', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '22222222-2222-4222-8222-222222222231', null, 'demo-rayquaza-384', 'https://example.invalid/rayquaza');

insert into inventory_items (id, business_id, sku, product_id, variant_id, location, quantity_on_hand, quantity_reserved, active) values
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'DEMO-MT-150-ES-MP-HOLO', '22222222-2222-4222-8222-222222222224', '33333333-3333-4333-8333-333333333334', 'Caja psiquico A2', 2, 1, true),
  ('44444444-4444-4444-8444-444444444445', '11111111-1111-4111-8111-111111111111', 'DEMO-BB-001-EN-LP-NOR', '22222222-2222-4222-8222-222222222225', '33333333-3333-4333-8333-333333333335', 'Binder verde fila 1', 6, 0, true),
  ('44444444-4444-4444-8444-444444444446', '11111111-1111-4111-8111-111111111111', 'DEMO-SQ-007-JA-SEALED', '22222222-2222-4222-8222-222222222226', '33333333-3333-4333-8333-333333333336', 'Estante sellados', 3, 2, true),
  ('44444444-4444-4444-8444-444444444447', '11111111-1111-4111-8111-111111111111', 'DEMO-GG-094-EN-NM-MB', '22222222-2222-4222-8222-222222222227', '33333333-3333-4333-8333-333333333337', 'Vitrina premium', 1, 1, true),
  ('44444444-4444-4444-8444-444444444448', '11111111-1111-4111-8111-111111111111', 'DEMO-DN-149-ES-HP-HOLO', '22222222-2222-4222-8222-222222222228', '33333333-3333-4333-8333-333333333338', 'Caja estado medio', 0, 0, true),
  ('44444444-4444-4444-8444-444444444449', '11111111-1111-4111-8111-111111111111', 'DEMO-SN-143-CHS-DMG-NOR', '22222222-2222-4222-8222-222222222229', '33333333-3333-4333-8333-333333333339', 'Caja ofertas', 5, 0, true),
  ('44444444-4444-4444-8444-444444444450', '11111111-1111-4111-8111-111111111111', 'DEMO-LC-448-ES-NM-PB', '22222222-2222-4222-8222-222222222230', '33333333-3333-4333-8333-333333333340', 'Carpeta promos', 7, 3, true),
  ('44444444-4444-4444-8444-444444444451', '11111111-1111-4111-8111-111111111111', 'DEMO-RQ-384-JA-NM-HOLO', '22222222-2222-4222-8222-222222222231', '33333333-3333-4333-8333-333333333341', 'Caja alta rotacion', 2, 0, true),
  ('44444444-4444-4444-8444-444444444452', '11111111-1111-4111-8111-111111111111', 'DEMO-CH-004-EN-MP-NOR', '22222222-2222-4222-8222-222222222232', '33333333-3333-4333-8333-333333333342', 'Pendiente de revisar', 10, 0, true);

insert into price_snapshots (id, business_id, inventory_item_id, product_id, source_id, price_ars, price_usd, exchange_rate, note) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222224', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 9200, 7.4, 1243.2432, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444445', '22222222-2222-4222-8222-222222222225', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 950, 0.8, 1187.5, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444446', '22222222-2222-4222-8222-222222222226', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 4800, 4.1, 1170.7317, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee7', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444447', '22222222-2222-4222-8222-222222222227', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 32500, 26.5, 1226.4151, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee8', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444448', '22222222-2222-4222-8222-222222222228', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 7600, 6.2, 1225.8064, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee9', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444449', '22222222-2222-4222-8222-222222222229', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 650, 0.5, 1300, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444450', '22222222-2222-4222-8222-222222222230', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 1750, 1.3, 1346.1538, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444451', '22222222-2222-4222-8222-222222222231', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 41000, 33, 1242.4242, 'Precio ficticio'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444452', '22222222-2222-4222-8222-222222222232', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 700, 0.6, 1166.6667, 'Precio ficticio');

insert into current_prices (inventory_item_id, business_id, price_ars, price_usd, manual_override, source_snapshot_id) values
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 9200, 7.4, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'),
  ('44444444-4444-4444-8444-444444444445', '11111111-1111-4111-8111-111111111111', 950, 0.8, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'),
  ('44444444-4444-4444-8444-444444444446', '11111111-1111-4111-8111-111111111111', 4800, 4.1, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6'),
  ('44444444-4444-4444-8444-444444444447', '11111111-1111-4111-8111-111111111111', 32500, 26.5, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee7'),
  ('44444444-4444-4444-8444-444444444448', '11111111-1111-4111-8111-111111111111', 7600, 6.2, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee8'),
  ('44444444-4444-4444-8444-444444444449', '11111111-1111-4111-8111-111111111111', 650, 0.5, true, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee9'),
  ('44444444-4444-4444-8444-444444444450', '11111111-1111-4111-8111-111111111111', 1750, 1.3, true, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10'),
  ('44444444-4444-4444-8444-444444444451', '11111111-1111-4111-8111-111111111111', 41000, 33, false, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11'),
  ('44444444-4444-4444-8444-444444444452', '11111111-1111-4111-8111-111111111111', 700, 0.6, true, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12');

insert into inventory_movements (id, business_id, inventory_item_id, movement_type, quantity_delta, unit_cost_usd, reference_type, reference_id, idempotency_key, note, created_by) values
  ('55555555-5555-4555-8555-555555555554', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444446', 'reservation', 0, null, 'reservation', '88888888-8888-4888-8888-888888888882', 'seed-squirtle-reservation', 'Reserva ficticia de prueba para compra web futura', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444448', 'manual_adjustment', -1, null, 'manual', 'demo-adjustment', 'seed-dragonite-adjustment', 'Ajuste ficticio por carta enviada a revision', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('55555555-5555-4555-8555-555555555556', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444451', 'import', 2, 22, 'import_run', '66666666-6666-4666-8666-666666666662', 'seed-rayquaza-import', 'Ingreso ficticio desde lote premium', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('55555555-5555-4555-8555-555555555557', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444450', 'reservation_release', 0, null, 'reservation', '88888888-8888-4888-8888-888888888883', 'seed-lucario-release', 'Liberacion ficticia de reserva vencida', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('55555555-5555-4555-8555-555555555558', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444452', 'import', 10, 0.25, 'import_run', '66666666-6666-4666-8666-666666666663', 'seed-charmander-import', 'Importacion ficticia con estado a revisar', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

insert into import_runs (id, business_id, source, status, file_name, total_rows, review_rows, applied_rows, created_by) values
  ('66666666-6666-4666-8666-666666666662', '11111111-1111-4111-8111-111111111111', 'manual_csv', 'parsed', 'lote-feria-demo.csv', 36, 0, 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('66666666-6666-4666-8666-666666666663', '11111111-1111-4111-8111-111111111111', 'legacy_snapshot', 'ready', 'snapshot-stock-demo.csv', 84, 1, 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

insert into import_rows (id, business_id, import_run_id, row_number, status, raw_payload, matched_product_id, matched_variant_id, matched_inventory_item_id, review_reason) values
  ('77777777-7777-4777-8777-777777777773', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666661', 5, 'review', '{"name":"Eevee Reverse","expansion":"Evoluciones Demo","number":"133","quantity":3,"priceArs":1200}', '22222222-2222-4222-8222-222222222223', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444443', 'Posible duplicado: decidir si suma stock'),
  ('77777777-7777-4777-8777-777777777774', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666661', 11, 'review', '{"name":"Umbreon Feria","expansion":"Sombras Urbanas","number":"197","quantity":1,"priceArs":14500}', null, null, null, 'Multiples resultados posibles'),
  ('77777777-7777-4777-8777-777777777775', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666662', 3, 'matched', '{"name":"Jolteon Lote","expansion":"Destellos Iniciales","number":"135","quantity":4,"priceArs":1800}', null, null, null, ''),
  ('77777777-7777-4777-8777-777777777776', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666663', 14, 'review', '{"name":"\u70c8\u7a7a\u5750","expansion":"Cielos Antiguos","number":"384","quantity":2,"priceArs":43000}', '22222222-2222-4222-8222-222222222231', '33333333-3333-4333-8333-333333333341', '44444444-4444-4444-8444-444444444451', 'Precio sube respecto del snapshot anterior');

insert into reservations (id, business_id, inventory_item_id, quantity, status, channel, external_cart_id, expires_at, idempotency_key) values
  ('88888888-8888-4888-8888-888888888882', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444446', 2, 'active', 'future_ecommerce', 'demo-cart-002', '2026-08-03 13:45:00+00', 'reservation-demo-squirtle'),
  ('88888888-8888-4888-8888-888888888883', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444450', 1, 'released', 'admin', 'demo-cart-003', '2026-08-03 12:00:00+00', 'reservation-demo-lucario-release');

commit;
