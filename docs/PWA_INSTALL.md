# Instalar UltimoTurno en el celular

La aplicacion instalable usa directamente la plataforma productiva:

```text
https://ultimoturno.app/inicio
```

No requiere APK, Expo Go ni una configuracion separada. Usa los mismos usuarios,
permisos y datos que la web.

## Android

1. Abrir la direccion en Chrome.
2. Pulsar `Instalar UltimoTurno` cuando aparezca dentro de la plataforma.
3. Confirmar `Instalar`.
4. Abrir el icono `UltimoTurno` desde la pantalla de inicio.

Si Chrome no muestra el boton, abrir su menu y elegir `Instalar aplicacion` o
`Agregar a pantalla principal`.

## iPhone y iPad

1. Abrir la direccion en Safari.
2. Pulsar `Compartir`.
3. Elegir `Agregar a inicio`.
4. Confirmar el nombre `UltimoTurno`.

## Alcance de la primera etapa

- Pantalla completa e icono propio.
- Misma autenticacion y permisos de la plataforma online.
- Accesos rapidos a Inventario, Cargar stock, Ordenes y Revendedores.
- Interfaz disponible ante un corte breve de conexion.
- Operaciones y datos siempre online: no se cachean respuestas de la API ni se
  encolan ventas o cambios de stock sin confirmacion del servidor.

La carpeta `mobile-app/` pertenece a una aplicacion Expo anterior conectada a
Apps Script. No corresponde a esta PWA ni debe usarse para operar la plataforma
Vercel/Supabase actual.
