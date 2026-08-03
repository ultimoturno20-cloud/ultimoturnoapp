# Sistema V2 - Stock, Administracion, Cache y Claims

Documento de instalacion tecnica. Para reglas operativas, flujo oficial,
componentes legacy y checklist antes de sumar features, ver
`../docs/OPERATING_MODEL.md`.

## Planillas

Importante: cada bloque se instala en su propia planilla/proyecto de Apps Script.
No copiar los `.gs` en el mismo proyecto, porque cada uno tiene su propio `onOpen`.

### 1. PriceCharting Cache

Instalar `PriceChartingCacheMaster.gs`.

Hojas:

- `Config`
- `PriceCharting Cache`
- `Log`

Uso:

1. Ejecutar `setupPriceChartingCacheMaster`.
2. Ejecutar `promptSetPriceChartingCacheToken`.
3. Ejecutar `refreshFullPriceChartingCache`.
4. Activar `setupDailyPriceChartingCacheTrigger`.

Esta planilla guarda el CSV completo de PriceCharting y se actualiza una vez por dia.
Las otras planillas leen desde aca para no quedar pesadas.

El CSV de PriceCharting no incluye imagen en la descarga actual. Por eso `Imagen URL`
queda vacia en el cache y se completa solo bajo demanda cuando pegas links en `Stock`
o en `Carga` del generador de claims.

Si PriceCharting devuelve `HTTP 429`, el script entra en cooldown. Por defecto espera
60 minutos antes de volver a intentar. Ese valor se cambia en `Config` con
`rate_limit_cooldown_min`.

### 2. Stock + Administracion

Instalar `StockAdministrationUnified.gs` y `MobileSalesApp.html`.

Hojas:

- `Dashboard`
- `Stock`
- `Compras`
- `Ordenes`
- `Ventas Detalle`
- `Frees`
- `Claims Log`
- `Entregas Log`
- `Config`
- `Log`

Reglas:

- En `Stock` se puede pegar un link de PriceCharting y completar la carta desde el cache.
- `Stock` tiene `Ultima compra USD`, opcional, para recordar el ultimo costo de compra.
- La app mobile del HUB permite buscar stock, armar carrito y cerrar ventas de mesa desde celular.
- En `Compras`, el stock solo se suma cuando `Recibido` esta marcado.
- En `Ordenes`, el pago se maneja por `Claim + Comprador`.
- En `Ventas Detalle`, cada fila es una carta vendida o a vender. Sirve para claims y tambien para ventas manuales.
- El stock se descuenta cuando una venta esta `Pagado` y `Entregado`.
- Los frees descuentan stock cuando estan `Entregado`.
- Las ordenes pagadas, entregadas y ya sincronizadas con stock se archivan en `Entregas Log`.
- `Dashboard` resume cobros, entregas, ventas y stock para uso diario.

Flujo:

```text
Compra recibida -> Stock
Claim terminado -> Ordenes + Ventas Detalle + Frees
Orden pagada + entregada -> Ventas Detalle pagadas/entregadas -> descuenta Stock
Orden ya sincronizada -> Entregas Log
Venta manual mesa/evento -> Ventas Detalle -> descuenta Stock si Pagado + Entregado
```

`Ordenes` funciona como bandeja de trabajo activa. Cuando una orden ya esta pagada,
entregada y con stock descontado, el script la mueve a `Entregas Log` para que no
moleste en el dia a dia. Tambien se puede ejecutar manualmente con
`Stock Admin > Archivar ordenes entregadas`.

Visual:

- `Stock Admin > Actualizar dashboard` reconstruye el tablero principal.
- `Stock Admin > Aplicar formato visual` reaplica colores, filtros, encabezados y reglas por estado.
- `Ordenes` usa rojo para pendientes de pago, amarillo para pagadas sin embalar,
  azul para pagadas/embaladas sin entregar y verde para entregadas.
- `Compras`, `Ventas Detalle`, `Frees` y `Stock` tambien tienen colores por estado.

En `Ventas Detalle`, `Referencia` es opcional. Para una venta de claim guarda el nombre
del claim. Para mesa/evento puede quedar vacio o decir algo como `Mesa 30/7`.
`Origen` indica el canal: `Claim`, `Mesa`, `Evento`, `Online`, `Local` u `Otro`.

Para cargar una venta manual:

1. Agregar una fila en `Ventas Detalle`.
2. Pegar `PriceCharting URL` si existe.
3. Usar `Stock Admin > Completar ventas desde cache`, o activar triggers.
4. Completar `Precio ARS`, `Comprador` y `Origen`.
5. Marcar `Pagado` y `Entregado` cuando corresponda.
6. `Sync Stock` se completa cuando descuenta stock.

Para usar la app mobile:

1. En Apps Script del HUB, desplegar como Web App.
2. Ejecutar como el propietario de la planilla.
3. Permitir acceso segun el equipo interno.
4. Abrir la URL desde el celular.

La app busca cartas en `Stock`, muestra precio final ARS, precio PC USD, ultima compra
USD y cantidad disponible. `Cerrar venta` agrega filas en `Ventas Detalle` como venta
pagada/embalada/entregada y descuenta stock en el momento.

API app nativa:

- `Stock Admin > Configurar token app mobile` genera el token interno.
- `POST WebAppURL` con `{ "action": "searchStock", "token": "...", "q": "charizard" }`
  devuelve resultados de stock.
- `POST WebAppURL` con `{ "action": "closeSale", "token": "...", "payload": {...} }`
  cierra una venta desde una app externa.
- Si `GET WebAppURL` no incluye `action`, sigue mostrando la Web App mobile HTML.

Para cargar compras:

- `PriceCharting URL` sigue en la columna `I`.
- `Costo total USD` y `Costo unitario USD` quedan al final de la hoja.
- Cuando una compra esta `Recibido`, suma stock.
- Si hay `Costo unitario USD`, lo copia a `Stock > Ultima compra USD`.
- Si no hay unitario pero hay `Costo total USD`, calcula `Costo total USD / Cantidad`.

### 3. Importador Scanner

Instalar `ScannerStockImporter.gs` y `ScannerCsvLoaderDialog.html` en una planilla aparte.

Hojas:

- `Config`
- `MonPrice Raw`
- `Import Scanner`
- `Log`

Esta planilla es una herramienta de carga masiva. No guarda la administracion diaria:
lee el cache de PriceCharting y envia las cartas ya revisadas al `Stock` del HUB.

Uso:

1. Ejecutar `setupScannerStockImporter`.
2. Ejecutar `Configurar PriceCharting Cache`.
3. Ejecutar `Configurar HUB destino`.
4. Ejecutar `Scanner Stock > Pegar CSV MonPrice`.
5. Pegar el contenido completo del CSV.
6. Usar `Guardar y convertir`.
7. Ejecutar `Scanner Stock > Matchear con PriceCharting`.
8. Revisar las filas en rojo con estado `Revisar`.
9. Ejecutar `Scanner Stock > Enviar a Stock del HUB`.

Tambien se puede importar el CSV como hoja nueva o pegarlo manualmente en `MonPrice Raw`
y despues ejecutar `Scanner Stock > Convertir MonPrice CSV`.

El match intenta primero `Nombre + Expansion + Numero`. Si eso no aparece, prueba
`Nombre + Numero` solo cuando el resultado es unico. El `Average Price` de MonPrice
queda como referencia en `Scanner avg USD`; no se copia como `Ultima compra USD`
porque no es necesariamente tu costo real de compra.

### 4. Generador de Claims V2

Instalar `ClaimGeneratorV2.gs` y `ImageGridExporterDialog.html`.

Hojas:

- `Carga`
- `Claim`
- `Frees`
- `Info`
- `Claims Log`
- `Config`
- `Log`

La hoja mas importante es `Claim`.

Columnas de `Claim`:

```text
ID | Nombre | Expansion | Precio USD | Precio ARS calculado | Precio redondeado | Precio final | Precio final USD | Nombre final | Comprador | Tags | PriceCharting URL | PriceCharting ID | Imagen URL
```

`Precio final` y `Precio final USD` son manuales e independientes.
No se convierten entre si.

- Si completas `Precio final` con `100`, `Nombre final` queda `Nombre - Expansion - $100`.
- Si completas `Precio final USD` con `100`, `Nombre final` queda `Nombre - Expansion - $100usd`.
- Si completas ambos, `Nombre final` muestra ambos importes.
- Si ambos quedan vacios, `Nombre final` muestra solo `Nombre - Expansion`.

Uso:

1. Pegar links en `Carga`.
2. Ejecutar `Procesar links`.
3. Revisar `Claim`.
4. Corregir `Nombre`, `Expansion`, `Precio final` / `Precio final USD` y `Nombre final`.
5. Completar `Comprador` con formato libre, ejemplo `juan 4657`.
6. Completar `Tags` si alguien pidio etiqueta previa.
7. Completar `Frees` si corresponde.
8. Ejecutar `Terminar claim`.

`Terminar claim` hace todo:

```text
Crea una planilla archivada del claim
Envia compradores a Administracion > Ordenes
Envia cartas a Administracion > Ventas Detalle como pendientes
Envia frees a Administracion > Frees
Guarda logs
Limpia Carga / Claim / Frees para reutilizar el generador
```

## Clave de orden

El pago no se maneja por carta, se maneja por usuario dentro de una fecha.

Ejemplo:

```text
20260730-JUAN-4657
```

Asi `juan 4657` puede comprar en claims de fechas distintas sin que se mezclen pagos.

## App nativa Expo

Carpeta local: `mobile-app`.

Uso:

```bash
cd mobile-app
npm install
npm start
```

La app usa la URL publicada del HUB y el token de `Configurar token app mobile`.
Desde Expo Go permite buscar stock, agregar cartas al carrito y cerrar ventas de mesa.
