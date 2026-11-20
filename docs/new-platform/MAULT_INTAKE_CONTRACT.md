# Contrato de ingreso Mault (primera entrega, issue #43)

Estado: propuesta ejecutable en domain, sin endpoints ni migraciones aplicadas.
`mault-intake.ts` normaliza la copia y evalua elegibilidad sin IO ni escrituras.
No es un importador activo. Integrar y revisar este contrato antes de desarrollar
sus consumidores, segun AGENTS.md. PR #44; no pertenece al plan OP.

## Alcance y autorizacion

El objetivo es agregar copias nuevas de Pokemon al inventario central, manteniendo
idioma, condicion y acabado. El primer contacto no debe sumar todo el historico.
Elegir explicitamente las colecciones incluidas; ninguna seleccion equivale a cero
cartas autorizadas, no a todas. Otros juegos quedan excluidos.

Solo un admin del negocio puede configurar conexion, colecciones, propietario y
politica de condicion. businessId proviene de la sesion; un webhook o una copia
de Mault nunca deciden negocio, propietario, precio de venta o cantidad.
El contexto domain es interno del servidor, no un body HTTP confiable.
El adaptador HTTP futuro debe validar tipos, enums y pertenencia de todos los IDs.
Credenciales solo en servidor/archivo privado, nunca DTO, respuesta, auditoria
o bundle navegador. Rotar la clave no debe cambiar la identidad de las copias.

## Estados por copia

| Estado | Existencias | Significado |
| --- | --- | --- |
| excluded | 0 | Otro juego o coleccion no habilitada |
| baseline | 0 | Historico observado, pendiente de conciliacion explicita |
| review | 0 | Identidad/variante/condicion dudosa o cambio posterior |
| already_imported | 0 | Copia con recibo confirmado de ingreso previo |
| ready | +1 propuesta | Coincidencia exacta y politicas satisfechas |

`ready` es una propuesta, NO un recibo de escritura. Cada scanned_card representa
una unidad. Conservar el ID por copia; no agrupar y perder trazabilidad.
`MaultIntakeCopy` conserva acabado original, idioma normalizado y ubicacion.
El numero normaliza ceros iniciales, sin descartar un denominador contradictorio.
El producto TCGplayer solo ayuda a buscar candidatos: no prueba la coincidencia
de idioma/condicion/acabado ni sustituye el mapeo de la edicion.

Coincidencia requiere ID de impresion fuente, juego, set, numero, idioma,
acabado y condicion. No aceptar nombre aproximado o numero en otro set.
Pokeball, Masterball y Reverse son identidades diferentes.
Dusk Ball se conserva en el origen y queda en revision: el enum actual de
CardVariant no lo admite; no convertirlo a Reverse ni a otro por comodidad.
Idiomas desconocidos no se convierten a EN. `zh-cn`/`zh-tw` -> CHS/CHT;
`zh` sin variante queda pendiente. ID (indonesio) se conserva como ID.

NM puede ser el valor inicial de Mault. Politica inicial: require_confirmation.
El administrador puede autorizar accept_recorded en configuracion persistida;
no inferir esa autorizacion de needs_review=false ni de is_reviewed=true.
Errores de reconocimiento de Mault permanecen pendientes.

## Primera sincronizacion y recuperacion

1. Leer todas las paginas autorizadas con la clave de solo lectura y sin tocar stock.
2. Registrar baseline por ID. Marcar baselineComplete solo tras recorrido completo.
3. La fase incremental solo agrega IDs nuevos, nunca los de baseline.
4. Importar historico requiere preview y confirmacion explicita, conciliando
   cartas ya ingresadas manualmente/por CSV. No comparar snapshots y sumar
   diferencias ciegamente: ventas/reservas tambien cambian cantidades.
5. Persistir pendientes aunque se avance el cursor, para resolverlos despues.
6. Actualizar cursor solo despues de persistir todas las copias del recorrido.
   Un fallo deja el cursor anterior; volver a leer no vuelve a sumar recibos.

Los eventos son aceleradores; una lectura incremental de respaldo recupera
avisos perdidos. Validar firma HMAC sobre body original, antiguedad y conexion
antes de aceptar el webhook. No confiar en los datos del evento como identidad
final: reconsultar las copias cuando corresponda. Eventos fuera de orden no
pueden deshacer una correccion mas nueva. Mault no informa bajas por `since`;
esta primera integracion NO elimina ni resta inventario por una ausencia.

## Persistencia prevista (no implementada en este PR)

Recibo unico por `(business_id, provider='mault', source_copy_id)`.
No incluir clave, conexion o coleccion en esa unicidad: rotacion/reconexion y
movimientos de caja no deben habilitar un segundo ingreso de la misma copia.
`maultReceiptKey` documenta esa identidad; NO es un lock ni un recibo durable.
Fingerprint de identidad excluye precios, ubicacion y coleccion. Cambiar una
identidad ya ingresada genera revision, nunca otra unidad automatica.

En transaccion: bloquear/insertar recibo unico, bloquear captura y item destino,
revalidar permisos/variante/estado, reutilizar el ingreso y movimiento existentes,
marcar imported con item destino y revocar snapshot de stock. Despues del commit,
invalidar cache de memoria existente. Rollback ante cualquier fallo.
Otro proceso simultaneo o respuesta perdida devuelve el recibo previo.
Solo promover baseline a imported en fase historica confirmada.
Guardar movimiento y recibo en la misma transaccion; no usar un archivo local
como proteccion frente a duplicados ni escribir directamente en Supabase.

Conservar precios centrales vigentes, cantidades reservadas y asignadas,
imagenes manuales y ordenes existentes. El precio Mault es referencia NM,
no costo de compra ni precio de venta autorizado. Los items nuevos necesitan
la politica vigente de precios, sin reutilizar cambios/redondeos historicos.

## Contrato HTTP propuesto para la entrega posterior

Administracion autenticada, scoped al negocio:

- `GET /integrations/mault/status`: conectado, fase, colecciones habilitadas,
  ultima lectura, errores y totales; sin secretos ni exportaciones completas.
- `POST /integrations/mault/preview`: preview paginado de pendientes y resumen
  global. Catalogo/IDs seleccionados y permisos se resuelven en servidor.
- `POST /integrations/mault/apply`: seleccion explicita de copyIds y requestId;
  revalida y devuelve recibos, nunca confia en quantityDelta/catalogId cliente.
- `POST /integrations/mault/webhook`: firma por conexion; persistencia idempotente
  rapida y procesamiento reanudable. No tarea larga sin durable acknowledgement.

La sincronizacion automatica incremental debe funcionar con el navegador cerrado.
Definir worker externo/cron reanudable segun limites de Vercel, sin crear otra
base/capa de cache. No iniciar workers ni habilitar importaciones por este PR.

## Aceptacion de la entrega posterior

Pruebas DB/HTTP en PGlite nuevo: mismo ID dos veces/concurrente/respuesta perdida,
rotacion de clave, mudanza entre colecciones, rollback, cursor parcial, evento
repetido/firma invalida/fuera de orden, permisos de otro negocio/propietario,
variante incorrecta, Dusk Ball, condicion no confirmada, historico y baja fuente.
Comprobar reservas/asignaciones/precios e invalidacion snapshot/cache.
UI nueva necesita QA en los cinco anchos y estados exigidos por AGENTS.md.
No escribir cartas reales ni aplicar migraciones productivas como prueba.

## Evidencia de esta entrega

- `npm run check:new`: 323 tests aprobados, lint, tipos, DB temporal y build OK.
- 17 pruebas focalizadas del lector/contrato aprobadas tambien por separado.
- Resolucion de domain, DB e importers dentro del worktree de esta tarea.
- Lectura real autenticada y multipagina validada; resumen solo en carpeta
  privada fuera de Git, sin registros reales o claves en esta entrega.
- Sin conciliacion de catalogo, writes de inventario, worker, webhook activo,
  migraciones, UI, merge o deploy. Revision cruzada e integracion pendientes.
