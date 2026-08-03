# Apps Script - UltimoTurno V2

Esta carpeta contiene scripts de Apps Script para el sistema UltimoTurno. La
fuente de verdad operativa esta en `../docs/OPERATING_MODEL.md` y el detalle de
instalacion V2 esta en `V2_ARCHITECTURE_README.md`.

## Scripts oficiales V2

- `PriceChartingCacheMaster.gs`: cache diario de PriceCharting.
- `TcgCsvCacheMaster.gs`: cache diario de TCGCSV/TCGplayer.
- `StockAdministrationUnified.gs`: HUB de stock, administracion, API mobile,
  compras, ordenes, ventas, frees, auditoria y dashboard.
- `MobileSalesApp.html`: Web App HTML del HUB.
- `ClaimGeneratorV2.gs`: generador de claims V2.
- `ImageGridExporterDialog.html`: dialogo para exportar grids.
- `ScannerStockImporter.gs`: herramienta separada para importacion masiva desde
  CSV MonPrice. Preferir el importador integrado en la app cuando el HUB ya esta
  publicado.

## Regla importante

Cada bloque se instala en su propia planilla/proyecto de Apps Script. No copies
varios `.gs` en el mismo proyecto: muchos definen `onOpen` y se pisan los menus.

## Legacy

Estos archivos quedan como referencia historica o respaldo, pero no forman parte
del flujo oficial V2:

- `PokemonClaimsUnified.gs`
- `PokemonSinglesStockMaster.gs`
- `SalesStockConnector.gs`
- `ClaimsStockSalesConnector.gs`

No uses estos conectores legacy junto con `StockAdministrationUnified.gs`, porque
pueden duplicar responsabilidades de ventas, claims o descuento de stock.
