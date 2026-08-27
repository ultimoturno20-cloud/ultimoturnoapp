# Traspaso de contexto - UltimoTurno

Actualizado: 2026-08-24

Este documento permite continuar el trabajo desde otra cuenta de Codex en la
misma PC sin depender del historial del chat anterior.

## Estado operativo actual - 2026-08-24

Workspace activo:

```text
D:\UltimoTurno\Stock
```

La API local esta corriendo y responde en:

```text
http://127.0.0.1:4000
```

Perfil y base activa segun `GET /health`:

```text
Perfil: PILOTO REAL
Ejemplos: deshabilitados
Base: D:\UltimoTurno\Stock\apps\api\.data\ultimoturno-pilot-real
Imagenes: D:\UltimoTurno\Stock\apps\api\.data\pricecharting-images
```

Foto de datos tomada el 2026-08-24:

```text
SKUs: 438
Unidades totales: 138
Reservadas: 137
Disponibles: 1
Valor disponible: $125.000 ARS
Ordenes activas: 87
Ordenes entregadas: 26
Ordenes canceladas: 1
Compras registradas: 0
Claim activo: Claim 18 de agosto
Claims historicos: 7
Items con reserva: 130
```

El 2026-08-21 se ejecuto un reset controlado para empezar una carga completa de
stock: se bajo el stock disponible a cero preservando las reservas de ordenes.
Despues de ese reset la base quedo con `totalUnits = reservedUnits` y
`availableUnits = 0`. Al 2026-08-24 hay nuevamente `1` unidad disponible, por
lo que no asumir que el inventario sigue exactamente igual que al terminar el
reset.

Respaldos logicos del reset:

```text
D:\UltimoTurno\Stock\outputs\stock-before-reset-2026-08-21T10-07-04Z.json
D:\UltimoTurno\Stock\outputs\stock-before-reset-2026-08-21T10-06-52Z.json
```

Script reutilizable del reset:

```text
D:\UltimoTurno\Stock\scripts\reset-available-stock-api.ps1
```

Este script trabaja por API local y preserva reservas. No abrir PGlite directo
si la API esta corriendo.

## Cambios recientes importantes

- `Importar stock` tiene ahora un bloque de carga rapida: una carta por linea
  con separador `|` o tabulacion. Convierte a CSV y genera vista previa en un
  click.
- La carga rapida acepta este formato:

```text
Nombre | Expansion | Numero | Cantidad | Precio USD | Precio ARS | Variante | Ubicacion
Abra | Scarlet & Violet 151 | 63 | 2 | 0.91 | 1500 | reverse | Caja A
Team Rocket's Mewtwo Ex | Ascended Heroes | 281 | 1 | 535.5 | 850000 | PSA 10 | Vitrina
```

- `Importar stock` incorpora `Resolver seguras`, que resuelve coincidencias de
  alta confianza contra PriceCharting o stock existente y deja las dudosas para
  revision manual.
- `Inventario / Venta` tiene edicion rapida de `Disponible`: se escribe el
  disponible final y el sistema registra el ajuste de stock por diferencia.
- `Ordenes` trabaja con tableros generados desde claims cerrados y un tablero
  `Pedidos` para ordenes externas. Las tarjetas se abren haciendo click en la
  tarjeta; el boton `Abrir` fue eliminado.
- `Ordenes` tiene acciones rapidas de `Mensaje`, `Pago`, `Entrega` y
  `Eliminar`. Eliminar es una cancelacion segura: libera reserva, conserva
  auditoria y saca la orden de activas.
- `Ordenes` conserva historial de `Entregadas`. Los estados tienen color tenue
  por tarjeta: pendiente, mensaje, embalada, pagada y entregada.
- `Caja` reemplaza a `Ventas` como vista financiera operativa: stock
  valorizado, deuda a cobrar, compras estimadas a pagar, ventas cobradas y
  ultimas cartas vendidas.
- `Admin` concentra mantenimiento: PriceCharting CSV, precios TCGplayer,
  indice maestro, imagenes, importacion y herramientas avanzadas.
- `Precios TCGplayer` usa TCGCSV como fuente diaria sin credenciales oficiales.
  Guarda snapshot local por `tcgplayer_product_id` + `sub_type_name`, con
  scheduler a las `18:30` hora local y boton manual en Admin.
- Primera carga TCGplayer real del 2026-08-24: 45.185 filas de precio, 31.216
  productos, 18.619 productos cruzados y 30.169 cartas del indice con precio.
- `Calidad` quedo como bandeja de correccion diaria de datos: imagenes,
  PriceCharting, matches debiles y conflictos.
- El modal de producto diferencia RAW y graded; permite PSA/BGS/CGC/SGC,
  nota/certificado y vista previa util.
- El forzador de imagenes acepta URL manual directa o link de PriceCharting; se
  corrigieron casos donde URLs con apostrofes o links completos terminaban como
  rutas invalidas.

## Siguiente foco recomendado

El usuario quiere empezar la carga completa de stock. El proximo trabajo deberia
centrarse en hacer `Importar stock` todavia mas rapido y confiable:

1. Mejorar el preview visual de filas importadas con foto, precio, variante,
   accion y decision en una grilla mas densa.
2. Agregar acciones batch sobre filas revisables: crear todas sin stock previo,
   ignorar seleccionadas, elegir primer PriceCharting seguro, exportar solo
   dudas.
3. Agregar guardado/recuperacion de borrador de importacion para no perder una
   carga larga.
4. Registrar importaciones por lote con resumen historico y posibilidad de
   auditoria/reversion logica.
5. Mantener las ordenes intactas: nunca bajar `quantityOnHand` por debajo de
   `quantityReserved`.

## Prompt corto para iniciar la nueva conversacion

Copiar y pegar esto en la nueva cuenta:

```text
Estamos continuando UltimoTurno desde el workspace
D:\UltimoTurno\Stock.

Antes de modificar archivos, lee en este orden:
1. docs/new-platform/HANDOFF_NEXT_ACCOUNT.md
2. docs/OPERATING_MODEL.md
3. docs/new-platform/LOCAL_DEVELOPMENT.md
4. docs/new-platform/DATA_MODEL.md
5. docs/new-platform/MIGRATION_STRATEGY.md

Inspecciona tambien git status y el codigo actual. El documento de traspaso es
mas reciente que los otros documentos si hay contradicciones.

Estamos trabajando en la NUEVA VERSION. LEGACY debe seguir operativo y no debe
ser modificado salvo que yo lo pida expresamente. No agregues login: el usuario
aclaro que no lo quiere. No elimines Ventas, Compras, Ordenes, Movimientos ni la
revision visual de Importaciones. No conectes Google Sheets, PriceCharting,
Supabase remoto ni datos reales sin autorizacion.

Objetivo siguiente: preparar el primer ingreso controlado de stock real. Primero
separa una base piloto de la base con ejemplos, endurece el parser CSV, genera
una previsualizacion y conciliacion completa, y no apliques la importacion real
sin confirmacion explicita del usuario.

Trabaja de manera incremental: inspecciona, implementa, verifica con
npm run check:new y deja una forma clara de probarlo.
```

## Resumen ejecutivo

UltimoTurno tiene dos sistemas que deben convivir:

1. LEGACY, actualmente operativo.
   - Google Sheets + Apps Script.
   - App Expo/React Native en `mobile-app/`.
   - Generador de claims, ventas, ordenes, caches e importaciones existentes.
   - Debe seguir funcionando y no depende de la nueva plataforma.

2. NUEVA VERSION, en desarrollo activo.
   - Monorepo npm workspaces con TypeScript.
   - Web administrativa React + Vite.
   - API Node HTTP.
   - PostgreSQL embebido persistente mediante PGlite durante desarrollo local.
   - Migraciones SQL compatibles con el objetivo PostgreSQL/Supabase.
   - No usa Google Sheets ni Supabase remoto. PriceCharting queda disponible
     mediante descarga manual autenticada y cache local persistente.

La nueva version ya no debe tratarse como un prototipo descartable. Las
funciones nuevas deben ser incrementales, persistentes y reutilizables en el
producto final. Los datos de ejemplo actuales solo existen para visualizar y
probar; no son inventario real.

## Decisiones firmes del usuario

- La interfaz debe estar en espanol.
- La estetica principal es negra, blanca y roja, basada en la app y el logo de
  UltimoTurno.
- No agregar login ni pantalla de autenticacion. Existe infraestructura de
  sesiones en el schema, pero no es parte de la experiencia pedida actualmente.
- Inventario y venta deben estar unidos: desde el stock se agregan cartas al
  carrito.
- El carrito debe permitir editar cantidad y precio por carta.
- Al confirmar se elige entre venta cobrada y reserva.
- Una reserva debe aparecer en Ordenes y luego poder completarse o cancelarse.
- Deben conservarse Inicio, Inventario/Venta, Ordenes, Ventas, Compras,
  Movimientos, Importar y Claims.
- Movimientos y auditoria se muestran juntos para evitar dos secciones casi
  iguales.
- Importaciones debe mostrar errores, advertencias y multiples coincidencias
  para elegir la carta correcta.
- La carga real debe venir inicialmente desde un snapshot de LEGACY, sin
  escribir en Google Sheets.
- No decidir automaticamente cual hoja es fuente final cuando Stock, Ventas
  Detalle, Ordenes y Movimientos difieren. Primero hay que conciliar.
- La futura tienda online debe reservar stock antes de confirmar el pago.
- El modelo debe admitir varios negocios a futuro, sin complicar la operacion
  actual de un solo negocio.
- No guardar secretos ni credenciales en el repositorio.
- No desplegar, tocar Git remoto ni conectar servicios con costo sin permiso.

## Preferencias de trabajo aprendidas

- Construir versiones pequenas, visibles y funcionales; evitar planes enormes
  antes de mostrar resultados.
- No pedir aprobacion por colores, nombres internos o decisiones tecnicas
  reversibles.
- No quitar funcionalidades existentes al hacer una mejora visual o tecnica.
- No volver a introducir carteles de prototipo ni pantallas vacias.
- Los numeros operativos deben ser grandes y faciles de leer.
- Los formularios se abren por una accion explicita. No deben quedar flotando al
  final de paginas largas.
- No iniciar servidores desacoplados desde Codex ni dejar comandos esperando
  indefinidamente. Para el usuario existe un lanzador que abre dos PowerShell.
- Ejecutar lint, typecheck, tests, verificacion DB y build al cerrar cambios.

## Arquitectura actual de la nueva version

```text
package.json                         scripts del monorepo
apps/
  api/                               API Node HTTP, puerto 4000
  admin-web/                         React + Vite, puerto 5173
packages/
  db/                                PGlite, SQL, repositorios y operaciones
  domain/                            tipos y reglas compartidas
  importers/                         normalizacion y conciliacion
docs/new-platform/                   documentacion de la nueva plataforma
scripts/                             validaciones y lanzador local
apps/api/.data/ultimoturno-pglite/   base persistente local usual, ignorada por Git
Abrir UltimoTurno Nueva App.cmd      inicia API y web en dos ventanas
```

Flujo local:

```text
React/Vite -> HTTP API -> operaciones de packages/db -> PGlite persistente
```

La API crea el negocio y un actor `Sistema local` automaticamente. La web no
pide credenciales y no conserva cambios solamente en memoria del navegador.

## Funcionalidad existente

### Inicio

- Resumen de SKUs, unidades, reservadas, disponibles y valor ARS.
- Ventas de semana y mes.
- Cantidad de ordenes e importaciones pendientes.
- Inventario destacado, actividad y auditoria recientes.

### Inventario / Venta

- Datos persistentes servidos por la API.
- Busqueda inteligente por tokens y ranking: soporta casos operativos como
  `psyduck 44`, usando el primer numero como numero principal de carta y
  priorizando coincidencias nombre + numero.
- Orden por nombre, precio o cantidad.
- Filtros avanzados plegables.
- Imagen o placeholder, precio y disponibilidad legibles.
- Detalle de producto y ultimos movimientos en panel lateral.
- Alta y edicion en modal, abierto solo con `Nuevo producto` o `Editar`.
- Ajustes de cantidad con motivo y movimiento de inventario.
- Carrito lateral con cantidad y precio editable por linea.
- Confirmacion como venta cobrada o reserva.
- Los precios visibles muestran USD y ARS blue cuando hay precio USD o ARS.
  El frontend usa `/exchange-rate/blue`; el backend usa referencia local
  `ULTIMOTURNO_BLUE_RATE_ARS` o 1540 por defecto. Si se define
  `ULTIMOTURNO_BLUE_RATE_MODE=auto`, consulta DolarAPI y cae al valor local si
  no puede actualizar.
- Notificaciones compactas que desaparecen automaticamente.
- Diseno responsive comprobado en escritorio, tablet y celular.

### Ordenes

- Lista reservas persistidas.
- Permite completar o cancelar una reserva.
- Completar descuenta stock; cancelar libera la cantidad reservada.

### Ventas

- Lista operaciones persistidas.
- Resumen semanal y mensual inicial.
- Conserva cliente, canal, lineas, cantidades y precios de venta.

### Compras

- Flujo persistente de compras sobre productos ya existentes o resultados del
  cache local de PriceCharting.
- Registra vendedor, nota, cantidades y costo por linea.
- Suma stock y crea movimientos.
- Incluye un buscador sobre el cache local real de PriceCharting.
- Desde un resultado PriceCharting se puede presionar `Comprar`, cargar
  cantidad/costo y registrar la compra. Si la carta ya existe por
  `priceChartingId`, suma stock al item existente; si no existe, crea producto,
  variante e item con SKU `PKM-PC-{priceChartingId}`, link canonico e imagen
  local/remota disponible.
- El ultimo costo de compra se deriva de `purchase_items` recibidos y se muestra
  en Inventario, en el buscador de Compras y en la exportacion CSV.
- La sincronizacion se ejecuta manualmente y no modifica inventario.
- Las imagenes tienen dos fases: primero se descubren URLs reales y despues se
  descargan archivos locales. La fase rapida replica legacy: abre la pagina
  canonica de PriceCharting y extrae
  `https://storage.googleapis.com/images.pricecharting.com/.../1600.jpg`,
  `og:image` o `twitter:image`, guardando esa URL para que la app ya pueda
  mostrar la carta sin esperar la descarga local.
- Existe endpoint `POST /pricecharting-images/discover` y herramienta
  `tools/pricecharting-image-worker.ts`. El acceso directo
  `Traer URLs Imagenes PriceCharting.cmd` ejecuta el worker rapido por indice
  externo:
  `npx tsx tools\pricecharting-image-worker.ts --save=url --source=external-index --batch=1000 --sleep-ms=0 --loop`.
  El worker habla con la API local para no abrir PGlite desde otro proceso.
- Existe endpoint `POST /pricecharting-images/external-index`. Construye/cachea
  `external-image-index.json` junto a la base local usando PokemonTCG API y
  TCGdex cuando responden, matchea por nombre + expansion + numero y guarda URL
  limpia en `public_url` mas fuente trazable en `source_image_url`. Las cartas
  sin match fuerte se posponen unos minutos, no se marcan como fallidas. Si
  PokemonTCG API no responde, cae al dataset raw de GitHub
  `PokemonTCG/pokemon-tcg-data`, que en pruebas locales respondio mejor que el
  endpoint API. El worker acepta `--rebuild-index` para reconstruir ese cache
  externo sin borrar archivos a mano.
- Existe endpoint `GET /pricecharting-images/external-index/status` para que el
  worker muestre si el indice externo ya existe, cuantas cartas tiene y que
  avisos hubo al construirlo. El acceso directo rapido avisa al usuario que no
  abra ventanas duplicadas y que las primeras tandas pueden depender de ese
  indice.
- PriceCharting HTML no debe ejecutarse con alta concurrencia: PriceCharting
  documenta limites estrictos de API y en pruebas reales pidio cooldown cuando
  el worker corria tandas concurrentes. El modo HTML queda forzado a
  concurrencia 1 y delay minimo de 1000 ms. Para mas velocidad, la mejora
  correcta es indexar fuentes abiertas por expansion completa, no pegarle 90k
  veces a paginas PriceCharting. Si quedan huecos despues del indice externo,
  usar `Traer URLs Imagenes PriceCharting Fallback Lento.cmd`.
- El estado intermedio `url_found` queda registrado en
  `pricecharting_image_cache`. El panel de Compras muestra `URLs imagen` aparte
  de `Imagenes locales`, asi hay feedback aun cuando todavia no se bajaron los
  archivos.
- Para descarga local, el procesador reutiliza `source_image_url` si ya existe;
  eso evita volver a leer HTML de PriceCharting. Tambien puede intentar
  PokemonTCG API y TCGdex, validando nombre + expansion + numero antes de
  asociar imagenes externas al `priceChartingId`. Las imagenes marcadas como
  fallidas vuelven a cola cuando se ejecuta stock/all, asi mejoras del
  descargador recuperan fallos viejos sin limpiar DB a mano.
- Existe modo manual `Solo Pokemon TCG` en Compras. Ese endpoint manda
  `mode: "pokemon-tcg"` a `/pricecharting-images/process`: no usa storage/HTML
  de PriceCharting ni TCGdex. Busca por nombre + numero, primero con expansion y
  despues sin expansion, pero solo descarga/asocia si el score fuerte pasa el
  umbral para evitar imagenes cruzadas.
- El panel de imagenes de Compras muestra progreso global, estado de cola,
  ultima tanda procesada, fuentes que aportaron URLs/imagenes y errores
  recientes por `priceChartingId`. Los botones visibles priorizan la primera
  pasada masiva: `Stock primero`, `URLs masivas`, `Descargar PokemonTCG`,
  `Descargar locales` y `Auto continuo`.

### Claims

- Existe como seccion principal propia en la navegacion.
- Permite crear un claim activo persistente.
- Permite buscar cartas en el cache local de PriceCharting y agregarlas al
  claim activo sin duplicarlas dentro del mismo claim. El buscador tambien
  entiende `nombre numero`, por ejemplo `psyduck 44`, y compara contra el
  primer numero de carta aunque PriceCharting tenga `044` o el usuario pegue
  `44/62`.
- La mesa de revision permite editar precio final ARS, precio final USD,
  nombre final, comprador, tags e ignorar/restaurar cartas.
- Calcula precio sugerido ARS desde el precio USD de PriceCharting con la
  regla inicial del generador viejo: USD x 1510, redondeado hacia arriba a
  500, minimo 800.
- Permite cargar frees basicos por comprador.
- Cerrar claim agrupa por comprador y crea ordenes pendientes en `Ordenes`.
  Las lineas de claim no requieren `inventory_item_id`; quedan como lineas
  externas con nombre/SKU snapshot y no descuentan stock automaticamente.
- Completar/cancelar esas ordenes cambia el estado de la orden, pero no mueve
  stock si la linea no esta vinculada a un item de inventario.

### Movimientos

- Historial de cambios de stock.
- Auditoria basica presentada en la misma seccion.

### Importar

- Recibe snapshot CSV pegado/cargado desde la web.
- Previsualiza antes de aplicar.
- Clasifica filas como crear, actualizar, revisar o invalidas.
- Muestra advertencias y hasta tres candidatos de coincidencia.
- Requiere resolver coincidencias ambiguas y confirmar para aplicar.
- La aplicacion usa las mismas operaciones persistentes y deja auditoria.
- Cruza cada fila contra el cache local de PriceCharting antes de crear stock:
  si hay una coincidencia fuerte la asocia automaticamente con
  `priceChartingId`, URL canonica e imagen local si existe; si hay multiples
  coincidencias plausibles obliga a elegir una; si no hay ninguna bloquea la
  fila para evitar cartas sin identidad externa.
- Para japones/chino usa traduccion local cuando la conoce, pero el matching
  fuerte se apoya principalmente en expansion y numero para cubrir nombres que
  llegan sin traducir desde MonPrice.

## Endpoints actuales

- `GET /health`
- `GET /auth/me` devuelve el actor local; no hay pantalla de login.
- `GET /exchange-rate/blue`
- `GET /stock`
- `POST /inventory`
- `PUT /inventory/:id`
- `POST /inventory-adjustments`
- `GET /movements`
- `GET /audit`
- `GET /sales`
- `POST /sales`
- `POST /sales/:id/complete`
- `POST /sales/:id/cancel`
- `GET /purchases`
- `POST /purchases`
- `GET /claims`
- `POST /claims`
- `POST /claims/cards/from-pricecharting`
- `PUT /claims/cards/:id`
- `POST /claims/frees`
- `POST /claims/close`
- `GET /pricecharting-cache`
- `GET /pricecharting-cache/status`
- `POST /pricecharting-cache/refresh`
- `GET /pricecharting-images/status`
- `POST /pricecharting-images/queue-stock`
- `POST /pricecharting-images/queue-all`
- `POST /pricecharting-images/external-index`
- `POST /pricecharting-images/discover`
- `POST /pricecharting-images/process`
- `POST /examples/inventory`
- `POST /imports/snapshot/preview`
- `POST /imports/snapshot/apply`

## Base de datos

Migraciones reproducibles:

- `0001_initial_stock_readonly.sql`: negocio, usuarios/roles, catalogo,
  variantes, inventario, precios, movimientos, fuentes externas,
  importaciones, reservas, auditoria e idempotencia.
- `0002_operational_inventory.sql`: indices y estructura de sesiones. Las
  sesiones estan dormidas y no deben forzar login en la web.
- `0003_operational_commerce.sql`: ventas, lineas de venta, compras y lineas de
  compra.
- `0004_pricecharting_cache.sql`: catalogo PriceCharting e historial de
  sincronizaciones.
- `0005_pricecharting_image_cache.sql`: cola/cache de imagenes de
  PriceCharting.
- `0006_claims.sql`: sesiones, cartas y frees de claims.
- `0007_pricecharting_image_url_found.sql`: agrega estado `url_found` para
  separar URL encontrada de archivo local descargado.

Desde el 2026-08-07, el perfil operativo local por defecto es `PILOTO REAL`.
Al iniciar mediante `npm run dev:api` o el lanzador de Windows, la base usada
por defecto es:

```text
apps/api/.data/ultimoturno-pilot-real
```

El perfil `PILOTO REAL` tiene `ULTIMOTURNO_ALLOW_EXAMPLES=false`; la ruta
`/examples/inventory` queda bloqueada. Tambien existen bases anteriores de
ejemplos/prueba en `apps/api/.data/ultimoturno-pglite` y
`.data/ultimoturno-pglite`. Quedan archivadas para inspeccion, no para uso
operativo. No mezclar ni borrar ninguna sin inspeccion y confirmacion.

En la ultima revision visual contenia ejemplos y operaciones de prueba. La
pantalla mostraba 8 SKUs, 12 unidades y registros de venta/reserva. No asumir
que nada dentro de esa base es real.

Los seeds de `packages/db/seeds/` se usan para pruebas/verificacion. La API
operativa no carga seeds automaticamente. Los ejemplos visibles se cargaron
mediante la accion `Cargar ejemplos`.

## Comandos

Desde `D:\UltimoTurno\Stock`:

```powershell
npm install
npm run dev:api
npm run dev:web
```

Direcciones:

```text
API: http://localhost:4000
Web: http://localhost:5173
```

Forma recomendada para el usuario:

```text
Doble clic en "Abrir UltimoTurno Piloto Real.cmd"
```

El acceso viejo `"Abrir UltimoTurno Nueva App.cmd"` tambien apunta al piloto
real, para evitar abrir por accidente el ambiente de ejemplos. El lanzador
cierra solamente procesos de este proyecto que ocupen 4000/5173 y abre API y web
en dos PowerShell visibles.

Verificacion completa y finita:

```powershell
npm run check:new
```

Esto ejecuta lint, typecheck, tests, verificacion de migraciones/seeds y build.
La ultima ejecucion completa, el 2026-08-07, aprobo todas las etapas y 29 tests.

## Archivos principales

- `apps/admin-web/src/main.tsx`: vistas, estado, llamadas API e interacciones.
- `apps/admin-web/src/styles.css`: sistema visual y responsive.
- `apps/api/src/server.ts`: rutas HTTP.
- `packages/db/src/index.ts`: operaciones persistentes y reglas transaccionales.
- `packages/db/migrations/*.sql`: schema reproducible.
- `packages/importers/src/index.ts`: reglas de importacion/conciliacion.
- `scripts/start-new-platform.ps1`: lanzador de servidores.
- `docs/new-platform/LOCAL_DEVELOPMENT.md`: ejecucion local.

## Estado de Git y precauciones

Al 2026-08-05, `git status` muestra modificaciones anteriores en LEGACY y gran
parte de la nueva plataforma como archivos sin seguimiento:

```text
M  StockAdministrationUnified_TO_COPY.gs
M  apps-script/StockAdministrationUnified.gs
M  apps-script/StockAdministrationUnified_TO_COPY.gs
M  mobile-app/App.js
M  mobile-app/src/api.js
?? apps/
?? packages/
?? docs/new-platform/
?? scripts/
?? package.json y otros archivos raiz de la nueva plataforma
```

No revertir esos cambios. No asumir que las modificaciones de LEGACY fueron
hechas por la tarea actual. Antes de commits hay que revisar y separar nueva
plataforma de cambios legacy. El remoto conocido es:

```text
https://github.com/ultimoturno20-cloud/ultimoturnoapp
```

No hacer push sin solicitud explicita. Como el usuario cambiara de cuenta en la
misma PC, todos los archivos locales seguiran disponibles aunque aun no esten en
Git.

## Deuda y riesgos conocidos

1. `ARCHITECTURE.md` y `DATA_MODEL.md` conservan frases de la etapa demo y no
   reflejan por completo ventas/compras persistentes. El codigo y este handoff
   son mas recientes.
2. El parser CSV actual divide lineas y celdas con `split`. No soporta de forma
   segura comillas, comas dentro de nombres, saltos de linea ni todos los casos
   de Excel/Google Sheets. Debe reemplazarse antes del stock real.
3. La traduccion japones/chino es un diccionario pequeno y hay cadenas con
   mojibake. No es una traduccion de produccion.
4. El matching de importacion ayuda a revisar, pero todavia no garantiza una
   identidad canonica por expansion/numero/idioma/acabado.
5. No existe backup/restauracion operativa de la base PGlite.
6. Las bases viejas mezclan ejemplos y pruebas manuales. Nunca importar stock
   real encima de ellas. Usar solamente `apps/api/.data/ultimoturno-pilot-real`.
7. Supabase remoto no esta configurado. PGlite es suficiente para preparar y
   validar el primer snapshot local.
8. No hay conexion real con Google Sheets. PriceCharting solo descarga su CSV
   oficial cuando el usuario configura el token y presiona Sincronizar.
9. No hay pruebas end-to-end automatizadas de navegador; hubo validacion manual
   responsive con el navegador integrado.

## Siguiente objetivo: carga controlada de stock real

El trabajo debe empezar asi:

Antes de este objetivo ya quedo implementado el cache PriceCharting:

- parser CSV robusto mediante `csv-parse`;
- tablas `pricecharting_cache_entries` y `pricecharting_cache_runs`;
- descarga desde el mismo link usado por LEGACY;
- token en variable privada de Windows, nunca en Git;
- buscador y estado visibles dentro de Compras;
- no crea inventario ni cambia precios automaticamente.

Para activarlo se ejecuta `Configurar PriceCharting.cmd`, se reinicia la nueva
app y se presiona `Sincronizar cache` en Compras.

### 1. Separar entornos

- Mantener `.data/ultimoturno-pglite` como base de ejemplos.
- Crear un perfil piloto, por ejemplo
  `.data/ultimoturno-pilot-real`, mediante `PGLITE_DATA_DIR`.
- Agregar una identificacion visual clara de `EJEMPLOS` o `PILOTO REAL`.
- No borrar la base actual sin confirmacion.

### 2. Fortalecer entrada de archivos

- Reemplazar el parser manual por un parser CSV probado.
- Soportar UTF-8, BOM, `,` y `;`, campos entre comillas y saltos de linea.
- Aceptar inicialmente CSV; XLSX puede agregarse despues si realmente se usa.
- No instalar ni conectar Google APIs para esta etapa.

### 3. Crear un asistente de importacion real

- Paso 1: seleccionar archivo.
- Paso 2: detectar encabezados y mapear columnas.
- Paso 3: validar todas las filas sin escribir.
- Paso 4: revisar duplicados y candidatos multiples.
- Paso 5: mostrar conciliacion y totales.
- Paso 6: confirmacion explicita.
- Paso 7: aplicar todo en una transaccion y registrar el lote.

Campos deseados:

- identificador/SKU de LEGACY;
- nombre;
- expansion;
- numero;
- idioma;
- condicion;
- acabado;
- cantidad observada;
- cantidad reservada;
- precio ARS;
- precio USD;
- ubicacion;
- imagen;
- identificadores externos;
- fila y hoja de origen.

### 4. Conciliacion obligatoria

El informe debe comparar por separado:

- cantidad de la hoja Stock;
- ventas pendientes de sincronizar;
- ordenes/reservas activas;
- suma de movimientos cuando exista;
- duplicados por identidad de carta;
- filas sin identidad suficiente;
- totales de SKUs, unidades, reservadas y valor.

No elegir silenciosamente una fuente ganadora. Cada conflicto debe quedar
visible y exportable.

### 5. Aplicacion segura

- Requerir confirmacion del usuario.
- Usar transaccion completa: todo se aplica o nada se aplica.
- Guardar hash del archivo e idempotencia para no repetir el mismo snapshot.
- Registrar antes/despues y usuario local en auditoria.
- Generar resumen final y lista de diferencias.

### 6. Validacion antes de oficializar

- Comparar conteos globales con LEGACY.
- Revisar manualmente una muestra fisica.
- Mantener LEGACY como fuente operativa.
- Usar la nueva app primero en modo consulta/conciliacion.
- Definir el corte del modulo Inventario solo cuando los numeros coincidan.

## Informacion que debe aportar el usuario para la carga real

No pedirla antes de implementar todo lo que pueda hacerse sin datos reales. Al
llegar al punto necesario, solicitar:

1. Un CSV local reciente exportado de la hoja de Stock.
2. Los nombres exactos de las columnas y la pestaña de origen.
3. Un CSV separado de Ordenes/reservas si esas cantidades no estan incluidas.
4. Confirmacion sobre si precios vacios deben quedar en cero o pendientes de
   revision.
5. Aprobacion antes de crear/aplicar el primer lote en la base piloto.

No pedir credenciales de Google ni Supabase para esta etapa.

## Criterio de terminado para el primer stock real

- El archivo se valida sin modificar datos.
- Todos los errores muestran fila, campo y causa.
- Los duplicados y multiples candidatos requieren decision humana.
- Existe un resumen exacto de altas, actualizaciones, ignoradas y conflictos.
- Repetir el mismo archivo no duplica inventario.
- Una aplicacion fallida no deja cambios parciales.
- El stock importado persiste al reiniciar API y web.
- Se puede consultar, editar, ajustar y auditar desde la interfaz actual.
- LEGACY permanece sin cambios y operativo.
