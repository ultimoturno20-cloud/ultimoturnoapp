# UltimoTurno

Sistema interno para stock, claims, ventas de mesa/evento, compras e importacion
de cartas Pokemon.

## Estado actual

El trabajo activo esta en la nueva plataforma local:

- API: `apps/api`
- Web/admin: `apps/admin-web`
- Perfil operativo: `PILOTO REAL`
- Base actual: `apps/api/.data/ultimoturno-pilot-real`
- Fuentes automaticas: PriceCharting CSV `06:00`; precios TCGplayer via TCGCSV
  `18:30`.

Para retomar contexto actualizado, leer primero
`docs/new-platform/HANDOFF_NEXT_ACCOUNT.md`.

## Continuar desde otra cuenta de Codex

Leer primero `docs/new-platform/HANDOFF_NEXT_ACCOUNT.md`. Contiene el estado
actual, decisiones del usuario, comandos, riesgos y el siguiente objetivo para
la carga controlada de stock real.

## Por donde empezar

- `docs/OPERATING_MODEL.md`: fuente de verdad del modelo V2, reglas para no
  pisar logica y checklist antes de sumar features.
- `apps-script/V2_ARCHITECTURE_README.md`: instalacion de planillas y Apps Script.
- `mobile-app/README.md`: setup, verificacion y build de la app Expo.

## Componentes principales

- `apps/api`: API local actual con PGlite/PostgreSQL embebido.
- `apps/admin-web`: interfaz diaria actual.
- `packages/shared`: tipos y utilidades compartidas de la nueva plataforma.

## Legado / referencia

- `apps-script/StockAdministrationUnified.gs`: HUB historico.
- `apps-script/PriceChartingCacheMaster.gs`: cache PriceCharting historico.
- `apps-script/TcgCsvCacheMaster.gs`: cache TCGplayer historico.
- `apps-script/ClaimGeneratorV2.gs`: generador de claims historico.
- `mobile-app`: app nativa Expo anterior.

Estos componentes siguen en el repo como referencia, pero el flujo diario actual
esta en `apps/api` y `apps/admin-web`.
