# UltimoTurno 2.2.0 Beta

App nativa Expo para uso interno en mesas/eventos.

## Funciones principales

- Venta de mesa con buscador visual, carrito persistente, precios ARS/USD y cierre seguro.
- Ordenes con checklist de embalaje, senas parciales y cierre confirmado.
- Compras agrupadas con recepciones completas o parciales.
- Importacion de CSV MonPrice con revision de cantidades antes de guardar.
- Gestion de stock, ubicacion, precios, idioma, condicion y estado desde la app.
- Historial de ventas con anulacion y devolucion automatica al stock.
- Catalogo local para buscar cartas sin senal y cola offline con reintentos e idempotencia.
- Perfiles Seb, Mayu, Melo y Ger con permisos distintos, contrasena y biometria.
- Dashboard con ventas semanales, valor de stock y evolucion diaria.

## Setup del HUB

En el proyecto Apps Script del HUB debe estar la version actual de:

- `StockAdministrationUnified.gs`
- `MobileSalesApp.html`

Pasos:

1. Reemplazar el contenido anterior por `apps-script/StockAdministrationUnified_TO_COPY.gs`.
2. Guardar y ejecutar `setupStockAdministration` una vez.
3. Autorizar los permisos que pida Google.
4. Recargar la planilla y activar `Stock Admin > Automatizaciones > Activar triggers`.
5. Ejecutar `Stock Admin > Configuracion > Configurar token app mobile` si todavia no existe.
6. Crear una nueva version del despliegue Web App usando `Ejecutar como: yo`.
7. Mantener la misma URL `/exec`; una version nueva no obliga a reconfigurar cada celular.

La primera vez que cada perfil entra despues de desplegar la V2 debe crear o
escribir su contrasena. Desde el segundo ingreso puede usar huella o
reconocimiento facial.

## Setup de la app

```bash
cd mobile-app
npm install
npm start -- --clear
```

En la app, solo Seb configura:

1. Entrar como Seb y crear la contrasena local si es la primera vez.
2. Ir a `Mas > Configuracion`.
3. Pegar la URL `/exec` de Apps Script.
4. Pegar el token generado en el HUB.
5. Guardar configuracion.

La app no trae URL ni token por defecto en el codigo fuente. En celulares ya
configurados se usa la configuracion guardada en el dispositivo.

Para probar en celular, usar Expo Go SDK 54 y escanear el QR. El `--clear`
evita que el telefono reutilice un bundle viejo.

## Probar en PC

```bash
cd D:\UltimoTurno\Stock\mobile-app
npm run web
```

Si Expo pregunta algo en la terminal, aceptar abrir en navegador.

## Probar en celular

Esta app usa Expo SDK 54 y es compatible con Expo Go SDK 54.

```bash
cd D:\UltimoTurno\Stock\mobile-app
npm start -- --clear
```

Despues escanear el QR con Expo Go.

## Verificaciones locales

```bash
npm run check:deps
npm run export:web
npm run export:android
```

No se deben parchear archivos internos de React Native. Las versiones nativas
se mantienen alineadas con Expo SDK 54 mediante `expo install --check`. En
particular, `expo-font` debe permanecer en la version compatible con SDK 54.

## Generar APK interna

La APK interna usa el perfil `preview` de `eas.json`. Ese perfil genera
`UltimoTurno Beta` con el paquete separado `com.ultimoturno.app.beta`, por lo que
puede instalarse junto a la version principal. No necesita Expo Go abierto.

Antes de compilar:

```bash
cd D:\UltimoTurno\Stock\mobile-app
npm run check:deps
npm run export:android
```

Primer setup de EAS, si la PC todavia no esta logueada:

```bash
npx eas-cli login
npx eas-cli build:configure
```

Build de la APK Beta:

```bash
npm run build:apk
```

Cuando termine, EAS da un link para descargar/instalar la APK. Ese link se puede
abrir desde el celular del equipo interno.
