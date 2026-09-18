# UltimoTurno

Sistema operativo de UltimoTurno para inventario, claims, ordenes, caja,
compras e importacion de cartas Pokemon.

## Estado actual

La plataforma activa funciona localmente y online:

- Web/API de produccion: `https://ultimoturnoapp-api.vercel.app/`
- Produccion: Vercel + Supabase/Postgres + Supabase Storage.
- API: `apps/api`.
- Web administrativa: `apps/admin-web`.
- Perfil local: `PILOTO REAL`.
- Base local: `apps/api/.data/ultimoturno-pilot-real`.
- Catalogo PriceCharting: aproximadamente 120.710 entradas.
- Actualizacion PriceCharting: cron diario de Vercel a las `09:00 UTC`
  (`06:00` de Argentina).

Ultimo cambio funcional documentado antes de esta actualizacion: `708c9aa`.

Para retomar el trabajo leer, en este orden:

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/NEXT_STEPS.md`
4. `docs/new-platform/HANDOFF_NEXT_ACCOUNT.md` solo si hace falta contexto
   historico.

## Workspace correcto

```text
D:\UltimoTurno\Stock
```

No usar `C:\Users\skype\Documents\Stock`: es un workspace viejo y no es la
plataforma de produccion.

## Cambios operativos recientes

- Claims: cargador CSV por seccion con vista previa. El claim activo de
  produccion debe preservarse y nunca eliminarse durante pruebas o reparaciones.
- Importaciones: se corrigio la vista previa de CSV escaneados y el matching de
  nombres japoneses de MonPrice.
- Imagenes: URLs publicas en Supabase Storage, reparacion de claims y daemon
  local para descargar, subir y enlazar imagenes en lotes.
- PriceCharting: refresco diario y fallback de busqueda para fuentes de imagen.
- Ordenes: tablero visual renovado y cabecera compacta para dedicar mas pantalla
  a las tarjetas. Fueron cambios de frontend y no alteraron la base de ordenes.

## Herramientas de imagenes

Para dejar corriendo el reparador online:

```powershell
npm run images:storage:daemon -- --loop
```

Tambien puede iniciarse con `Mejorar Calidad Imagenes Online.cmd`.

El daemon pide candidatos a la API online, descarga cada imagen a
`D:\UltimoTurno\pricecharting-images`, la sube al bucket
`ultimoturno-images` y enlaza la URL publica con catalogo, stock y claims. Las
fuentes que responden `403`, `404` o `410` reciben una espera de 24 horas para
evitar ciclos inutiles.

Las credenciales se configuran como variables de entorno. Nunca pegarlas en
archivos versionados.

## Desarrollo y verificacion

```powershell
npm run dev:api
npm run dev:web
npm run lint
npm run typecheck
npm test
npm run db:verify
npm run build
```

Antes de probar local, confirmar que se usa el perfil `PILOTO REAL` y no una
base de ejemplos.

## Componentes principales

- `apps/api`: API Node para local y funciones serverless de Vercel.
- `apps/admin-web`: interfaz React/Vite de operacion diaria.
- `packages/db`: esquema, migraciones y persistencia PGlite/Postgres.
- `packages/importers`: parsers y conciliacion CSV.
- `packages/domain`: tipos y reglas compartidas.
- `tools/image-storage-daemon.ts`: reparador continuo de imagenes online.
- `scripts/upload-pricecharting-images-to-supabase.mts`: carga masiva de
  imagenes locales a Supabase Storage.

## Legado / referencia

`apps-script` y `mobile-app` siguen en el repositorio como referencia historica.
El flujo diario actual esta en `apps/api` y `apps/admin-web`.
