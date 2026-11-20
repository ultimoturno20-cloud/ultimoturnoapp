# Prueba de API Mault

Esta herramienta sigue siendo de lectura y diagnostico. No importa cartas ni modifica Mault,
stock, precios, reservas o pedidos. No carga la API ni la base de UltimoTurno.
Issue #43. Base de esta entrega: origin/main y produccion f0c3d1e.

## Configuracion privada

Crear una clave de solo lectura en Mault > Settings > Integrations > API keys.
Guardar fuera del repositorio un JSON como este, con la clave real solo local:

```json
{
  "baseUrl": "https://mault.xyz/api",
  "apiKey": "REEMPLAZAR_LOCALMENTE",
  "collectionId": ""
}
```

La URL alojada se verifico sin credenciales: /api/v1/collections responde JSON
401. /v1/collections devuelve HTML y no es la ruta de API alojada.
Usar una carpeta privada con permisos locales restringidos. Nunca versionar
claves ni exportaciones reales, ni pegarlas en logs, issues, PRs o chats.
collectionId vacio consulta todas las colecciones de la organizacion de la clave;
si se completa, verifica pertenencia antes de consultar las cartas.

```powershell
node tools/mault-api-probe.mjs D:\UltimoTurno\mault-private\config.json
node --test tools/mault-api-probe.test.mjs
```

## Resultado y limites

El resumen cuenta copias unicas por ID de escaneo, idiomas, acabados, presencia
de ID TCGplayer y ubicacion, y campos basicos pendientes de revision.
Los registros repetidos no suman dos veces. El informe no certifica identidad,
idioma, condicion o variante: solo informa lo que devuelve Mault.
NM puede ser un valor inicial; foil sin subtipo queda pendiente.
withBasicFieldsComplete NO significa coincidencia con nuestro catalogo.
No consulta ni concilia el inventario existente. Un reescaneo fisico con otro
ID sigue siendo otra copia para Mault y necesita control operativo.

Consulta GET con timeout por peticion, sin seguir redirecciones, y verifica
origen y endpoint antes de enviar la clave a cada pagina. La instancia alojada
devuelve enlaces /v1/cards; solo ese endpoint del mismo origen se reubica a
/api/v1/cards conservando filtros, para completar lecturas mayores a 500 copias.
Un cambio de coleccion o filtros entre paginas cancela el informe. Espacia consultas
para respetar 60/minuto. Ante 401/403/429, HTML, error o paginacion invalida,
falla sin imprimir respuesta remota ni presentar un resultado parcial.
Limite defensivo 120 paginas: falla explicitamente si se excede.

El consumidor implementado en esta misma rama utiliza lectura incremental y
recibos transaccionales, con configuracion y revision en Admin. El usuario
autorizo desarrollar/probar antes del merge contractual. No se desplego ni se
activo una carga real. Las bajas no aparecen en la lectura incremental y no
se restan automaticamente. Ver MAULT_INTAKE_CONTRACT.md para operacion y limites.

La lectura real autenticada y multipagina se verifico con configuracion privada,
sin publicar registros, identificadores de cartas o credenciales. La elegibilidad
contractual agrega reglas mas estrictas que este diagnostico basico. Ver
MAULT_INTAKE_CONTRACT.md y packages/domain/src/mault-intake.ts. El consumidor
DB/HTTP tiene pruebas idempotentes en PGlite nuevo; aun no esta en produccion.

Referencia oficial: https://github.com/maultxyz/mault/blob/master/docs/public-api.md
