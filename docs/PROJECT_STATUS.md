# UltimoTurno - estado actual

Actualizado: 2026-09-26

> Esta seccion reemplaza el estado fechado 2026-09-11 que se conserva mas abajo
> como referencia historica.

## Resumen vigente

- Workspace obligatorio: `D:\UltimoTurno\Stock`.
- Produccion: `https://ultimoturnoapp-api.vercel.app/`.
- Infraestructura: Vercel + Supabase/Postgres + Supabase Storage.
- Rama de despliegue: `main`.
- Ultimo commit funcional desplegado y verificado: `08a2e0c`.
- El claim activo de produccion contiene datos reales: no eliminarlo, cancelarlo
  ni recrearlo durante verificaciones.
- Las ordenes tambien son datos reales. Las mejoras visuales recientes fueron
  solo de frontend y no modificaron la base de ordenes.

## Trabajo completado del 17 al 26 de septiembre

- El carrito movil ahora ocupa la pantalla disponible, mantiene totales y confirmacion accesibles, desplaza solo la lista de cartas y agrupa las herramientas de exportacion en un desplegable compacto.
- Las cantidades del carrito se editan con botones menos/mas o escritura directa. Los campos aceptan quedar vacios mientras se reemplaza el valor, seleccionan el contenido al enfocarse y ya no fuerzan prefijos como `01` o `013`; el cierre de venta elimina totales y avisos duplicados.

### Navegacion y sincronizacion

- El arranque ya no descarga toda la plataforma. Antes esperaba unas 18 APIs
  globales, incluyendo stock, ventas, compras, auditoria, herramientas de
  calidad y hasta 20.000 capturas moviles aunque esa pantalla no las usara.
  Ahora autentica y carga solo los datos de la URL visible; cada sector se
  obtiene al entrar y mantiene su sincronizacion independiente.
- Las navegaciones nuevas disparan su consulta inmediatamente y las solicitudes
  concurrentes se deduplican por sector. Una operacion ya no ejecuta el refresh
  global: actualiza solamente la vista activa.
- `Cargar stock` no descarga el inventario completo ni consulta el conteo caro
  del catalogo al iniciar. El contador muestra `Catalogo completo` hasta tener
  un total disponible sin bloquear; la busqueda consulta directamente el
  endpoint indexado.
- La API serializa JSON compacto y comprime con gzip las respuestas mayores a
  1 KB. En produccion, `/stock` bajo de `2.510.223` bytes compactos sin
  compresion a `344.611` bytes transferidos con gzip, cerca de 86% menos.
- Medicion productiva previa al cambio: `/stock` entregaba aproximadamente
  3,5 MB de JSON indentado; `/catalog-cards?q=pikachu` rondaba 1 segundo y el
  contador `/pricecharting-cache/status` llego a 6,5 segundos. El contador fue
  retirado del camino critico. Commit funcional: `a2b98c3`; ajuste final de
  arranque: `08a2e0c`.
- Se unifico el sistema visual global: cabecera, navegacion y barra operativa
  permanecen en el flujo normal para no superponerse; `Mas` despliega una
  franja que empuja el contenido y se cierra al navegar. Paneles, botones,
  campos y toolbars comparten radios, alturas y espaciado, con una grilla
  estable en movil.
- Cada sector principal tiene una URL propia y navegable: `/inicio`,
  `/inventario`, `/inventario/cargar-stock`, `/claims`, `/claims/en-vivo`,
  `/ordenes`, `/caja`, `/compras`, `/calidad`, `/movimientos`, `/importar`,
  `/carga-movil`, `/revendedores` y `/admin`.
- El portal de revendedores tambien tiene URLs por sector:
  `/portal-revendedor/venta`, `/portal-revendedor/pedidos`,
  `/portal-revendedor/stock`, `/portal-revendedor/stock-global` y
  `/portal-revendedor/ventas`.
- La navegacion usa el historial del navegador sin recargar toda la aplicacion;
  atras, adelante y abrir un enlace en otra pestana funcionan como se espera.
- El sector visible se sincroniza automaticamente cada 15 segundos y al volver
  a enfocar la ventana. Solo consulta los datos necesarios para esa pantalla y
  conserva formularios, carrito, filtros y posicion de scroll.
- `Actualizar sector` reemplaza la recarga global manual. El indicador
  `En vivo` / `Sincronizando` informa el estado sin bloquear la operacion.
- El portal de revendedores sincroniza su panel cada 15 segundos sin vaciar el
  carrito ni cambiar la pestana activa.
- Verificacion local: una carga externa de 5 cartas aparecio sola en Inventario
  durante el siguiente ciclo, sin recargar la pagina; rutas directas, historial,
  desktop, movil y consola del navegador verificados.

### Automatizaciones y alertas

- Se agregaron rewrites explicitos para `/api/cron/*` y
  `/api/database-quality/*`. Sin esas reglas Vercel devolvia su `404` antes de
  que las rutas anidadas llegaran al servidor, por lo que los cron diarios no
  estaban ejecutando PriceCharting ni TCGplayer.
- La aplicacion muestra una alerta global cuando la ultima corrida de alguna
  fuente fallo, nunca existio o tiene mas de 24 horas.
- La alerta ya no confunde estados aun no cargados por la navegacion sectorial
  con fuentes nunca ejecutadas. Administracion carga sus ocho indicadores en
  tandas acotadas y conserva cada resultado exitoso aunque otro endpoint falle,
  mostrando un aviso puntual para la fuente que no respondio.
- `Mas > Administracion` muestra por fuente la programacion, ultima ejecucion,
  duracion real, resultado y error persistido. Los reintentos quedan bloqueados
  mientras estan corriendo; TCGplayer consulta primero la version de TCGCSV y
  salta la descarga completa cuando no hubo cambios.
- Las corridas nuevas guardan `started_at` y `completed_at` reales, incluyendo
  fallos, para que el diagnostico no dependa del estado efimero de una funcion
  serverless.

### Claims, catalogo y stock

- Inventario muestra un acceso permanente al carrito mediante un icono con
  contador en la barra superior. La apertura solicitada por `Cobrar ahora` se
  consume una sola vez, por lo que volver a Inventario ya no reabre el panel.
- El carrito muestra totales ARS y USD en el encabezado. Permite incluir u
  ocultar precios y copiar la lista, copiar una grilla PNG, descargar CSV o
  descargar una o varias grillas PNG con las cartas agregadas. La grilla ajusta
  sus columnas y filas a las cartas presentes, sin exportar el lienzo 5x6 vacio.
- Inventario abre por defecto mostrando cartas con stock. Disponibilidad,
  idioma y fuente de precio quedan siempre accesibles en una franja compacta;
  expansion, condicion, lote, ubicacion, estado, categoria y calidad se agrupan
  en un panel avanzado corto, sin desplegar el bloque alto anterior.
- Cada tarjeta de Inventario sin imagen muestra `Reparar imagen` como una accion
  propia debajo de Stock, Detalles y Carrito. No depende de overlays ni de abrir
  el editor completo, y actualiza la tarjeta cuando encuentra una fuente valida.
- `Resolver stock primero` ya no cruza todo el catalogo PriceCharting mediante
  condiciones `OR`. La cola parte solo del stock activo sin imagen, resuelve
  primero por el identificador PriceCharting indexado y usa
  nombre/expansion/numero como respaldo. Tampoco reescribe entradas que ya
  tienen una URL descubierta o descargada. Esto corrige el timeout de Postgres
  en `/pricecharting-images/external-index` antes de iniciar la reparacion.
- La regresion de cola de imagenes quedo cubierta por la suite: vinculacion
  directa, coincidencia de catalogo con numeros normalizados, exclusion de
  cartas con imagen y conservacion de URLs ya resueltas.
- El indice masivo externo usa `/tmp/ultimoturno-external-image-index.json` en
  Vercel (o `EXTERNAL_IMAGE_INDEX_PATH` si se configura). Ya no intenta escribir
  dentro de `/var/task`, que es de solo lectura en funciones serverless.
- Verificacion productiva del 26 de septiembre: la cola prioritaria respondio
  en `1,7 s` y encolo las `188` cartas de stock sin imagen. El indice externo
  proceso `300` pendientes en `126,6 s`, encontro `107` URLs confiables y no
  registro fallos. El stock sin imagen bajo de `188` a `81`; las restantes se
  conservaron pendientes porque no hubo coincidencia fuerte.
- La pantalla `Calidad` se simplifico para el trabajo diario: conserva las
  metricas y la bandeja de revision, pero muestra solo `Sincronizar fuentes` y
  `Reparar imagenes prioritarias`. La sincronizacion ejecuta PriceCharting,
  indice maestro y TCGplayer en orden; los controles tecnicos duplicados quedan
  centralizados en `Mas > Administracion`.
- Se agrego `/claims/planificar`, un workspace separado para preparar multiples
  borradores sin modificar ni reservar stock. Incluye selector masivo desde
  inventario disponible, cantidades, secciones, precios, tags y publicacion
  transaccional como claim activo.
- Los planes usan stock existente y no vuelven a ingresarlo al inventario al
  publicarse. La disponibilidad se revalida antes de publicar y UltimoTurno
  conserva prioridad mientras el plan siga en borrador.
- El asistente opcional convierte una instruccion en una estrategia estructurada
  y luego selecciona las cartas localmente. Solo la instruccion escrita se envia
  a OpenAI; nombres, precios, cantidades y tags del inventario no salen de la
  plataforma. Requiere `OPENAI_API_KEY`; el modelo es configurable mediante
  `OPENAI_CLAIM_MODEL` y por defecto usa `gpt-4o-mini`.
- Migracion nueva: `0036_claim_planner.sql`.
- El buscador de cartas del claim se movio arriba de la mesa para evitar bajar
  hasta el final de la pagina.
- El claim agrupa cantidades: una carta con varias unidades mantiene una sola
  imagen y el mensaje final aclara `hay N`.
- La busqueda del claim permite filtrar ingles, japones y chino, y prioriza
  resultados que ya existen en stock.
- Las cartas agregadas a un claim entran al ciclo de stock; una venta confirmada
  descuenta la unidad correspondiente.
- La carga de stock paso a una pagina completa. `Agregar stock y seguir` queda
  en el flujo nuevo y ya no vuelve a abrir el modal anterior.
- La accion rapida de Inventario separa `Actualizar precio` de `Agregar stock`:
  editar el valor de venta conserva la cantidad existente y no genera unidades.
- La busqueda interactiva del catalogo se optimizo y dejo de recalcular el total
  completo en cada consulta.
- La carga masiva de stock conserva sus resultados y posicion durante la
  sincronizacion sectorial: actualizar `allItems` ya no reinicia el buscador ni
  contrae la grilla, evitando el salto de scroll cada 15 segundos.
- Las coincidencias del inventario aparecen inmediatamente y permanecen
  visibles mientras llega el catalogo completo. El debounce bajo a `100 ms`.
- La consulta de catalogo usa GIN para prefijos y un indice funcional para el
  numero principal de carta; se eliminaron comparaciones `%texto%` redundantes.
  Busquedas como `psy 44/62` se normalizan a `44` sin perder precision.
- La API conserva durante 60 segundos hasta 400 busquedas recientes, útil para
  varias personas cargando las mismas expansiones al mismo tiempo.
- En `/inventario/cargar-stock` se ocultan temporalmente la alerta automatica y
  la barra operativa, la cabecera es compacta y la grilla usa todo el ancho.
- En pantallas de hasta `620 px`, la carga de stock usa un workspace movil
  especifico: oculta la cabecera y navegacion globales, reduce el encabezado a
  una linea, mantiene idioma y moneda en una franja horizontal y coloca el
  boton de busqueda junto al campo en vez de apilarlo debajo.
- Los resultados moviles usan filas compactas con imagen, identidad y precios;
  su alto responde al viewport dinamico y reserva espacio inferior para que el
  teclado y la barra del navegador no tapen las ultimas cartas. El campo usa la
  accion `search` del teclado movil y no permite autocompletado del navegador.
- La mejora movil se valido con lint, typecheck y build. El commit `ad609e5` se
  desplego en Vercel y produccion entrego el CSS nuevo; `/api/public-status`
  confirmo PostgreSQL accesible.
- Migracion nueva: `0039_catalog_search_number_index.sql`.
- La carga de stock muestra coincidencias del inventario de inmediato, reduce el
  debounce a `180 ms` y usa un indice GIN de texto completo para evitar escanear
  las mas de 120 mil cartas en cada busqueda (`0037_fast_catalog_search.sql`).
- Se normalizo el tamano visual de cartas y se agregaron fallbacks seguros para
  imagenes publicas de TCGPlayer/CDN mediante proxy cuando hace falta.
- `Forzar imagen` en Inventario ya no guarda rutas efimeras como
  `/pricecharting-images/files/...`: conserva la fuente publica remota que
  funciona entre ejecuciones de Vercel. Volver a forzar una carta afectada
  reemplaza la ruta local rota por su URL durable.

### Precios TCGplayer

- La fuente de precios es TCGCSV, sin depender de credenciales de la API oficial
  de TCGplayer. El cache guarda low, mid, high, market y direct low por producto
  y acabado.
- Al iniciar la mejora habia `45.464` precios para `31.480` productos, pero solo
  `26` de las `1.347` cartas del inventario resolvian un producto TCGplayer. El
  problema era de vinculacion, no de descarga.
- El matcher ahora prioriza fichas PriceCharting reales sobre filas sinteticas
  TCGCSV cuando ambas tienen la misma coincidencia.
- Inventario y catalogo pueden heredar el producto TCGplayer de otra variante de
  la misma carta, y eligen el subtipo de precio segun acabado (`Normal`,
  `Reverse Holofoil`, `Holofoil`, etc.).
- Cuando una imagen ya contiene `/product/{id}`, ese identificador exacto tiene
  prioridad y evita una coincidencia aproximada.
- El endpoint de sincronizacion acepta `inventoryOnly=true` para recorrer TCGCSV
  contra las cartas operativas sin reprocesar todo el indice de 120 mil fichas.
- El backfill productivo completo conecto `1.120` de las `1.347` cartas del
  inventario y, despues de validar acabados, encontro precio confiable para
  `1.107`; antes solo `25` tenian precio. Se preservaron `10` conflictos
  ambiguos sin sobreescribirlos.
- La seleccion de precio respeta el acabado. `Cosmos`, `Master Ball` y
  `Poke Ball` no usan un precio generico si TCGCSV no ofrece ese subtipo, y las
  cartas antiguas normales priorizan `Unlimited` sobre `Normal`.
- Vercel ejecuta `/api/cron/tcgplayer-refresh` diariamente a las `09:30 UTC`
  (`06:30` de Argentina), despues del cron de PriceCharting.
- Migracion nueva: `0035_tcgplayer_price_fallback.sql`.
- El alta de stock usa TCGplayer como respaldo cuando una carta no tiene precio
  PriceCharting, evitando que cartas con referencia valida caigan al minimo de
  `800 ARS`.
- `Mas > Administracion` incluye un reparador general de precios de venta con
  vista previa. El modo seguro corrige pisos y faltantes; el modo general
  muestra tambien subas y bajas. Trabaja en tandas auditadas de hasta 250,
  recalcula con el dolar blue vigente y no modifica claims, ordenes ni ventas
  historicas.

### Revendedores en consignacion

- Se publico un sistema de usuarios revendedores con comision configurable,
  stock asignado, ventas, anulaciones, devoluciones y rendiciones auditables.
- La asignacion administrativa usa busqueda con resultados inline, imagen y
  datos de variante; elegir una carta ya no requiere abrir un desplegable.
- La asignacion es blanda: el stock sigue disponible para UltimoTurno, que
  siempre tiene prioridad. La venta del revendedor revalida y descuenta stock
  dentro de una transaccion.
- El portal fue redisenado como una herramienta operativa, con carrito, precios,
  comision estimada, saldo a rendir, historial y stock propio.
- Los revendedores pueden guardar pedidos sin reservar stock y confirmarlos mas
  tarde. Tambien pueden consultar el stock global en modo estrictamente lectura.
- Los pedidos confirmados tienen preparacion (`A embalar`, `A entregar`,
  `Entregado`) y cobro (`Pendiente`, `Pagado`) como estados independientes.
- Migraciones nuevas: `0032_reseller_consignment.sql`,
  `0033_reseller_orders.sql` y `0034_reseller_order_workflow.sql`.
- Verificacion final: lint, typecheck, build y DB verify OK; 42 tests aprobados;
  revision visual desktop y movil; produccion confirmada en `5e115f1`.

## Trabajo completado del 12 al 16 de septiembre

### Claims e importacion

- Se agrego un cargador CSV dentro de cada claim para elegir una seccion,
  cargar o pegar el archivo, generar una vista previa y agregar solo las filas
  conciliadas.
- Se corrigio el error `504` de `Generar vista previa` para CSV del scanner.
- Se agrego matching de nombres con caracteres japoneses en CSV de MonPrice.
- Se reparo la recuperacion de imagenes del claim activo y se bloquearon URLs
  protegidas o no publicas que se rompian en la web.

### Imagenes online

- El bucket esperado es `ultimoturno-images`.
- La reparacion prioritaria reutiliza primero imagenes confiables que ya existen
  en el catalogo para la misma carta. Acepta diferencias inocuas de numero como
  `26` / `026`, exige coincidencia de nombre, expansion e idioma y persiste la
  URL publica en el producto de stock; no vuelve a descargar la misma imagen.
- El daemon ejecuta esa reutilizacion al comienzo de cada ciclo y la accion
  `Reparar imagenes prioritarias` tambien la aplica antes de consultar fuentes
  externas. Las descargas pendientes se ordenan ahora por prioridad de stock
  antes que por el estado general de la cola.
- Para evitar los limites de ejecucion de Vercel, el daemon pide una tanda de
  cartas operativas sin URL, prueba localmente las rutas directas de
  PriceCharting y sube cada acierto a Supabase antes de continuar con el backlog
  general. Los `403` de TCGplayer ya no impiden este paso prioritario.
- El lanzador operativo usa `--priority-only`: mientras existan faltantes en
  stock procesa tandas chicas contra PriceCharting/PokemonTCG y evita gastar
  ciclos en URLs TCGplayer que responden `403`.
- Migracion nueva: `0040_reuse_catalog_stock_images.sql`.
- Existe un daemon local de produccion en `tools/image-storage-daemon.ts`.
- Comando: `npm run images:storage:daemon -- --loop`.
- Lanzador: `Mejorar Calidad Imagenes Online.cmd`.
- Descarga candidatos al directorio `D:\UltimoTurno\pricecharting-images`, los
  sube a Supabase Storage y enlaza la URL publica en la base online.
- Endpoints agregados:
  - `GET /pricecharting-images/download-candidates?limit=N`
  - `POST /pricecharting-images/:id/link-public`
  - `POST /pricecharting-images/:id/download-failed`
- Los `403`, `404` y `410` se registran con espera de 24 horas para evitar que
  el daemon repita inmediatamente la misma fuente fallida.
- Cuando hay backlog de candidatos ya descubiertos, el daemon prioriza subirlos
  y evita ejecutar la busqueda externa pesada en cada ciclo.
- Ultima observacion manual conocida: `claim-sin-img=0`, `stock-sin-img=6` y
  cobertura de catalogo cercana al `23%`. Es una foto operativa, no una garantia
  actual; consultar los endpoints antes de tomarla como valor presente.
- `external-index` puede superar los 60 segundos y devolver `504` en Vercel.
  El daemon sigue con candidatos existentes. Algunas URLs de TCGPlayer responden
  `403`; ahora quedan en backoff en lugar de trabar la cola.

### PriceCharting

- El token se configura solo por variable de entorno `PRICECHARTING_TOKEN`.
- El token de produccion se roto en Vercel el 2026-09-26 despues de que la
  credencial anterior comenzara a responder `410`. El valor no se guarda en
  Git ni en estos documentos.
- La importacion masiva dejo de ejecutar cientos de `INSERT` separados y usa
  tandas JSON de hasta 10.000 filas. Las filas sin cambios no se reescriben y
  la poda compara directamente los IDs presentes en el archivo.
- `api/[...path].ts` permite hasta 300 segundos bajo Fluid Compute en vez del
  limite artificial de 60 segundos. La primera corrida productiva optimizada
  completo 94.943 filas en 55,25 segundos, dejo 122.677 entradas y termino con
  estado `completed`.
- Vercel ejecuta `/api/cron/pricecharting-refresh` diariamente a las `09:00 UTC`
  (`06:00` de Argentina) segun `vercel.json`.
- La busqueda de imagenes tiene fallback cuando PriceCharting devuelve una
  pagina de busqueda en lugar de una ficha de producto.

### Ordenes

- Las ordenes reservadas pueden marcarse como pagadas despues de un reset de
  inventario. Si la reserva ya no coincide, el cierre no genera stock negativo
  ni descuenta una reposicion posterior: confirma el cobro, concilia la reserva
  obsoleta y registra la excepcion en auditoria.
- Se renovo el tablero con metricas operativas: contactar, vencidas, cobrar,
  embaladas y entregar.
- Las tarjetas muestran comprador, estado, total, resumen, mensaje, deuda y
  progreso de embalaje con colores por estado.
- Se compacto la cabecera y la navegacion solo en la vista Ordenes para dejar
  mas altura al tablero y a las tarjetas.
- Archivos principales: `apps/admin-web/src/main.tsx` y
  `apps/admin-web/src/styles.css`.

## Commits funcionales recientes

```text
08a2e0c perf: eliminar contador bloqueante del alta
a2b98c3 perf: cargar cada sector bajo demanda
ad609e5 Mejorar carga de stock en celular
bc1c859 perf(api): compress shared stock snapshots
8ad146f fix(db): use portable snapshot epoch
1ab2454 fix(api): share stock snapshots across instances
d79e7d3 perf(db): streamline stock read joins
5e115f1 Add reseller order workflow states
2f51d11 Add reseller orders and global stock view
fcd6781 Redesign reseller sales portal
32bb40f Add reseller consignment system
6e9dac1 Remove catalog count from interactive search
687fa8d Speed up catalog card search
bcba451 Allow safe public image proxy fallback
891d344 Normalize inventory card dimensions
106264a Fallback to direct catalog images
d364c26 Keep stock intake in full-page flow
7952ca5 Add dedicated stock intake workspace
4279907 Move claim card search above workspace
75631b4 Stabilize catalog image delivery
67fc876 Improve claim catalog and stock lifecycle
ab108a3 Refresh project handoff documentation
708c9aa Compact orders workspace chrome
6539590 Polish orders workspace UI
c66f66a Back off failed image download sources
a14d887 Skip image discovery while storage backlog exists
4ad725e Make image storage daemon production-safe
4473356 Add online image storage daemon
85f2234 Handle PriceCharting search fallback for images
ca6a9a0 Schedule daily PriceCharting refresh
5aea65a Add image quality repair tools
0b3bc17 Support Japanese MonPrice CSV names
24a6ee0 Prevent protected claim image URLs
9fd2c87 Fix claim image URLs for web
0f553a6 Repair active claim image recovery
8b1d530 Fix scanner CSV import preview
2ebd38d Add claim section CSV loader
```

## Variables necesarias, sin valores

```ini
ULTIMOTURNO_ACCESS_KEY=...
ULTIMOTURNO_DATABASE_URL=...
ULTIMOTURNO_DATABASE_SSL=true
ULTIMOTURNO_DATABASE_POOL_MAX=1
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=ultimoturno-images
PRICECHARTING_TOKEN=...
PRICECHARTING_IMAGE_DIR=D:\UltimoTurno\pricecharting-images
OPENAI_API_KEY=...
OPENAI_CLAIM_MODEL=gpt-4o-mini
```

Nunca copiar valores reales a Git, logs compartidos o documentacion.

## Verificacion y deploy

Antes de subir cambios:

```powershell
npm run lint
npm run typecheck
npm test
npm run db:verify
npm run build
```

Despues de `git push`, comprobar `GET /api/public-status` y confirmar que
`deployment.commitSha` coincide con el commit enviado. Si no coincide, Vercel
todavia puede estar construyendo.

---

## Archivo historico al 2026-09-11

Actualizado: 2026-09-11

Este archivo es la memoria corta del proyecto para poder abrir otro chat y
seguir trabajando sin perder contexto.

## Workspace

```text
D:\UltimoTurno\Stock
```

La carpeta que importa para codigo nuevo es esta. Si Codex aparece parado en
`C:\Users\skype\Documents\Stock`, cambiar el working directory a
`D:\UltimoTurno\Stock` antes de tocar archivos.

## Online

App online:

```text
https://ultimoturnoapp-api.vercel.app/
```

API online:

```text
https://ultimoturnoapp-api.vercel.app/api
```

Proveedor:

```text
Vercel + Supabase Postgres
```

Estado funcional conocido:

- La pagina carga online.
- El inventario puede estar en cero y eso es normal si no se cargo stock.
- El catalogo PriceCharting completo fue importado: aproximadamente 120.710
  entradas.
- La busqueda de agregar stock debe buscar contra el catalogo completo, no solo
  contra cartas que alguna vez tuvieron inventario.
- Se agrego el endpoint `/catalog-cards` como fuente unificada del selector.
- Puede quedar un problema de deploy/cache en Vercel si online sirve una version
  vieja del backend. Verificar el commit desplegado antes de asumir que el codigo
  local esta roto.

## Local

Comandos habituales:

```powershell
npm run dev:api
npm run dev:web
```

Tambien existen accesos `.cmd` en la raiz para abrir la plataforma con perfil
piloto real.

Perfil esperado:

```text
ULTIMOTURNO_DATA_PROFILE=PILOTO REAL
ULTIMOTURNO_ALLOW_EXAMPLES=false
```

Base local esperada para piloto:

```text
D:\UltimoTurno\Stock\apps\api\.data\ultimoturno-pilot-real
```

Imagenes locales esperadas:

```text
D:\UltimoTurno\pricecharting-images
```

## Base de datos

Local puede usar PGlite. Produccion usa Postgres/Supabase.

Variables importantes, sin pegar secretos en git:

```ini
ULTIMOTURNO_DB_DRIVER=postgres
ULTIMOTURNO_DATABASE_URL=...
ULTIMOTURNO_DATABASE_SSL=true
ULTIMOTURNO_DATABASE_POOL_MAX=1
ULTIMOTURNO_ACCESS_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=ultimoturno-images
PRICECHARTING_TOKEN=...
```

Notas de DB:

- En Vercel se ajusto el pool para evitar `EMAXCONNSESSION max clients reached`.
- En produccion conviene usar transaction pooler y `ULTIMOTURNO_DATABASE_POOL_MAX=1`.
- Las migraciones viven en `packages/db/migrations`.
- La migracion mas reciente importante es `0030_unified_catalog_cards.sql`.

## Catalogo

Fuente principal:

```text
PriceCharting CSV / API
```

Estado conocido:

- Total aproximado: 120.710 entradas.
- Con precio PriceCharting: aproximadamente 81.339 entradas.
- TCG price cache online estaba vacio en la ultima revision conocida.
- El catalogo NO es stock. Sirve para elegir cartas y crear stock.
- Stock en cero no significa catalogo vacio.

Separacion por idioma:

- `english`
- `japanese`
- `chinese`

Regla de negocio:

- Korean, Indonesia y promos/variantes de otros paises asiaticos caen en
  `japanese`.
- La UI muestra filtros tipo `Todos`, `US Ingles`, `JP Japones`, `CN Chino`.

Endpoint unificado:

```text
GET /api/catalog-cards?q=...&languageGroup=...
```

Este endpoint debe ser la fuente del modal `Agregar stock`.

## Imagenes

Estado conocido:

- Hay imagenes locales descargadas/cacheadas.
- Se hizo una subida parcial/grande a Supabase Storage:
  - aproximadamente 37.014 subidas;
  - 595 ya existentes;
  - 16 fallidas.
- El bucket esperado es `ultimoturno-images`.
- El script de subida es:

```powershell
npm run images:supabase:upload
```

Script real:

```text
scripts/upload-pricecharting-images-to-supabase.mts
```

Notas:

- Las imagenes de PriceCharting no siempre vienen en el CSV.
- El sistema puede usar fallback desde `card_index_entries` / TCGCSV cuando
  matchea idioma + expansion + numero.
- Si el catalogo muestra placeholder `PC`, revisar primero si `image_url` viene
  vacio desde `/catalog-cards`.

## UI de agregar stock

Cambios recientes:

- El buscador principal conserva el texto local mientras se escribe y aplica el
  filtro tras `300 ms` de pausa, sin reponer consultas anteriores ni perder
  letras durante una escritura rapida.
- Busca en catalogo completo.
- Muestra contador de catalogo completo.
- Agrega filtro de idioma.
- Distingue acabados como `Reverse`.
- Muestra precios separados:
  - `PC`: precio de PriceCharting.
  - `TCG`: precio de TCG en caso de tenerlo.
- Se saco el texto `blue` del listado del catalogo.
- Hay toggle superior para ver precios en `USD` o `ARS`.
- Al seleccionar carta, los campos `Precio de venta ARS` y `Precio de venta USD`
  se convierten entre si.
- Precio minimo de venta: `800 ARS`.
- Hay valor recomendado redondeado para acelerar carga de stock.

Regla de precio:

- Si se carga ARS, calcula USD.
- Si se carga USD, calcula ARS.
- Si falta precio fuente, recomendar minimo `800 ARS`.
- El backend tambien normaliza el precio ARS antes de guardar.

## Revendedores en consignacion

MVP publicado en produccion:

- Usuarios revendedores con email, password y sesion propia.
- Comision porcentual configurable por revendedor.
- Asignacion y devolucion de unidades con historial auditable.
- La asignacion es blanda: no modifica `quantity_on_hand` ni
  `quantity_reserved`, por lo que UltimoTurno conserva prioridad de venta.
- Al confirmar una venta del revendedor se valida el stock real en transaccion;
  si una venta central consumio las unidades, la operacion se rechaza.
- La venta confirmada descuenta stock, calcula bruto, comision y neto a rendir.
- Anular una venta repone stock y revierte las unidades vendidas.
- Rendiciones registradas como libro de pagos, con saldo pendiente.
- Gestion interna en `Mas > Revendedores`.
- Portal separado en `?revendedor=1`.
- Pedidos propios: se guardan pendientes sin reservar stock y se convierten en
  venta solo despues de revalidar disponibilidad.
- Vista de stock global para revendedores, buscable y de solo lectura; no
  expone costos de compra ni acciones administrativas.
- Seguimiento operativo de pedidos confirmados con preparacion (`A embalar`,
  `A entregar`, `Entregado`) y cobro (`Pendiente`, `Pagado`) independientes.

Las migraciones son `0032_reseller_consignment.sql`,
`0033_reseller_orders.sql` y `0034_reseller_order_workflow.sql`. No se aplicaron cambios ni
datos de prueba sobre produccion durante la implementacion.

## Precios CoolStuff

- Se agrego una cache persistente de precios retail CoolStuff por
  `pricecharting_id`, condicion y acabado.
- El inventario expone CoolStuff como fuente real cuando existe una
  coincidencia confiable, incluyendo precio USD y enlace canonico.
- El worker externo procesa solo cartas inglesas con stock positivo cuyo dato
  falta o esta vencido. No intenta descargar todo el sitio.
- El descubrimiento usa el indice publico de expansiones y sus paginas
  paginadas. Las paginas se reutilizan dentro de cada tanda para reducir
  solicitudes.
- Las consultas son secuenciales y esperan al menos 10 segundos. Una respuesta
  vacia o bloqueada se registra como fallo reintentable, no como carta ausente.
- Nombre, expansion, numero, condicion y acabado se validan antes de aplicar el
  precio. Coincidencias ambiguas no se publican automaticamente.
- La migracion es `0038_coolstuff_price_cache.sql`; la operacion se inicia con
  `Actualizar Precios CoolStuff.cmd` o `npm run coolstuff:prices:daemon`.
- Vercel aloja la API y Supabase conserva el progreso, pero el scraping debe
  ejecutarse desde un equipo o worker externo de larga duracion.

Verificacion del MVP:

```text
typecheck OK
lint OK
build OK
tests OK: 48 pass, 0 fail
alta/login/portal API local OK
revision visual desktop OK
revision visual movil OK
produccion `5e115f1` OK
```

## Verificacion

Ultima verificacion local conocida despues de los cambios estructurales:

```powershell
npm run typecheck
npm run build
npm run db:verify
npm test
```

Resultado conocido:

```text
typecheck OK
build OK
db:verify OK
tests OK: 42 pass, 0 fail
```

## Commits recientes importantes

```text
5e115f1 Add reseller order workflow states
2f51d11 Add reseller orders and global stock view
fcd6781 Redesign reseller sales portal
32bb40f Add reseller consignment system
609a61b Add unified catalog cards view
556c9eb Optimize unified catalog search
de5a4f1 Filter reference rows in unified catalog
22c6f97 Trigger unified catalog deploy
```

Si online no refleja el comportamiento esperado, revisar en Vercel si el commit
activo es el ultimo de `main`.
