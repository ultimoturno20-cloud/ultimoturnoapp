# Plan de optimizacion de UltimoTurno

Actualizado: 2026-10-14

## Objetivo y alcance

Simplificar la plataforma existente y reducir trabajo repetido sin reemplazar
la base de datos, cambiar operaciones historicas ni agregar otro sistema.
Pedido del usuario: completar una planificacion integral y comenzar, no dejar
la mejora limitada a un unico item. Este documento es el seguimiento vigente.

Base inicial: main y produccion en 318a5a3; repositorio limpio, public-status
HTTP 200 y DB accesible. Los tiempos se miden en fixtures aislados; no se
presentan como latencia de produccion ni como promesas sin medicion.

## Seguimiento

| Etapa | Estado | Resultado esperado |
|---|---|---|
| 1. Lecturas y recargas | En curso | Consultas acotadas y recargas solo cuando cambian sus datos |
| 2. Modulos y contratos | Pendiente | Responsabilidades separadas en la misma aplicacion |
| 3. Interfaz y estilos | Pendiente | Componentes comunes y menos capas de overrides |
| 4. Precios e imagenes | Pendiente | Servicios compartidos con reglas e identidad explicitas |
| 5. Circuitos y cierre del plan | Pendiente | Recorridos consistentes y QA integral documentado |

## Etapa 1: lecturas y recargas

- [x] OP-1.1: leer un item por ID sin cargar todo el stock; valorar solo las
  carpetas solicitadas. Paridad completa del DTO, permisos y valores existentes.
- [x] OP-1.2: al editar cartas de claim, evitar recargar stock si no cambio;
  mantener recarga ante cantidades, imagenes o reparaciones reales de stock.
- [x] OP-1.3: medir y eliminar GET repetidos entre vistas, conservando sesiones,
  refresh manual, cambio de precio entre pestanas y recuperacion de errores.
- [ ] OP-1.4: paginar/filtrar las lecturas grandes en servidor donde sea posible;
  separar resumen global de pagina. Exportaciones y acciones masivas siguen
  trabajando sobre el alcance completo explicitamente elegido.
- [ ] OP-1.5: registrar consultas, filas, bytes y tiempos antes/despues en
  fixtures de inventario y claim grandes; agregar presupuestos de regresion.

Criterio de terminado: menos lecturas demostrables, mismos precios/cantidades/
reservas/totales/permisos, sin caches viejas despues de escrituras. Paginacion
no recorta resumen, filtros, seleccion, exportaciones ni operaciones masivas.

## Etapa 2: modulos y contratos

- [ ] OP-2.1: compartir DTO de Inventario, Ordenes y Claims sin importar codigo
  de servidor/DB en el bundle del navegador; contrato publico separado.
- [ ] OP-2.2: separar consultas y operaciones de Inventario/Claims/Ordenes/
  Revendedores de packages/db/src/index.ts por entregas pequenas y testeadas.
- [ ] OP-2.3: separar handlers HTTP de integraciones y jobs de server.ts;
  conservar rutas, permisos, body limits, transacciones e idempotencia.
- [ ] OP-2.4: extraer vistas y controladores de main.tsx por sector, usando
  infraestructura compartida. Transporte comun con autenticacion explicita:
  tienda anonima y cuentas de Torneos nunca heredan la sesion administrativa.

Criterio de terminado: responsabilidades identificables, menos contratos
duplicados, dependencias sin ciclos nuevos y mismos circuitos operativos.
Mover archivos no se registra por si solo como mejora de rendimiento.

## Etapa 3: interfaz y estilos

- [ ] OP-3.1: inventariar editores/detalles/dialogos repetidos y consolidar
  primero los que realmente tienen el mismo comportamiento y permisos.
- [ ] OP-3.2: compartir formato monetario, campos de precio y validacion visual;
  no unificar politicas de redondeo distintas por negocio.
- [ ] OP-3.3: mover estilos a sus sectores y retirar overrides reemplazados
  despues de probar desktop/movil; una fuente de estilos por componente.
- [ ] OP-3.4: QA visual a 320/390/768/1440/1788 px, teclado, foco, estados
  vacio/error/carga, reduced-motion e imagenes/precios contenidos.

Criterio de terminado: apariencia y controles consistentes, sin nuevas capas
para anular otras, sin saltos de layout y sin alterar la identidad negro/rojo.

## Etapa 4: precios e imagenes

- [ ] OP-4.1: explicitar precio de referencia, precio central y snapshot de
  orden; compartir conversion/formatos, conservando cada politica autorizada.
- [ ] OP-4.2: consolidar resolucion de imagenes con identidad exacta de carta,
  expansion, idioma, numero y variante; override manual siempre protegido.
- [ ] OP-4.3: separar proveedores PC/TCGplayer/CoolStuff/TCGdex de reglas del
  negocio; conservar caches existentes, limites y estados de error visibles.
- [ ] OP-4.4: caracterizar y retirar rutas/helpers obsoletos solo con evidencia
  de que no tienen consumidores. No eliminar datos ni caches historicas.

Criterio de terminado: misma carta/variante/precio elegido, fuente trazable,
sin sobrescribir precios pactados ni sustituir ediciones especiales.

## Etapa 5: circuitos y cierre del plan

- [ ] OP-5.1: recorrer tienda/claim/mostrador hasta Ordenes con stock y reservas
  compartidos, sin nuevas listas paralelas ni reinterpretar ordenes previas.
- [ ] OP-5.2: revisar consignacion y devoluciones manteniendo las reglas de
  Revendedores; Torneos conserva sus cuentas y limites independientes.
- [ ] OP-5.3: QA completo en API/base temporal: pagos, cancelacion, stock,
  permisos, concurrencia y respuesta perdida/reintentos sin duplicados.
- [ ] OP-5.4: cerrar cada pendiente o documentar una decision explicita con
  razon y alternativa. El plan no termina al completar OP-1.1.

Criterio de terminado: checklist resuelto, regresiones y comparacion de
metricas documentadas, guias actualizadas y ultimo commit verificado online.

## Protocolo de entrega y continuidad

1. Elegir el siguiente OP pendiente de la etapa actual y leer su contexto.
2. Definir baseline, alcance y prueba de preservacion antes de cambiar codigo.
3. Implementar y comprobar comportamiento en bases/API temporales.
4. Actualizar este checklist con evidencia, pendientes y decision siguiente.
5. Commit, push y verificar public-status con el SHA publicado. No cerrar
   una entrega como online si el despliegue sigue en un commit anterior.
6. Continuar con el siguiente OP; fallos operativos reales tienen prioridad,
   pero no borran ni reinician este plan.

Prohibido probar compras, cierres o pagos ficticios sobre produccion, borrar
o recrear datos reales, guardar secretos en Git o compartir auth entre roles.
Temporales de QA en .work ignorado, preferentemente TEMP/TMP en D:.

## Registro de entregas

- 2026-10-14, OP-1.1: getter por ID y negocio, agregados de consignacion
  acotados y valuacion solo de carpetas solicitadas. Mismo mapper/consulta de
  stock, sin copias nuevas de reglas. Fixture de 1000 items: 2000 -> 2 filas
  auxiliares y 1297672 -> 1294 bytes devueltos por SQL. Tiempos locales
  informativos 174 -> 48 ms, no medicion productiva ni criterio obligatorio.
  Regresiones de DTO completo, grading, reservas, asignaciones, negocio ajeno,
  frescura tras escritura, carpetas y getter legacy. QA: 231 tests completos,
  tipos/lint/build/DB verify aprobados, sin escrituras productivas de prueba.
  Commit 3414fb1 publicado y confirmado en public-status; stock privado 401
  sin sesion. La etapa 1 y las posteriores no estan completas.
- 2026-10-14, OP-1.2: PUT de carta agrega stockRefreshRequired sin reemplazar
  el workspace. Servidor compara stock antes/despues para metadata y conserva
  refresh por cantidades/imagenes y reparaciones legacy. Cuando corresponde,
  invalida snapshot compartido en la transaccion y cache en memoria del handler;
  panel pide /stock?fresh=1. Respuesta sin flag conserva refresh por seguridad.
  Chrome/API real temporal: cinco ediciones de metadata -> cero GET extra de
  stock. Cantidad e imagen refrescan; precio central conservado, fallback de
  API anterior y errores de guardado/recarga probados. No requests productivos.
  QA: suite completa de 234 tests antes del ajuste final de frescura; siete
  regresiones finales DB/HTTP aprobadas con ese ajuste, tipos/lint/build OK.
  Prueba HTTP queda versionada para que CI vuelva a comprobar las caches.
  Siguiente entrega: OP-1.3, deduplicacion de GET entre vistas y consistencia
  de invalidaciones/peticiones en vuelo. No se marcan OP-1.3/1.4/1.5 completos.
- 2026-10-14, OP-1.3: cliente administrativo unico reemplaza el helper anterior.
  Comparte solo GET simultaneos por URL completa, bearer efectivo y revision;
  no agrega TTL de respuestas. Conserva ETag de stock, errores HTTP y señales
  de cancelacion independientes. Escrituras se envian una sola vez, invalidan
  antes/despues aun ante fallo y las lecturas esperan su finalizacion.
  Lotes de vistas se aplican juntos solo si siguen vigentes; sesion reemplazada
  descarta respuestas anteriores sin convertirlas en un 401 de la cuenta nueva.
  Recarga manual y evento de precio invalidan inmediatamente; siguiente stock
  usa fresh=1, incluido evento recibido con la pestana oculta. Torneos y tienda
  anonima no importan este transporte ni heredan credenciales administrativas.
  Cache de stock existente extraida de server.ts, mismo TTL de 15 segundos:
  lecturas simultaneas comparten trabajo y fresh supersede pendientes viejos.
  Snapshot compartido publica/limpia solo con su ticket SQL exacto; las
  invalidaciones existentes revocan ese ticket en la misma transaccion.
  Datos marcados invalidados no sirven como fallback ante errores: se informa
  el fallo y se permite reintentar, sin devolver stock vacio ni resucitar datos.
  Fixture reproducible con helper de e63a864 y cliente actual, vistas Claims /
  Inventario / Ordenes simultaneas: GET totales 8 -> 4; stock 3 -> 1, claims
  2 -> 1 y resellers 2 -> 1. No es una medicion de latencia productiva.
  Chrome con API/PGlite temporal confirma una lectura stock entre tres vistas,
  recarga manual fresh, precio central desde otra pestana y respuesta vieja
  retenida. Regresion OP-1.2: cinco metadata -> cero GET extra; cantidad/imagen,
  API vieja y fallos de guardado/refresh conservados. Cero requests productivos.
  Pruebas versionadas: admin-api.test.ts (8), stock-read-cache.test.ts (7),
  claim-stock-cache.test.ts y revocacion SQL en claim-stock-refresh.test.ts.
  QA final: 250 tests completos aprobados; tipos, lint, build y db:verify OK.
  Sin migraciones, nuevas dependencias ni cambios de datos comerciales reales.
  Siguiente entrega OP-1.4: paginacion/filtros en servidor conservando resumen,
  seleccion completa, exportaciones y acciones masivas. Etapa 1 sigue en curso.
