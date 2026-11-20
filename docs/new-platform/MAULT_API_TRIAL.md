# Prueba de API Mault

Primera etapa: lectura y diagnostico. No importa cartas ni modifica Mault,
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
origen y endpoint antes de enviar la clave a cada pagina. Espacia consultas
para respetar 60/minuto. Ante 401/403/429, HTML, error o paginacion invalida,
falla sin imprimir respuesta remota ni presentar un resultado parcial.
Limite defensivo 120 paginas: falla explicitamente si se excede.

Siguiente etapa, despues de comprobar datos reales: contrato de importacion
con vinculacion exacta de catalogo y negocio/propietario, recibos transaccionales
por copia, politica de revision/condicion, precios centrales y recuperacion.
Webhook firmado mas lectura incremental de respaldo; las bajas no aparecen en
la lectura incremental documentada y requieren una politica explicita.
No activar carga automatica ni importar el historico sin definir alcance y
conciliar cartas ya ingresadas por CSV o manualmente. No hay despliegue.

Referencia oficial: https://github.com/maultxyz/mault/blob/master/docs/public-api.md
