# Presupuestador de lotes

## Estado de la entrega

Pedido del usuario del 2026-11-09: una mesa similar a Claims para cotizar lotes,
tanto compra por porcentaje como venta. Issue #41; Codex responsable en
codex/lot-quotes, desde main a4c839e. Implementacion propuesta, no desplegada
hasta revision y merge humano. No depende de los PR #32, #36, #40 ni companion.
Produccion verificada al empezar: a4c839e, DATABASE_URL configurada y DB accesible.

Prioridad de producto independiente del plan de optimizacion. No se marca ningun
OP completado: sigue OP-1.4c.2b y los pasos restantes de OPTIMIZATION_PLAN.md.
Los documentos generales tienen una consolidacion pendiente en PR #40; este
documento y el PR del presupuestador registran el alcance sin pisar ese trabajo.

## Uso

Ingresar como admin y abrir Presupuestos, ruta /admin/presupuestos.

1. Nombrar el lote, elegir ARS o USD, cotizacion y porcentaje de compra.
2. Buscar en el catalogo compartido y agregar la edicion/idioma/acabado exactos.
   Tambien se pueden agregar cartas o productos manuales.
3. Revisar imagen, identidad, cantidad, referencia y precio de venta por fila.
   Los campos vacios significan precio pendiente; cero es un precio conocido.
4. Revisar referencia total, oferta de compra y presupuesto de venta. Si falta
   algun precio se muestra expresamente un subtotal parcial.
5. Guardar el presupuesto para reabrirlo desde cualquier dispositivo con la
   misma cuenta/negocio. CSV exporta todas las filas con fuentes e imagenes;
   Copiar resumen genera texto con importes, enlaces y advertencias de faltantes.
6. Archivar cambia solo el estado del presupuesto. Permanece consultable y
   puede volver a Borrador. No hay borrado ni conversion automatica a compra.

El 70% inicial es una sugerencia editable, no una regla global de precios.
La oferta es el porcentaje sobre la referencia conocida, redondeado una vez
al centavo sobre el total. El precio de venta por fila es independiente.
No se aplica la antigua regla puntual de cambio 1540/redondeo a 500 del claim.

## Referencias y moneda

La busqueda reutiliza /catalog-cards y CatalogPickerEntry. Se guardan nombre,
edicion, numero, idioma, acabado, precio de referencia, enlace, imagen y fecha
de fuente, usando el proveedor indicado por el catalogo. No se hace scraping,
no se dispara sincronizacion ni se promete un precio actualizado al instante.
Una referencia NM no se ajusta automaticamente al cambiar condicion: revisarla.

Cada presupuesto conserva moneda y ARS por USD. Al agregar una referencia USD
en un presupuesto ARS se convierte al cambio guardado y se redondea al centavo.
Cambiar la cotizacion conserva los precios ya cargados y afecta altas futuras.
Cambiar moneda convierte todas las referencias/precios actuales con confirmacion
si hay filas. Las conversiones pueden redondear: revisar antes de guardar.
No se reprecian presupuestos guardados automaticamente al cambiar el catalogo.

## Persistencia, permisos y contratos

- Migracion aditiva 0063_lot_quotes.sql, registrada en migrationFiles. Una tabla
  nueva lot_quotes, sin relaciones con stock, ordenes, reservas o claims.
- GET /lot-quotes?offset=N: lista de 30 resumenes y total por negocio, sin
  descargar el contenido completo de todos los presupuestos.
- GET /lot-quotes/:id: presupuesto completo, sin truncar sus filas.
- PUT /lot-quotes/:id: { version, requestId, draft }; version 0 crea el UUID.
  Respuesta completa con version y fechas. Se permiten hasta 1000 filas,
  cantidades enteras 1..10000 y oferta 0..100 con hasta dos decimales.
  Documento maximo 3,5 MB UTF-8 para respetar el limite del despliegue serverless.
- Rutas autentican y exigen admin; negocios separados, 404 generico para IDs
  ajenos. Los roles stock_owner, reseller y admin_readonly no tienen acceso.
- Guardado transaccional con bloqueo por fila/version y auditoria minima.
  Repetir la misma solicitud confirmada no duplica ni incrementa version.
  Una version vieja u otro contenido bajo igual requestId recibe 409.
- El editor conserva un borrador por cuenta/negocio en sessionStorage cuando
  el navegador lo permite. Guardar en servidor es la persistencia compartida.
  Un guardado incierto bloquea edicion y reintenta el mismo requestId/cuerpo.
  Ante conflicto, exportar el borrador y abrir la version guardada.
- El refresco periodico no reemplaza el contenido editado. La recarga manual
  puede actualizar un documento limpio; errores visibles, sin reenvio automatico
  de escrituras. El transporte privado existente conserva sesiones/revisiones.
- CSV con BOM, comillas y escape de formulas; no exporta solo una pagina.

No se agrega otro sistema de autenticacion, base, cache permanente ni dependencia.
Los nuevos DTO y rutas son autocontenidos; no cambian contratos operativos previos.

## Verificacion y limites

Pruebas de dominio: centavos, extremos de porcentaje, precios faltantes/cero,
validacion de cantidades/URLs, CSV con enlaces, formulas, comillas y 1000 filas.
DB: persistencia tras reinicio, reintentos simultaneos, versiones en conflicto,
scopes negativos, roles, historia paginada completa y rollback ante fallo de audit.
Se compara hash de todas las tablas operativas salvo lot_quotes/audit_log para
demostrar que guardar/archivar no cambia las operaciones existentes.
HTTP: autenticacion, permisos, negocios, payload invalido y dispatcher real.
Gate inicial y final npm run check:new: 306 tests, lint/tipos/db:verify/build
aprobados, incluido el limite UTF-8 de 3,5 MB. Regresiones del modulo tambien
se reejecutan con el endurecimiento final de los tipos de moneda/estado.
Chrome aislado en 320/390/768/1440/1788: catalogo, manual, calculos, moneda,
CSV con enlaces, clipboard, guardado/recarga, borrador con campos incompletos,
respuesta de guardado perdida y reintento exacto, conflicto de version,
error/reintento de listado, archivo y stock intacto comprobados. Foco/teclado,
movimiento reducido y precios/controles contenidos; cero requests productivos.
Fixtures y capturas quedan ignoradas en .work/lot-quotes-*; solo se versionan
pruebas sinteticas y documentacion. El PR registra CI y estado de release.

QA siempre con base temporal y cuentas/cartas sinteticas; sin datos productivos,
sin preview con credenciales reales ni escrituras sobre stock/claims existentes.
No incluye importacion masiva de archivos, grillas PNG, refresh automatico de
proveedores ni generacion de compras/ventas. Son extensiones posteriores.

Antes de release: revisar CI, revision cruzada y migracion; autorizar merge y
comprobar el SHA resultante de main y DB en public-status. Sin merge no esta online.
