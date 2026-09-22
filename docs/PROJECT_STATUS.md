# UltimoTurno - estado actual

Actualizado: 2026-09-18

> Esta seccion reemplaza el estado fechado 2026-09-11 que se conserva mas abajo
> como referencia historica.

## Resumen vigente

- Workspace obligatorio: `D:\UltimoTurno\Stock`.
- Produccion: `https://ultimoturnoapp-api.vercel.app/`.
- Infraestructura: Vercel + Supabase/Postgres + Supabase Storage.
- Rama de despliegue: `main`.
- Ultimo cambio funcional documentado antes de esta actualizacion: `708c9aa`.
- El claim activo de produccion contiene datos reales: no eliminarlo, cancelarlo
  ni recrearlo durante verificaciones.
- Las ordenes tambien son datos reales. Las mejoras visuales recientes fueron
  solo de frontend y no modificaron la base de ordenes.

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
- Vercel ejecuta `/api/cron/pricecharting-refresh` diariamente a las `09:00 UTC`
  (`06:00` de Argentina) segun `vercel.json`.
- La busqueda de imagenes tiene fallback cuando PriceCharting devuelve una
  pagina de busqueda en lugar de una ficha de producto.

### Ordenes

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

MVP implementado localmente:

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

Verificacion del MVP:

```text
typecheck OK
lint OK
build OK
tests OK: 42 pass, 0 fail
alta/login/portal API local OK
revision visual desktop OK
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
tests OK: 36 pass, 0 fail
```

## Commits recientes importantes

```text
609a61b Add unified catalog cards view
556c9eb Optimize unified catalog search
de5a4f1 Filter reference rows in unified catalog
22c6f97 Trigger unified catalog deploy
```

Si online no refleja el comportamiento esperado, revisar en Vercel si el commit
activo es el ultimo de `main`.
