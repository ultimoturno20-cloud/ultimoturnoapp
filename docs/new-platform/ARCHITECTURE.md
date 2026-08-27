# Nueva plataforma UltimoTurno

## Alcance de esta etapa

Esta etapa crea una version nueva aislada. No reemplaza legacy, no escribe en
Google Sheets, no usa credenciales reales y no se conecta a Supabase remoto.

## Eleccion tecnica

- Monorepo npm workspaces: simple de operar con Node/npm, sin introducir pnpm,
  turborepo ni servicios adicionales.
- TypeScript: contratos claros para dominio, API, importadores y web.
- React + Vite para admin web: consistente con React usado por la app Expo, pero
  liviano para web administrativa.
- API Node HTTP sin framework pesado: suficiente para endpoints internos de
  prototipo y facil de reemplazar por Fastify/Express si aparece complejidad.
- PostgreSQL/Supabase como objetivo: el schema esta escrito en SQL PostgreSQL.
- PGlite para desarrollo local seguro: ejecuta migraciones, seeds y consultas
  tipo PostgreSQL sin servicios remotos ni datos reales.

## Carpetas nuevas

```text
apps/api              API local que lee desde PGlite/PostgreSQL demo
apps/admin-web        Web administrativa visual
packages/db           Schema, migraciones, seeds y verificacion local
packages/domain       Reglas y tipos compartidos
packages/importers    Parsers ficticios y conciliacion inicial
docs/new-platform     Documentacion de la nueva version
scripts               Checks propios de la nueva version
```

## Fronteras con legacy

- Legacy no depende de la nueva version.
- La nueva version no importa codigo de `apps-script/` ni `mobile-app/`.
- La nueva version no escribe en Google Sheets.
- La nueva version usa datos ficticios hasta aprobacion explicita.

## Modulos visibles actuales

- Inicio: metricas ficticias de productos, unidades, reservas, valor e
  importaciones pendientes.
- Stock/Venta: consulta de inventario, detalle de carta, historial y carrito
  demo con precio editable por linea.
- Ordenes: ventas/reservas demo creadas desde el carrito, con estados simples.
- Movimientos: historial ficticio para entender cambios de stock.
- Importaciones: revision de filas, candidatos multiples, warnings de calidad
  y traduccion demo de nombres japoneses/chinos antes de buscar candidatos.
- Compras: operaciones persistentes sobre inventario y busqueda sobre cache
  local PriceCharting sincronizado manualmente.

Ventas, reservas, compras e importaciones siguen siendo demostrativas: no
escriben stock real ni crean movimientos persistidos.

## Flujo local actual

```text
packages/db/migrations -> PGlite en memoria -> apps/api -> apps/admin-web
```

La web conserva fixtures como fallback si la API local no esta corriendo, pero
cuando la API responde muestra datos leidos desde tablas PostgreSQL demo.

## Reglas de seguridad vigentes

- La nueva version no conecta Google Sheets ni Supabase remoto. PriceCharting
  solo se consulta al sincronizar manualmente su CSV con token de entorno.
- El carrito de venta/reserva solo modifica estado local de la pantalla.
- La compra demo solo arma costos y limpia el borrador al registrar.
- La importacion muestra errores y decisiones en pantalla, pero no aplica
  cambios sobre inventario.
