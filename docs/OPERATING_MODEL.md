# UltimoTurno V2 - Modelo operativo

Este documento es la fuente de verdad para seguir trabajando sobre la V2 sin
sumar capas encima de piezas mezcladas.

## Estado actual

UltimoTurno V2 usa Google Sheets + Apps Script como backend operativo y una app
Expo como interfaz interna.

El sistema oficial queda dividido asi:

1. `PriceChartingCacheMaster.gs`
   - Planilla separada.
   - Baja el CSV diario de PriceCharting.
   - El token vive en `Script Properties`, no en una celda.
   - Las demas planillas leen desde este cache.

2. `TcgCsvCacheMaster.gs`
   - Planilla separada.
   - Baja producto y precios desde TCGCSV/TCGplayer.
   - Complementa el stock con referencia de mercado.

3. `StockAdministrationUnified.gs` + `MobileSalesApp.html`
   - Es el HUB.
   - Administra stock, compras, ordenes, ventas, frees, movimientos,
     auditoria, sesiones, acciones idempotentes, snapshots y dashboard.
   - Expone la Web App/API usada por la app nativa.

4. `ClaimGeneratorV2.gs` + `ImageGridExporterDialog.html`
   - Planilla separada.
   - Prepara claims, grids y archivo historico.
   - En la V2 se controla preferentemente desde la app/HUB.

5. `mobile-app`
   - App Expo para uso interno.
   - Maneja mesa/eventos, ordenes, compras, importacion MonPrice, claims,
     stock, historial, anulaciones, cola offline, catalogo local y perfiles.

## Flujo oficial

```text
Compra recibida -> Stock
Venta de mesa/evento -> Ventas Detalle -> Stock
Claim preparado -> Ordenes + Ventas Detalle + Frees
Orden pagada + entregada -> Sync Stock -> Entregas Log
CSV MonPrice -> Revision -> Stock
```

El stock se descuenta una sola vez cuando una venta o free listo recibe marca en
`Sync Stock`. La app de venta de mesa ya escribe esa marca cuando descuenta en el
momento.

## Reglas para no pisar logica

- No instalar varios `.gs` de sistemas distintos en el mismo proyecto de Apps
  Script. Muchos definen `onOpen` y menus propios.
- No usar los conectores legacy junto con el HUB V2 para descontar stock.
- No terminar el mismo claim desde dos caminos a la vez. El camino recomendado
  es app/HUB; el menu del generador queda como respaldo administrativo.
- No editar manualmente `Sync Stock`, `Sync ventas`, `Acciones App` ni tokens
  salvo para una reparacion controlada.
- Toda accion que venga de la app debe incluir `localActionId` para idempotencia.
- Si una accion queda en cola offline, esperar el reintento antes de repetirla
  manualmente.

## Legacy

Estos archivos quedan como referencia historica o herramientas puntuales, pero no
son parte del flujo oficial V2:

- `PokemonClaimsUnified.gs`
- `PokemonSinglesStockMaster.gs`
- `SalesStockConnector.gs`
- `ClaimsStockSalesConnector.gs`

`ScannerStockImporter.gs` puede seguir usandose como herramienta separada para
cargas masivas, pero el flujo preferido es importar desde la app cuando el HUB ya
esta publicado.

## Seguridad interna

- La app no debe traer URL ni token por defecto en codigo fuente.
- La URL `/exec` y el token se configuran desde `Mas > Configuracion`.
- Las contrasenas deben estar activas para vincular cada perfil con una sesion
  del HUB.
- Seb/admin configura API, token, generador de claims y reseteo de accesos.
- Para escalar a otros negocios, cada negocio debe tener sus propios tokens,
  planillas, carpetas Drive y usuarios.

## Checklist antes de seguir agregando features

1. Publicar el HUB con `StockAdministrationUnified.gs` actual.
2. Ejecutar `setupStockAdministration`.
3. Activar triggers desde `Stock Admin > Automatizaciones`.
4. Configurar PriceCharting Cache, TCGplayer Cache y Generador de Claims.
5. Configurar token app mobile.
6. Instalar/abrir la app, entrar como Seb y guardar URL/token.
7. Probar: busqueda stock, venta mesa, compra parcial, importacion CSV, claim,
   pago de orden, entrega y anulacion.
8. Revisar `Revision Pendiente`, `Auditoria App`, `Movimientos Stock` y
   `Stock Snapshots`.

## Expansion futura

Para otro negocio, primero conviene copiar el modelo de planillas y configuracion
por negocio. Despues, cuando el flujo este estable, se puede migrar a un backend
multi-tenant con:

- negocios/tenants,
- usuarios y permisos por negocio,
- jobs para caches,
- storage de imagenes/grids,
- auditoria central,
- API versionada para la app.
