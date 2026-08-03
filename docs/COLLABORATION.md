# Colaboracion

Guia rapida para compartir el proyecto con otro miembro del equipo.

## Que se comparte por Git

El repo debe incluir:

- `README.md`
- `docs/`
- `apps-script/`
- `mobile-app/`
- `tools/`
- `outputs/` cuando sean artefactos utiles de migracion, previews o builds
- scripts de inspeccion y utilidades

No se suben dependencias ni entornos locales:

- `node_modules/`
- `.expo/`
- `.android-sdk/`
- `.android-tools/`
- `.android-user/`
- `mobile-app/dist-*`

Eso se regenera en cada PC con `npm install` o con los comandos de Expo.

## Crear repo privado

1. Crear un repo privado en GitHub, por ejemplo `ultimoturno`.
2. Agregar al otro miembro como collaborator.
3. Conectar este proyecto local con el remoto:

```bash
git remote add origin https://github.com/TU_USUARIO/ultimoturno.git
git branch -M main
git push -u origin main
```

Si el repo remoto ya existe con archivos, primero conviene hacer pull o crear uno
vacio para evitar conflictos.

## Primer setup en otra PC

```bash
git clone https://github.com/TU_USUARIO/ultimoturno.git
cd ultimoturno/mobile-app
npm install
npm run check:deps
npm start -- --clear
```

## Apps Script y planillas

Las planillas de Google no viajan por Git. Hay que compartirlas desde Drive:

- HUB / Administracion
- PriceCharting Cache
- TCGplayer Cache
- Generador de Claims V2
- carpetas de grids y claims archivados

En Apps Script, quien despliegue debe tener permisos sobre esas planillas y crear
una nueva version del Web App cuando cambie `StockAdministrationUnified.gs`.

## Regla de trabajo

- Hacer cambios en ramas cortas.
- Probar `npm run check:deps`, `npm run export:web` y `npm run export:android`
  antes de pasar una build.
- No mezclar scripts legacy con el HUB V2.
- Documentar cualquier cambio de columnas, estados o acciones API.
