# Desarrollo local nueva plataforma

## Requisitos

- Node.js 20 o superior.
- npm.

No hace falta Supabase remoto para esta etapa.

## Instalacion

Desde la raiz del repo:

```bash
npm install
```

## Verificaciones

```bash
npm run lint
npm run typecheck
npm run test
npm run db:verify
npm run build
```

O todo junto:

```bash
npm run check:new
```

## Ejecutar API operativa local persistente

La API usa PGlite como PostgreSQL embebido persistente mientras no haya
credenciales de Supabase remoto. En el uso operativo actual, el perfil por
defecto es `PILOTO REAL` y la base queda normalmente en
`apps/api/.data/ultimoturno-pilot-real`. La API imprime la ruta exacta al
iniciar y tambien la expone en `GET /health`. Esto permite conservar cambios al
reiniciar sin tocar Google Sheets.

Opcionalmente podes definir donde guardar la base local:

```bash
set PGLITE_DATA_DIR=apps\api\.data\ultimoturno-pilot-real
```

En PowerShell:

```powershell
$env:PGLITE_DATA_DIR="apps\api\.data\ultimoturno-pilot-real"
```

```bash
npm run build
npm run dev:api
```

La API ejecuta migraciones reproducibles y usa un actor interno de sistema para
auditoria local. No pide login y no usa seeds demo en runtime.

API local:

```text
http://localhost:4000/health
http://localhost:4000/stock
http://localhost:4000/products
http://localhost:4000/movements
http://localhost:4000/imports
http://localhost:4000/import-rows
http://localhost:4000/reservations
http://localhost:4000/pricecharting-cache
```

## Ejecutar web admin

En otra terminal:

```bash
npm run dev:web
```

Web local:

```text
http://localhost:5173
```

La web abre directamente contra la API. No muestra fixtures locales ni guarda
cambios operativos en memoria del navegador.

## Perfil piloto real

Para cargar stock real sin mezclar ejemplos, usar:

```text
Doble clic en "Abrir UltimoTurno Piloto Real.cmd"
```

Ese perfil usa `apps/api/.data/ultimoturno-pilot-real`, muestra la etiqueta
`PILOTO REAL` en la cabecera y no carga ejemplos automaticamente ni permite el
boton de ejemplos. La base anterior de ejemplos queda separada en
`apps/api/.data/ultimoturno-pglite`.

Estado de referencia tomado el 2026-08-24 en `PILOTO REAL`:

```text
SKUs: 438
Unidades totales: 138
Reservadas: 137
Disponibles: 1
Ordenes activas: 87
Claim activo: Claim 18 de agosto
```

El 2026-08-21 se hizo un reset controlado para comenzar la carga completa de
stock. Ese reset bajo el disponible a cero preservando reservas y guardo
respaldo logico en:

```text
outputs/stock-before-reset-2026-08-21T10-07-04Z.json
```

Para repetir esa operacion, usar el script por API:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\reset-available-stock-api.ps1 -Apply
```

No abrir la base PGlite directamente con scripts mientras la API esta corriendo.

## Base local segura

`npm run db:verify` ejecuta las migraciones y los seeds con PGlite en memoria.
Actualmente valida:

- 12 productos/SKUs ficticios;
- movimientos de inventario;
- importaciones y filas de revision;
- reservas activas/liberadas;
- calculo de disponible = stock - reservado.

La suite de tests tambien valida reglas demo de importacion:

- traduccion de nombres japoneses/chinos de ejemplo;
- warnings de calidad para filas incompletas;
- ranking de candidatos cuando hay multiples versiones posibles;
- reporte de conciliacion legacy ficticio.

## Cache local de PriceCharting

El cache se descarga desde el mismo export oficial que usa LEGACY:

```text
https://www.pricecharting.com/price-guide/download-custom?t=TOKEN&category=pokemon-cards
```

El token nunca se guarda en Git. Para configurarlo en Windows, ejecutar una vez:

```text
Configurar PriceCharting.cmd
```

El script pide el token de forma oculta y lo guarda como variable de entorno del
usuario `PRICECHARTING_TOKEN`. Tambien acepta pegar el link completo del boton
`API/Download` y extrae el parametro `t` automaticamente. El token esperado por
PriceCharting tiene 40 caracteres; si se pega otra cosa, el configurador lo
rechaza antes de guardarlo.

Despues hay que reiniciar API y web mediante `Abrir UltimoTurno Nueva App.cmd`.

La API sincroniza automaticamente el CSV una vez por dia mientras esta abierta.
Por defecto corre a las `06:00` hora local. Para cambiar la hora o desactivar la
tarea sin tocar codigo, ejecutar:

```text
Configurar PriceCharting Automatico.cmd
```

Ese asistente guarda variables de usuario de Windows:

```text
PRICECHARTING_AUTO_REFRESH_ENABLED=true
PRICECHARTING_AUTO_REFRESH_TIME=06:00
```

Tambien se puede sincronizar manualmente desde Admin/Calidad. Cada corrida
guarda el catalogo y precio loose USD en `pricecharting_cache_entries`, junto
con un historial de ejecuciones en `pricecharting_cache_runs`. No crea
inventario ni modifica precios de venta.

El estado de la tarea diaria se ve en `Admin > PriceCharting CSV` y por API en
`GET /pricecharting-cache/auto-refresh/status`.

No toca Supabase remoto, Google Sheets ni datos reales.

Si la sincronizacion muestra `PriceCharting respondio HTTP 404`, volver a
ejecutar `Configurar PriceCharting.cmd` y pegar el token correcto o el link
completo de `API/Download`. Si el token tiene 40 caracteres y sigue dando 404,
revisar en PriceCharting que la suscripcion tenga descarga CSV habilitada para
la categoria `pokemon-cards`.

## Cache local de precios TCGplayer

La app tambien mantiene un snapshot local de precios TCGplayer usando TCGCSV
como cache publico. No requiere credenciales oficiales de TCGplayer.

Fuente por defecto:

```text
https://tcgcsv.com/tcgplayer/3/{groupId}/prices
```

La categoria `3` corresponde a Pokemon. Cada precio se guarda por
`tcgplayer_product_id` + `sub_type_name`, por ejemplo `Normal`, `Holofoil` o
`Reverse Holofoil`, para no mezclar variantes.

La API sincroniza automaticamente estos precios una vez por dia mientras esta
abierta. Por defecto corre a las `18:30` hora local, despues de la actualizacion
diaria esperada de TCGCSV. Para ajustar sin tocar codigo, definir variables de
usuario de Windows:

```text
TCGCSV_BASE_URL=https://tcgcsv.com
TCGPLAYER_PRICE_CATEGORY_ID=3
TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED=true
TCGPLAYER_PRICE_AUTO_REFRESH_TIME=18:30
```

El refresh primero consulta `last-updated.txt`; si TCGCSV no cambio desde la
ultima corrida exitosa, evita bajar todo de nuevo. Tambien se puede forzar
manualmente desde `Admin > Precios TCGplayer`.

Endpoints:

```text
GET /tcgplayer-prices/status
GET /tcgplayer-prices/auto-refresh/status
POST /tcgplayer-prices/refresh
```

La primera carga real del 2026-08-24 guardo:

```text
Filas de precio: 45.185
Productos TCGplayer: 31.216
Productos cruzados con indice maestro: 18.619
Cartas del indice con precio TCGplayer: 30.169
Fuente TCGCSV: 2026-08-23T17:05:31-03:00
```

Este cache no modifica inventario ni precios de venta. Es una fuente para
comparar y calcular valor sugerido en futuras mejoras de `Caja` e
`Inventario / Venta`.

### Imagenes PriceCharting

El CSV no siempre trae URL de imagen. La nueva app mantiene una cola local por
base en `pricecharting_image_cache`, pero guarda los JPG descargados en un
almacen compartido entre perfiles:

```text
apps/api/.data/pricecharting-images/
```

Asi `EJEMPLOS` y `PILOTO REAL` reutilizan los mismos archivos y no descargan
duplicados. Si una imagen ya existe localmente, la API registra el cache en la
base activa sin volver a llamar a PriceCharting.

Desde Compras:

- `Stock primero` busca primero URLs externas para las cartas ya cargadas en
  inventario.
- `URLs masivas` cruza el cache completo de PriceCharting contra el indice
  externo local de imagenes. Esta es la primera pasada recomendada porque no
  pega a PriceCharting.
- `Auto continuo` repite `URLs masivas` hasta que no haya mas pendientes listas.
  Se puede pausar desde el mismo boton.
- `Descargar locales` baja archivos al disco usando URLs ya encontradas cuando
  existan.

Cada tanda es finita y usa concurrencia limitada. El acceso directo
`Traer URLs Imagenes PriceCharting.cmd` hace la misma primera pasada masiva y
muestra si el indice externo local ya existe. Si PriceCharting responde
`HTTP 429`, la app entra en pausa automatica y reintenta sola despues del
cooldown. Las imagenes quedan servidas localmente desde la API y se reutilizan
en busquedas del cache. No modifican inventario ni precios.

## Primer vertical real

Inventario ya permite:

- ver stock persistente;
- crear y editar productos;
- registrar ajustes de cantidad con movimientos;
- consultar historial y auditoria;
- cargar o pegar un CSV de stock/MonPrice;
- previsualizar un snapshot CSV robusto antes de importarlo;
- aplicar el snapshot solo despues de confirmacion explicita.
