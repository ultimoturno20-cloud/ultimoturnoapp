# Modelo de datos inicial

## Principios

- `business_id` aparece en las tablas operativas para preparar multi-negocio sin
  complejidad extra.
- `inventory_items` guarda stock actual observable.
- `inventory_movements` guarda historial y permite conciliacion.
- `reservations` existe desde el inicio porque ecommerce debe reservar antes de
  confirmar pago.
- `import_runs` e `import_rows` permiten importar y revisar antes de aplicar.
- `idempotency_keys` evita duplicar acciones futuras.
- `audit_log` registra acciones sensibles.

## Tablas principales

- `businesses`
- `app_users`
- `roles`
- `user_roles`
- `card_products`
- `card_variants`
- `external_sources`
- `external_identifiers`
- `inventory_items`
- `price_snapshots`
- `current_prices`
- `inventory_movements`
- `import_runs`
- `import_rows`
- `reservations`
- `audit_log`
- `idempotency_keys`
- `pricecharting_cache_entries`
- `pricecharting_cache_runs`

## Preparado pero no operativo todavia

Ventas, compras, claims, pagos y ecommerce completo no se implementan en esta
etapa. Solo se dejan relaciones fundamentales como reservas, movimientos,
referencias e idempotencia para evitar una migracion destructiva despues.

La web ya tiene prototipos locales de carrito de venta/reserva y compra a
cliente, pero esos flujos no tienen tablas oficiales todavia. Antes de hacerlos
persistentes hay que aprobar el modelo de `orders`, `order_lines`, `purchase_runs`
o nombres equivalentes, y decidir como impactan en `inventory_movements`.

## Importaciones

El prototipo de importador contempla:

- traduccion demo de nombres japoneses/chinos antes de buscar coincidencias;
- ranking estable de candidatos multiples;
- warnings visibles por datos incompletos, cantidades invalidas, precios
  faltantes, diferencias contra cache y posibles duplicados;
- decision manual por fila antes de aplicar cambios.

Todavia falta persistir la decision de revision y modelar una tabla de
candidatos si queremos auditar por que se eligio una carta y no otra.

El cache PriceCharting se mantiene separado del catalogo y del inventario. Una
sincronizacion reemplaza el snapshot completo de referencia, conserva un
historial de ejecuciones y nunca crea stock ni cambia precios de venta por si
sola.

## Seed ficticio actual

El entorno local carga datos demo suficientes para probar la aplicacion sin
servicios externos:

- 1 negocio;
- 2 usuarios y roles;
- 12 productos con variantes;
- 12 items de inventario con ubicaciones, precios y reservas;
- historial de movimientos;
- 3 importaciones con filas aplicadas y filas a revisar;
- 3 reservas para validar el futuro flujo ecommerce.

Estos datos no representan stock real y pueden resetearse sin impacto operativo.
