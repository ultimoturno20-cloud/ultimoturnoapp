# UltimoTurno - estado actual

Actualizado: 2026-10-09

> Esta seccion reemplaza el estado fechado 2026-09-11 que se conserva mas abajo
> como referencia historica.

## Resumen vigente

- Correccion de layout de Inventario: Stock abre un dialogo independiente,
  sin estirar las filas ni mover otras cartas. Mantiene carga y cambio de precio
  existentes, con foco contenido y cierre bloqueado mientras guarda.
- Precios ocupan una fila completa de la tarjeta; imagenes y columnas se adaptan
  al ancho. El editor de disponibilidad central ocupa todo el ancho del detalle,
  sin botones recortados ni estilos de celda sobre sus controles internos.
  La paginacion responde al cambio de ancho antes de abrir el editor.
- QA de esta correccion: Chrome en 1788/1440/1024/768/390/320 px y ambas
  densidades, posiciones de tarjetas estables y controles/precios contenidos;
  carga y precio simulados, 20 tests frontend, lint/tipos/build web correctos.
  Sin cambios de API/schema ni escrituras de prueba en produccion.

- Primera etapa de consistencia operativa: Inventario y equipo de Revendedores
  usan WorkspaceToolbar, con busqueda, orden y controles de altura uniforme.
  Inventario muestra filtros activos removibles y deja visibles exportar/reset.
- Inventario incorpora vistas En stock, Disponibles, Coleccion / no venta y
  Reservadas; permite guardar hasta 20 vistas personales, abrirlas, actualizar
  sus filtros y eliminarlas con confirmacion. No crea categorias ni cambia datos.
  Coleccion / no venta filtra el estado existente not_for_sale, no todas las carpetas.
- Busqueda, filtros, fuente de precio, orden y densidad se recuperan al recargar;
  la busqueda pendiente se conserva al salir hacia Cargar stock y volver.
  Preferencias locales por negocio/usuario, solo en ese navegador: no hay
  sincronizacion entre dispositivos, carrito persistido ni secretos nuevos.
  Accesos rapidos de venta/calidad limpian tambien filtros ocultos anteriores.
- Sin cambios de API/schema/stock/precios. Validacion completa check:new con
  127 tests; Chrome en 1788/1440/768/390/320 px verifica vistas, filtros, foco,
  navegacion y limites de controles sin mutaciones de inventario. Se continua
  la unificacion de Ordenes/Caja/Compras en entregas siguientes.

- Solicitudes de revendedores usa filas compactas con imagen de 72 px,
  variantes/disponibilidad, referencias, cantidad/precio y acciones agrupadas.
  Se retiro la grilla anterior de tres filas que estiraba precios y cortaba
  Aprobar y asignar. Ancho de lectura acotado y layout especifico para movil.
  Las imagenes priorizan el catalogo enriquecido y su fallback; sin imagen
  muestra un placeholder discreto. No cambia aprobacion, stock ni precios.

- Revendedores abre con una vista del equipo: busqueda, filtros por solicitudes,
  saldo, disponibilidad limitada y estado; orden por nombre, mercaderia, saldo
  o ventas del mes. Los totales separan valor en mano de deuda a rendir.
- Cada ficha tiene Resumen, Mercaderia, Solicitudes, Ventas, Cuenta corriente
  y Configuracion, con enlaces recuperables al recargar y navegacion Atras.
  Los propietarios conservan solo las vistas y acciones de consignacion.
- Mercaderia comparte el catalogo visual del portal, grilla/lista y filtros;
  muestra en mano/vendibles y permite incluir agotadas. La entrega por lote
  se despliega a pedido, sin ocupar permanentemente el sector.
- Alta, detalle, devolucion, rendicion y anulacion usan dialogos con validacion,
  foco contenido y bloqueo durante la operacion. Una respuesta no confirmada
  en pagos/devoluciones/anulaciones exige revisar movimientos antes de reenviar.
  El precio editable se identifica como central; no es un precio por revendedor.
- Cuenta corriente muestra ventas netas confirmadas y rendiciones existentes,
  sin asignar pagos historicos a ventas ni inventar saldos retroactivos. Ventas
  mensuales usan calendario de Buenos Aires. Cupo reutiliza el endpoint actual.
  Esta etapa no cambia esquema, endpoints ni reglas financieras/stock.
- Pendiente: comprobantes e historial agrupado de entregas/devoluciones,
  rendiciones aplicadas a ventas seleccionadas y edicion ampliada de perfiles.
  No se presentan estas mejoras futuras como funciones ya implementadas.

- Revendedores permite solicitar y asignar hasta 100 cartas por lote, con imagenes,
  cantidades editables, totales y revision previa. La seleccion del portal se
  conserva al filtrar; las entregas se arman en `Asignar stock > Agregar al lote`.
- Administracion permite aprobar/rechazar solicitudes seleccionadas y aprobar
  menos unidades que las pedidas. Una linea aprobada queda resuelta; el remanente
  no se vuelve a solicitar automaticamente. Las otras lineas siguen pendientes.
- Cada lote aplica todo o nada y controla reservas, asignaciones existentes,
  propietario, negocio y cupo acumulado. No descuenta stock ni reserva unidades.
  Los reintentos usan una clave persistida en `reseller_batch_receipts` y no
  repiten asignaciones; cambiar el contenido con la misma clave se rechaza.
  Las claves del borrador se conservan durante la sesion del componente, no
  sobreviven a recargar/cerrar la pagina. No hay reenvios automaticos offline.
- Migracion aditiva `0058_reseller_batches.sql`: crea solamente recibos de lote.
  No venta/inactivos permanecen en mano pero no vendibles; No venta se bloquea
  tambien en las operaciones individuales de solicitud, asignacion y venta.
  Pruebas locales cubren rollback, cupo, permisos, idempotencia y respuestas
  perdidas; Chrome verifica el recorrido completo en 1440/390/320 px.

- El portal de revendedores comparte catalogo visual en `Mi stock` y `Stock global`:
  grilla/lista, imagenes con fallback de catalogo, idioma, condicion, acabado y tipo.
  Ambas vistas filtran y ordenan cartas, con 48 entradas por tanda. Mi stock agrega
  filtro de disponibilidad y muestra por separado unidades en mano/vendibles.
  `Vender` suma al carrito existente sin confirmar una venta ni descontar stock.
  La lectura respeta el tipo manual del item y no expone costos ni datos de propietario.
  No hay migracion ni conversion de inventario para esta mejora visual.

- Inventario clasifica automaticamente cartas actuales y nuevas como Pokemon,
  Supporter, Item, Stadium, Tool o Energy a partir de atributos confiables del
  indice TCGplayer/TCGCSV. Sin referencia suficiente o con atributos contradictorios
  queda `Sin clasificar`; no se adivina por nombre, imagen ni acabado.
- La plantilla 151 inglesa tiene fallback al checklist exacto por expansion,
  nombre y numero (y clave para energias cosmos); clasifica las 368 entradas.
  No se aplica el numerado ingles a cartas japonesas ni a promos sin referencia.
- `Mas filtros > Tipo de carta` filtra singles del inventario, y `Contenido`
  incorpora filtro/etiqueta de tipo. Las carpetas completas no son cartas.
  Categoria, variante y estado de venta siguen separados del tipo.
- Agregar/editar stock permite mantener `Automatico` o elegir un tipo manual,
  incluido `Sin clasificar`. La correccion pertenece al item/propietario, se
  conserva al sumar unidades y se puede quitar desde edicion volviendo a Automatico.
- Migracion aditiva `0057_inventory_card_type.sql`: agrega una correccion nullable
  e invalida snapshots derivados. La clasificacion actual se resuelve en lectura,
  sin reescribir cantidades, precios, movimientos, ordenes ni claims existentes.

- Inventario permite crear carpetas como items unicos desde `Agregar stock > Crear carpeta`.
  Cada carpeta tiene SKU y producto propios, cantidad fisica maxima de uno,
  estado `No venta` inicial y precio de venta independiente de su valuacion.
- `Detalles > Contenido` permite buscar cartas/promos en PriceCharting, agregar,
  editar cantidades, vincular referencias pendientes y quitar entradas.
  El contenido no crea ni consume unidades de singles.
- El contenido abre como grilla de imagenes, con nombre, numero, variante,
  cantidad y valor. Incluye vista de lista y filtros de nombre/numero, variante,
  referencias sin vincular y precios pendientes. Todas las entradas son visibles
  sin paginacion, con carga diferida de imagenes.
- Las imagenes priorizan Supabase y el indice de cartas. La plantilla 151 usa
  el arte del checklist ingles para las 360 entradas numeradas, incluso si falta
  precio; normal y reverse se diferencian por etiqueta, no por el arte compartido.
  Energias y promos sin imagen de catalogo muestran `Sin imagen`, sin inventar
  referencias ni precios. El panel de contenido se adapta a escritorio y movil.
- La valuacion suma los ultimos precios sin graduar del cache PriceCharting;
  se convierte con el dolar vigente y suma una sola vez al valor total.
  Precios faltantes quedan visibles como valuacion parcial, con fecha de referencia.
- Inicio incluye `No venta` en `Valor stock`, ademas de stock libre/asignado,
  y muestra su importe por separado. Caja incluye la coleccion en `Plata en cartas`
  con desglose propio; conserva el reservado en su total fisico. Las carpetas se
  valuan por contenido al dolar vigente, no por su precio de venta manual.
  La ganancia potencial usa solamente venta/costo de items habilitados para venta,
  sin tratar coleccion como ganancia. Carpetas incompletamente valuadas muestran
  aviso con cantidad de cartas sin precio. El calculo tiene tests de frontend.
- La plantilla opcional `Master set 151 (EN)` carga 207 cartas numeradas,
  153 reverse y ocho energias cosmos holo. No incorpora promos automaticamente;
  las coincidencias ambiguas quedan sin vincular. La plantilla es idempotente.
- El contenido queda bloqueado mientras la carpeta esta reservada, consignada
  o vendida. Se conserva despues de la venta para consulta.
- Migracion aditiva: `0056_inventory_folders.sql`. No elimina ni convierte
  stock, ordenes, claims ni registros anteriores.

- Workspace obligatorio: `D:\UltimoTurno\Stock`.
- Produccion: `https://ultimoturno.app/` (alias tecnico: `https://ultimoturnoapp-api.vercel.app/`).
- Infraestructura: Vercel + Supabase/Postgres + Supabase Storage.
- Rama de despliegue: `main`.
- La rama `main` se despliega automaticamente y el estado productivo se
  verifica contra `/api/public-status` despues de cada cambio.
- El claim activo de produccion contiene datos reales: no eliminarlo, cancelarlo
  ni recrearlo durante verificaciones.
- Las ordenes tambien son datos reales. Las mejoras visuales recientes fueron
  solo de frontend y no modificaron la base de ordenes.

## Trabajo completado del 17 de septiembre al 7 de octubre

### Aplicacion movil instalable

- La plataforma productiva incorpora una PWA con manifest, iconos de
  UltimoTurno, modo standalone y accesos rapidos a Inventario, Cargar stock,
  Ordenes y Revendedores. Android/Chrome ofrece `Instalar UltimoTurno` y la app
  queda disponible desde la pantalla de inicio sin barra del navegador.
- El service worker guarda solamente la interfaz, el logo, los iconos y assets
  versionados. Las rutas `/api/*`, las imagenes operativas y todas las
  operaciones de stock, ventas y ordenes permanecen siempre online para evitar
  mostrar o escribir informacion comercial desactualizada.
- Si se pierde conexion, la interfaz puede abrir y muestra un aviso operativo;
  no intenta encolar ventas silenciosamente ni confirma acciones hasta recuperar
  internet.
- `mobile-app/` conserva una app Expo anterior conectada al HUB de Apps Script.
  Es material legado y no debe distribuirse como cliente de la plataforma
  Vercel/Supabase actual. La PWA es el cliente movil vigente de esta primera
  etapa.
- En pantallas de hasta 700 px, Ordenes usa un flujo movil dedicado: navegacion
  superior compacta, un selector para ver una sola columna/estado por vez,
  tarjetas de ancho completo sin scroll horizontal y detalle de orden a pantalla
  completa. El tablero de escritorio y su drag-and-drop no cambian.
- Revendedores tambien tiene una experiencia movil dedicada. Administracion usa
  un selector de persona, metricas horizontales y fichas compactas para
  solicitudes/asignaciones. El portal usa resumen y pestanas desplazables,
  catalogos de una columna y una barra fija que abre el carrito a pantalla
  completa; pedidos, ventas, stock propio y stock global conservan todos sus
  controles en formato tactil.
- Inicio, Inventario, Caja y Claims comparten una capa movil operativa: la
  navegacion permanece en una sola fila desplazable, las metricas se consultan
  como tiras horizontales, los formularios priorizan controles tactiles y las
  cartas/filas se compactan sin ocultar acciones ni informacion comercial.

### Costos, vencimientos y pagos en dos monedas

- Las ordenes nuevas y los claims nuevos usan por defecto una fecha limite de
  pago a 7 dias. La fecha sigue siendo editable y la migracion
  `0052_default_payment_due.sql` completo las ordenes abiertas que no tenian
  vencimiento, respetando la zona horaria de Buenos Aires.
- Caja incorpora una herramienta administrativa para completar costos faltantes
  como porcentaje del precio de venta o importarlos con filas
  `sku,costo,moneda`. Acepta ARS y USD, actualiza solo el negocio autenticado y
  registra la operacion en auditoria.
- Los resumenes financieros usan el costo cargado por carta o, si existe, el
  costo de la ultima compra. Tambien muestran costo total y ganancia potencial;
  la exportacion de Inventario incluye `purchaseCost` y `purchaseCurrency`.
- Las ordenes mixtas o expresadas en USD admiten pagos parciales separados en
  ARS y USD. La deuda restante, los indicadores del tablero, el pago completo y
  la fusion de ordenes duplicadas conservan ambos importes sin convertirlos ni
  perderlos.
- La base productiva confirmada para estas funciones es `3b06aa7`. Las
  migraciones mas recientes son `0052_default_payment_due.sql` y
  `0053_sale_amount_paid_usd.sql`.

### Acceso del portal de revendedores

- Los assets del frontend se publican con rutas absolutas desde la raiz. Antes,
  Vite generaba `./assets/...`: al abrir `/portal-revendedor/venta` el navegador
  intentaba cargar `/portal-revendedor/assets/...`, recibia `index.html` por la
  regla SPA y bloqueaba el modulo por MIME, dejando la pagina en blanco.
- `/inicio` y todas las rutas anidadas del portal comparten ahora los mismos
  archivos `/assets/...`, sin depender de la profundidad de la URL.
- `Stock global` replica los filtros utiles del inventario administrativo sin
  exponer datos operativos internos: busqueda, orden por nombre, expansion,
  numero, precio o cantidad, grupo de idioma y filtros por expansion, idioma,
  condicion, acabado y categoria. La vista renderiza 48 cartas por tanda para
  mantenerse fluida aun con catalogos grandes.
- Desde `Stock global`, cada revendedor puede pedir una cantidad para recibirla
  en consignacion. Repetir el pedido sobre la misma carta actualiza la solicitud
  pendiente y no reserva ni descuenta inventario.
- Administracion muestra las solicitudes pendientes dentro de cada revendedor.
  Antes de aprobar puede comparar Venta, TCGplayer, PriceCharting y CoolStuff,
  usar cualquiera de esas referencias como precio ARS, y corregir cantidad o
  importe. La aprobacion actualiza el precio global y crea la asignacion en una
  sola transaccion. Tambien puede rechazar el pedido sin modificar stock.
- La lista administrativa de revendedores muestra por persona el valor de la
  mercaderia asignada, el saldo a rendir y las ventas brutas confirmadas del mes,
  ademas de destacar solicitudes pendientes sin tener que abrir cada perfil.
- Cada revendedor admite un limite de mercaderia en ARS. El capital asignado se
  calcula con las unidades que aun conserva por el precio actual; las solicitudes
  pendientes tambien consumen cupo. Al vender o devolver unidades el cupo se
  libera automaticamente, y nuevas solicitudes o asignaciones que superen el
  limite quedan bloqueadas. Un limite vacio mantiene el perfil sin tope.
- `Mercaderia en consignacion` muestra el precio ARS de cada carta asignada y
  permite compararlo con Venta, TCGplayer, PriceCharting y CoolStuff. Al tocar
  una referencia se completa el precio editable de la misma fila; al guardarlo
  se actualiza el precio real usado por el portal, el valor asignado y el cupo
  disponible del revendedor.
- Inventario permite iniciar una asignacion desde cada tarjeta o desde su panel
  de detalle: se elige revendedor y cantidad sin navegar a otra pantalla. Solo
  admite unidades realmente libres; las reservadas por ordenes quedan excluidas
  tanto en la interfaz como en la validacion transaccional del servidor.
- Las ordenes pendientes o a embalar pueden asignarse completas a un
  revendedor desde su detalle. Todas las cantidades pasan juntas a su
  inventario en consignacion, respetando stock fisico y limite de mercaderia;
  la operacion es idempotente, la orden muestra a quien fue entregada y sus
  lineas quedan bloqueadas para evitar diferencias posteriores.

### Dominio productivo

- `ultimoturno.app` esta registrado en la cuenta `ultimoturno20-cloud`, usa los nameservers de Vercel y quedo asociado al proyecto `ultimoturnoapp-api`.
- La raiz, las rutas directas, el portal de revendedores y `/api/*` se sirven desde el mismo dominio con HTTPS. La URL `vercel.app` queda disponible solo como alias tecnico de respaldo.
- Los workers de CoolStuff, reparacion de imagenes y restauracion de stock usan `https://ultimoturno.app/api` como valor predeterminado.
- La API acepta automaticamente peticiones HTTPS cuyo `Origin` coincide con el host servido. Esto habilita `PUT` y `POST` desde el dominio personalizado sin abrir CORS a terceros; la preflight y una ruta protegida se verificaron online con respuestas `204` y `200`.

### Rendimiento y densidad visual

- `/stock` ahora responde con `ETag` y el frontend revalida la copia ya cargada.
  Si no hubo cambios, la sincronizacion de 15 segundos recibe `304` sin volver
  a transferir ni parsear los aproximadamente 3 MB de inventario.
- Inventario monta inicialmente 24 tarjetas en escritorio y 16 en movil, y
  continua por bloques al acercarse al final. Las tarjetas fuera de pantalla
  usan `content-visibility`, reduciendo trabajo de layout y pintura.
- El propietario deja de repetirse en las mas de mil tarjetas de UltimoTurno;
  la etiqueta de propiedad aparece solo para stock realmente separado de otra
  persona.
- El listado de usuarios y los datos del sector visible se solicitan en
  paralelo despues de autenticar, eliminando una espera serial del arranque.
- Medicion productiva del 2026-09-28: la primera lectura de `/stock` respondio
  `200` en aproximadamente `933 ms`; la siguiente revalidacion respondio `304`
  en aproximadamente `388 ms`, con cuerpo de `0 bytes`. Antes, cada ciclo
  transferia y parseaba nuevamente unos `2.983.114 bytes` descomprimidos.
- Verificacion integral posterior: `55/55` pruebas aprobadas, ademas de
  `typecheck`, `lint` y build de produccion.

### Usuarios con stock propio

- El inventario ahora admite propietario por unidad/SKU. El stock historico y
  las cargas sin propietario siguen perteneciendo a `UltimoTurno`; no se
  mezclan con el stock de usuarios externos aunque sea la misma carta y
  variante.
- Se agrego el rol `stock_owner`. Ese usuario inicia sesion en el panel
  operativo y dispone solo de `Cargar stock` y `Asignar a revendedores`. Las
  nuevas unidades quedan a su nombre y solo puede consignar existencias de su
  propiedad; no puede vender, editar inventario, operar caja ni administrar
  usuarios.
- Los administradores ven y venden todo el inventario. Al cargar stock pueden
  elegir `UltimoTurno` o uno de los propietarios, y en Inventario pueden filtrar
  y reconocer cada tarjeta por propietario.
- Administracion incorpora `Usuarios y propietarios` para crear cuentas de tipo
  administrador o stock propio. La clave general continua disponible como
  acceso de contingencia.
- La API aplica el aislamiento aun si se intenta usar una URL manual: limita las
  rutas del propietario, valida propiedad al editar/vender y guarda el
  propietario original en cada linea de venta.
- El flujo es independiente del portal de revendedores en consignacion. Las
  asignaciones de consignacion siguen compartiendo disponibilidad central;
  `stock_owner` representa mercaderia realmente separada por dueño.
- Cuentas productivas creadas y verificadas: Mayra, Seb Admin y Melo con rol
  `admin`; German con rol `stock_owner`. Seb Admin usa una cuenta separada para
  conservar intacta la cuenta previa `Seb` del portal de revendedores.
- La interfaz web exige sesion individual por email y password. La antigua clave
  general ya no se guarda ni se acepta como cookie del navegador; permanece
  disponible solo como encabezado tecnico para workers e integraciones.
- `/inicio` es el ingreso comun para todos los perfiles. Un revendedor es enviado
  directamente a su portal y no puede usar el panel operativo; un `stock_owner`
  es enviado a carga de stock; un administrador conserva acceso completo.
- La administracion de consignacion tiene un modo limitado para `stock_owner`:
  permite elegir un revendedor, buscar entre el stock propio y asignar unidades,
  pero oculta alta de cuentas, devoluciones, ventas, anulaciones y rendiciones.
- La API replica esas restricciones aunque se escriba una URL o se invoque un
  endpoint manualmente. La asignacion valida tambien el propietario de la carta.

- El carrito movil ahora ocupa la pantalla disponible, mantiene totales y confirmacion accesibles, desplaza solo la lista de cartas y agrupa las herramientas de exportacion en un desplegable compacto.
- Las cantidades del carrito se editan con botones menos/mas o escritura directa. Los campos aceptan quedar vacios mientras se reemplaza el valor, seleccionan el contenido al enfocarse y ya no fuerzan prefijos como `01` o `013`; el cierre de venta elimina totales y avisos duplicados.
- La edicion manual de cartas del claim usa la API transaccional aislada del driver. Cambiar precio, comprador, cantidad o tags en paralelo ya no abre un `BEGIN/COMMIT` manual compartido ni devuelve `Ya hay una transaccion manual activa`.
- La carga de stock consulta automaticamente el precio CoolStuff exacto por carta, condicion y acabado. Cuando existe en la cache muestra USD, conversion recomendada a ARS y permite aplicarlo sin reescribir valores; cuando aun no fue relevado ofrece la busqueda oficial ya completada. La consulta esta habilitada tambien para usuarios `stock_owner`.
- Las ordenes pendientes o a embalar permiten editar sus cartas desde el mismo detalle: agregar stock disponible, quitar lineas, cambiar cantidades y precios ARS/USD o marcar una carta gratis. El servidor recalcula totales y reservas en una unica transaccion, bloquea ediciones de ventas ya pagadas y evita que dos operaciones tomen la misma ultima unidad.
- Ordenes permite ordenar cada columna del tablero y la vista de lista por mayor/menor importe o por mayor/menor cantidad de cartas. El importe combina ARS con los USD convertidos al blue vigente y el orden es solo visual: no reescribe la posicion manual de las tarjetas.
- `Cerrar claim` sincroniza stock, crea las ordenes, reserva sus cartas y marca el claim cerrado dentro de una unica transaccion aislada. El servidor bloquea el claim durante el cierre para impedir ordenes duplicadas y la interfaz deshabilita el boton con estado `Cerrando...` mientras espera la respuesta.
- Si una carta del claim ya existe pero no tiene disponibilidad suficiente al cerrar, el sistema usa primero las unidades libres y crea automaticamente solo el faltante sobre el mismo SKU antes de reservarlo. El ingreso queda registrado como movimiento `claim_stock_in`; el cierre ya no falla por stock agotado.

### Navegacion y sincronizacion

- El arranque ya no descarga toda la plataforma. Antes esperaba unas 18 APIs
  globales, incluyendo stock, ventas, compras, auditoria, herramientas de
  calidad y hasta 20.000 capturas moviles aunque esa pantalla no las usara.
  Ahora autentica y carga solo los datos de la URL visible; cada sector se
  obtiene al entrar y mantiene su sincronizacion independiente.
- Las navegaciones nuevas disparan su consulta inmediatamente y las solicitudes
  concurrentes se deduplican por sector. Una operacion ya no ejecuta el refresh
  global: actualiza solamente la vista activa.
- `Cargar stock` no descarga el inventario completo ni consulta el conteo caro
  del catalogo al iniciar. El contador muestra `Catalogo completo` hasta tener
  un total disponible sin bloquear; la busqueda consulta directamente el
  endpoint indexado.
- La API serializa JSON compacto y comprime con gzip las respuestas mayores a
  1 KB. En produccion, `/stock` bajo de `2.510.223` bytes compactos sin
  compresion a `344.611` bytes transferidos con gzip, cerca de 86% menos.
- Medicion productiva previa al cambio: `/stock` entregaba aproximadamente
  3,5 MB de JSON indentado; `/catalog-cards?q=pikachu` rondaba 1 segundo y el
  contador `/pricecharting-cache/status` llego a 6,5 segundos. El contador fue
  retirado del camino critico. Commit funcional: `a2b98c3`; ajuste final de
  arranque: `08a2e0c`.
- Se unifico el sistema visual global: cabecera, navegacion y barra operativa
  permanecen en el flujo normal para no superponerse; `Mas` despliega una
  franja que empuja el contenido y se cierra al navegar. Paneles, botones,
  campos y toolbars comparten radios, alturas y espaciado, con una grilla
  estable en movil.
- Cada sector principal tiene una URL propia y navegable: `/inicio`,
  `/inventario`, `/inventario/cargar-stock`, `/claims`, `/claims/en-vivo`,
  `/ordenes`, `/caja`, `/compras`, `/calidad`, `/movimientos`, `/importar`,
  `/carga-movil`, `/revendedores` y `/admin`.
- El portal de revendedores tambien tiene URLs por sector:
  `/portal-revendedor/venta`, `/portal-revendedor/pedidos`,
  `/portal-revendedor/stock`, `/portal-revendedor/stock-global` y
  `/portal-revendedor/ventas`.
- La navegacion usa el historial del navegador sin recargar toda la aplicacion;
  atras, adelante y abrir un enlace en otra pestana funcionan como se espera.
- El sector visible se sincroniza automaticamente cada 15 segundos y al volver
  a enfocar la ventana. Solo consulta los datos necesarios para esa pantalla y
  conserva formularios, carrito, filtros y posicion de scroll.
- `Actualizar sector` reemplaza la recarga global manual. El indicador
  `En vivo` / `Sincronizando` informa el estado sin bloquear la operacion.
- El portal de revendedores sincroniza su panel cada 15 segundos sin vaciar el
  carrito ni cambiar la pestana activa.
- Verificacion local: una carga externa de 5 cartas aparecio sola en Inventario
  durante el siguiente ciclo, sin recargar la pagina; rutas directas, historial,
  desktop, movil y consola del navegador verificados.

### Automatizaciones y alertas

- Se agregaron rewrites explicitos para `/api/cron/*` y
  `/api/database-quality/*`. Sin esas reglas Vercel devolvia su `404` antes de
  que las rutas anidadas llegaran al servidor, por lo que los cron diarios no
  estaban ejecutando PriceCharting ni TCGplayer.
- La aplicacion muestra una alerta global cuando la ultima corrida de alguna
  fuente fallo, nunca existio o tiene mas de 24 horas.
- La alerta ya no confunde estados aun no cargados por la navegacion sectorial
  con fuentes nunca ejecutadas. Administracion carga sus ocho indicadores en
  tandas acotadas y conserva cada resultado exitoso aunque otro endpoint falle,
  mostrando un aviso puntual para la fuente que no respondio.
- `Mas > Administracion` muestra por fuente la programacion, ultima ejecucion,
  duracion real, resultado y error persistido. Los reintentos quedan bloqueados
  mientras estan corriendo; TCGplayer consulta primero la version de TCGCSV y
  salta la descarga completa cuando no hubo cambios.
- Las corridas nuevas guardan `started_at` y `completed_at` reales, incluyendo
  fallos, para que el diagnostico no dependa del estado efimero de una funcion
  serverless.

### Claims, catalogo y stock

- Las cartas agregadas a un claim reutilizan el SKU existente sin aumentar
  `quantity_on_hand`. Solo se crea stock cuando la carta/variante realmente no
  existia en inventario.
- Al cerrar el claim, cada linea vendida pasa a una orden pendiente y aumenta
  `quantity_reserved`; la unidad sigue en mano pero deja de estar disponible.
  Al cobrar la orden, baja `quantity_on_hand`, se libera la reserva y la venta
  queda pagada.
- Se corrigio la clasificacion historica `claim_added` que habia sumado stock
  sobre SKUs existentes. La reconciliacion productiva del claim del 27 de
  septiembre reviso 242 tarjetas y retiro 185 unidades duplicadas de 108
  tarjetas. Una segunda ejecucion devolvio 0 correcciones, confirmando que es
  idempotente.
- Agregar una carta al claim sincroniza solamente las tarjetas tocadas, no las
  242 tarjetas del claim completo. La reparacion masiva usa operaciones por
  lote y termino en produccion en aproximadamente `1,4 s`.
- Inventario muestra un acceso permanente al carrito mediante un icono con
  contador en la barra superior. La apertura solicitada por `Cobrar ahora` se
  consume una sola vez, por lo que volver a Inventario ya no reabre el panel.
- El carrito muestra totales ARS y USD en el encabezado. Permite incluir u
  ocultar precios y copiar la lista, copiar una grilla PNG, descargar CSV o
  descargar una o varias grillas PNG con las cartas agregadas. La grilla ajusta
  sus columnas y filas a las cartas presentes, sin exportar el lienzo 5x6 vacio.
- Las grillas de carrito y claims prueban la URL preparada por la API y luego la
  fuente publica original. Esto evita perder imagenes alojadas en Supabase y
  evita volver a proxificar una URL que ya paso por `/image-proxy`.
- La exportacion tambien enruta por el proxy propio las imagenes publicas del
  Storage de Supabase y Scrydex. Corrige los espacios vacios que aparecian en la
  grilla aunque Ethan's Ho-Oh ex, Mega Starmie ex y Wellspring Mask Ogerpon ex
  se vieran correctamente dentro del claim.
- Inventario abre por defecto mostrando cartas con stock. Disponibilidad,
  idioma y fuente de precio quedan siempre accesibles en una franja compacta;
  expansion, condicion, lote, ubicacion, estado, categoria y calidad se agrupan
  en un panel avanzado corto, sin desplegar el bloque alto anterior.
- Cada SKU muestra ahora un desglose no superpuesto por unidad: `Disponible`
  para mercaderia libre, `Asignada` para consignacion y `Reservada` para ordenes
  pendientes de cobro o entrega. La vista inicial incluye todo el stock fisico,
  aunque su disponibilidad libre sea cero, y una busqueda por nombre tambien
  encuentra SKUs agotados. Las asignaciones hechas desde una orden cuentan como
  reservadas hasta cobrarla; al cobrar salen de la tenencia del revendedor y al
  cancelar se liberan automaticamente.
- Cada tarjeta de Inventario sin imagen muestra `Reparar imagen` como una accion
  propia debajo de Stock, Detalles y Carrito. No depende de overlays ni de abrir
  el editor completo, y actualiza la tarjeta cuando encuentra una fuente valida.
- `Resolver stock primero` ya no cruza todo el catalogo PriceCharting mediante
  condiciones `OR`. La cola parte solo del stock activo sin imagen, resuelve
  primero por el identificador PriceCharting indexado y usa
  nombre/expansion/numero como respaldo. Tampoco reescribe entradas que ya
  tienen una URL descubierta o descargada. Esto corrige el timeout de Postgres
  en `/pricecharting-images/external-index` antes de iniciar la reparacion.
- La regresion de cola de imagenes quedo cubierta por la suite: vinculacion
  directa, coincidencia de catalogo con numeros normalizados, exclusion de
  cartas con imagen y conservacion de URLs ya resueltas.
- El indice masivo externo usa `/tmp/ultimoturno-external-image-index.json` en
  Vercel (o `EXTERNAL_IMAGE_INDEX_PATH` si se configura). Ya no intenta escribir
  dentro de `/var/task`, que es de solo lectura en funciones serverless.
- Verificacion productiva del 26 de septiembre: la cola prioritaria respondio
  en `1,7 s` y encolo las `188` cartas de stock sin imagen. El indice externo
  proceso `300` pendientes en `126,6 s`, encontro `107` URLs confiables y no
  registro fallos. El stock sin imagen bajo de `188` a `81`; las restantes se
  conservaron pendientes porque no hubo coincidencia fuerte.
- La pantalla `Calidad` se simplifico para el trabajo diario: conserva las
  metricas y la bandeja de revision, pero muestra solo `Sincronizar fuentes` y
  `Reparar imagenes prioritarias`. La sincronizacion ejecuta PriceCharting,
  indice maestro y TCGplayer en orden; los controles tecnicos duplicados quedan
  centralizados en `Mas > Administracion`.
- Se agrego `/claims/planificar`, un workspace separado para preparar multiples
  borradores sin modificar ni reservar stock. Incluye selector masivo desde
  inventario disponible, cantidades, secciones, precios, tags y publicacion
  transaccional como claim activo.
- Los planes usan stock existente y no vuelven a ingresarlo al inventario al
  publicarse. La disponibilidad se revalida antes de publicar y UltimoTurno
  conserva prioridad mientras el plan siga en borrador.
- El asistente opcional convierte una instruccion en una estrategia estructurada
  y luego selecciona las cartas localmente. Solo la instruccion escrita se envia
  a OpenAI; nombres, precios, cantidades y tags del inventario no salen de la
  plataforma. Requiere `OPENAI_API_KEY`; el modelo es configurable mediante
  `OPENAI_CLAIM_MODEL` y por defecto usa `gpt-4o-mini`.
- Migracion nueva: `0036_claim_planner.sql`.
- El buscador de cartas del claim se movio arriba de la mesa para evitar bajar
  hasta el final de la pagina.
- El claim agrupa cantidades: una carta con varias unidades mantiene una sola
  imagen y el mensaje final aclara `hay N`.
- La busqueda del claim permite filtrar ingles, japones y chino, y prioriza
  resultados que ya existen en stock.
- Las cartas agregadas a un claim entran al ciclo de stock; una venta confirmada
  descuenta la unidad correspondiente.
- La carga de stock paso a una pagina completa. `Agregar stock y seguir` queda
  en el flujo nuevo y ya no vuelve a abrir el modal anterior.
- La accion rapida de Inventario separa `Actualizar precio` de `Agregar stock`:
  editar el valor de venta conserva la cantidad existente y no genera unidades.
- La busqueda interactiva del catalogo se optimizo y dejo de recalcular el total
  completo en cada consulta.
- La carga masiva de stock conserva sus resultados y posicion durante la
  sincronizacion sectorial: actualizar `allItems` ya no reinicia el buscador ni
  contrae la grilla, evitando el salto de scroll cada 15 segundos.
- Las coincidencias del inventario aparecen inmediatamente y permanecen
  visibles mientras llega el catalogo completo. El debounce bajo a `100 ms`.
- La consulta de catalogo usa GIN para prefijos y un indice funcional para el
  numero principal de carta; se eliminaron comparaciones `%texto%` redundantes.
  Busquedas como `psy 44/62` se normalizan a `44` sin perder precision.
- La API conserva durante 60 segundos hasta 400 busquedas recientes, útil para
  varias personas cargando las mismas expansiones al mismo tiempo.
- En `/inventario/cargar-stock` se ocultan temporalmente la alerta automatica y
  la barra operativa, la cabecera es compacta y la grilla usa todo el ancho.
- En pantallas de hasta `620 px`, la carga de stock usa un workspace movil
  especifico: oculta la cabecera y navegacion globales, reduce el encabezado a
  una linea, mantiene idioma y moneda en una franja horizontal y coloca el
  boton de busqueda junto al campo en vez de apilarlo debajo.
- Los resultados moviles usan filas compactas con imagen, identidad y precios;
  su alto responde al viewport dinamico y reserva espacio inferior para que el
  teclado y la barra del navegador no tapen las ultimas cartas. El campo usa la
  accion `search` del teclado movil y no permite autocompletado del navegador.
- La mejora movil se valido con lint, typecheck y build. El commit `ad609e5` se
  desplego en Vercel y produccion entrego el CSS nuevo; `/api/public-status`
  confirmo PostgreSQL accesible.
- Migracion nueva: `0039_catalog_search_number_index.sql`.
- La carga de stock muestra coincidencias del inventario de inmediato, reduce el
  debounce a `180 ms` y usa un indice GIN de texto completo para evitar escanear
  las mas de 120 mil cartas en cada busqueda (`0037_fast_catalog_search.sql`).
- Se normalizo el tamano visual de cartas y se agregaron fallbacks seguros para
  imagenes publicas de TCGPlayer/CDN mediante proxy cuando hace falta.
- `Forzar imagen` en Inventario ya no guarda rutas efimeras como
  `/pricecharting-images/files/...`: conserva la fuente publica remota que
  funciona entre ejecuciones de Vercel. Volver a forzar una carta afectada
  reemplaza la ruta local rota por su URL durable.

### Precios TCGplayer

- La fuente de precios es TCGCSV, sin depender de credenciales de la API oficial
  de TCGplayer. El cache guarda low, mid, high, market y direct low por producto
  y acabado.
- Al iniciar la mejora habia `45.464` precios para `31.480` productos, pero solo
  `26` de las `1.347` cartas del inventario resolvian un producto TCGplayer. El
  problema era de vinculacion, no de descarga.
- El matcher ahora prioriza fichas PriceCharting reales sobre filas sinteticas
  TCGCSV cuando ambas tienen la misma coincidencia.
- Inventario y catalogo pueden heredar el producto TCGplayer de otra variante de
  la misma carta, y eligen el subtipo de precio segun acabado (`Normal`,
  `Reverse Holofoil`, `Holofoil`, etc.).
- Cuando una imagen ya contiene `/product/{id}`, ese identificador exacto tiene
  prioridad y evita una coincidencia aproximada.
- El endpoint de sincronizacion acepta `inventoryOnly=true` para recorrer TCGCSV
  contra las cartas operativas sin reprocesar todo el indice de 120 mil fichas.
- El backfill productivo completo conecto `1.120` de las `1.347` cartas del
  inventario y, despues de validar acabados, encontro precio confiable para
  `1.107`; antes solo `25` tenian precio. Se preservaron `10` conflictos
  ambiguos sin sobreescribirlos.
- La seleccion de precio respeta el acabado. `Cosmos`, `Master Ball` y
  `Poke Ball` no usan un precio generico si TCGCSV no ofrece ese subtipo, y las
  cartas antiguas normales priorizan `Unlimited` sobre `Normal`.
- Vercel ejecuta `/api/cron/tcgplayer-refresh` diariamente a las `09:30 UTC`
  (`06:30` de Argentina), despues del cron de PriceCharting.
- Migracion nueva: `0035_tcgplayer_price_fallback.sql`.
- El alta de stock usa TCGplayer como respaldo cuando una carta no tiene precio
  PriceCharting, evitando que cartas con referencia valida caigan al minimo de
  `800 ARS`.
- `Mas > Administracion` incluye un reparador general de precios de venta con
  vista previa. El modo seguro corrige pisos y faltantes; el modo general
  muestra tambien subas y bajas. Trabaja en tandas auditadas de hasta 250,
  recalcula con el dolar blue vigente y no modifica claims, ordenes ni ventas
  historicas.

### Revendedores en consignacion

- Se publico un sistema de usuarios revendedores con comision configurable,
  stock asignado, ventas, anulaciones, devoluciones y rendiciones auditables.
- La asignacion administrativa usa busqueda con resultados inline, imagen y
  datos de variante; elegir una carta ya no requiere abrir un desplegable.
- La asignacion es blanda: el stock sigue disponible para UltimoTurno, que
  siempre tiene prioridad. La venta del revendedor revalida y descuenta stock
  dentro de una transaccion.
- El portal fue redisenado como una herramienta operativa, con carrito, precios,
  comision estimada, saldo a rendir, historial y stock propio.
- Los revendedores pueden guardar pedidos sin reservar stock y confirmarlos mas
  tarde. Tambien pueden consultar el stock global en modo estrictamente lectura.
- Los pedidos confirmados tienen preparacion (`A embalar`, `A entregar`,
  `Entregado`) y cobro (`Pendiente`, `Pagado`) como estados independientes.
- Migraciones nuevas: `0032_reseller_consignment.sql`,
  `0033_reseller_orders.sql` y `0034_reseller_order_workflow.sql`.
- Verificacion final: lint, typecheck, build y DB verify OK; 42 tests aprobados;
  revision visual desktop y movil; produccion confirmada en `5e115f1`.

## Trabajo completado del 12 al 16 de septiembre

### Claims e importacion

- Se agrego un cargador CSV dentro de cada claim para elegir una seccion,
  cargar o pegar el archivo, generar una vista previa y agregar solo las filas
  conciliadas.
- Se corrigio el error `504` de `Generar vista previa` para CSV del scanner.
- Se agrego matching de nombres con caracteres japoneses en CSV de MonPrice.
- Se reparo la recuperacion de imagenes del claim activo y se bloquearon URLs
  protegidas o no publicas que se rompian en la web.

### Imagenes online

- El bucket esperado es `ultimoturno-images`.
- La reparacion prioritaria reutiliza primero imagenes confiables que ya existen
  en el catalogo para la misma carta. Acepta diferencias inocuas de numero como
  `26` / `026`, exige coincidencia de nombre, expansion e idioma y persiste la
  URL publica en el producto de stock; no vuelve a descargar la misma imagen.
- El daemon ejecuta esa reutilizacion al comienzo de cada ciclo y la accion
  `Reparar imagenes prioritarias` tambien la aplica antes de consultar fuentes
  externas. Las descargas pendientes se ordenan ahora por prioridad de stock
  antes que por el estado general de la cola.
- Para evitar los limites de ejecucion de Vercel, el daemon pide una tanda de
  cartas operativas sin URL, prueba localmente las rutas directas de
  PriceCharting y sube cada acierto a Supabase antes de continuar con el backlog
  general. Los `403` de TCGplayer ya no impiden este paso prioritario.
- El lanzador operativo usa `--priority-only`: mientras existan faltantes en
  stock procesa tandas chicas contra PriceCharting/PokemonTCG y evita gastar
  ciclos en URLs TCGplayer que responden `403`.
- Migracion nueva: `0040_reuse_catalog_stock_images.sql`.
- Existe un daemon local de produccion en `tools/image-storage-daemon.ts`.
- Comando: `npm run images:storage:daemon -- --loop`.
- Lanzador: `Mejorar Calidad Imagenes Online.cmd`.
- Descarga candidatos al directorio `D:\UltimoTurno\pricecharting-images`, los
  sube a Supabase Storage y enlaza la URL publica en la base online.
- Endpoints agregados:
  - `GET /pricecharting-images/download-candidates?limit=N`
  - `POST /pricecharting-images/:id/link-public`
  - `POST /pricecharting-images/:id/download-failed`
- Los `403`, `404` y `410` se registran con espera de 24 horas para evitar que
  el daemon repita inmediatamente la misma fuente fallida.
- Cuando hay backlog de candidatos ya descubiertos, el daemon prioriza subirlos
  y evita ejecutar la busqueda externa pesada en cada ciclo.
- Ultima observacion manual conocida: `claim-sin-img=0`, `stock-sin-img=6` y
  cobertura de catalogo cercana al `23%`. Es una foto operativa, no una garantia
  actual; consultar los endpoints antes de tomarla como valor presente.
- `external-index` puede superar los 60 segundos y devolver `504` en Vercel.
  El daemon sigue con candidatos existentes. Algunas URLs de TCGPlayer responden
  `403`; ahora quedan en backoff en lugar de trabar la cola.

### PriceCharting

- El token se configura solo por variable de entorno `PRICECHARTING_TOKEN`.
- El token de produccion se roto en Vercel el 2026-09-26 despues de que la
  credencial anterior comenzara a responder `410`. El valor no se guarda en
  Git ni en estos documentos.
- La importacion masiva dejo de ejecutar cientos de `INSERT` separados y usa
  tandas JSON de hasta 10.000 filas. Las filas sin cambios no se reescriben y
  la poda compara directamente los IDs presentes en el archivo.
- `api/[...path].ts` permite hasta 300 segundos bajo Fluid Compute en vez del
  limite artificial de 60 segundos. La primera corrida productiva optimizada
  completo 94.943 filas en 55,25 segundos, dejo 122.677 entradas y termino con
  estado `completed`.
- Vercel ejecuta `/api/cron/pricecharting-refresh` diariamente a las `09:00 UTC`
  (`06:00` de Argentina) segun `vercel.json`.
- La busqueda de imagenes tiene fallback cuando PriceCharting devuelve una
  pagina de busqueda en lugar de una ficha de producto.

### Ordenes

- Las ordenes reservadas pueden marcarse como pagadas despues de un reset de
  inventario. Si la reserva ya no coincide, el cierre no genera stock negativo
  ni descuenta una reposicion posterior: confirma el cobro, concilia la reserva
  obsoleta y registra la excepcion en auditoria.
- Se renovo el tablero con metricas operativas: contactar, vencidas, cobrar,
  embaladas y entregar.
- Las tarjetas muestran comprador, estado, total, resumen, mensaje, deuda y
  progreso de embalaje con colores por estado.
- Se compacto la cabecera y la navegacion solo en la vista Ordenes para dejar
  mas altura al tablero y a las tarjetas.
- Archivos principales: `apps/admin-web/src/main.tsx` y
  `apps/admin-web/src/styles.css`.

## Commits funcionales recientes

```text
3b06aa7 Merge pull request #27 (pagos parciales en USD)
8a8d9ce feat: record partial USD payments on orders
9567b2d Merge pull request #26 (costos de inventario)
89e6981 feat: load card costs from sale percent or CSV
2120a75 Merge pull request #25 (vencimiento por defecto)
a21de66 feat: default payment due date to 7 days
39b5bdf Optimize core views for mobile
81dfe9b Optimize reseller workflows for mobile
155cbd0 Optimize order workflow for mobile
16ac6fa Add installable UltimoTurno PWA
08a2e0c perf: eliminar contador bloqueante del alta
a2b98c3 perf: cargar cada sector bajo demanda
ad609e5 Mejorar carga de stock en celular
bc1c859 perf(api): compress shared stock snapshots
8ad146f fix(db): use portable snapshot epoch
1ab2454 fix(api): share stock snapshots across instances
d79e7d3 perf(db): streamline stock read joins
5e115f1 Add reseller order workflow states
2f51d11 Add reseller orders and global stock view
fcd6781 Redesign reseller sales portal
32bb40f Add reseller consignment system
6e9dac1 Remove catalog count from interactive search
687fa8d Speed up catalog card search
bcba451 Allow safe public image proxy fallback
891d344 Normalize inventory card dimensions
106264a Fallback to direct catalog images
d364c26 Keep stock intake in full-page flow
7952ca5 Add dedicated stock intake workspace
4279907 Move claim card search above workspace
75631b4 Stabilize catalog image delivery
67fc876 Improve claim catalog and stock lifecycle
ab108a3 Refresh project handoff documentation
708c9aa Compact orders workspace chrome
6539590 Polish orders workspace UI
c66f66a Back off failed image download sources
a14d887 Skip image discovery while storage backlog exists
4ad725e Make image storage daemon production-safe
4473356 Add online image storage daemon
85f2234 Handle PriceCharting search fallback for images
ca6a9a0 Schedule daily PriceCharting refresh
5aea65a Add image quality repair tools
0b3bc17 Support Japanese MonPrice CSV names
24a6ee0 Prevent protected claim image URLs
9fd2c87 Fix claim image URLs for web
0f553a6 Repair active claim image recovery
8b1d530 Fix scanner CSV import preview
2ebd38d Add claim section CSV loader
```

## Variables necesarias, sin valores

```ini
ULTIMOTURNO_ACCESS_KEY=...
ULTIMOTURNO_DATABASE_URL=...
ULTIMOTURNO_DATABASE_SSL=true
ULTIMOTURNO_DATABASE_POOL_MAX=1
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=ultimoturno-images
PRICECHARTING_TOKEN=...
PRICECHARTING_IMAGE_DIR=D:\UltimoTurno\pricecharting-images
OPENAI_API_KEY=...
OPENAI_CLAIM_MODEL=gpt-4o-mini
```

Nunca copiar valores reales a Git, logs compartidos o documentacion.

## Verificacion y deploy

Verificacion local del estado integrado `3b06aa7` realizada el 2026-10-07:
lint OK, typecheck OK, build OK y `92/92` tests aprobados. Incluye pruebas
especificas de vencimiento a 7 dias, costos por porcentaje/CSV y pagos parciales
USD. `/api/public-status` confirmo la misma base funcional en produccion con
PostgreSQL accesible.

Antes de subir cambios:

```powershell
npm run lint
npm run typecheck
npm test
npm run db:verify
npm run build
```

Despues de `git push`, comprobar `GET /api/public-status` y confirmar que
`deployment.commitSha` coincide con el commit enviado. Si no coincide, Vercel
todavia puede estar construyendo.

---

## Archivo historico al 2026-09-11

Actualizado: 2026-09-11

Este archivo es la memoria corta del proyecto para poder abrir otro chat y
seguir trabajando sin perder contexto.

## Workspace

```text
D:\UltimoTurno\Stock
```

La carpeta que importa para codigo nuevo es esta. Si Codex aparece parado en
`C:\Users\skype\Documents\Stock`, cambiar el working directory a
`D:\UltimoTurno\Stock` antes de tocar archivos.

## Online

App online:

```text
https://ultimoturno.app/
```

API online:

```text
https://ultimoturno.app/api
```

Proveedor:

```text
Vercel + Supabase Postgres
```

Estado funcional conocido:

- La pagina carga online.
- El inventario puede estar en cero y eso es normal si no se cargo stock.
- El catalogo PriceCharting completo fue importado: aproximadamente 120.710
  entradas.
- La busqueda de agregar stock debe buscar contra el catalogo completo, no solo
  contra cartas que alguna vez tuvieron inventario.
- Se agrego el endpoint `/catalog-cards` como fuente unificada del selector.
- Puede quedar un problema de deploy/cache en Vercel si online sirve una version
  vieja del backend. Verificar el commit desplegado antes de asumir que el codigo
  local esta roto.

## Local

Comandos habituales:

```powershell
npm run dev:api
npm run dev:web
```

Tambien existen accesos `.cmd` en la raiz para abrir la plataforma con perfil
piloto real.

Perfil esperado:

```text
ULTIMOTURNO_DATA_PROFILE=PILOTO REAL
ULTIMOTURNO_ALLOW_EXAMPLES=false
```

Base local esperada para piloto:

```text
D:\UltimoTurno\Stock\apps\api\.data\ultimoturno-pilot-real
```

Imagenes locales esperadas:

```text
D:\UltimoTurno\pricecharting-images
```

## Base de datos

Local puede usar PGlite. Produccion usa Postgres/Supabase.

Variables importantes, sin pegar secretos en git:

```ini
ULTIMOTURNO_DB_DRIVER=postgres
ULTIMOTURNO_DATABASE_URL=...
ULTIMOTURNO_DATABASE_SSL=true
ULTIMOTURNO_DATABASE_POOL_MAX=1
ULTIMOTURNO_ACCESS_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=ultimoturno-images
PRICECHARTING_TOKEN=...
```

Notas de DB:

- En Vercel se ajusto el pool para evitar `EMAXCONNSESSION max clients reached`.
- En produccion conviene usar transaction pooler y `ULTIMOTURNO_DATABASE_POOL_MAX=1`.
- Las migraciones viven en `packages/db/migrations`.
- La migracion mas reciente importante es `0030_unified_catalog_cards.sql`.

## Catalogo

Fuente principal:

```text
PriceCharting CSV / API
```

Estado conocido:

- Total aproximado: 120.710 entradas.
- Con precio PriceCharting: aproximadamente 81.339 entradas.
- TCG price cache online estaba vacio en la ultima revision conocida.
- El catalogo NO es stock. Sirve para elegir cartas y crear stock.
- Stock en cero no significa catalogo vacio.

Separacion por idioma:

- `english`
- `japanese`
- `chinese`

Regla de negocio:

- Korean, Indonesia y promos/variantes de otros paises asiaticos caen en
  `japanese`.
- La UI muestra filtros tipo `Todos`, `US Ingles`, `JP Japones`, `CN Chino`.

Endpoint unificado:

```text
GET /api/catalog-cards?q=...&languageGroup=...
```

Este endpoint debe ser la fuente del modal `Agregar stock`.

## Imagenes

Estado conocido:

- Hay imagenes locales descargadas/cacheadas.
- Se hizo una subida parcial/grande a Supabase Storage:
  - aproximadamente 37.014 subidas;
  - 595 ya existentes;
  - 16 fallidas.
- El bucket esperado es `ultimoturno-images`.
- El script de subida es:

```powershell
npm run images:supabase:upload
```

Script real:

```text
scripts/upload-pricecharting-images-to-supabase.mts
```

Notas:

- Las imagenes de PriceCharting no siempre vienen en el CSV.
- El sistema puede usar fallback desde `card_index_entries` / TCGCSV cuando
  matchea idioma + expansion + numero.
- Si el catalogo muestra placeholder `PC`, revisar primero si `image_url` viene
  vacio desde `/catalog-cards`.

## UI de agregar stock

Cambios recientes:

- El buscador principal conserva el texto local mientras se escribe y aplica el
  filtro tras `300 ms` de pausa, sin reponer consultas anteriores ni perder
  letras durante una escritura rapida.
- Busca en catalogo completo.
- Muestra contador de catalogo completo.
- Agrega filtro de idioma.
- Distingue acabados como `Reverse`.
- Muestra precios separados:
  - `PC`: precio de PriceCharting.
  - `TCG`: precio de TCG en caso de tenerlo.
- Se saco el texto `blue` del listado del catalogo.
- Hay toggle superior para ver precios en `USD` o `ARS`.
- Al seleccionar carta, los campos `Precio de venta ARS` y `Precio de venta USD`
  se convierten entre si.
- Precio minimo de venta: `800 ARS`.
- Hay valor recomendado redondeado para acelerar carga de stock.

Regla de precio:

- Si se carga ARS, calcula USD.
- Si se carga USD, calcula ARS.
- Si falta precio fuente, recomendar minimo `800 ARS`.
- El backend tambien normaliza el precio ARS antes de guardar.

## Revendedores en consignacion

MVP publicado en produccion:

- Usuarios revendedores con email, password y sesion propia.
- Comision porcentual configurable por revendedor.
- Asignacion y devolucion de unidades con historial auditable.
- La asignacion es blanda: no modifica `quantity_on_hand` ni
  `quantity_reserved`, por lo que UltimoTurno conserva prioridad de venta.
- Al confirmar una venta del revendedor se valida el stock real en transaccion;
  si una venta central consumio las unidades, la operacion se rechaza.
- La venta confirmada descuenta stock, calcula bruto, comision y neto a rendir.
- Anular una venta repone stock y revierte las unidades vendidas.
- Rendiciones registradas como libro de pagos, con saldo pendiente.
- Gestion interna en `Mas > Revendedores`.
- Portal separado en `?revendedor=1`.
- Pedidos propios: se guardan pendientes sin reservar stock y se convierten en
  venta solo despues de revalidar disponibilidad.
- Vista de stock global para revendedores, buscable y de solo lectura; no
  expone costos de compra ni acciones administrativas.
- Seguimiento operativo de pedidos confirmados con preparacion (`A embalar`,
  `A entregar`, `Entregado`) y cobro (`Pendiente`, `Pagado`) independientes.

Las migraciones son `0032_reseller_consignment.sql`,
`0033_reseller_orders.sql` y `0034_reseller_order_workflow.sql`. No se aplicaron cambios ni
datos de prueba sobre produccion durante la implementacion.

## Precios CoolStuff

- Se agrego una cache persistente de precios retail CoolStuff por
  `pricecharting_id`, condicion y acabado.
- El inventario expone CoolStuff como fuente real cuando existe una
  coincidencia confiable, incluyendo precio USD y enlace canonico.
- El worker externo procesa solo cartas inglesas con stock positivo cuyo dato
  falta o esta vencido. No intenta descargar todo el sitio.
- El descubrimiento usa el indice publico de expansiones y sus paginas
  paginadas. Las paginas se reutilizan dentro de cada tanda para reducir
  solicitudes.
- Las consultas son secuenciales y esperan al menos 10 segundos. Una respuesta
  vacia o bloqueada se registra como fallo reintentable, no como carta ausente.
- Nombre, expansion, numero, condicion y acabado se validan antes de aplicar el
  precio. Coincidencias ambiguas no se publican automaticamente.
- La migracion es `0038_coolstuff_price_cache.sql`; la operacion se inicia con
  `Actualizar Precios CoolStuff.cmd` o `npm run coolstuff:prices:daemon`.
- Vercel aloja la API y Supabase conserva el progreso, pero el scraping debe
  ejecutarse desde un equipo o worker externo de larga duracion.

Verificacion del MVP:

```text
typecheck OK
lint OK
build OK
tests OK: 48 pass, 0 fail
alta/login/portal API local OK
revision visual desktop OK
revision visual movil OK
produccion `5e115f1` OK
```

## Verificacion

Ultima verificacion local conocida despues de los cambios estructurales:

```powershell
npm run typecheck
npm run build
npm run db:verify
npm test
```

Resultado conocido:

```text
typecheck OK
build OK
db:verify OK
tests OK: 42 pass, 0 fail
```

## Commits recientes importantes

```text
5e115f1 Add reseller order workflow states
2f51d11 Add reseller orders and global stock view
fcd6781 Redesign reseller sales portal
32bb40f Add reseller consignment system
609a61b Add unified catalog cards view
556c9eb Optimize unified catalog search
de5a4f1 Filter reference rows in unified catalog
22c6f97 Trigger unified catalog deploy
```

Si online no refleja el comportamiento esperado, revisar en Vercel si el commit
activo es el ultimo de `main`.
