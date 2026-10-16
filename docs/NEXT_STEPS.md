# UltimoTurno - proximos pasos

Actualizado: 2026-10-16

> Usar primero el orden de continuidad y el prompt de este documento.
> Los detalles por sector conservan verificaciones pendientes, no autorizan
> operaciones ficticias en produccion. El archivo de septiembre es historico.

## Orden de continuidad

Antes de nuevas tareas paralelas: integrar con autorizacion humana la preparacion
Codex/Claude y seguir docs/AGENT_COLLABORATION.md. Cada tarea requiere propietario,
alcance y rama/worktree propios; no hay asignacion funcional automatica a Claude.
AGENTS.md es comun; no duplicar reglas en CLAUDE.md. Ramas y PRs reemplazan pushes
directos a main. Commit/push/CI por entrega; online se confirma despues del merge
humano, comparando public-status con el SHA resultante de main.

Plan de desarrollo solicitado el 14/10: docs/OPTIMIZATION_PLAN.md. Completar
sus cinco etapas por IDs con pruebas/commit/push/PR y online tras merge autorizado.
OP-1.1 online en 3414fb1, OP-1.2 en e63a864 y OP-1.3 en ca89cca, con
QA DB/HTTP/Chrome: GET superpuestos 8 -> 4, stock 3 -> 1, sesiones aisladas,
recarga manual/entre pestanas y descarte de respuestas anteriores a guardados.
OP-1.4 en curso: OP-1.4a entrega historial Movimientos/Auditoria con filtros
y paginas SQL, carga solo de pestana activa y totales fuera de la pagina.
QA: 260 tests completos, regresiones finales y Chrome/API temporal aprobados.
OP-1.4a confirmado online en ddf5f20. OP-1.4b entregado: Inventario paginado
24/48/96 por /inventory/view, agregados globales y alcance completo para
seleccion/CSV. IDs frescos antes de lotes; carrito/editor conservados fuera de
pagina, sin GET /stock ni dashboards /resellers al entrar. 269 tests completos
y 20 regresiones finales, API/Chrome temporal, tipos/lint/build/db:verify OK.
Comparacion 1000 DTO: 1051899 -> 26058 bytes de respuesta para pagina 24 con
metadata; lectura fria SQL aun construye snapshot completo, no un LIMIT SQL
ni latencia productiva. Paridad de filtros/precios con ddf5f20 en 1217 casos.
OP-1.4b confirmado online en ec14a69. OP-1.4c.1 entregado el 16/10:
Carga movil con paginas SQL 25/50/100 y contadores globales, duplicados fuera
de pagina, Preview/carga completa de pendientes elegibles sin truncar a 20000.
Conserva precio central, transaccion y recibos; invalida snapshot/memoria tras
cargar. [] no carga todo, body invalido se rechaza. QA: 278 tests completos,
tipos/lint/build/db:verify y Chrome/API/PGlite temporal con cinco anchos,
filtros/lecturas retenidas/manual, errores y reintentos, alta/deshacer, preview
y carga de 120 capturas desde un filtro que muestra solo 10. Sin QA productivo.
OP-1.4c.1 confirmado online en cfea206. OP-1.4c.2a entregado: Ingreso deja
de descargar /stock y usa /inventory/intake-search. SQL filtra metadata y
completa hasta 60 IDs elegidos; combinacion/ranking/idiomas conservados,
30 resultados normales, respaldo de 60 locales y avisos ante fallos parciales.
Sin cache mezclada del navegador ni candidatos de otro propietario; conserva
cache catalogo servidor 60 s, precio local fresco y POST de alta existente.
La lectura de metadata puede ser amplia y POST aun resuelve identidad con
stock completo; no afirmar LIMIT SQL global ni nueva optimizacion de writes.
QA 286 tests, tipos/lint/build/db:verify y Chrome/API temporal aprobados,
incluidos guardar/seguir, doble clic, propietario, carpeta y cinco anchos.
Seguir con OP-1.4c.2b: primero picker de Ordenes; despues Compras, Claims,
Planificador y movimientos exactos por item. Luego OP-1.5 (metricas).
Mapear filtros, agrupaciones, permisos y acciones de cada consumidor primero.
La pre-base movil ya esta paginada; su busqueda de candidatos es otro alcance.
El mapa previo de consumidores y requisitos esta en OPTIMIZATION_PLAN.md.
No limitar /stock global ni exportar/seleccionar solo las filas de una pagina.
Verificar siempre SHA del ultimo commit en public-status.
Actualizar checklist y evidencia en cada entrega; etapa 1 todavia en curso.
No abandonar el plan por una unica optimizacion ni confundir los pasos
operativos reales de abajo con autorizacion para ejecutar QA productivo.

1. Correccion del 504 de cierre entregada: recargar /admin/claims antes de
   reintentar Cerrar claim. El panel envia el ID exacto y recupera cierres ya
   confirmados si se pierde la respuesta, sin duplicar ni cerrar otro claim.
   No hubo cierre productivo de prueba. Si la respuesta sigue sin confirmar,
   actualizar Claims/Ordenes y revisar estado antes de repetir la accion.
   Antes de cerrar, abrir Claims > Compradores y premios: revisar ranking,
   empates y lista Sorteo (mas de 10000 ARS, incluyendo USD al cambio vigente).
   Completar precios/asignaciones por revisar antes de decidir premios.
   Revisar las 52 pendientes de Jugable con identidad exacta y comprobar primero
   el claim y sus compradores actuales. Las 77 ya aplicadas no se vuelven a
   cotizar ni sobrescribir por defecto. La regla 1540/500 fue puntual, no global.
2. Pilotear la tienda con operaciones reales: confirmar publicacion de productos
   fuera del claim, instrucciones publicas y configuracion elegida de solo retiro
   con reserva de 30 minutos. Habilitar pedidos solo desde admin cuando el
   operador este listo. No se verifico hoy si ya estan habilitados.
3. Completar referencias de carpetas reales y revisar clasificacion pendiente;
   conservar contenido, promos elegidas, estado No venta y valuacion sin duplicar.
4. Validar lotes, devoluciones, saldos y cupos de revendedores en trabajo real.
   Comprobantes/recepcion fisica y rendiciones por ventas seleccionadas siguen
   siendo desarrollo pendiente; no reinterpretar movimientos anteriores.
5. Pilotear Torneos con cuentas independientes, ingreso tardio, rondas manuales
   y bajas. Recuperar conflictos con Recargar datos, no reemplazar el estado.
6. Retomar la propuesta de agenda operativa de Inicio como siguiente mejora
   de producto a definir con el usuario. La primera etapa de consistencia visual
   ya se entrego; no confundir sugerencias de chat con funcionalidades terminadas.
7. Backlog posterior: rentabilidad neta con costos desconocidos visibles,
   ubicaciones/lista de preparacion/QR, ficha de cliente/listas de deseos,
   sincronizacion de vistas entre dispositivos y recuperacion de backups probada
   en entorno aislado. Pagos automaticos, envios y avisos automaticos son etapas
   separadas, no condiciones faltantes para reconstruir el checkout manual.

## Prioridades vigentes

### Compradores y premios antes del cierre

- Disponible en /admin/claims, sin exigir cerrar ni generar ordenes. Usa el
  claim completo guardado, no los filtros de la mesa ni campos sin guardar.
- Ranking descendente por total ARS equivalente; ARS/USD separados visibles.
  Empates comparten puesto y no se decide ganador automaticamente.
- Sorteo es estrictamente mayor que 10000 ARS. Copiar participantes incluye
  todos los elegibles una sola vez, aun si hay una busqueda activa.
- Frees y cartas ignoradas no suman. Si falta precio o hay compradores de mas
  por unidad, revisar el aviso provisional. Un importe conocido ya superior
  al minimo habilita participar aunque aun falten otros precios del comprador.
- La cotizacion puede cambiar el orden/ingreso de compras USD; ver la cotizacion
  mostrada al tomar la lista. No se congela ni guarda un sorteo o resultado.
  Asignar premios/frees y realizar el sorteo siguen siendo decisiones manuales.

### Usar el espacio independiente Torneos

- Abrir `/torneos` y crear una cuenta propia de Torneos. Crear un torneo real o importar
  un JSON guardado desde el programa de escritorio; la importación crea una copia.
- Guardar configuración, inscribir jugadores e iniciar Swiss. Cargar resultados
  por mesa y avanzar solo cuando esté completa la ronda. Bajas también durante rondas Swiss en curso: conservan mesa y resultado; no emparejan en la siguiente.
- Para ingresos tardíos, inscribir desde Jugadores. Participan desde la siguiente
  ronda o se agregan a la actual con Editar ronda actual a mano. Cargar ronda manual
  permite reconstruir una ronda jugada con sus mesas y resultados. Revisar el editor
  completo antes de guardar: reemplaza la ronda actual, no las anteriores.
- Al terminar Swiss, iniciar top cut si corresponde y registrar ganadores hasta
  la final. El campeón y el cuadro son independientes de las posiciones Swiss.
- Desde otra PC, ingresar con la misma cuenta de Torneos y abrir el torneo
  guardado. Pulsar Recargar datos antes de editar cambios de otra persona.
- Ante conflicto de versión o respuesta no confirmada, recargar y comprobar si
  la acción ya quedó aplicada antes de reenviar. No crear pruebas en producción.
- Detalles: `docs/new-platform/TOURNAMENTS.md`.

### Precios de Jugable del claim

- Recargar el claim del 12 de octubre: 77 de 129 entradas ya tienen precio final
  ARS de CoolStuff con cambio fijo 1540 y redondeo unitario superior a 500.
  Operacion puntual autorizada; no agrega un boton ni modifica precios centrales.
- Revisar las 52 restantes con su identidad exacta: 13 especiales (Prize Pack,
  Cosmos, estampados), 23 sin enlace confirmado, 10 sin expansion mapeada y
  6 por idioma/variante. No equivalen todas a productos inexistentes en CoolStuff:
  el buscador no devolvio contenido y no se reemplazaron por versiones normales.
  Plan con motivos, precios y enlaces en .work/claim-oct12-coolstuff.json;
  resultado aplicado en .work/claim-oct12-coolstuff-result.json. No versionar
  evidencia operativa ni volver a aplicar precios sobre compradores asignados.

### Imagenes de claims

- Claim del 12 de octubre reparado: las 243 faltantes ya tienen imagen y cargan
  en Chrome; recargar el panel. No hace falta volver a ejecutar una busqueda masiva
  sobre este claim. Las 359 cartas y sus valores/compradores/cantidades se conservaron.
- El respaldo para Slowpoke de 30th Celebration #16 ya fue verificado.
  Reintentar solo si aparece un nuevo fallo, no como reparacion pendiente de
  la tanda completada. Buscar imagenes usa el mismo flujo para el claim activo.
- Si no hay coincidencia exacta, usar Corregir imagen con URL directa de la foto,
  no una pagina PC bloqueada. No sustituir por otra expansion/idioma/estampado.
  Respaldo TCGdex automatico limitado a ingles; otros idiomas usan cache/storage
  o PC. No hacer escrituras de prueba sobre los claims reales.

### Tienda publica y separacion del admin

- Catalogo y busqueda en lista por defecto, sin exigir escribir primero.
  Al buscar, filas comparables y banner oculto;
  cantidad por condicion y lapiz admin por oferta. Grilla sigue seleccionable.
  Filtros de lista en dialogo, incluso en escritorio; eleccion de vista en URL.
- Mantener agrupado solo visual/exacto y IDs/precios/stock por condicion.
  Contador/paginacion siguen contando variantes, no cartas agrupadas; ofertas
  pueden quedar en paginas diferentes. No pedir datos privados para agrupar,
  ni inventar rating/rareza/ilustrador cuando no existan en catalogo publico.
- Pulido de movimiento entregado: entradas cortas, hover discreto, dialogos,
  carga y feedback del carrito. Mantener cartas compactas y dimensiones estables;
  no agregar efectos continuos al catalogo ni reordenar filas para animar.
- Respetar prefers-reduced-motion: estados de compra/carga siguen visibles
  aunque animaciones, transiciones y scroll suave esten desactivados. Probar
  ambos modos al extender tienda, teclado y 320 px incluidos.
- Precios desde tienda: si ya ingresaste como admin, abrir `/` con el mismo
  navegador; o usar Acceso admin (escudo) para ingresar con la cuenta existente.
  El lapiz junto a disponibilidad o dentro de detalle edita el precio central:
  ARS minimo 800/redondeo a 100 y USD al blue vigente, no una oferta independiente.
  Guardar actualiza catalogo y panel de otra pestana. Cualquier admin del negocio
  puede hacerlo; revendedores, duenos de stock y visitantes no tienen permiso.
- Si otro admin cambio el precio, Recargar precio antes de guardar. Si la respuesta
  quedo sin confirmar, Reintentar precio conserva el mismo valor esperado.
  No altera cantidad/reservas ni ordenes existentes. Mantener pruebas de escritura
  en bases temporales, nunca cambiar precios reales para verificar un deploy.
- Carrito y pedido Web con pago manual entregados. Abrir `/admin/configuracion`
  > Tienda y pedidos web: completar instrucciones PUBLICAS de pago y contacto,
  definir retiro/envio y plazo de reserva; activar Aceptar pedidos web y guardar.
  Empieza pausado. No cargar claves de API ni contrasenas en instrucciones.
  Recargar la tienda despues de cambiar la configuracion. Envio se coordina y
  cotiza aparte; no hay tarifa automatica ni costo incluido en el pedido.
- En `/admin/ordenes`, revisar los pedidos Web y sus datos de contacto/entrega.
  Confirmar pago solo ante un cobro real. Un pago parcial evita expiracion;
  despues completar el pago/embalaje/entrega con las acciones existentes.
  La fecha exacta de reserva Web es distinta del vencimiento por dia de claims.
  No fusionar ni editar cartas/asignar a revendedor en esta primera entrega.
- Expiracion solo de nuevas reservas Web sin pago: se procesa al consultar
  catalogo/stock/ordenes o confirmar otro pedido, no con un cron continuo.
  Cancela la orden y libera reserva, sin borrar registros ni tocar claims.
  Una carta con reserva Web activa no puede incorporarse a un claim abierto.
  Resolver su orden antes. Seguir excluyendo del catalogo los items del claim.
- Ante respuesta sin confirmar, reintentar el MISMO envio; la pestana conserva
  temporalmente los datos incluso al recargar. No iniciar otro pedido a mano.
  Reembolsos, cotizacion de envio, correo automatico y pagos automaticos siguen
  pendientes. Probar compras solo en base temporal, nunca pedidos ficticios reales.
- Densidad corregida: catalogo con imagenes completas y compactas, 5-6 cartas
  por fila en escritorio y dos en celular. Detalle mantiene una imagen grande.
  Conservar marcos estables y precios completos al sumar carrito/checkout;
  la paginacion sigue en 36 y no cambia la publicacion de los productos.
- Navegacion comercial: Singles, Sellado, Accesorios y Otros. Para ubicar un
  producto, usar Inventario > Detalles > Categorias: singles, sellado, accesorios
  u otros, manteniendo las etiquetas de trabajo que ya tenga. Elegir una sola
  categoria comercial; si hay varias contradictorias se agrupa en Otros.
  Carpetas van a Otros. Cartas reconocidas o con numero numerico van a Singles
  sin exigir etiquetar una por una. Sin evidencia se usa Otros, no se adivina
  Sellado/Accesorios por el nombre. Los tipos de cartas filtran dentro de Singles.
- Redisenio entregado: busqueda en encabezado, banner de marca, navegacion por
  productos y filtros laterales. En celular, Filtros abre un dialogo; Ver resultados
  lo cierra. Grilla/lista y chips para quitar filtros, sin cambiar inventario.
  Ver detalle es consulta; el boton de carrito es independiente. Sin cuenta obligatoria.
- La tienda ya usa la gama negra/carbon/roja del panel. Mantener esta identidad
  en futuras pantallas de carrito/checkout, sin oscurecer las imagenes reales.
- Separacion entregada: tienda en `/` y panel/login en `/admin`. Todas las
  secciones usan `/admin/...`; Configuracion es `/admin/configuracion`.
  Enlaces anteriores redirigen, y la app instalada inicia dentro de admin.
  Abrirla con internet para retirar la cache global anterior. Torneos y portal
  de revendedores mantienen sus propios espacios y accesos.
- Catalogo publico entregado en `/`, ahora con carrito y checkout manual. Para
  preparar la tienda, abrir `/admin/inventario`: Detalles > Publicar en tienda,
  o seleccionar items y Publicar/Ocultar de tienda. No publicar pruebas reales.
  Todo empieza oculto; solo administradores cambian la publicacion.
- Web habilitada indica permiso de publicacion, no visibilidad garantizada.
  Debe estar Disponible, tener unidades centrales libres y precio de venta ARS
  positivo. USD sin ARS, No venta, asignaciones, reservas y claim abierto quedan
  fuera. Una carpeta usa su precio de venta, no el valor de su contenido.
- Siguiente alcance: pagos automaticos, seguimiento y cotizacion de envio,
  despues de pilotear pedidos manuales. DTO publico ya excluye
  costos, propietarios, notas, compradores e identificadores externos.
- Estas protecciones ya estan implementadas: catalogo excluye items de claims
  abiertos; checkout valida precios/stock, reserva atomicamente, controla abuso
  y reintentos y libera nuevas reservas Web sin pago al vencer. Conservarlas
  al extender la tienda. No publicar la base completa ni probar compras reales.

### Consistencia visual y vistas operativas

- Correccion entregada: Stock abre fuera de la grilla; precios completos y
  disponibilidad central editable sin desbordes. Revisar con datos reales en
  ambas densidades, sin registrar cargas ficticias para probar.
- Primera entrega terminada en Inventario: vistas iniciales y personales,
  filtros activos, restauracion al recargar y barra compartida con el equipo
  de Revendedores. Revisar en movil sin confirmar operaciones ficticias.
- Las vistas personales son locales por negocio/usuario/navegador. Guardar
  una vista no registra stock, no habilita venta y no persiste el carrito.
- Segunda entrega terminada en Ordenes/Caja/Compras. Pilotear las vistas de
  tareas en Ordenes, busqueda/fecha/tipo en Caja y Ver mas items en Compras.
  Por entregar significa paid sin entregar; Con deuda incluye saldos USD.
  Preferencias de tablero y lista son independientes. Los filtros de Caja
  solo afectan movimientos, no sus resumenes generales. Fecha usa creacion
  para saldos/compras y completedAt (o creacion) para ventas cobradas.
- En Compras, filtrar/restablecer no borra el ingreso en preparacion. El
  borrador no se guarda en localStorage ni sobrevive a recargar la pagina.
  No registrar pagos, compras o entregas ficticias para probar en produccion.
- Proxima mejora a evaluar: vistas personales con nombre en estos sectores,
  aparte de la recuperacion automatica actual; no prometerlas ya disponibles.
- Evaluar sincronizacion de vistas entre dispositivos como etapa separada,
  con almacenamiento autenticado por negocio/usuario y migracion aditiva.

### Pilotear la nueva administracion de revendedores

- Abrir Revendedores y comparar mercaderia en mano, solicitudes y saldos con
  los datos reales, sin cargar operaciones ficticias. Buscar por nombre/email
  y revisar filtros de deuda, pendientes y disponibilidad limitada.
- Abrir una ficha, alternar las pestanas y revisar imagenes/variantes en
  Mercaderia. Incluir agotadas solo para consultar; no permite devolver cero.
- En Solicitudes, revisar las filas compactas: imagen, pedidas/disponibles,
  referencias y cantidad/precio central quedan agrupados. Aprobar individual
  mantiene asignacion inmediata; aprobar menos resuelve la solicitud completa.
  En celular, Rechazar/Aprobar de la barra actuan sobre la seleccion indicada.
- En la proxima entrega real, desplegar Asignar mercaderia y revisar el lote.
  Los borradores sobreviven a cambiar de pestana, no a recargar; cambiar de
  revendedor pide confirmar su descarte.
- Consultar Ventas y Cuenta corriente: ventas netas y rendiciones son registros
  existentes, no pagos imputados por venta. Usar Registrar rendicion solo ante
  un cobro real y revisar los movimientos si la respuesta no se confirma.
- Revisar cupo en Configuracion; el campo vacio conserva Sin limite.
  El precio de Detalles sigue modificando inventario central, no un precio propio.
- Siguiente etapa: comprobantes/historial de entregas y devoluciones, luego
  rendiciones por ventas seleccionadas y configuracion ampliada de perfiles.
  Estas requieren diseno financiero/backend adicional; no migrar datos actuales
  ni reinterpretar rendiciones anteriores automaticamente.

### Pilotear catalogo y lotes de revendedores

- Revisar `Mi stock` y `Stock global` con grilla/lista, variantes y filtros por tipo.
- Comprobar que una carta en mano pero reservada por una orden muestre menos
  vendibles, quede visible y no permita agregarse a la venta si tiene cero disponibles.
- Probar la accion Vender hasta el carrito, sin confirmar ventas ficticias reales.
- En la proxima entrega real, seleccionar cartas desde Stock global y revisar
  cantidades/totales antes de enviar el lote. Filtrar no elimina la seleccion.
- En Revendedores, aprobar solo las solicitudes a entregar; ajustar cantidades
  y precios previamente. Aprobar una cantidad menor resuelve esa linea, sin
  recrear el remanente como solicitud. Las lineas no elegidas siguen pendientes.
- Para entrega directa, buscar cada carta, Agregar al lote y confirmar el total
  una sola vez. Cambiar de revendedor limpia los borradores del destino anterior.
- Si falla una linea por cupo, reservas o permisos, no se aplica ninguna. Ante
  error de conexion, reintentar el mismo borrador sin recargar la pagina; la clave
  recupera el lote ya aplicado sin duplicarlo. No crear pruebas en produccion.
- Proximas mejoras a evaluar: seguimiento de entregas/devoluciones y rendiciones
  por ventas seleccionadas, conservando siempre prioridad del stock central.

### Revisar tipos de cartas

- En Inventario, usar `Mas filtros > Tipo de carta` para revisar Pokemon,
  Supporter, Item, Stadium, Tool y Energy. `Sin clasificar` significa que falta
  una referencia confiable, no que el sistema haya inferido que es una carta Item.
- Para una carta pendiente o una excepcion, elegir el tipo en Editar.
  `Automatico` elimina la correccion manual; agregar mas unidades no la borra.
- Las altas desde catalogo reutilizan sus atributos sin exigir cargar el tipo.
  Las importaciones y otros ingresos tambien reciben la clasificacion al leer stock.
- Revisar el filtro de tipo dentro de cada carpeta; el checklist ingles de 151
  cubre sus 368 entradas, mientras promos adicionales dependen del indice.
- Ampliar cobertura con referencias verificadas del catalogo, sin adivinar por
  nombres ni ejecutar pruebas que creen/reemplacen stock, ordenes o claims reales.

### Cargar carpetas reales

- Crear la carpeta `MASTER SET 151` desde `Agregar stock > Crear carpeta`,
  mantener `No venta` y abrir `Detalles > Contenido`.
- Aplicar la plantilla 151 inglesa, revisar las referencias sin vincular
  (incluidas energias) y agregar solamente las promos que contiene esa carpeta.
- Revisar la grilla en `Detalles > Contenido`, comparando numero y variante con
  la carpeta fisica. Los filtros `Sin vincular` y `Sin precio` indican datos de
  catalogo pendientes, no cartas fisicamente faltantes. Normal y reverse usan
  el mismo arte con etiquetas distintas. Vincular las energias/promos sin imagen.
- Cargar las otras carpetas con nombres y contenidos independientes.
- Comparar una muestra de precios con PriceCharting y comprobar que el valor
  cambie despues de la proxima sincronizacion del catalogo. Las pruebas del
  desarrollo se realizaron exclusivamente en bases temporales/locales aisladas.
- Comprobar `Valor stock` en Inicio y `Plata en cartas > Coleccion / no venta`
  en Caja: las carpetas deben sumar su contenido una sola vez, incluso sin precio
  de venta. Si el valor es parcial, completar referencias/precios pendientes.
- Si se decide vender una carpeta, fijar su precio de venta y cambiar el estado
  a `Disponible`. La carpeta completa representa una unidad; las cartas internas
  no se ofrecen como singles.

### Validar vencimientos, costos y pagos mixtos

- En la proxima orden y el proximo claim reales, sin crear datos ficticios,
  confirmar que ambos propongan vencimiento a 7 dias y que una fecha elegida
  manualmente se conserve.
- En Caja, completar una muestra pequena de cartas sin costo usando un porcentaje
  del precio de venta. Revisar el costo unitario, costo total y ganancia potencial
  antes de aplicar la herramienta sobre todo el inventario.
- Importar un CSV pequeno con `sku,costo,moneda`, incluyendo una fila ARS y otra
  USD. Confirmar que los SKU inexistentes se informen como omitidos y no alteren
  otras cartas.
- En una orden con total USD, registrar primero un pago parcial en dolares y luego
  otro en pesos. Verificar `Pagado`, `Resta`, Caja y el movimiento automático de
  columna sin marcarla como saldada antes de tiempo.
- Completar y, en un caso separado, fusionar ordenes duplicadas con pagos USD;
  confirmar que `amountPaidUsd` no se pierda y que la deuda final coincida.

Senal de exito: vencimientos y costos quedan trazables, y una cobranza combinada
ARS/USD nunca convierte, duplica ni descarta importes.

### Pilotear la PWA en celulares reales

- En Android, abrir `https://ultimoturno.app/admin`, pulsar `Instalar
  UltimoTurno` y confirmar que el icono abra la plataforma en pantalla completa.
- En iPhone, usar Safari > Compartir > Agregar a inicio y confirmar que conserva
  sesion y abre dentro del alcance de `ultimoturno.app`.
- Probar los accesos rapidos a Inventario, Cargar stock, Ordenes y Revendedores.
- Cortar temporalmente la conexion: la interfaz debe mostrar el estado offline,
  pero ninguna venta, reserva ni modificacion de stock debe confirmarse ni quedar
  encolada silenciosamente.
- Volver a conectarse y comprobar que el sector visible sincronice datos sin
  reinstalar la aplicacion.

Senal de exito: la app se instala con el icono correcto, usa la misma sesion y
datos de produccion, y nunca presenta una operacion offline como confirmada.

### Verificar asignacion directa y resumen de revendedores

- En Inventario, elegir una carta con unidades libres y usar `Asignar` desde la
  tarjeta y desde el detalle. Confirmar que permite elegir revendedor y cantidad
  sin cambiar de sector.
- Probar una carta completamente reservada por una orden: el control debe quedar
  deshabilitado y una peticion manual no debe poder consumir esa reserva.
- Crear una solicitud desde el portal y confirmar que Administracion muestre
  Venta, TCGplayer, PriceCharting y CoolStuff. Pulsar una referencia debe copiar
  su conversion ARS al precio a aprobar.
- En `Mercaderia en consignacion`, comprobar que las mismas cuatro referencias
  aparezcan en cada carta y que al pulsarlas completen su precio editable.
- Revisar en la lista lateral el valor asignado, saldo a rendir y ventas del mes
  de varios revendedores, incluyendo uno sin movimientos.

Senal de exito: la consignacion se inicia desde Inventario sin duplicar unidades,
las cuatro referencias permiten decidir el precio y el resumen lateral coincide
con el detalle de cada cuenta.

### Verificar estados unitarios de inventario

- Buscar una carta libre, una asignada a consignacion y una incluida en una
  orden pendiente. Las tarjetas deben mostrar respectivamente `Disponible`,
  `Asignada` y `Reservada`, combinando cantidades cuando un SKU tenga varios
  estados.
- Confirmar que una carta con una unidad reservada y cero libres siga visible
  en la vista inicial y que el carrito permanezca deshabilitado para esa unidad.
- Cobrar y cancelar ordenes asignadas a revendedores para verificar que la
  tenencia consignada se cierre o libere sin dejar unidades fantasma.

Senal de exito: el total fisico coincide con la suma de disponible, asignado y
reservado, y ninguna reserva pendiente se presenta como venta libre.

### Pilotear asignacion de ordenes a revendedores

- Abrir una orden pendiente, elegir un revendedor y pulsar `Asignar orden`.
- Confirmar que la orden muestre el nombre asignado y que todas sus cantidades
  aparezcan en `Mercaderia en consignacion` y en el inventario del portal.
- Verificar que el valor asignado y el cupo disponible se recalculen, y que una
  orden que supera el limite sea rechazada sin asignaciones parciales.
- La orden asignada conserva cobro, embalaje y entrega, pero ya no permite
  cambiar sus cartas porque la mercaderia fue entregada fisicamente.

Senal de exito: una sola accion traslada todo el contenido sin duplicar stock y
la orden identifica permanentemente al revendedor responsable.

### Verificar el proximo cierre de claim en produccion

- Pulsar `Cerrar claim` una sola vez y esperar el estado `Cerrando...`; el boton queda bloqueado hasta terminar.
- Confirmar que la vista navegue a Ordenes y que exista exactamente una orden pendiente por comprador.
- Verificar que las cartas existentes queden reservadas; si alguna no tiene disponibilidad, debe crear solo el faltante y reservarlo. Las cartas nuevas deben crear solo las unidades necesarias.
- Si la conexion se interrumpe, actualizar Claims antes de reintentar: el servidor protege el claim cerrado contra una segunda generacion de ordenes.

Senal de exito: el claim queda cerrado, las ordenes se exportan una sola vez y no aparece `Ya hay una transaccion manual activa`.

### Pilotear edicion de ordenes

- Abrir una orden pendiente desde el tablero y usar `Editar cartas` para sumar
  una carta disponible, cambiar cantidad y precio, y quitar una linea.
- Confirmar que los totales ARS/USD cambien al guardar y que Inventario refleje
  exactamente las nuevas cantidades reservadas.
- Probar una orden `A embalar`: al cambiar la cantidad de una carta debe quedar
  desmarcada como embalada. Las ordenes pagadas o entregadas deben permanecer
  de solo lectura.
- Con dos sesiones, intentar reservar la ultima unidad al mismo tiempo. Una
  operacion debe completarse y la otra informar que el stock cambio, sin dejar
  una orden ni reservas parciales.

Senal de exito: se corrige una orden sin cancelarla ni recrearla, los totales y
reservas coinciden y nunca se genera stock negativo o doble reserva.

### Pilotear usuarios con stock propio

- Confirmar el primer ingreso de Mayra, Seb y Melo como administradores y de
  German como propietario de stock; cambiar las claves temporales si se decide
  una politica distinta de acceso.
- Administradores y propietarios de stock ingresan por `/admin`; revendedores
  por `/portal-revendedor`, viendo solamente su portal. German debe ver solo
  `Cargar stock` y `Asignar a revendedores`; una cuenta administradora conserva
  el panel completo.
- Cargar una carta con German y asignarla a un revendedor. Intentar luego una
  asignacion de stock perteneciente a UltimoTurno: la API debe rechazarla.
- Escribir manualmente `/inventario`, `/ordenes` y `/admin` con la sesion de
  German. La interfaz debe volver a `/inventario/cargar-stock` y la API debe
  denegar operaciones fuera del alcance autorizado.
- Mantener separadas las nociones de propietario y revendedor consignado. No
  migrar asignaciones de consignacion a propiedad salvo decision operativa
  explicita.

Senal de exito: cada rol aterriza en su sector, German solo carga y consigna su
propio stock, y cualquier administrador puede intervenir sobre todo el sistema.

### Verificar reparacion prioritaria de imagenes

- Verificacion completada: la cola respondio en `1,7 s`, se encontraron `107`
  URLs y el faltante de stock bajo de `188` a `81`, sin errores de proceso.
- Revisar las `81` cartas restantes, principalmente ediciones japonesas,
  chinas o expansiones con nombres no equivalentes entre fuentes. Mejorar el
  mapeo de expansiones antes de bajar el umbral de confianza.
- Repetir la operacion tras ampliar esos aliases y comprobar que las entradas
  con URL existente no se vuelvan a procesar.

Senal de exito: `/pricecharting-images/queue-stock` responde en segundos y la
reparacion avanza sobre las cartas activas sin imagen, sin recorrer ni
reescribir todo el catalogo.

### 0. Medir la nueva ruta rapida en operacion real

- Probar inicio directo en `/inventario`, `/inventario/cargar-stock`,
  `/ordenes` y `/claims` desde escritorio y celular, incluyendo una sesion fria.
- Confirmar en la pestana Network que Cargar stock no solicita `/stock`,
  `/sales`, `/audit` ni `/mobile-intake/entries` durante el arranque.
- Registrar cualquier API que supere dos segundos con ruta, hora y accion; no
  volver a una carga global para ocultar datos faltantes.
- Vigilar errores de pool durante varias sesiones simultaneas. Las respuestas
  grandes deben conservar `Content-Encoding: gzip`.
- `/stock` ya revalida con `ETag`: una medicion productiva dio `200` en unos
  `933 ms` para la primera carga y `304` en unos `388 ms` y `0 bytes` para el
  siguiente ciclo sin cambios. Confirmar que varias sesiones mantengan esta
  conducta y no vuelvan a procesar el cuerpo completo.
- Si la primera apertura de Inventario sigue siendo lenta, el siguiente cambio
  grande es un listado paginado/resumido con detalles bajo demanda. No reducir
  la cache compartida de 15 segundos: evita que varias personas reconstruyan
  al mismo tiempo los mas de 2.000 SKUs.

Senal de exito: Cargar stock abre en menos de un segundo con conexion caliente,
las busquedas normales responden cerca de un segundo, las sincronizaciones sin
cambios reciben `304` y ninguna vista genera una rafaga de APIs ajenas al
sector.

### Activar y pilotear el planificador de claims

- Verificar visualmente en el proximo cierre real que las cartas existentes
  pasen a `Reservadas` sin aumentar el total en mano, y que las inexistentes
  creen solo la cantidad indicada por el claim.
- Confirmar al cobrar una de esas ordenes que la reserva vuelva a cero y la
  cantidad en mano baje exactamente por la cantidad vendida.
- Configurar `OPENAI_API_KEY` en Vercel para habilitar el asistente; no guardar
  la clave en Git ni exponerla al frontend.
- Crear un borrador real, sumar cartas manualmente y comprobar que el stock no
  cambia mientras permanece en planificacion.
- Probar una propuesta de IA y confirmar que solo se guarda al pulsar
  `Aplicar propuesta`.
- Publicar el borrador cuando no haya otro claim activo y confirmar cantidades,
  secciones, precios y stock sin duplicaciones.
- Recoger correcciones del operador para ajustar reglas de seleccion y futuros
  templates de claims.

Senal de exito: un claim completo se prepara en minutos, ninguna sugerencia se
aplica sola y publicar no crea unidades de inventario inexistentes.

### Activar precios CoolStuff

- Desplegar la API para aplicar `0038_coolstuff_price_cache.sql`.
- Configurar `ULTIMOTURNO_ACCESS_KEY` en el equipo que ejecutara el worker.
- Iniciar `Actualizar Precios CoolStuff.cmd` y dejarlo abierto, o ejecutar:

```powershell
npm run coolstuff:prices:daemon
```

- Para una tanda unica usar `npm run coolstuff:prices`; para validar sin guardar
  y con opciones usar
  `npx tsx tools/coolstuff-price-worker.ts --dry-run --batch=5`.
- No bajar `--delay-ms` de `10000`. El worker respeta el sitio publico y guarda
  progreso en Supabase para continuar despues de una interrupcion.
- Revisar `/api/coolstuff-prices/status` con la clave de acceso y confirmar que
  crezcan `matchedEntries` sin un aumento sostenido de `failedEntries`.
- Comparar manualmente una muestra por expansion, especialmente Reverse Foil,
  Cosmos, Poke Ball, Master Ball y 1st Edition.
- En `Inventario > Cargar stock`, elegir una carta ya relevada y confirmar que
  `Usar CoolStuff` copie el USD exacto y el ARS recomendado. Elegir despues una
  carta pendiente y comprobar que `Buscar` abra la consulta oficial sin
  bloquear ni demorar el formulario.
- No mover el scraping a Vercel ni al navegador: CoolStuff responde de forma
  inestable a consultas automatizadas. El worker externo llena la cache y la
  carga de stock solo hace una lectura exacta y rapida.

Senal de exito: el inventario muestra precio y enlace CoolStuff en las cartas
inglesas con stock, sin cruzar acabados y sin depender de mantener Vercel activo
durante el scraping.

### 1. Observar la sincronizacion sectorial en produccion

- Revisar visualmente las rutas principales en desktop y movil despues de la
  unificacion del chrome, especialmente `Mas`, Ordenes, Inventario y Claims,
  confirmando que ninguna barra tape contenido.
- Probar `/inventario/cargar-stock` en los telefonos que se usaran durante la
  carga real. Con el teclado abierto deben seguir visibles el campo, el boton de
  busqueda y al menos uno o dos resultados; la barra inferior del navegador no
  debe impedir seleccionar las ultimas cartas.
- Confirmar que idioma y moneda se puedan desplazar horizontalmente sin mover
  toda la pagina, y que tocar la lupa o la accion `Buscar` del teclado produzca
  el mismo resultado.
- Confirmar con dos sesiones reales que inventario, claims, ordenes, caja y el
  portal reflejen cambios dentro de los 15 segundos esperados.
- Durante una carga simultanea, dejar abierta
  `/inventario/cargar-stock`, escribir una busqueda y esperar al menos dos
  ciclos: el texto, los resultados y la posicion vertical deben permanecer
  estables.
- Medir consultas de nombre y nombre+numero con varias sesiones. Las busquedas
  repetidas dentro de 60 segundos deben aprovechar la cache de la API.
- Vigilar latencia y cantidad de consultas durante el uso diario.
- Mantener el refresco acotado al sector visible; no volver a descargar toda la
  aplicacion para actualizar una sola pantalla.
- Evaluar Supabase Realtime o eventos del servidor solo si los 15 segundos no
  alcanzan o si el sondeo genera una carga medible. El sondeo actual es simple,
  predecible y conserva el estado local de trabajo.
- Verificar que todas las rutas directas funcionen en Vercel despues de cada
  cambio de `vercel.json`.

Senal de exito: dos operadores ven las altas y cambios sin F5, sin perder lo
que estaban escribiendo y sin una recarga completa de la interfaz.

### 2. Pilotear revendedores en produccion

- Crear un revendedor de prueba con comision real y asignarle pocas cartas.
- Probar una venta central antes que la venta del revendedor para confirmar la
  prioridad de UltimoTurno online.
- Probar venta, anulacion, devolucion y rendicion con el piloto.
- Probar pedidos pendientes y su conversion a venta luego de una venta central.
- Validar con el piloto los estados de preparacion, entrega y pago de pedidos.
- Confirmar con los revendedores que el stock global de solo lectura muestra la
  informacion comercial necesaria sin exponer datos internos.
- Definir si el revendedor puede solicitar una anulacion o si queda solo en
  manos del administrador.
- Agregar cambio de password y edicion/baja de revendedores en la siguiente
  iteracion.
- Evaluar si los pedidos necesitan filtros/tablero por estado cuando el piloto
  acumule volumen real.

Senal de exito: el revendedor carga ventas desde su portal, el stock se descuenta
una sola vez y el saldo a rendir coincide con la comision acordada.

### 3. Completar cobertura de imagenes

- Dejar `Mejorar Calidad Imagenes Online.cmd` ejecutando por lotes.
- Confirmar despues del despliegue cuantas de las cartas de stock sin imagen se
  resolvieron reutilizando el catalogo y dejar el scraping solo para el remanente.
- Vigilar que nuevas altas hereden automaticamente imagenes equivalentes aunque
  el numero venga con ceros a la izquierda (`26` / `026`).
- Confirmar que las cartas reparadas manualmente conservan una URL publica
  `http/https` y no vuelven a `/pricecharting-images/files/...` despues de un
  nuevo despliegue de Vercel.
- Vigilar que bajen `stock-sin-img` y `claim-sin-img` sin aumentar errores.
- Mantener el backoff de fuentes `403/404/410`.
- Dividir o paginar `external-index` si los `504` de Vercel siguen impidiendo
  descubrir nuevas URLs.
- Medir por separado cobertura de catalogo, stock y claim; el catalogo completo
  puede crecer lentamente sin afectar la operacion diaria.

Senal de exito: claim activo y stock operativo sin imagenes rotas, daemon capaz
de continuar solo y cobertura de catalogo en crecimiento.

### 4. Validar CSV reales de scanner y MonPrice

- Probar archivos con nombres japoneses, BOM UTF-8, comas y comillas.
- Confirmar que `Generar vista previa` responde dentro del limite de Vercel.
- Mantener la regla: nada se escribe antes de `Confirmar e importar`.
- Probar el cargador CSV por seccion sobre el claim activo sin cancelarlo ni
  eliminarlo.

Senal de exito: el archivo escaneado genera preview, concilia las cartas y solo
las filas confirmadas llegan a la seccion elegida.

### 5. Seguir compactando Ordenes con datos intactos

- Revisar en auditoria los cierres `sale.complete_stock_reconciled`; indican
  ordenes cobradas cuya reserva habia quedado obsoleta por un reset de stock.
- Verificar el tablero en desktop y movil con volumen real.
- Si todavia falta espacio vertical, ocultar o colapsar la marca superior solo
  dentro de Ordenes.
- No cambiar estados, reservas ni queries de persistencia por una mejora visual.

Senal de exito: mas tarjetas visibles y acciones legibles sin modificar una sola
orden de produccion.

### 6. Robustecer tareas automaticas

- Despues del proximo despliegue, confirmar que las rutas de cron sin
  credenciales responden JSON `401` en vez del `404` de Vercel; eso valida que
  el rewrite llega a la API sin disparar una sincronizacion.
- Confirmar que el cron PriceCharting de las `09:00 UTC` y el de TCGplayer de
  las `09:30 UTC` dejan una corrida `completed` o `skipped` dentro de las 24
  horas siguientes.
- Revisar errores de pool de Supabase y mantener
  `ULTIMOTURNO_DATABASE_POOL_MAX=1`.
- Evitar tareas monoliticas que excedan los 60 segundos de Vercel; procesar en
  lotes reanudables e idempotentes.

### 7. Mejorar calidad de catalogo

- Usar `Calidad` como bandeja operativa y mantener las tareas de emergencia o
  diagnostico tecnico dentro de `Mas > Administracion`, sin volver a duplicar
  acciones en ambas pantallas.
- Resolver duplicados y variantes ambiguas.
- Priorizar imagenes visibles para cartas que existen en stock o claims.
- Mostrar claramente idioma, acabado y fuente de precio.
- Mantener PriceCharting y TCGCSV como referencias, no como inventario.
- Revisar manualmente las `227` cartas del inventario que siguen sin vinculo
  TCGplayer y los `10` conflictos ambiguos del backfill; no aprobar
  coincidencias debiles en lote.
- Confirmar que el cron diario de TCGplayer deja una corrida `completed` o
  `skipped` y que no excede el limite de ejecucion de Vercel.
- Generar primero la vista previa del reparador de precios con `Solo $800 y
  faltantes`, revisar una muestra y aplicar una tanda chica. Usar `Todos los
  desactualizados` solo despues de revisar cuantas cartas bajarian de precio.

## Prompt para iniciar otro chat

```text
Continuemos trabajando en UltimoTurno.

Usa exclusivamente el repo D:\UltimoTurno\Stock o tu worktree asignado de ese repo.
Antes de modificar nada lee AGENTS.md, docs/PROJECT_STATUS.md,
docs/NEXT_STEPS.md y docs/new-platform/HANDOFF_NEXT_ACCOUNT.md.

Revisa git status, git log -1 y
https://ultimoturno.app/api/public-status.
Base verificada el 2026-10-13 antes de la consolidacion documental: 9f267b8.
No asumir que ese SHA sigue siendo el ultimo; comparar Git y despliegue actuales.

Produccion tiene stock, ordenes y claims reales. No borrar, recrear ni hacer
escrituras de prueba. Nunca guardar secretos o datos de compradores en Git.
La tienda esta en /; el panel en /admin/...; Torneos en /torneos con cuenta propia.

Imagenes del claim reparadas el 12/10. Jugable: 77 de 129 precios CoolStuff
aplicados; 52 pendientes, sin reemplazos de edicion/idioma. Cambio puntual 1540
y redondeo unitario a 500. No volver a aplicar a compradores asignados.
No hay nuevo boton de cotizacion masiva ni cobros/envios automaticos.

Retomar el orden de continuidad de NEXT_STEPS.md. Separar entregado, operacion
puntual, propuesta y pendiente. Preservar los datos actuales, validar en base
aislada y hacer commit, push y PR al terminar cada cambio. Leer tambien
docs/AGENT_COLLABORATION.md: ramas/worktrees separados, hotspots coordinados y
merge solo humano. Verificacion online despues del merge contra el SHA de main.
```

---

## Archivo historico al 2026-09-11

Actualizado: 2026-09-11

Este archivo marca el orden recomendado para seguir. La idea es evitar gastar
tiempo repitiendo diagnosticos y atacar lo que mas destraba la plataforma.

## Prioridad 1 - confirmar deploy online

Objetivo: asegurar que online corre el mismo codigo que local.

1. Verificar `/api/health` online con access key.
2. Confirmar commit desplegado en Vercel.
3. Probar `/api/catalog-cards?q=lillie%27s%20determination&limit=10`.
4. Confirmar que el resultado viene desde `unified_catalog_cards` y no desde
   inventario.
5. Si aparecen filas `tcgcsv-*` como cartas principales, revisar deploy o SQL de
   la vista.

Senal de exito:

```text
Agregar stock busca en 120.710 cartas y trae muchas cartas reales del catalogo,
incluyendo cartas que nunca tuvieron stock.
```

## Prioridad 2 - imagenes online

Objetivo: que el selector y el inventario muestren imagenes online.

1. Consultar `/api/pricecharting-images/status`.
2. Consultar `/api/catalog-cards?q=pikachu&limit=5` y mirar `imageUrl`.
3. Si `imageUrl` apunta a `/pricecharting-images/files/...`, online no puede
   servirlo salvo que el archivo exista en el entorno de Vercel.
4. Preferir URLs publicas de Supabase Storage para online.
5. Ejecutar el uploader solo con variables de entorno, sin pegar claves en
   archivos versionados.

Comando base:

```powershell
npm run images:supabase:upload
```

Variables de entorno utiles:

```ini
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=ultimoturno-images
PRICECHARTING_IMAGE_DIR=D:\UltimoTurno\pricecharting-images
SUPABASE_UPLOAD_DRY_RUN=false
SUPABASE_UPDATE_IMAGE_URLS=true
SUPABASE_UPDATE_REFERENCED_ONLY=false
SUPABASE_CREATE_BUCKET=false
SUPABASE_PUBLIC_BUCKET=true
```

Senal de exito:

```text
/api/catalog-cards devuelve imageUrl publico de Supabase para una parte grande
del catalogo, y la UI deja de mostrar el placeholder PC.
```

## Prioridad 3 - busqueda de catalogo

Objetivo: que buscar sea rapido, completo y sin duplicados confusos.

Pendientes:

- Separar claramente carta base, acabado y fuente de precio.
- Evitar duplicados visuales cuando una fila TCG solo es referencia de imagen o
  precio.
- Mostrar `Reverse`, `Holo`, `Promo`, `Prize Pack`, `Stamped`, etc. como badges.
- Ordenar por coincidencia fuerte: nombre exacto, expansion, numero, precio,
  imagen.
- Mantener filtro de idioma visible y rapido.

Senal de exito:

```text
Buscar "Lillie's Determination" muestra varias ediciones correctas, con acabado
visible, precio PC/TCG separado, imagen si existe, y sin filas repetidas
inutiles.
```

## Prioridad 4 - carga de stock

Objetivo: cargar stock rapido sin tener que completar todo a mano.

Reglas actuales:

- Precio minimo: `800 ARS`.
- Valor recomendado: redondeado y nunca menor a `800 ARS`.
- ARS y USD se convierten entre si.
- El costo de compra es opcional.

Mejoras recomendadas:

- Boton `Usar recomendado` bien visible.
- Permitir elegir cantidad y guardar sin tocar precio si el recomendado sirve.
- Mantener opcion avanzada para ubicacion, graded y notas, pero que no frene la
  carga simple.
- Atajo para `Agregar stock y seguir` sin cerrar el modal.

Senal de exito:

```text
Se puede buscar carta, elegir variante, tocar cantidad, usar recomendado y
guardar en pocos segundos.
```

## Prioridad 5 - pool y errores 500

Objetivo: eliminar errores tipo `EMAXCONNSESSION`.

Revisar:

- `ULTIMOTURNO_DATABASE_POOL_MAX=1` en Vercel.
- `DATABASE_URL` usando pooler transaccional de Supabase, no session pooler.
- Que el backend no abra clientes extra por request.
- Que endpoints pesados no hagan muchas consultas paralelas.

Senal de exito:

```text
Ordenes, audit, stock y catalogo no muestran 500 por max clients.
```

## Prompt para un chat nuevo

Pegar esto al abrir otro chat:

```text
Estamos trabajando en UltimoTurno, workspace D:\UltimoTurno\Stock.

Antes de tocar codigo, lee:
- docs/PROJECT_STATUS.md
- docs/NEXT_STEPS.md
- docs/new-platform/HANDOFF_NEXT_ACCOUNT.md si necesitas contexto historico.

Objetivo actual: estabilizar online y local para que la plataforma funcione,
especialmente catalogo completo PriceCharting, imagenes online via Supabase,
busqueda por idioma, agregar stock, precios recomendados ARS/USD y errores de
pool en Vercel/Supabase.

No pegar secretos completos en archivos versionados. Usar variables de entorno.
La app online es https://ultimoturno.app/
```
