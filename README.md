# UltimoTurno

Sistema interno para stock, claims, ventas de mesa/evento, compras e importacion
de cartas Pokemon.

## Por donde empezar

- `docs/OPERATING_MODEL.md`: fuente de verdad del modelo V2, reglas para no
  pisar logica y checklist antes de sumar features.
- `apps-script/V2_ARCHITECTURE_README.md`: instalacion de planillas y Apps Script.
- `mobile-app/README.md`: setup, verificacion y build de la app Expo.

## Componentes activos

- `apps-script/StockAdministrationUnified.gs`: HUB principal.
- `apps-script/PriceChartingCacheMaster.gs`: cache PriceCharting.
- `apps-script/TcgCsvCacheMaster.gs`: cache TCGplayer.
- `apps-script/ClaimGeneratorV2.gs`: generador de claims.
- `mobile-app`: app nativa Expo.

Los scripts legacy siguen en `apps-script` como referencia historica, pero no son
parte del flujo oficial V2.
