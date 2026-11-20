# Ingreso Mault — issue #43, PR #44

Implementado en `codex/mault-api-trial`, base main/produccion `f0c3d1e`.
No pertenece al plan OP. El usuario autorizo desarrollar y probar el consumidor
antes de mergear el contrato. Revision cruzada, merge humano, migracion
productiva y release siguen pendientes. No se importaron cartas reales ni se
borro inventario.

## Momento del ingreso

La primera lectura completa registra el historico como `baseline`, sin sumar
stock. Las nuevas copias se preparan despues de ese punto. Con autoImport
habilitado, se ingresan al cumplir las politicas: por defecto, aprobacion en
Mault, ubicacion en storage, identidad e imagen verificadas y condicion
confirmada. NM puede ser el valor inicial del escaner; aceptar la condicion
registrada requiere una decision explicita del admin.

Escanear solamente no dispara el ingreso con esas politicas. Aprobar y guardar
en storage permite que una sincronizacion posterior lo procese. Un worker
externo consulta cada minuto: cada corrida lee una pagina de hasta 200 y prepara
como maximo dos pendientes. Puede haber demora si hay muchas copias. Funciona
con el navegador cerrado mientras el worker este encendido. No se inicio un
worker productivo por este PR. No hay webhook implementado.

El historico solo se ingresa mediante seleccion y confirmacion expresa, una vez
conciliado contra el inventario existente. Verificar seleccion no suma unidades.
La vista pagina 50 copias y permite seleccionar hasta 10 IDs por lote; no hay
operacion global truncada implicitamente a una pagina.

## Colecciones, idiomas e identidad

El admin elige colecciones por ID estable y asigna etiquetas de UltimoTurno.
Las seis categorias solicitadas se configuran como Items -> items,
Pokemon -> pokemon, Energy -> energy, Tools -> tools, Stadiums -> stadiums y
Supporters -> supporters. No se deduce el tipo real por nombre o arte de carta.
La interfaz permite agregar `jugables` a una regla. Una lista vacia no autoriza
todas las colecciones. La caja se conserva como ubicacion, separada de las
etiquetas. La posicion se muestra en la copia, sin convertirla en SKU.

La API informa idioma, acabado, estampa y ubicacion; no imagenes ni tags.
Idiomas desconocidos y variantes incompletas quedan para revision. ID/TH
conservan su idioma y pertenecen al grupo regional asiatico ya existente en el
helper de inventario. No se convierten a EN.

Se distinguen normal, holo, reverse, Pokeball, Masterball y Dusk Ball. La estampa
se conserva separada en el origen y se representa en el acabado del inventario
como `acabado · estampa`, evitando mezclar Prize Pack con la version sin sello.
Si el nombre sobrescribe ese acabado, la transaccion falla y hace rollback.
Se comparan set, numero completo (ceros iniciales normalizados sin quitar un
denominador), idioma, condicion, acabado y ubicacion al buscar stock central.
Varios items coincidentes requieren revision.

`pokemonjp` usa IDs de TCGtracking, no IDs TCGdex. Se reconoce como Pokemon pero
no se interpreta con el catalogo occidental. Cartas japonesas y estampadas
requieren confirmar manualmente la identidad de su imagen; no se descartan ni
se publican con una imagen inglesa de respaldo.

## Imagenes y precios

Para Pokemon occidental se consulta TCGdex por ID e idioma, comprobando ID,
nombre, set y numero. Se valida URL HTTPS de assets.tcgdex.net en el idioma
exacto, HTTP, MIME, firma de imagen y tamano acotado, sin redirects. Ausencia o
discrepancia deja la copia en revision, sin sumar stock. Confirmacion manual
exige declarar edicion/idioma/acabado/estampa y deja auditoria. Tambien verifica
el recurso; no acepta URLs arbitrarias del cliente.

Un item existente conserva precio central ARS/USD, imagen manual y etiquetas,
agregando las de su coleccion. La correccion general de addInventoryStock
conserva image_url si se omite imageUrl; un vacio explicito mantiene el borrado
previo. No persiste un fallback calculado como si fuera una imagen manual.

No se usa el precio Mault como precio de venta. Por defecto las cartas nuevas
no tienen precio autorizado y quedan para revision. El admin puede configurar
un precio ARS unico para nuevas cartas solo si desea ese mismo importe para
todas; no modifica precios existentes. No se reutiliza una cotizacion o redondeo
historico. La configuracion inicial queda deshabilitada.

## Persistencia y recuperacion

Migracion aditiva `0064_mault_intake.sql`: conexion por negocio y copias con
PK `(business_id, copy_id)`, payload, huella, estado, imagen y recibo. La unicidad
no depende de clave API, coleccion ni caja. Rotar clave, mover caja o repetir
lecturas no habilita otro ingreso del mismo ID. Reescanear fisicamente con otro
ID es otra copia para Mault: requiere control operativo.

El alta usa addInventoryStock y una transaccion: bloqueos de conexion/copia/item,
revalidacion de politicas, movimiento, recibo, auditoria y revocacion de snapshot.
Despues se invalida la cache en memoria existente. Fallo intermedio hace
rollback; reintentar un ID confirmado devuelve el recibo sin sumar otra unidad.
Cambios de identidad posteriores quedan en revision, sin modificar la unidad
previa. Bajas o ausencias fuente no eliminan ni restan stock.

Lease de 90 segundos impide corridas solapadas y cambios de configuracion durante
la lectura. Cada pagina se persiste con su continuacion; el watermark final
solo avanza al completar el recorrido. Fechas fuente monotonicas. Una copia
inaccesible queda en revision y no bloquea indefinidamente las demas. Cambiar
reglas de colecciones reinicia baseline/cursor conservando recibos. No hace
falta borrar colecciones Mault para evitar duplicados; borrarlas impide revisar
copias pendientes. Los recibos persisten aunque una coleccion desaparezca.

## API e instalacion pendiente

Solo admin autenticado del negocio; el alcance viene de la sesion. La clave
Mault nunca va al navegador ni se recibe en cuerpos HTTP.

| Ruta bajo /integrations/mault | Metodo | Funcion |
| --- | --- | --- |
| status | GET | Configuracion segura y totales globales |
| config | PUT | Politicas y reglas, con version optimista |
| collections | GET | Colecciones de la clave asignada |
| preview | GET | Filtro y pagina de 50 copias |
| run | POST | Una pagina y dos pendientes como maximo |
| prepare | POST | Verifica seleccion sin sumar stock |
| verify-image | POST | Confirmacion manual auditada |
| apply | POST | Seleccion e historico confirmado |

Servidor: `MAULT_API_URL=https://mault.xyz/api`, `MAULT_API_KEY` de solo lectura
y `MAULT_BUSINESS_ID` exactamente igual al negocio autorizado. Sin coincidencia
no se habilita esa clave. No copiarla a Preview; previews sin aislamiento de
credenciales siguen bloqueados.

Worker: `node tools/mault-sync-worker.mjs` (o `--once`), con
`ULTIMOTURNO_API_URL=https://ultimoturno.app/api` y credencial destino
`ULTIMOTURNO_ACCESS_KEY` privada. No necesita la clave Mault, no imprime respuestas
privadas y no reenvia credenciales por redirects.

UI en Admin / Configuracion. Tras aprobar y desplegar: asignar credenciales solo
en servidor, seleccionar reglas/politicas, hacer baseline, revisar imagenes de
una muestra y decidir carga historica/worker. No activar sin resolver precios
de cartas nuevas y alcance del inventario existente.

## QA y limites del reinicio

PGlite nuevo y fixtures sinteticos: seis etiquetas/idiomas/imagenes, baseline,
reintentos concurrentes, rollback, correcciones, aislamiento, politicas,
estampas, precios e imagenes manuales. HTTP: auth y no exposicion de clave.
Paginacion segura y rechazo de imagen incorrecta.
Chrome local: seis imagenes publicas en 320/390/768/1440/1788 px sin desbordes;
recarga conserva las seis, filtro vacio, error, teclado y movimiento reducido.
Formulario abierto en esos cinco anchos, edicion/descarte de etiquetas y estado
de carga comprobados. Gate local completo: 332 tests, lint, tipos, DB temporal y
build aprobados. Regresiones finales adicionales cubren reanudacion de baseline
parcial y rechazo de correcciones antiguas; ver CI del head final del PR.
No certifica cobertura visual de todo el stock real. Se verifico previamente
una muestra real por idioma autorizada, sin publicar IDs ni credenciales.

Antes del reinicio real falta respaldo privado recuperable y definir alcance
central/propietarios/reservas/asignaciones. Preservar ordenes, pagos, claims,
historial, catalogo e imagenes manuales. `/inventory/reset-stock` pone a cero
existencias Y reservas de todos los activos del negocio: no usar automaticamente.
El backup parcial del script legacy de reset carece de imagenes/categorias.
No se ejecutaron ese endpoint ni ese script.
