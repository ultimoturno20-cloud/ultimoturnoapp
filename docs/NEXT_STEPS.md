# UltimoTurno - proximos pasos


## Usar el espacio independiente Torneos

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


Actualizado: 2026-10-09

> Las prioridades vigentes estan en esta primera seccion. El plan del
> 2026-09-11 se conserva debajo como referencia historica.

## Prioridades vigentes

### Consistencia visual y vistas operativas

- Correccion entregada: Stock abre fuera de la grilla; precios completos y
  disponibilidad central editable sin desbordes. Revisar con datos reales en
  ambas densidades, sin registrar cargas ficticias para probar.
- Primera entrega terminada en Inventario: vistas iniciales y personales,
  filtros activos, restauracion al recargar y barra compartida con el equipo
  de Revendedores. Revisar en movil sin confirmar operaciones ficticias.
- Las vistas personales son locales por negocio/usuario/navegador. Guardar
  una vista no registra stock, no habilita venta y no persiste el carrito.
- Proxima entrega: aplicar el patron de barra y estados a Ordenes/Caja/Compras,
  conservando reglas financieras y permisos. Pendientes de entregar corresponde
  a Ordenes; no se implementa como un filtro inventado sobre inventario.
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

- En Android, abrir `https://ultimoturno.app/inicio`, pulsar `Instalar
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
- Ingresar siempre por `/inicio`: una cuenta revendedora debe abrir solamente su
  portal, German debe ver solo `Cargar stock` y `Asignar a revendedores`, y una
  cuenta administradora debe conservar el panel completo.
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
Estamos trabajando en UltimoTurno. Usa exclusivamente el workspace
D:\UltimoTurno\Stock; no uses C:\Users\skype\Documents\Stock.

Antes de responder lee AGENTS.md, docs/PROJECT_STATUS.md y docs/NEXT_STEPS.md.
Revisa git status antes de editar. Produccion es
https://ultimoturno.app/ con Vercel, Supabase/Postgres y Supabase
Storage.

Hay un claim activo y ordenes reales en produccion: no los elimines, canceles ni
recrees durante pruebas. No pongas secretos en Git.

Base funcional de produccion confirmada: `3b06aa7`. Revisar igualmente
`git log -1` y
`/api/public-status` antes de editar, porque puede existir un despliegue mas
nuevo.

Trabajo reciente: PWA instalable, vistas moviles dedicadas para Ordenes y
Revendedores, capa movil para Inicio/Inventario/Caja/Claims, carga de stock en
pagina completa, busqueda de catalogo rapida, mejoras de claim y sistema de
revendedores en consignacion. Tambien se agregaron vencimientos automaticos a 7
dias, carga masiva de costos por porcentaje o CSV y pagos parciales separados en
ARS/USD.
UltimoTurno siempre conserva prioridad sobre el stock y la venta del revendedor
revalida disponibilidad antes de descontar.

La carga de stock tiene una version compacta para pantallas de hasta 620 px:
sin cabecera/navegacion global, filtros horizontales, campo y lupa en una fila,
resultados densos y espacio inferior para teclado/barra del navegador. Esta
version esta online; falta validarla durante una carga real con
los telefonos de los operadores.

La navegacion principal y el portal usan URLs reales por sector. La pantalla
visible se actualiza cada 15 segundos y al recuperar el foco, sin F5 ni perdida
de formularios, carrito, filtros o scroll. El boton superior actualiza solo el
sector actual. Antes de cambiar esto, revisar la implementacion de History API,
los mapas de rutas y `vercel.json`.

Objetivo inmediato: validar vencimientos, carga de costos y pagos mixtos con una
muestra pequena; despues validar la PWA/carga movil y la sincronizacion con dos
sesiones. Luego pilotear revendedores con pocas cartas reales y continuar
cobertura de imagenes y validacion de CSV reales.
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
