# Claims Sales Connector

Conector para usar cuando hay tres planillas separadas:

1. `Stock Maestro`
2. `Ventas`
3. `Presupuestador / Generador de Claims`

Este script se instala en la planilla de `Presupuestador / Generador de Claims`.

## Que hace

Lee la hoja activa de claim y busca filas con `Comprador`.

Por cada fila con comprador:

1. Agrega una venta en la planilla `Ventas`.
2. Marca la fila del claim en la columna `Sync Stock` para no duplicarla.

No toca `Stock Maestro`. La planilla `Ventas` se encarga de descontar stock.

## Instalacion

1. Abrir la planilla de claims / presupuestador.
2. Ir a `Extensiones > Apps Script`.
3. Crear o reemplazar `Code.gs` con `ClaimsStockSalesConnector.gs`.
4. Usar el manifest `appsscript.json` de este directorio.
5. Guardar.
6. Ejecutar `promptConfigureConnections`.
7. Pegar el ID o URL de la planilla `Ventas`.
8. Recargar la planilla.

Va a aparecer el menu `Claims Sync`.

## Uso

1. Abrir la hoja del claim que queres sincronizar.
2. Completar compradores en la columna `Comprador`.
3. Usar `Claims Sync > Enviar compradores a Ventas`.

## Columnas esperadas

El script detecta por nombre de encabezado. Idealmente el claim tiene:

- `SKU` o `ID`
- `Nombre`
- `Expansion`
- `numero`
- `link` o `PriceCharting URL`
- `precio final` o `precio`
- `Comprador`
- `Imagen URL`
- `nombrefinal` o `Mensaje`

Si no hay `SKU`, usa `PriceCharting URL` o `PriceCharting ID`.

## Regla de stock

Claims no descuenta stock directamente.

```text
Claim con comprador -> Ventas -> Stock Maestro
```

Esto permite vender tambien online o en local cargando filas directamente en `Ventas`.

## Evitar duplicados

La columna `Sync Stock` guarda una marca `ENVIADO VENTAS fecha`.
Si esa columna ya tiene valor, la fila no se vuelve a sincronizar.
