# Inventario: continuidad de navegacion

2026-10-19. Issue #33, Codex, rama codex/inventory-stay-on-page desde 4215399.
Implementado y probado localmente; pendiente de PR/CI, revision y merge humano.
No desplegado. PR #32 (slider de Ordenes) es una entrega separada.

## Comportamiento

- Cobrar desde el carrito no cambia la vista a Caja. La venta se registra y
  descuenta stock con el mismo POST existente; carrito/cliente se limpian.
- Crear una reserva conserva el envio a Ordenes.
- useInventoryPage.refresh ahora recibe solo fresh; ya no admite un reset
  implicito. Todos sus consumidores fueron adaptados, incluidos reintentos.
- Una revision distinta del stock no dispara un segundo GET de pagina cero.
  Cada respuesta reemplaza la pagina completa, totales y metadata con datos
  actuales. No se acumulan paginas como si fueran un snapshot congelado.
- El servidor existente ajusta offsets fuera de rango a la ultima pagina
  valida (o cero si no hay resultados). Sin cambios de contrato/API/DB.
- Cambiar filtros, orden o tamano inicia en la primera pagina como antes.
- sessionStorage guarda solo filtro/offset/limite para restaurar al recargar
  la misma pestana. Clave aislada por el scope de preferencias usuario/negocio;
  filtro distinto no reutiliza el offset. No guarda cartas, carrito ni auth.
  Si storage esta bloqueado o es invalido, la navegacion en memoria funciona.

## Verificacion

npm run check:new aprobado: 290 tests, lint, typecheck, db:verify y build.
Cuatro tests nuevos de posicion: cuenta/filtro, validacion de estado, campos
permitidos y storage no disponible. Sin dependencias ni migraciones nuevas.

Chrome/Playwright, PGlite temporal con 73 cartas sinteticas, cero requests
productivos: cobro con precio unitario distinto del central y cantidad dos,
stock descontado exacto, precio central intacto, carrito vacio y misma ruta/pagina.
Actualizacion manual/focus, recarga, limite 24/48, edicion de precio, venta de
la unica carta de ultima pagina (72 -> 48), reintento 503 sin cambiar pagina,
respuesta vieja retenida frente a filtro nuevo, busqueda vacia y reserva a Ordenes.
320/390/768/1440/1788 px sin overflow de pagina; capturas revisadas, reduced motion.
Fixture/scripts/logs/capturas en .work/inventory-stay-* ignorado. Demo aislada:
http://127.0.0.1:5301/demo. No son datos productivos ni preview de Vercel.

## Entrega

No completa OP-1.4c.2b ni repara backups o jobs de precios. Produccion al iniciar
seguia en 4215399, DATABASE_URL configurada, Postgres accesible y stock/ventas/claim
presentes. Verificar de nuevo despues del merge humano con el SHA resultante;
HTTP 200/ok solos no prueban conexion a DB. No cobrar ventas ficticias online.
