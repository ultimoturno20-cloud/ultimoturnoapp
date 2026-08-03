# Pokemon Singles Stock Master

Planilla maestra para stock de singles Pokemon, pensada para:

- cargar una vez el link de PriceCharting por carta,
- actualizar precios desde CSV de PriceCharting,
- mantener cantidad real de stock,
- exportar datos para ecommerce.

## Instalacion recomendada

Usar una Google Sheet nueva para la maestra de stock.

1. Abrir `Extensiones > Apps Script`.
2. Borrar el contenido de `Code.gs`.
3. Copiar el contenido de `PokemonSinglesStockMaster.gs`.
4. Activar el manifest en `Configuracion del proyecto`.
5. Reemplazar `appsscript.json` por el de este directorio.
6. Guardar.
7. Ejecutar `setupSinglesStockMaster`.
8. Ejecutar `promptSetPriceChartingToken` y pegar el token.
9. Cargar cartas en `Stock` con `PriceCharting URL` o `PriceCharting ID`.
10. Ejecutar `refreshPriceChartingCsv`.
11. Usar `Stock Maestro > Activar trigger diario`.

No pegar el token en una celda. El script lo guarda en `Script Properties`.

## Hojas

### Stock

La hoja principal. Una fila por carta vendible.

Columnas clave:

- `SKU`
- `Nombre`
- `Expansion`
- `Numero`
- `Idioma`
- `Condicion`
- `Ubicacion`: Bulk, Carpeta naranja, Carpeta celeste, Carpeta violeta
- `Cantidad`
- `PriceCharting URL`
- `PriceCharting ID`
- `TCGplayer Search URL`
- `Imagen URL`
- `Precio PC USD`
- `Dolar usado`
- `Precio sugerido ARS`
- `Precio manual ARS`
- `Precio final ARS`
- `Ultima actualizacion`
- `Incluir claim`
- `Notas`

No hay `Estado`. Si `Cantidad > 0`, existe stock. Si se vende, baja la cantidad.

### Cache PriceCharting

Se llena desde el CSV diario de PriceCharting.

El stock cruza por `PriceCharting ID` o por URL canonica.

### Ventas

No vive en Stock Maestro. Usar una planilla separada con `SalesStockConnector.gs`.

### Claims

No vive en Stock Maestro. Usar la planilla de claims/presupuestador con
`ClaimsStockSalesConnector.gs`.

### Ecommerce Export

Vista exportable para Tiendanube, Shopify, WooCommerce u otro ecommerce.

## Flujo diario

1. Cargar cartas en `Stock`.
2. Pegar `PriceCharting URL`.
3. Completar `Idioma`, `Condicion`, `Ubicacion`, `Cantidad`.
4. Ejecutar `Actualizar CSV PriceCharting ahora`, o esperar trigger diario.
5. Ejecutar `Completar stock desde cache` si hace falta.
6. Ejecutar `Completar imagenes faltantes` solo para cartas que no tengan imagen.
7. Revisar `Precio manual ARS` si queres pisar el sugerido.
8. Exportar ecommerce.

## Ventas y Claims

Stock Maestro no registra ventas ni claims.

El flujo correcto es:

```text
Claims / Online / Local -> Ventas -> Stock Maestro
```

La planilla `Ventas` descuenta stock mediante `SalesStockConnector.gs`.

## PriceCharting CSV

El CSV se descarga desde:

`https://www.pricecharting.com/price-guide/download-custom?t=TOKEN&category=pokemon-cards`

El token se inyecta desde `Script Properties`.

Para evitar timeouts de Google Sheets, el importador no vuelca todo el CSV de Pokemon.
Filtra el CSV y guarda en `Cache PriceCharting` solo las filas que matchean cartas ya
cargadas en `Stock` por `PriceCharting ID` o `PriceCharting URL`.

Por eso el orden correcto es: primero cargar stock, despues actualizar CSV.

## TCGplayer

No se scrapean precios de TCGplayer. Se genera un link de busqueda automatico a partir de:

- nombre,
- expansion,
- numero.

Esto deja TCGplayer a un click sin volver fragil el sistema.
