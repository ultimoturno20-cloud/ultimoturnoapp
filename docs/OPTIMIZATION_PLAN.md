# Plan de optimizacion de UltimoTurno

Actualizado: 2026-10-16

## Objetivo y alcance

Simplificar la plataforma existente y reducir trabajo repetido sin reemplazar
la base de datos, cambiar operaciones historicas ni agregar otro sistema.
Pedido del usuario: completar una planificacion integral y comenzar, no dejar
la mejora limitada a un unico item. Este documento es el seguimiento vigente.

Base inicial: main y produccion en 318a5a3; repositorio limpio, public-status
HTTP 200 y DB accesible. Los tiempos se miden en fixtures aislados; no se
presentan como latencia de produccion ni como promesas sin medicion.

## Seguimiento

| Etapa | Estado | Resultado esperado |
|---|---|---|
| 1. Lecturas y recargas | En curso | Consultas acotadas y recargas solo cuando cambian sus datos |
| 2. Modulos y contratos | Pendiente | Responsabilidades separadas en la misma aplicacion |
| 3. Interfaz y estilos | Pendiente | Componentes comunes y menos capas de overrides |
| 4. Precios e imagenes | Pendiente | Servicios compartidos con reglas e identidad explicitas |
| 5. Circuitos y cierre del plan | Pendiente | Recorridos consistentes y QA integral documentado |

## Etapa 1: lecturas y recargas

- [x] OP-1.1: leer un item por ID sin cargar todo el stock; valorar solo las
  carpetas solicitadas. Paridad completa del DTO, permisos y valores existentes.
- [x] OP-1.2: al editar cartas de claim, evitar recargar stock si no cambio;
  mantener recarga ante cantidades, imagenes o reparaciones reales de stock.
- [x] OP-1.3: medir y eliminar GET repetidos entre vistas, conservando sesiones,
  refresh manual, cambio de precio entre pestanas y recuperacion de errores.
- [ ] OP-1.4: paginar/filtrar las lecturas grandes en servidor donde sea posible;
  separar resumen global de pagina. Exportaciones y acciones masivas siguen
  trabajando sobre el alcance completo explicitamente elegido.
- [x] OP-1.4a: historial de movimientos/auditoria con consulta filtrada y
  paginada en SQL, totales independientes y carga solo de pestana activa.
- [x] OP-1.4b: adaptar Inventario con endpoint paginado separado, manteniendo
  busqueda/orden/precios, resumen/facetas, carrito, seleccion y exportacion
  completas. No reemplazar stock.items global por una pagina parcial.
- [ ] OP-1.4c: adaptar las otras lecturas grandes despues de mapear consumidores:
  ingreso movil, pickers de ordenes/compras/claim y planificador. Rankings,
  propuestas, exportaciones y cierres conservan su alcance completo.
- [x] OP-1.4c.1: pre-base de carga movil con paginas SQL, totales globales,
  duplicados fuera de pagina y preview/carga de TODOS los pendientes elegibles.
- [ ] OP-1.4c.2: busqueda de candidatos en Ingreso, Ordenes, Compras, Claims
  y Planificador; movimientos exactos por item donde corresponda. Mapear cada
  consumidor antes de sustituir su lectura completa. No recortar propuestas.
- [x] OP-1.4c.2a: buscador de Ingreso sin GET /stock completo, respaldo local
  acotado en servidor, reglas compartidas y resultados aislados por cuenta.
- [ ] OP-1.4c.2b: adaptar pickers de Ordenes, Compras, Claims y Planificador;
  movimientos exactos por item. Siguiente entrega recomendada: Ordenes.
- [ ] OP-1.5: registrar consultas, filas, bytes y tiempos antes/despues en
  fixtures de inventario y claim grandes; agregar presupuestos de regresion.

Criterio de terminado: menos lecturas demostrables, mismos precios/cantidades/
reservas/totales/permisos, sin caches viejas despues de escrituras. Paginacion
no recorta resumen, filtros, seleccion, exportaciones ni operaciones masivas.

## Etapa 2: modulos y contratos

- [ ] OP-2.1: compartir DTO de Inventario, Ordenes y Claims sin importar codigo
  de servidor/DB en el bundle del navegador; contrato publico separado.
- [ ] OP-2.2: separar consultas y operaciones de Inventario/Claims/Ordenes/
  Revendedores de packages/db/src/index.ts por entregas pequenas y testeadas.
- [ ] OP-2.3: separar handlers HTTP de integraciones y jobs de server.ts;
  conservar rutas, permisos, body limits, transacciones e idempotencia.
- [ ] OP-2.4: extraer vistas y controladores de main.tsx por sector, usando
  infraestructura compartida. Transporte comun con autenticacion explicita:
  tienda anonima y cuentas de Torneos nunca heredan la sesion administrativa.

Criterio de terminado: responsabilidades identificables, menos contratos
duplicados, dependencias sin ciclos nuevos y mismos circuitos operativos.
Mover archivos no se registra por si solo como mejora de rendimiento.

## Etapa 3: interfaz y estilos

- [ ] OP-3.1: inventariar editores/detalles/dialogos repetidos y consolidar
  primero los que realmente tienen el mismo comportamiento y permisos.
- [ ] OP-3.2: compartir formato monetario, campos de precio y validacion visual;
  no unificar politicas de redondeo distintas por negocio.
- [ ] OP-3.3: mover estilos a sus sectores y retirar overrides reemplazados
  despues de probar desktop/movil; una fuente de estilos por componente.
- [ ] OP-3.4: QA visual a 320/390/768/1440/1788 px, teclado, foco, estados
  vacio/error/carga, reduced-motion e imagenes/precios contenidos.

Criterio de terminado: apariencia y controles consistentes, sin nuevas capas
para anular otras, sin saltos de layout y sin alterar la identidad negro/rojo.

## Etapa 4: precios e imagenes

- [ ] OP-4.1: explicitar precio de referencia, precio central y snapshot de
  orden; compartir conversion/formatos, conservando cada politica autorizada.
- [ ] OP-4.2: consolidar resolucion de imagenes con identidad exacta de carta,
  expansion, idioma, numero y variante; override manual siempre protegido.
- [ ] OP-4.3: separar proveedores PC/TCGplayer/CoolStuff/TCGdex de reglas del
  negocio; conservar caches existentes, limites y estados de error visibles.
- [ ] OP-4.4: caracterizar y retirar rutas/helpers obsoletos solo con evidencia
  de que no tienen consumidores. No eliminar datos ni caches historicas.

Criterio de terminado: misma carta/variante/precio elegido, fuente trazable,
sin sobrescribir precios pactados ni sustituir ediciones especiales.

## Etapa 5: circuitos y cierre del plan

- [ ] OP-5.1: recorrer tienda/claim/mostrador hasta Ordenes con stock y reservas
  compartidos, sin nuevas listas paralelas ni reinterpretar ordenes previas.
- [ ] OP-5.2: revisar consignacion y devoluciones manteniendo las reglas de
  Revendedores; Torneos conserva sus cuentas y limites independientes.
- [ ] OP-5.3: QA completo en API/base temporal: pagos, cancelacion, stock,
  permisos, concurrencia y respuesta perdida/reintentos sin duplicados.
- [ ] OP-5.4: cerrar cada pendiente o documentar una decision explicita con
  razon y alternativa. El plan no termina al completar OP-1.1.

Criterio de terminado: checklist resuelto, regresiones y comparacion de
metricas documentadas, guias actualizadas y ultimo commit verificado online.

## Protocolo de entrega y continuidad

1. Elegir el siguiente OP pendiente de la etapa actual y leer su contexto.
2. Definir baseline, alcance y prueba de preservacion antes de cambiar codigo.
3. Implementar y comprobar comportamiento en bases/API temporales.
4. Actualizar este checklist con evidencia, pendientes y decision siguiente.
5. Commit/push de rama propia y PR con revision cruzada; merge solo humano,
   segun AGENTS.md y AGENT_COLLABORATION.md. Despues del merge autorizado,
   verificar public-status contra el SHA resultante de main. Un PR pendiente
   no esta online; no cerrar como desplegado si produccion tiene otro SHA.
6. Continuar con el siguiente OP; fallos operativos reales tienen prioridad,
   pero no borran ni reinician este plan.

Prohibido probar compras, cierres o pagos ficticios sobre produccion, borrar
o recrear datos reales, guardar secretos en Git o compartir auth entre roles.
Temporales de QA en .work ignorado, preferentemente TEMP/TMP en D:.

## Registro de entregas

- 2026-10-14, OP-1.1: getter por ID y negocio, agregados de consignacion
  acotados y valuacion solo de carpetas solicitadas. Mismo mapper/consulta de
  stock, sin copias nuevas de reglas. Fixture de 1000 items: 2000 -> 2 filas
  auxiliares y 1297672 -> 1294 bytes devueltos por SQL. Tiempos locales
  informativos 174 -> 48 ms, no medicion productiva ni criterio obligatorio.
  Regresiones de DTO completo, grading, reservas, asignaciones, negocio ajeno,
  frescura tras escritura, carpetas y getter legacy. QA: 231 tests completos,
  tipos/lint/build/DB verify aprobados, sin escrituras productivas de prueba.
  Commit 3414fb1 publicado y confirmado en public-status; stock privado 401
  sin sesion. La etapa 1 y las posteriores no estan completas.
- 2026-10-14, OP-1.2: PUT de carta agrega stockRefreshRequired sin reemplazar
  el workspace. Servidor compara stock antes/despues para metadata y conserva
  refresh por cantidades/imagenes y reparaciones legacy. Cuando corresponde,
  invalida snapshot compartido en la transaccion y cache en memoria del handler;
  panel pide /stock?fresh=1. Respuesta sin flag conserva refresh por seguridad.
  Chrome/API real temporal: cinco ediciones de metadata -> cero GET extra de
  stock. Cantidad e imagen refrescan; precio central conservado, fallback de
  API anterior y errores de guardado/recarga probados. No requests productivos.
  QA: suite completa de 234 tests antes del ajuste final de frescura; siete
  regresiones finales DB/HTTP aprobadas con ese ajuste, tipos/lint/build OK.
  Prueba HTTP queda versionada para que CI vuelva a comprobar las caches.
  Siguiente entrega: OP-1.3, deduplicacion de GET entre vistas y consistencia
  de invalidaciones/peticiones en vuelo. No se marcan OP-1.3/1.4/1.5 completos.
- 2026-10-14, OP-1.3: cliente administrativo unico reemplaza el helper anterior.
  Comparte solo GET simultaneos por URL completa, bearer efectivo y revision;
  no agrega TTL de respuestas. Conserva ETag de stock, errores HTTP y señales
  de cancelacion independientes. Escrituras se envian una sola vez, invalidan
  antes/despues aun ante fallo y las lecturas esperan su finalizacion.
  Lotes de vistas se aplican juntos solo si siguen vigentes; sesion reemplazada
  descarta respuestas anteriores sin convertirlas en un 401 de la cuenta nueva.
  Recarga manual y evento de precio invalidan inmediatamente; siguiente stock
  usa fresh=1, incluido evento recibido con la pestana oculta. Torneos y tienda
  anonima no importan este transporte ni heredan credenciales administrativas.
  Cache de stock existente extraida de server.ts, mismo TTL de 15 segundos:
  lecturas simultaneas comparten trabajo y fresh supersede pendientes viejos.
  Snapshot compartido publica/limpia solo con su ticket SQL exacto; las
  invalidaciones existentes revocan ese ticket en la misma transaccion.
  Datos marcados invalidados no sirven como fallback ante errores: se informa
  el fallo y se permite reintentar, sin devolver stock vacio ni resucitar datos.
  Fixture reproducible con helper de e63a864 y cliente actual, vistas Claims /
  Inventario / Ordenes simultaneas: GET totales 8 -> 4; stock 3 -> 1, claims
  2 -> 1 y resellers 2 -> 1. No es una medicion de latencia productiva.
  Chrome con API/PGlite temporal confirma una lectura stock entre tres vistas,
  recarga manual fresh, precio central desde otra pestana y respuesta vieja
  retenida. Regresion OP-1.2: cinco metadata -> cero GET extra; cantidad/imagen,
  API vieja y fallos de guardado/refresh conservados. Cero requests productivos.
  Pruebas versionadas: admin-api.test.ts (8), stock-read-cache.test.ts (7),
  claim-stock-cache.test.ts y revocacion SQL en claim-stock-refresh.test.ts.
  QA final: 250 tests completos aprobados; tipos, lint, build y db:verify OK.
  Sin migraciones, nuevas dependencias ni cambios de datos comerciales reales.
  Siguiente entrega OP-1.4: paginacion/filtros en servidor conservando resumen,
  seleccion completa, exportaciones y acciones masivas. Etapa 1 sigue en curso.
- 2026-10-14, OP-1.4a (entrega parcial de OP-1.4): /admin/movimientos usa
  GET /operational-history. Solo lee la pestana activa, 50 filas por defecto
  (25/50/100 seleccionables); filtros por texto literal, tipo y fecha en SQL.
  Fecha inclusiva de usuario en America/Argentina/Buenos_Aires. Una sentencia
  obtiene pagina acotada, total global del negocio/tipo, total filtrado, facetas
  y variacion neta filtrada; los totales no se calculan con las filas visibles.
  Cursor (created_at, id) con precision SQL, sin OFFSET. Limite temporal asOf
  conserva el recorrido frente a altas posteriores; no es un snapshot MVCC
  durable ni congela escrituras retrofechadas o ediciones de datos historicos.
  Recarga manual vuelve a primera pagina con el mismo filtro; refresh automatico
  actualiza primera pagina o conserva cursor/limite en paginas anteriores.
  Flechas arriba/abajo, estados vacio/error/carga, cancelacion de filtros viejos
  y reintento sin cache adicional. Admin requerido; negocio acota filas,
  totales/facetas y joins. DTO no trae before_data/after_data innecesarios;
  no se borran de DB y /movements y /audit legacy conservan sus contratos.
  Antes: dos GET de 100 filas cada uno aun viendo una sola pestana. Chrome:
  ahora un GET de 50 filas al entrar. Fixture con 1000 registros por tipo y
  snapshots de auditoria sinteticos de 4 KB: payload legacy combinado 861265
  bytes; pagina de auditoria de 25 filas aproximadamente 7402 bytes. Comparacion
  de ese fixture/alcance, no latencia ni tamano de datos productivos.
  QA: 260 tests completos; 18 regresiones finales DB/HTTP/contrato/transporte;
  tipos/lint/build/db:verify OK. Chrome con API/PGlite temporal: tres paginas,
  vuelta anterior, filtros, manual, respuesta retenida obsoleta y 503/reintento.
  Restablecer filtros ya vacios y elegir tab activo tambien recargan sin dejar
  la lista vacia; casos finales repetidos en Chrome con el bundle compilado.
  Viewports 320/390/768/1440/1788 sin overflow de pagina, tabla con scroll propio,
  teclado y reduced-motion; regresion OP-1.2 mantiene cinco metadata sin GET
  stock extra, cantidades/imagenes y fallos conservados. Cero requests productivos.
  Sin migraciones, dependencias, cambios en stock/ordenes/claims reales ni
  nuevas caches persistentes. OP-1.4 NO esta completo; sigue OP-1.4b.

- 2026-10-14, OP-1.4b: Inventario usa /inventory/view, pagina de 24/48/96
  items, con filtros/orden ejecutados sobre el snapshot existente del negocio.
  Resumen, calidad/duplicados, facetas, propietarios y conteos por disponibilidad/
  fuente siguen siendo globales. /stock completo no cambia para otros sectores.
  Nombres activos de revendedores via consulta acotada, sin sus dashboards.
  El TTL existente de lecturas normales sigue en 15 segundos; otro cliente
  necesita refresh fresco para observar inmediatamente metadata modificada.
  No prometer actualizacion instantanea general entre operadores. Estado de
  pagina/carrito aislado por usuario/negocio; guardados confirmados prevalecen
  sobre filas previas aun si falla la recarga posterior.
  No hay nueva cache persistente: estado React conserva pagina y solo IDs
  necesarios para detalle/editor/carrito. Las altas guardadas no convierten
  stock global en una lista parcial; Ingreso carga completo mientras se adapta
  en OP-1.4c. Refresh manual/escritura/precio entre pestanas pide datos frescos;
  revision de snapshot cambiada durante recorrido vuelve a primera pagina.
  Filtros viejos se cancelan/descartan y errores permiten reintentar.
  Seleccionar vista pide TODOS los IDs del filtro; seleccion individual se
  conserva entre paginas. CSV pide scope=all con mismos filtros/orden, sin
  limite de pagina. Antes de lote/publicacion, /inventory/items lee IDs frescos
  en tandas de hasta 64 con mapper OP-1.1, negocio/roles y 404 generico para
  faltantes/ajenos. No promete bloqueo de concurrencia entre lectura y PUT
  legacy ni nueva atomicidad de lotes; publicacion conserva transaccion existente.
  Escrituras no se reenvian y doble clic queda bloqueado. Fallo de refresh tras
  guardado no revierte una publicacion confirmada ni se presenta como fallo PUT.
  Filtros/helpers/precio numerico compartidos en domain, sin imports de DB al
  navegador. Paridad aislada con ddf5f20: 1217 combinaciones de filtros/orden/
  fuentes/idioma/propietario/duplicados, incluyendo busqueda fuera de stock.
  Fixture sintetico de 1000 DTO completos: payload 1051899 -> 26058 bytes
  (pagina 24 incluyendo metadata). Chrome: cero GET /stock y /resellers al
  entrar a Inventario; un GET paginado. IMPORTANTE: la lectura fria SQL todavia
  obtiene el snapshot completo para resumen/calidad/busqueda; NO es un LIMIT
  SQL de Inventario ni una reduccion medida de latencia productiva. OP-1.5
  debe medir este costo antes de optimizar la construccion del snapshot.
  QA: 269 tests completos aprobados, 20 regresiones finales DB/HTTP/domain/
  transporte; tipos/lint/build/db:verify OK. Chrome/API/PGlite temporal con
  132 items: paginas y limites, seleccion/CSV de 122 coincidencias, publicacion,
  lote con precio modificado fuera de pagina, carrito/reserva entre paginas,
  edicion de precio/cantidad, carpeta dinamica y contenido, 503/reintento,
  respuesta vieja retenida, precio entre pestanas, teclado/reduced-motion y
  320/390/768/1440/1788. Etiquetas contenidas e imagenes locales cargadas.
  Regresion Claims OP-1.2: cinco metadata siguen con cero GET stock extra.
  Cero requests productivos de QA; sin migraciones, dependencias ni secretos.
  Temporales .work/inventory-* ignorados, demo http://127.0.0.1:5291/demo.
  Verificar SHA publicado en public-status despues de commit/push.
  Sigue OP-1.4c, luego OP-1.5. OP-1.4 y las cinco etapas NO estan completas.

- 2026-10-16, OP-1.4c.1 (parte de OP-1.4c), base ec14a69: Carga movil usa
  /mobile-intake/view con 25/50/100 capturas, filtros de estado y texto literal
  por carta/SKU/ayudante/lote/nota en SQL. Cursor (created_at,id) conserva
  microsegundos; asOf evita desplazar paginas por altas posteriores. No es
  snapshot MVCC: cambios de estado concurrentes pueden cambiar coincidencias.
  Manual y guardados reinician recorrido; recarga de primera pagina renueva
  asOf. Filtros, salida de vista y cambio de usuario descartan lecturas viejas.
  Total del negocio y contadores Pendientes/Hoy/Cargadas son globales actuales,
  independientes del filtro/cursor. Hoy usa America/Argentina/Buenos_Aires.
  Duplicados se agregan en /mobile-intake/pending-match por identidad completa
  de captura, no solo por filas visibles. Mantiene prioridad stock/PC/manual,
  normalizacion de acentos/apostrofes y cantidades. No hay cache nueva.
  /mobile-intake/entries legacy mantiene su contrato y limite; el panel deja
  de descargar hasta 20000 entradas para renderizar solamente las primeras 80.
  /mobile-intake/pending es lectura completa explicita solo al pedir Preview.
  Cargar pendientes envia alcance completo al servidor, incluso con filtro;
  una carga individual consulta solo IDs solicitados. Ambos excluyen applied_at
  y no recortan a 20000 ni a la pagina. [] significa ninguna captura; body o
  seleccion invalidos se rechazan, no se convierten en una carga total.
  Conserva transaccion, agrupacion, cantidades y precio central existente;
  no reenvia escrituras. Invalida snapshot SQL dentro de la transaccion y cache
  de memoria tras confirmar carga; reintentos no duplican unidades aplicadas.
  DTO de captura compartido por domain/DB/panel. Admin y negocio acotan todos
  los endpoints nuevos, incluido preview y conteos. /stock global no cambia.
  Corrige la regla general que anulaba modo movil; columnas/controles caben
  a 320 px, sin agregar otra capa de overrides globales. Cantidad accesible,
  vacio/error/carga y reintentos de lista, estado y deshacer visibles.
  Fixture 1000 capturas: respuesta legacy 527306 -> 12670 bytes para pagina
  filtrada de 25 y metadatos; SQL devuelve JSON de hasta limit+1 capturas y
  agregados. No es latencia productiva ni elimina el escaneo de agregados.
  Fixture 20001 demuestra alcance completo de pendientes. Las operaciones
  completas siguen siendo deliberadamente completas; no se promete carga
  masiva ilimitada dentro del timeout serverless ni se agrega trabajo en cola.
  QA: 278 tests completos; pruebas DB/domain/HTTP de permisos, negocio ajeno,
  precision, fechas, filtros, payload, >20000, body invalido, [] y reintentos.
  Chrome/API/PGlite temporal: 130 capturas, preview y carga de 120 pendientes
  desde filtro Cargadas (10), 240 unidades, precio central conservado; duplicados
  fuera de pagina, respuestas retenidas/filtros/manual, alta/deshacer, errores
  y reintentos, teclado, reduced-motion, imagenes y 320/390/768/1440/1788.
  Tipos/lint/build/db:verify OK; temporales .work/mobile-* ignorados. Sin
  migraciones, dependencias, secretos ni escrituras operativas productivas.
  Commit/push y verificacion por SHA en public-status segun protocolo.
  Sigue OP-1.4c.2, luego OP-1.5. OP-1.4 y etapas 1-5 NO estan completas.

- 2026-10-16, OP-1.4c.2a, base cfea206: /admin/inventario/cargar-stock deja
  de pedir /stock al entrar/refrescar/guardar. El selector pide solo
  /inventory/intake-search?query=...&languageGroup=... tras 2 caracteres,
  debounce 100 ms. Devuelve hasta 30 candidatos combinados como antes; si
  falla catalogo, hasta 60 locales y advertencia visible. Fallo local conserva
  solo catalogo con advertencia; ambos fallidos dan error y reintento.
  Mapa baseline: InventoryForm mezclaba /catalog-cards (30) con busqueda sobre
  allItems de /stock, y guardaba el combinado 5 minutos en Map global sin
  sesion. Se retira esa Map y la dependencia allItems de Ingreso/formulario.
  El catalogo conserva su cache de servidor de 60 segundos y contrato legacy;
  el inventario local se lee fresco, no se mezcla en esa cache compartida.
  SQL preselecciona metadata por negocio/propietario y tokens normalizados;
  ranking/plurales/numeros/idioma usan los helpers existentes de domain.
  Se rankean TODAS las coincidencias de metadata antes de elegir IDs, sin
  cortar arbitrariamente a los primeros IDs SQL. Solo esos IDs (maximo 60)
  cargan el mapper completo OP-1.1 con precios/imagenes/tipos de carta.
  Consultas amplias todavia pueden devolver muchas filas de metadata: NO es
  un LIMIT SQL global de candidatos ni una reduccion garantizada de latencia.
  No se descargan esas filas al navegador ni se valuan carpetas ajenas.
  DTO y reglas de combinacion/identidad/presentacion compartidos en
  domain/catalog-picker.ts. Paridad con las funciones capturadas de cfea206:
  120 DTO y 160 combinaciones. DB compara 68 consultas/idiomas contra ranking
  del stock completo, incluidos fuera de stock/inactivos, acentos, plurales,
  numeros parciales, SKU, condicion, grading, ubicacion y tags.
  Hook use-intake-search usa transporte administrativo existente, AbortSignal,
  revision y clave de controles; no aplica respuestas de consultas previas.
  Cambio de cuenta limpia formulario/recibo y remonta Ingreso; nunca usa
  candidatos de otro propietario. Manual/escrituras renuevan busqueda sin
  convertir la pagina o el item guardado en el stock global completo.
  Altas mantienen POST /inventory/intake, transaccion, identidad, cantidades,
  reservas, propietario y politicas de precio. Ese POST aun lee stock completo
  internamente para resolver identidad: NO se optimizo esa escritura ni se
  promete otra atomicidad. Otros consumidores /stock quedan intactos.
  Fixture 1001 items: DTO anterior completo de 1306803 bytes; busqueda local
  selectiva devuelve 1906 bytes SQL (metadata/item/clasificacion, 1 fila cada
  una) y 373 bytes de DTO de candidato. Son alcances distintos de fixture,
  no metricas de latencia productiva ni presupuesto para toda consulta amplia.
  QA: 286 tests completos, tipos/lint/build/db:verify OK. Chrome/API/PGlite
  temporal: cero GET /stock al entrar y despues de guardar, limite 30, idiomas,
  respuesta retenida, vacio/error/reintento/advertencia parcial, guardar y
  seguir, doble clic con una escritura, precios locales frescos, teclado,
  reduced-motion, imagenes y 320/390/768/1440/1788. Propietario solo ve sus
  candidatos locales y conserva contenido de carpeta recien creada sin /stock.
  Temporales .work/intake-* ignorados, demo http://127.0.0.1:5296/demo.
  Sin migraciones, dependencias, secretos ni QA operativo sobre produccion.
  Publicar y verificar SHA/status/assets/rechazo privado segun protocolo.
  Sigue OP-1.4c.2b (primero Ordenes), luego OP-1.5 y etapas 2-5; padres abiertos.

## Mapa previo a OP-1.4b

Este mapa caracteriza ddf5f20, antes de la entrega OP-1.4b registrada arriba.
Inventario ya no carga stock completo; los demas consumidores siguen pendientes.

main.tsx usa stock.items completo en Inventario, Inicio, Caja, Compras,
Revendedores, Ordenes, Claims y Planificador. Mantener /stock completo para
esos consumidores hasta adaptar cada uno; no agregar un limit global a la ruta.

- visibleItems usa ranking de busqueda, filtros, duplicados y orden por precio
  de fuente/cambio/valor de carpeta. La pagina nueva debe conservar esas reglas.
- InventoryView deriva propietarios, disponibilidad y conteos por fuente de
  allItems; summary y quality tambien son globales. Deben venir como agregados
  independientes, no calcularse sobre una pagina o solo las filas cargadas.
- Seleccionar vista incluye todos los items filtrados, no los primeros 24
  renderizados. El nuevo flujo debe resolver IDs/alcance completo para lotes
  y publicacion, conservar seleccion al navegar y probar mas de una pagina.
- exportInventoryCsv(items) exporta el filtro completo. Requiere una lectura
  explicita completa con los mismos filtros/orden, no exportar la pagina actual.
- Carrito, detalles y editores necesitan resolver items seleccionados fuera de
  pagina y datos frescos despues de guardar. Reusar getter puntual OP-1.1;
  no sobrescribir el stock global con una lista parcial ni guardar otro stock.
- Claims prioriza catalogo con cantidades agrupadas por PriceCharting ID;
  Ordenes/Compras/Planificador buscan entre todos los candidatos. Adaptarlos
  por separado con busqueda servidor/agregados, sin recortar ranking o propuesta.
- Ingreso movil pide hasta 20000 entradas; revisar filtros y acciones antes
  de paginarlo. Detalle de item depende hoy de movimientos recientes globales:
  conviene una lectura exacta por item con sus permisos, no filtrar una pagina.
