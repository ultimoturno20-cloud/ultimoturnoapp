# Traspaso de contexto - UltimoTurno

## Imagen de claim y PriceCharting HTTP 403 - 2026-10-12

Buscar imagen y busqueda masiva dependian solo de paginas PC, omitian imagenes
ya indexadas y concatenaban el mismo HTTP 403 por cada URL candidata.
server.ts usa ahora downloadClaimCardImage para ambos caminos: lee cache/indice
por pricecharting_id exacto, prueba storage, TCGdex y finalmente paginas PC.
claim-image-resolver.ts comprueba nombre/numero/expansion desde detalle TCGdex;
solo ingles y arte base (normal/holo/reverse), no variantes estampadas especiales.
Slowpoke 30th Celebration #16 tiene detalle 30th-016 e imagen high.webp valida.
No se construye una URL de imagen por nombre/numero sin verificar metadata.
403/429 frenan paginas repetidas; mensaje 403 unico orienta a Corregir imagen
con URL directa. Se conserva cooldown 429 y registro de exito/fallo existente.
Tests de API agregados a npm test. QA aislada .work/claim-image-qa.mts simula
bloqueo PC y consulta TCGdex real, sin POST a produccion. No migraciones.

## Busqueda en filas y cantidad por variante - 2026-10-12

Referencia visual del usuario: busqueda CoolStuff con foto izquierda y opciones
de condicion/precio/cantidad/carrito a derecha. Se adopta estructura, no colores
claros/amarillos, ratings, favoritos, rareza ni notas sin datos reales.
Solo frontend, sin API/DTO/migraciones/dependencias ni escrituras productivas.

store-search-list.tsx muestra filas de ancho completo con bandas alternadas,
foto completa 118x165 desktop/82x115 movil, nombre/numero/edicion y metadata
publica. Filtros en dialogo en lista, sidebar solo en grilla desktop.
Catalogo y busqueda eligen lista por defecto salvo override manual: corregida
la primera entrega que seguia en grilla sin query. Search sin banner y encabezado
compacto. view=grid/list queda en URL y reload/popstate lo recuperan.
Input conserva espacios mientras se escribe; API recibe query normalizada.
Correccion de vista inicial verificada con .work/store-default-view-qa.mts:
raiz sin query/view, reload, limpiar busqueda y view invalida eligen lista;
grid explicito conserva eleccion. Chrome siete anchos, GET solamente.

store-search-results.ts agrupa solo coincidencias EXACTAS de nombre/edicion/
numero/idioma/acabado/grading/imagen/tipo/categoria. No recorta nombres ni
interpreta variantes por fuzzy matching. Condicion/precio/cantidad/ID quedan
individuales en offers; carpeta incluye ID en key y permanece unica.
Agrupado de pagina actual: paginacion/contador reales de 36 variantes, no
grupos; distintas condiciones de una carta pueden ocupar paginas diferentes.

StoreOfferRow conserva input por ID y abre detalle/precio de esa oferta, no
del primer miembro del grupo. Lapiz solo admin verificado; endpoints iguales.
Cantidad entera 1..min(stock,99) menos unidades ya en carrito. add(item,qty=1)
usa addStoreCartQuantity atomico: no parcial ni mas de 30 items, conserva ID/
precio actual y otras condiciones separadas. setLines mantiene ref sincronica
para que clicks consecutivos no usen un snapshot anterior. Payload/reintentos/
reservas/pago no cambian; intento ambiguo sigue bloqueando nuevos agregados.
StoreImage compartido entre grilla, lista y detalle conserva carga/fallback.

QA: 68 tests frontend/dominio (8 nuevos agrupado/vistas/condiciones/cantidades),
lint/typecheck/build web. .work/store-search-qa.mts: Chrome siete anchos,
ofertas agrupadas, cantidad multiple/limites/decimal, detalle LP, precio LP sin
tocar NM, espacios, filtros, vista/reload, paginacion, reduced-motion/error.
Screenshots inspeccionados. Checkout-browser-test con tres unidades tambien
paso: orden/pago/recarga/reintento solo en base y API temporales. .work ignorado.
No productos, precios, publicaciones ni pedidos ficticios en produccion.

## Pulido visual y movimiento de tienda - 2026-10-12

Cambio solo frontend en storefront.css/tsx y store-cart.tsx, sin dependencias,
API, migraciones ni datos. Conserva paleta negro/carbon/rojo y densidad compacta.
Entradas CSS 200-420 ms, stagger de cartas acotado a 100 ms por indice modulo6;
solo al montar, sin ocultar items por scroll/IntersectionObserver. Hover con
mouse mueve tarjeta 3 px sin relayout de vecinos y no hace zoom/crop de imagen.
Dialogos nativos animan apertura, no retrasan cierre/Escape ni alteran foco.

prefers-reduced-motion reduce anula animaciones/transiciones/smooth-scroll,
incluidos pseudo-elementos, hover/active y carga. Barra de carga estatica y
check de carrito permanecen visibles; no elimina feedback funcional.
Imagenes con decoding async y opacidad breve al cargar, estado asociado a URL
para recuperarse de error si cambia el src sin cambiar el ID. Sin imagen sigue
disponible. Titulo completo en tooltip de nombre truncado.

useStoreCart agrega feedback local id/version por 1 s solo en altas exitosas;
temporizador se reinicia ante otro agregado. Rechazo por limite/pedido pendiente
limpia feedback. No cambia cantidades limite, persistence, payload/idempotencia
ni reservas. Check reemplaza icono, no boton: conserva foco y dimensiones.
Contador animado solo con articulos y cifras tabulares. Notice discreto y
acciones de carrito separadas. Toolbar cabe en 320 px con selector agrupado.

QA 60 tests frontend/dominio + lint/typecheck/build web correctos.
.work/storefront-motion-qa.mts usa respuestas API simuladas y fotos publicas
solo leidas: Chrome siete anchos 1788/1440/1280/1024/768/390/320, grilla/lista,
hover sin desplazar vecinos, precio largo, feedback/limites, imagen rota y
cambio de URL, filtros/admin/precio en 320, foco/Escape, reduced-motion y
vacio/error/reintento. Capturas inspeccionadas. Checkout-browser-test tambien
paso con orden/pago/reintento solo en base/API temporales. Sin writes productivos.

## Admin y precio central desde tienda - 2026-10-12

Pedido explicito del usuario: cualquier admin logueado debe editar precios desde
la Web sin ir/volver al panel. Esta seccion reemplaza las afirmaciones historicas
de que raiz nunca lee una sesion ni llama API privada aun con token guardado.
Anonimo sigue sin API privada, login obligatorio ni bundle/PWA administrativo.
Carrito/checkout no usa privilegios staff ni cambia sus endpoints publicos.

store-admin-state.ts lee solo el token opaco de ultimoturno_admin_session,
compartido con panel. useStoreAdmin valida GET /store-admin/session en servidor,
focus/storage/cada 15 s visible. Sin token no hace llamadas privadas. Roles no
se confian al localStorage. 401 limpia sesion coincidente; 403 oculta controles
sin eliminar sesion del owner/revendedor. Storage comunica login/logout a panel.
POST /store-admin/login reutiliza cuentas y limites persistentes existentes;
revoca nueva sesion si no corresponde al rol admin y negocio ultimoturno.

GET/PUT /store-admin/items/:id/price exigen Bearer individual vigente, admin y
negocio, sin fallback a clave legacy. DTO permitido id/name/priceArs/priceUsd,
Cache-Control private/no-store y body limitado a 4 KB. Edita solo item activo,
publicado y available del negocio. JSON invalido 400; permisos 401/403.

vercel.json requiere rewrite explicito /api/store-admin/:path* al dispatcher;
sin esa regla el catch-all de Vercel devuelve 404 para rutas anidadas. Test
frontend adicional verifica configuracion del rewrite; no depende de localhost.

Solo current_prices cambia: ARS minimo 800/redondeo100 y USD calculado con blue
de servidor; manual_override=true. Inventario, cantidades, propietarios, costos,
etiquetas, publicacion y lineas de ventas/reservas existentes quedan intactos.

inventoryTransaction bloquea ii/current_prices como checkout; compara
expectedPriceArs bajo lock, conflicto409 sin pisar otro admin. Reintento cuyo
precio objetivo ya es actual devuelve resultado sin segundo audit ni recalculo.
Audita inventory.store_price.update con actor real, expira stock_read_snapshots
y cache del proceso. No hay migracion. El admin escucha aviso sin secretos por
storage y pide /stock?fresh=1 tras esperar refrescos pendientes: evita cache
de instancia/snapshot viejo. Cambio de sesion recarga panel para no mezclar cuentas.

StoreAdminAccess muestra escudo en encabezado, nombre/acceso panel/logout o login
opcional staff. StoreEditPriceButton lapiz compacto junto a disponibilidad y en
detalle; StorePriceEditor modal aislado, precio final visible, conflicto/recarga
y reintento ambiguo con draft congelado. Cerrar vuelve al detalle de origen.
Actualiza catalogo y carrito propio salvo checkout pendiente ambiguo; servidor
rechaza cotizacion vieja en checkout. No cambia ajustes ni habilita pedidos.

QA: 189 tests completos (9 nuevos), lint/tipos/build; Chrome HTTP con API/PGlite
temporales en .work/store-admin-browser-test.mts, siete anchos 320..1788.
Dos admins, reuse/login/logout/expiracion, precio central y refresh panel,
conflicto/recarga, respuesta perdida sin duplicar, retorno detalle, no-admin
y clave legacy rechazados, cantidades intactas. Capturas/fixtures ignorados.
No login, precios, ordenes ni publicaciones de prueba en produccion.

## Carrito y pedidos Web con pago manual - 2026-10-12

0062_store_checkout.sql agrega store_settings (enabled false por defecto),
store_orders vinculadas a sales y limites persistentes por hashes IP/email.
Admin en /admin/configuracion define instrucciones publicas, entrega y plazo
de reserva antes de abrir pedidos. No activar automaticamente ni inventar alias,
WhatsApp, direccion de retiro o costos de envio. Contacto/pago son texto publico;
no guardar secretos alli. No hay cuentas de compradores, cobro ni email automatico.

GET /store/settings publico; GET/PUT /store-settings solo admin y por negocio.
POST /store/orders publico con JSON <=16 KB, hasta 30 lineas y 99 unidades por
linea, validacion estricta y limites 5/email o 20/IP en 15 minutos. Claves UUIDv4,
hash del pedido normalizado y locks/idempotencia PostgreSQL. Reintento devuelve
el mismo recibo con estado actual aun si la tienda se pauso. No entrega DTO privado
de ventas, datos de otros compradores ni identificadores administrativos.

Checkout bloquea ii/current_prices en orden de ID y reutiliza listStoreCatalog
con ids acotados: misma publicacion, ARS positivo, stock libre, No venta y claim.
GET /store/catalog?ids permite refrescar solo el carrito (maximo 30 IDs UUID).
Crea sale reservation/pending/channel web, lineas con precio real, reservas,
movimientos y audit atomicos, sin restar cantidad fisica hasta cobro. Invalida
snapshot/cache y actualiza tablero dentro de transaccion. created_by es null:
un comprador no representa una sesion ni un usuario admin.

Vencimiento exacto en store_orders/reservations, NO en payment_due_at de tipo
date: evitamos marcar una reserva nueva vencida por medianoche/zona horaria.
expireStoreOrders se ejecuta al leer catalogo/stock/sales/order-boards y al
confirmar un pedido; no hay cron continuo. Solo pendientes/embaladas Web con
metadata propia, sin pagos y sin consignacion. Bloquea sale, libera reservas,
cancela conservando registros, audita y actualiza tablero/snapshot. Pago parcial
registrado conserva reserva. Pago/cancelacion se serializan contra expiracion;
Web nunca se completa sin stock suficiente. No cambia la reconciliacion legacy.
Fusion de duplicados excluye Web; editor y asignacion a revendedor las rechazan.

Trigger de claim nuevo/actualizacion de referencia bloquea las mismas filas de
inventario que checkout y rechaza una referencia con reserva Web activa. Incluye
inventory_item_id, inventory:UUID y PriceCharting producto/variante. No cambia
claim actual. Esto cubre incorporaciones posteriores; mantener exclusion del
claim abierto en catalogo/checkout. Cancelar/resolver la orden antes de agregarla.

store-cart-state.ts y store-cart.tsx manejan carrito publico, dialogo/formulario
y recuperacion: localStorage solo productos; sessionStorage solo intento pendiente
(incluye datos del comprador temporalmente). No usa session admin. Se elimina
el intento al confirmar/rechazo conocido; fallas ambiguas conservan la MISMA
clave/payload incluso al recargar. No generar otra clave ante respuesta incierta.
No se reserva al agregar al carrito. Detalle y tarjeta permiten agregar, sin
aumentar filas/imagenes. Envio siempre a coordinar y cotizado por separado.

QA: 180 tests completos y 12 focalizados finales, lint/tipos/build y db:verify
local correctos. .work/checkout-browser-test.mts usa API/base PGlite temporales,
Chrome siete anchos de tienda, cuatro configuracion y tres Ordenes. Crea una
orden local, pierde respuesta, recarga/reintenta sin duplicar, verifica contacto,
restricciones y cobra localmente. HTTP valida 400/401/405/413 y privacidad.
Scripts/capturas en .work ignorado. Ningun pedido, pago ni publicacion de prueba
en produccion. La concurrencia PostgreSQL usa locks/advisory; las pruebas de
escritura se realizaron en PGlite, no contra Supabase productivo.

## Catalogo compacto e imagenes contenidas - 2026-10-12

Cambio solo en storefront.css: grilla auto-fill con minimo 160 px (155 px en
el breakpoint intermedio) y dos columnas <=600 px, incluido 320 px. En QA se
ven 5-6 columnas en escritorio y 4-5 en tablet. Marcos de imagen hasta 240 px,
220 px movil, aspect-ratio 5/7. Imagen absoluta con object-fit: contain para
que el tamano intrinseco no estire la grilla ni el marco de detalle. Detalle
conserva sus dimensiones grandes, sin filtros/recorte de las fotos originales.

Espaciado y tipografia compactos, nombres/expansiones en dos lineas, variante
abreviada con ellipsis y valor ARS completo. Precio ajustado al contenedor, no
al viewport. Listado y paginacion de 36 se conservan. No cambia React/API/schema,
categorias, filtros, precios, publicaciones, cantidades ni checkout.

QA: 42 tests frontend/dominio, lint/tipos/build web, Chrome en diez anchos
1788/1440/1366/1280/1024/900/768/600/390/320 px. Tarjetas ~400-475 px (antes
~718 px a 1440). Comprueba precios largos, imagenes dentro del marco,
estabilidad al cargar fotos, lista, detalle/Escape y paginacion 36/4.
Respuestas simuladas en memoria, cero escrituras y cero lecturas privadas;
scripts/capturas en .work ignorado. Datos reales no modificados.

## Categorias comerciales de tienda - 2026-10-12

Esta entrega reemplaza la navegacion por cardType: header muestra Singles,
Sellado, Accesorios, Otros, ademas de Todo el catalogo. Tipo de carta solo se
muestra dentro de Singles. Domain/store-catalog agrega StoreCategory, category
en DTO/query y filtro previo al conteo/orden/paginacion. API anonima acepta
category con allowlist singles/sealed/accessories/other/all. Links cardType
anteriores se normalizan a Singles; categorias no Singles limpian cardType.
Cambiar categoria limpia filtros/offset. Quitar su chip tambien elimina tipo
dependiente; recarga conserva categoria en URL. Facet cardTypes solo de Singles.

resolveStoreCategory usa tags ya normalizados de inventory_items, sin devolverlos
en DTO. Carpetas siempre other. Para standard: exactamente una etiqueta comercial
singles/sellado/accesorios/otros define categoria; varias contradictorias -> other.
Sin etiquetas comerciales, tipo de carta conocido o numero numerico -> singles;
sin evidencia -> other. No adivina Sellado/Accesorios desde nombres/expansiones.
main.tsx agrega esas cuatro sugerencias a Detalles > Categorias, reutilizando
el flujo de tags existente. No agrega schema, backfill ni ruta de escritura;
no altera publicaciones, precio, stock ni reglas de claim/reservas.

QA: 48 tests focalizados de frontend/dominio/DB, lint/tipos/build completo,
Chrome con lecturas simuladas y cero escrituras en siete anchos. DB temporal
usa updateInventoryItemTags para mover productos y comprueba categoria publica,
filtrado, privacidad de tags y que cantidades/reservas/precios/publicacion no
cambien. Mantener tags privados: solo exportar la categoria comercial calculada.

## Redisenio comercial de tienda - 2026-10-12

storefront.tsx/css reorganizan la misma API publica, sin cambios backend/schema:
encabezado con busqueda, navegacion por cardType, banner de marca y CTA al
catalogo, filtros laterales con expansion buscable/radios, idioma/condicion/tipo,
chips removibles y grilla/lista. Navegar un tipo limpia filtros anteriores;
cambiar cualquier filtro reinicia offset. Facets y resultados previos persisten
durante carga, con acciones de detalle deshabilitadas hasta respuesta vigente.
Movil <=900 px usa un unico formulario dentro de dialog nativo; no duplica
controles. Resize al escritorio cierra filtros y restaura scroll. Detalle tambien
usa dialog con foco/escape y bloqueo temporal de scroll del body.

Arte original mobile-app/assets/ultimo-turno-splash-source.jpeg copiado sin editar
a public/brand/ultimo-turno-artwork.jpeg (193 KB), usado como fondo de banner.
No publicar productos/promociones inventadas. Los productos siguen usando sus
imagenes reales sin filtros ni recorte; objeto contain y alto maximo 420 px.
Lucide React 1.55.0 importado solo por tienda, tree-shaking de iconos. No cargar
bundle/estilos/sesion privados en raiz. Helper storefront-filters.ts tiene tests
de chips, etiquetas y busqueda de expansion con acentos. Precio visual ARS omite
centavos cero, conserva centavos no cero y el valor numerico; no conversion.

QA: 38 tests frontend/catalogo y lint/tipos/build completo. Chrome con respuestas
publicas simuladas y escrituras/lecturas privadas bloqueadas, siete anchos,
banner y primeras secciones visibles, imagenes reales, grilla/lista, filtro movil,
busqueda, chips, tipos, orden, paginacion/recarga, modales/scroll y errores.
Checkout/carrito/cuentas de compradores siguen pendientes; Ver detalle no compra.

## Paleta de tienda - 2026-10-12

storefront.css usa los valores efectivos de la capa Everyday polish de styles.css:
bg #08080a, surface #121216, surface-2 #18181d, border #2c2c34, text #f5f5f6,
muted #b0b0b8, accent #e82a40 y accent-2 #ff4b61. Variables locales --shop-*;
no importar estilos/bundle privado en la raiz publica. HTML color-scheme dark.
Imagenes originales sin tintes/filtros; disponibilidad verde y foco rojo visible.
Solo estilos/metadata, sin cambios de API/schema/logica ni escrituras de datos.
QA Chrome con respuestas simuladas y bloqueo de escrituras: paleta comparada
contra estilos computados del admin, textos >=4.5:1, seis anchos, estados
vacio/error, imagenes, filtros/paginacion/dialogo. 35 tests y lint/tipos/build web.
Scripts/capturas de QA en .work, fuera de Git.

## Catalogo publico y publicacion - 2026-10-12

La raiz deja de ser apertura pendiente: index.html carga storefront.tsx/css,
React separado de main.tsx, sin sesion ni API privada. Busqueda/filtros/orden
en URL, 36 por pagina, imagenes reales y dialogo de detalle; estados vacio/error.
No hay carrito, checkout ni pagos. Mantener noindex hasta apertura comercial.

0061_storefront_catalog.sql agrega inventory_items.storefront_published false,
indices de publicacion y claim linkage e invalida stock_read_snapshots. Registrar
migracion sin alterar orden previo. Stock privado siempre devuelve la bandera;
parseStockSnapshot rechaza versiones anteriores sin ella. PUT /inventory/storefront
solo admin, ids UUID unicos del negocio, lote atomico con locks, audit y expiracion
del snapshot/cache. Estado idempotente; no toca stock/precios. Inventario expone
checkbox en detalle y acciones de seleccion, con bloqueo mientras guarda y rollback
visual si falla. Web habilitada no equivale a visible.

GET /api/store/catalog es anonimo, solo lectura, negocio fijo slug ultimoturno.
packages/db/src/storefront.ts selecciona DTO whitelist de producto/variante,
imagen HTTP(S), precio ARS y freeQuantity central (no resta dos veces reservas
de ordenes asignadas). Solo active + available + publicacion explicita + ARS>0.
Excluye todo item enlazado a claim open, por inventory_item_id, inventory:UUID
o PriceCharting del producto/variante, porque el claim reserva recien al cerrar.
No usa snapshot privado/cache, propietarios, costos, notas ni identificadores
en respuesta. Folder usa precio manual de venta, nunca valuacion del contenido.
Contrato, filtros acotados y paginacion compartidos en domain/store-catalog.ts.

QA: 160 pruebas de regresion completas; tests nuevos y ampliados de catalogo,
roles, lotes atomicos, flags ocultas, disponibilidad, claim y DTO publico.
Chrome sobre build y API con nueva base PGlite temporal, seis anchos, imagenes,
filtros/paginacion/modal/errores, publicacion individual/lotes y auth privada.
No publicar items reales como prueba, ni crear ordenes/claims en produccion.
Scripts y capturas locales en .work (ignorados, sin secretos en Git).

Siguiente: confirmar forma de pago/entrega, carrito y checkout Web con precio
validado en servidor, reserva atomica, idempotencia, limites y expiracion.
No asumir que compartir DB resuelve concurrencia ni habilitar claims y tienda
simultaneamente para el mismo item sin conservar la exclusion.

## Raiz publica y rutas privadas - 2026-10-11

index.html + storefront.ts/css es un documento publico de apertura pendiente,
sin React/admin, login, API privada ni lectura de sesion. No es una tienda
operativa todavia. admin.html mantiene main.tsx: panel/login solo bajo /admin,
settings en /admin/configuracion. admin-routing.ts centraliza los 15 paths,
tipos y lectura de URL. Flags mobile/revendedor en la raiz no abren el panel.

vercel.json conserva API/imagenes, redirige rutas privadas anteriores a su
equivalente /admin y reescribe cada seccion hacia admin.html; no usa un catch-all
que tape sw/manifest. Vite/preview reutilizan esas reglas de paginas y headers.
Queries sobreviven a redirects; navegacion, roles y preferencias se mantienen.
Portal conserva sus URLs y vuelve a su login al salir, sin instalar PWA admin.
Torneos sigue en su HTML/espacio separado, sin cambios de logica o cuentas.

public/admin/sw.js y manifest.webmanifest: scope/start_url /admin. El id /inicio
del manifest se conserva solo como identidad de instalaciones existentes.
El worker no maneja tienda, portal, Torneos ni API; cachea solo shell privado
y archivos estaticos publicos. ignoreVary para esos assets evita misses del
Vary: Origin de Vite preview, sin cachear datos personalizados.
public/sw.js es un worker de retirada. legacy-stock-worker.ts desregistra solo
el worker global antiguo y borra solo su cache; no borra sesiones/localStorage.
Usuarios de instalaciones anteriores deben abrir una vez con internet.

QA local sobre build: 15 rutas sin sesion, login profundo, Atrás/recarga,
ficha con query, propietario restringido, logout y shell offline. Raiz sigue
publica aun con sesion y no carga bundles/API admin. Chrome a 1440/768/390/320;
32 tests frontend y lint/typecheck/build, QA anterior de Inventario/operaciones.
GET anonimos a API de produccion stock/sales/claims devuelven 401. Mover URLs
no reemplaza autenticacion; no se modifica backend ni se publican datos reales.

Siguiente: ecommerce. Aun faltan DTO/publicacion, carrito y checkout seguro.
El claim actual reserva al cerrar y puede agregar stock faltante: no habilitar
sus mismas unidades en ambos canales sin exclusion/coordinacion transaccional.

## Consistencia operativa, segunda entrega - 2026-10-10

Ordenes tablero/lista, Caja y Compras usan WorkspaceToolbar. Los archivos
operational-preferences.ts y use-operational-preferences.ts pasan de pendientes
a integrados: preferencias sanitizadas/versionadas por scope business/user y
sector; sin carritos, seleccion, tokens ni borradores. Hook evita persistir el
scope anterior al cambiar de usuario; vistas se montan con key del scope.
No hay vistas con nombre ni sincronizacion de preferencias entre dispositivos.

Ordenes agrega vistas de tareas con estados/lineas y saleOwed existente para
ARS/USD. Elegir tarea en lista limpia el filtro secundario; usar un filtro
secundario limpia la tarea para evitar intersecciones ocultas. Mantiene boards,
drag/drop, acciones, seleccion y reglas. Board/lista recuperan estados separados.

Caja filtra solo movimientos; resumenes generales y formulas se conservan.
Fecha del registro usa createdAt en saldos/compras y completedAt o createdAt
en ventas cobradas. Calendario Buenos Aires para Hoy/Este mes. Ver mas aumenta
el limite de las listas; se excluyen compras canceladas. Compras registradas
no equivale a deuda del proveedor. MoneyOverview y CostFillPanel en details,
sin retirar funciones existentes. Compras pagina catalogo de 18 en 18 sin
alterar la compra en preparacion; su carrito sigue sin persistencia local.

operational-workspace.css posterior al legacy, scoped a los tres sectores:
bandas sin paneles flotantes, dock duplicado oculto, encabezados sin solaparse
e indicadores visibles en tablet/movil. No modifica estilos de Torneos.
QA Chrome en seis anchos, fixtures de lectura y bloqueo de escrituras; tareas,
recarga/scope/storage lleno, resultados extra y borrador conservado. 26 tests
frontend, lint/typecheck/build web y QA previa de Inventario/Revendedores.
Sin modificaciones de backend/schema ni operaciones ficticias en produccion.

## Inventario sin saltos ni desbordes - 2026-10-09

InventoryQuickIntake deja de montarse dentro del article: InventoryView abre
ResellerAdminDialog independiente, con el item desde allItems. Conserva POST
intake y PUT de precio; onBusyChange bloquea cierre y Escape durante peticiones.
El guard de Escape respeta defaultPrevented de los dialogos existentes.

inventory-layout.css se carga despues del legacy: imagen proporcional, precio
en fila completa, controles contenidos y editor central a ancho completo.
Los selectores detail-grid > div solo estilizan celdas, no divs internos.
matchMedia actualiza el tamano de pagina al redimensionar, evitando que abrir
un editor dispare tardamente el cambio de cantidad de tarjetas renderizadas.

Chrome verifica seis anchos (1788/1440/1024/768/390/320), dos densidades,
posiciones estables al abrir Stock, foco, cierre bloqueado y guardado simulado.
20 tests frontend, lint/typecheck y build web correctos. Sin cambios de backend,
schema ni pruebas con escrituras en produccion. Ordenes/Caja/Compras sigue pendiente.

## Consistencia operativa, primera etapa - 2026-10-09

WorkspaceToolbar (tsx/css) se comparte entre Inventario y busqueda del equipo
de Revendedores. No cambia fichas/solicitudes ni logica financiera. CSS posterior
al legacy limita overrides al componente; inventario sin toolbar/section cards
flotantes y controles/densidad compactos, con limites verificados en movil.

inventory-views.ts concentra defaults, presets y preferencias versionadas.
Clave localStorage por businessId + userId de /auth/me; solo filtros/densidad y
20 vistas con nombre, IDs validados y limites. Lectura/escritura sanitizadas,
sin guardar tokens, items, cantidades ni carrito. Fallos de storage no bloquean
inventario; guardar muestra error y mantiene el dialogo. No hay sync en nube.
Bootstrap restaura una vez por scope antes de habilitar persistencia; cambios
de filtros no borran vistas. Save captura busqueda pendiente; salir del sector
aplica el borrador pendiente antes de desmontar. QuickOrder/calidad usan defaults
completos para no heredar propietario/categoria/tipo/idioma ocultos.
Aplicar una vista o Restablecer incrementa searchResetKey: invalida el borrador
de busqueda aun cuando el query aplicado ya estaba vacio, sin esperar debounce.

UI: presets En stock, Disponibles, Coleccion / no venta (not_for_sale en stock),
Reservadas; guardar/abrir/actualizar/eliminar vistas, confirmacion en dialogo
accesible existente; chips con quitar filtro, export/reset y densidad visibles.
No hay migracion, endpoints nuevos ni cambios de datos en produccion.

check:new completo: 127 tests, DB temporal en D, lint/tipos/build. QA local
Chrome en 1788/1440/768/390/320 px sin escrituras operativas. Siguiente alcance:
Ordenes/Caja/Compras y vistas operativas propias, no presentar todo el punto 1
como terminado ni prometer sincronizacion de vistas entre dispositivos.

## Solicitudes compactas - 2026-10-09

Se reemplazo el markup reseller-request-* del admin por ra-request-* aislado
en reseller-admin.css, sin afectar estilos del portal. La cascada legacy fijaba
referencias a ancho completo y acciones a 210 px, generando filas de ~260 px y
botones partidos. Ahora filas desktop de ~130 px, imagen 72x101, ancho maximo
1280, referencias compactas y campos/acciones juntos. Tablet/movil reorganizan
areas sin scroll horizontal; comandos de lote abreviados solo en movil.
CardArt usa globalStock enriquecido/fallback y placeholder Sin imagen discreto.
Se mantienen endpoints, validacion, idempotencia, borradores y precio central.

QA local con cuatro solicitudes, precios largos y referencias mixtas en
1788/1440/1280/1024/820/768/390/320 px. Se verificaron limites de cada control,
altura de fila, copia de referencia, seleccion, persistencia entre pestanas,
aprobacion parcial y rechazo; ninguna escritura en produccion.
Lint/typecheck, 12 tests de frontend y build web. No cambios de DB/schema.

## Administracion visual de revendedores - 2026-10-09

ResellersAdminView abre en vista de equipo sin seleccionar automaticamente
el primer perfil. reseller-admin.ts agrupa busqueda/filtros/orden, totales,
ventas mensuales (Buenos Aires), movimientos reales y validacion de URL.
reseller-admin.css limita estilos al admin y sus dialogos; portal conserva su UI.

Ficha por pestanas montadas/ocultas para mantener filtros y borradores durante
la sesion; revendedor/vista en query recuperan ficha al recargar. Cambiar destino
descarta borradores con confirmacion. Owner solo dispone de resumen/mercaderia.
Mercaderia reutiliza ResellerStockBrowser/Card; entrega por lote desplegable,
detalles visuales y opcion de consultar agotadas. Precios se etiquetan centrales.

ResellerAdminDialog contiene foco, restaura foco/scroll y bloquea cierre durante
operacion. Alta, devolucion, rendicion y anulacion usan endpoints existentes.
Ref/version de mutaciones evita doble envio y refrescos antiguos. Si una
respuesta POST no se confirma, no se habilita reenvio del dialogo; revisar
movimientos antes de registrar otra vez. PUT de cupo/precio puede reintentarse.
No se agrega idempotencia a singles; lotes conservan su mecanismo anterior.

Cuenta muestra debitos netos de ventas confirmadas y creditos de settlements,
sin asociar retrospectivamente pagos a ventas ni reconstruir saldos historicos.
No hay migracion ni modificacion de reglas stock/cuenta. Proximas etapas:
comprobantes/historial de entregas/devoluciones, pagos por ventas seleccionadas,
configuracion ampliada; no implementar botones ficticios ni backfills financieros.

Validacion: lint/typecheck, 119 tests, db:verify y build completos. Chrome local
1440/390/320 px cubre equipo, ficha, dialogos, foco, Atras/reload, borradores,
alta, aprobacion, entrega, venta, devolucion, anulacion y rendicion. Respuesta
perdida de pago bloquea reenvio; PUT de precio/cupo permite recuperacion.
Portal conserva imagenes y bloqueo de venta para cartas reservadas.
No hubo escrituras en produccion. Fixtures/capturas quedan ignorados en .work.
Si PGlite aborta al crear temporales, revisar espacio en C: esta ejecucion uso
TEMP/TMP=D:/UltimoTurno/Stock/.work/reseller-admin-temp, sin borrar archivos.

## Lotes de revendedores - 2026-10-08

`packages/db/src/reseller-batches.ts` expone solicitudes, entregas directas y
aprobacion/rechazo por lote (1..100 lineas unicas). Reutiliza las mismas operaciones
individuales mediante helpers applyResellerStock* e inventoryTransaction; el
dashboard se calcula una vez al terminar. Se bloquea perfil/cupo y los items en
orden estable. Si falla cualquier linea, movimientos, precios, pedidos y recibo
se revierten juntos. No se reduce cantidad fisica para una asignacion.

0058_reseller_batches.sql crea recibos de idempotencia por negocio/actor/clave;
el hash incluye operacion, destino y lineas canonicas. Mismo lote devuelve
dashboard actual con replayed=true; otra carga con esa clave falla. No se escriben
datos de prueba ni se reinicializan tablas reales. Snapshots derivados se invalidan
en la misma transaccion; la API elimina cache en memoria en asignacion/resolucion.

Rutas: POST /reseller/portal/assignment-requests/batch (reseller),
/resellers/:id/assignments/batch (admin/stock_owner con propiedad),
/resellers/:id/assignment-requests/batch (admin). Cantidad aprobada <= pedida;
la linea queda resuelta incluso si se aprueba menos. No se recrea el sobrante.
No venta se bloquea tambien en singles y en venta; el dashboard conserva en mano
pero vendible=0 para No venta/inactivos.

Web: ResellerBatchReview y useResellerBatchOperation en main.tsx; helpers/tests
en reseller-batch.ts/test.ts y estilos scoped en reseller-batch.css. Ref evita
doble click, claves separadas por ruta se mantienen para reintentos durante la
sesion del componente (no tras reload) y versiones descartan refrescos antiguos.
Lote de entrega revisable, seleccion persistente entre filtros, aprobacion
seleccionada y borradores limpios al cambiar de revendedor. Revisado en Chrome
1440/390/320 px, incluyendo respuesta perdida tras commit y replay confirmado,
cantidades parciales, rechazo seleccionado, cambio de destino y entrega repetida.
QA solamente en PGlite local; pruebas automatizadas usan bases temporales.

## Catalogo visual de revendedores - 2026-10-08

`ResellerStockBrowser` y `ResellerStockCard` en main.tsx comparten grilla/lista
entre Mi stock y Stock global. Filtros puros/testeables en reseller-catalog.ts;
estilos acotados en reseller-catalog.css, separados de las cascadas del portal legado.
getResellerDashboard enriquece variantes/tipos/imagenes en lote desde inventario
y catalogo, sin exponer costos ni propietarios. En mano y vendibles siguen separados.
Vender agrega al carrito existente; no crea ventas. Sin migraciones ni backfill.
Pruebas de filtros y lectura en reseller-catalog.test.ts (web/db) y Chrome local
en 1440/390/320 px con imagenes reales de checklist y unidades reservadas.

## Tipos de cartas - 2026-10-08

Clasificacion automatica en inventario actual, altas y contenidos de carpetas.
`packages/db/src/card-types.ts` normaliza atributos de TCGCSV/PokemonTCG; Grass,
Fire, etc. identifican Pokemon, no energias. Supporter/Item/Stadium/Tool/Energy
se toman de atributos explicitos. Conflictos quedan unknown, con fallback al
checklist ingles exacto de 151. No se usan nombres aislados ni variantes foil.

Las lecturas de stock/catalogo agregan tipos en lote desde `evidence_json` del
indice; se excluyen referencias weak_match, conflict o rechazadas. No hace falta
un backfill que reescriba inventario. La migracion 0057 agrega solo
`inventory_items.card_type_override` nullable e invalida snapshots de lectura.
El override es por item, respeta permisos existentes y se conserva al sumar stock.
Vaciarlo en edicion vuelve al tipo automatico; unknown manual sigue siendo manual.
Snapshots antiguos sin tipos se vuelven a generar. Carpetas no reciben tipo de
carta, pero sus entradas si. UI filtra por tipo, separado de tags/estado/acabado.
Tests aislados en `packages/db/src/card-types.test.ts`; no probar sobre produccion.

## Carpetas - 2026-10-08

La creacion especifica de `Master Set 151` fue reemplazada por `Crear carpeta`
dentro de Agregar stock. Cada carpeta es un item unico; su contenido y valuacion
PriceCharting se editan desde Detalles > Contenido. La plantilla opcional de 151
incluye 207 cartas, 153 reverse y ocho energias; las promos se agregan a mano.
El valor se calcula con el cache actual y el dolar vigente sin modificar el precio
de venta ni crear singles. La migracion aditiva es `0056_inventory_folders.sql`.
No convertir ni recrear datos existentes para probar; usar bases temporales.
Verificar siempre el nuevo commit mediante `git log -1` y `/api/public-status`.

Contenido ahora abre como grilla de cartas, con vista de lista, busqueda por
nombre/numero y filtros de variante/referencia/precio. Usa imagenes del cache
Supabase/indice y arte de checklist para las cartas numeradas de la plantilla
151. El arte normal/reverse es compartido y la variante se muestra por separado;
las ocho energias y promos sin imagen permanecen explicitamente sin imagen.
No confundir referencias sin vincular con cartas fisicamente faltantes.
Verificado en localhost con imagenes cargadas y viewports 1440, 390 y 320 px.

Se corrigio la omision de carpetas en Inicio/Caja: `moneySnapshot` ahora usa
`stockItemValues` de `apps/admin-web/src/stock-value.ts`. El contenido se valua
al dolar vigente, suma una vez y se desglosa como `Coleccion / no venta`.
Inicio conserva libres/asignadas y suma no venta; Caja agrega tambien reservadas.
El precio manual solo se usa para venta/ganancia potencial, sin incluir coleccion.
Tests monetarios en `apps/admin-web/tests/stock-value.test.ts`, incluidos en npm test.

## Aviso vigente - 2026-10-07

Este documento contiene historia extensa del proyecto. Para estado operativo y
prioridades actuales usar primero:

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/NEXT_STEPS.md`

La plataforma ya no es solo local: produccion corre en Vercel con
Supabase/Postgres y Supabase Storage. Cualquier afirmacion historica mas abajo
que diga que no hay Supabase remoto, que no se debe desplegar o que el sistema
es solo un prototipo queda reemplazada por los tres documentos anteriores.

Reglas que siguen siendo obligatorias:

- usar `D:\UltimoTurno\Stock`;
- no guardar secretos en Git;
- preservar el claim activo y las ordenes reales de produccion;
- revisar `git status` antes de editar;
- validar y desplegar incrementalmente.

Estado Git y produccion al cerrar este traspaso:

```text
Rama: main
Base funcional desplegada y confirmada: 3b06aa7
Produccion: https://ultimoturno.app/
DB: Supabase/Postgres por transaction pooler
Storage: Supabase Storage
Perfil: PILOTO REAL
Verificacion: lint, typecheck y build OK; 92/92 tests; /api/public-status OK;
PostgreSQL online accesible
```

Cambios recientes resumidos:

- carga inicial por sector en lugar de unas 18 APIs globales; los refresh de
  operaciones tambien quedan acotados a la vista activa;
- respuestas JSON compactas y gzip para payloads grandes: `/stock` paso de
  2.510.223 bytes sin compresion a 344.611 bytes transferidos;
- Cargar stock ya no pide `/stock` ni el contador lento del catalogo al abrir;
- carga de stock en pagina completa y sin reapertura del modal viejo;
- version movil compacta de carga de stock, con filtros horizontales, buscador
  en una fila, resultados densos y espacio para teclado/barra del navegador;
- busqueda de catalogo mas rapida, filtros de idioma y prioridad al stock;
- sincronizacion sectorial sin recargar toda la pagina y snapshots compartidos
  de stock para reducir consultas repetidas;
- imagenes con fallback directo/proxy seguro y tarjetas de tamano estable;
- buscador del claim arriba, cantidades agrupadas y ciclo claim-stock-venta;
- sistema de revendedores en consignacion publicado en produccion;
- portal propio con carrito, comision, saldo, ventas y stock asignado;
- pedidos sin reserva de stock, stock global de solo lectura y estados de
  preparacion/cobro.
- PWA instalable y experiencias moviles dedicadas para Ordenes, Revendedores,
  Inicio, Inventario, Caja y Claims;
- vencimiento por defecto a 7 dias para nuevas ordenes y claims;
- carga administrativa de costos por porcentaje del precio de venta o CSV
  `sku,costo,moneda`, con costo total y ganancia potencial en Caja;
- pagos parciales independientes en ARS y USD, incluidos deuda restante, pago
  completo y fusion de ordenes duplicadas.

Regla central de consignacion: asignar stock a un revendedor no lo quita de la
venta general. UltimoTurno conserva prioridad. Al confirmar la venta del
revendedor se revalida stock real en transaccion y recien entonces se descuenta.

Migraciones vigentes mas recientes:

```text
0049_sales_reseller_assignment.sql
0050_login_attempts.sql
0051_price_history.sql
0052_default_payment_due.sql
0053_sale_amount_paid_usd.sql
```

## Prompt vigente para el proximo chat

```text
Estamos trabajando en UltimoTurno. Usa exclusivamente el workspace
D:\UltimoTurno\Stock; no uses C:\Users\skype\Documents\Stock.

Antes de responder o modificar archivos, lee:
1. AGENTS.md
2. docs/PROJECT_STATUS.md
3. docs/NEXT_STEPS.md

Luego revisa git status y confirma el commit actual. Produccion funciona en
https://ultimoturno.app/ con Vercel, Supabase/Postgres y Supabase
Storage. La base funcional de produccion confirmada al cerrar este traspaso fue
`3b06aa7`; verificar igualmente `git log -1` y `/api/public-status` porque puede
haber commits documentales o despliegues posteriores.

Hay un claim activo, ordenes y stock reales: no los elimines, canceles ni
recrees durante pruebas. No guardes secretos en Git.

El sistema de revendedores ya esta online. Es consignacion blanda: el stock
sigue disponible para UltimoTurno, que tiene prioridad; la venta del revendedor
revalida y descuenta stock al confirmarse. El portal incluye ventas, pedidos,
stock propio, stock global de solo lectura, comisiones, rendiciones y estados
de preparacion (A embalar/A entregar/Entregado) y cobro (Pendiente/Pagado).

La carga de stock movil esta adaptada para pantallas de hasta 620 px: oculta el
chrome global, compacta filtros y resultados, mantiene campo y lupa en una fila
y reserva espacio para el teclado y la barra inferior del navegador.

La plataforma es una PWA instalable. Ordenes y Revendedores tienen flujos
moviles dedicados; Inicio, Inventario, Caja y Claims tienen navegacion,
metricas, tarjetas y formularios compactados para pantallas de hasta 700 px.

Las ordenes y claims nuevos vencen por defecto a 7 dias. Caja puede completar
costos faltantes por porcentaje o CSV `sku,costo,moneda`. Las ordenes admiten
pagos parciales independientes en ARS y USD; no convertir ni mezclar monedas al
calcular saldos.

Objetivo inmediato: validar con una muestra pequena el vencimiento a 7 dias, la
carga de costos y una cobranza parcial ARS/USD. Despues validar
`/inventario/cargar-stock` desde telefonos y la sincronizacion entre dos
sesiones; luego pilotear revendedores, imagenes faltantes y CSV reales.
```

---

## Archivo historico

Actualizado: 2026-08-24

Este documento permite continuar el trabajo desde otra cuenta de Codex en la
misma PC sin depender del historial del chat anterior.

## Estado operativo actual - 2026-08-24

Workspace activo:

```text
D:\UltimoTurno\Stock
```

La API local esta corriendo y responde en:

```text
http://127.0.0.1:4000
```

Perfil y base activa segun `GET /health`:

```text
Perfil: PILOTO REAL
Ejemplos: deshabilitados
Base: D:\UltimoTurno\Stock\apps\api\.data\ultimoturno-pilot-real
Imagenes: D:\UltimoTurno\Stock\apps\api\.data\pricecharting-images
```

Foto de datos tomada el 2026-08-24:

```text
SKUs: 438
Unidades totales: 138
Reservadas: 137
Disponibles: 1
Valor disponible: $125.000 ARS
Ordenes activas: 87
Ordenes entregadas: 26
Ordenes canceladas: 1
Compras registradas: 0
Claim activo: Claim 18 de agosto
Claims historicos: 7
Items con reserva: 130
```

El 2026-08-21 se ejecuto un reset controlado para empezar una carga completa de
stock: se bajo el stock disponible a cero preservando las reservas de ordenes.
Despues de ese reset la base quedo con `totalUnits = reservedUnits` y
`availableUnits = 0`. Al 2026-08-24 hay nuevamente `1` unidad disponible, por
lo que no asumir que el inventario sigue exactamente igual que al terminar el
reset.

Respaldos logicos del reset:

```text
D:\UltimoTurno\Stock\outputs\stock-before-reset-2026-08-21T10-07-04Z.json
D:\UltimoTurno\Stock\outputs\stock-before-reset-2026-08-21T10-06-52Z.json
```

Script reutilizable del reset:

```text
D:\UltimoTurno\Stock\scripts\reset-available-stock-api.ps1
```

Este script trabaja por API local y preserva reservas. No abrir PGlite directo
si la API esta corriendo.

## Cambios recientes importantes

- `Importar stock` tiene ahora un bloque de carga rapida: una carta por linea
  con separador `|` o tabulacion. Convierte a CSV y genera vista previa en un
  click.
- La carga rapida acepta este formato:

```text
Nombre | Expansion | Numero | Cantidad | Precio USD | Precio ARS | Variante | Ubicacion
Abra | Scarlet & Violet 151 | 63 | 2 | 0.91 | 1500 | reverse | Caja A
Team Rocket's Mewtwo Ex | Ascended Heroes | 281 | 1 | 535.5 | 850000 | PSA 10 | Vitrina
```

- `Importar stock` incorpora `Resolver seguras`, que resuelve coincidencias de
  alta confianza contra PriceCharting o stock existente y deja las dudosas para
  revision manual.
- `Inventario / Venta` tiene edicion rapida de `Disponible`: se escribe el
  disponible final y el sistema registra el ajuste de stock por diferencia.
- `Ordenes` trabaja con tableros generados desde claims cerrados y un tablero
  `Pedidos` para ordenes externas. Las tarjetas se abren haciendo click en la
  tarjeta; el boton `Abrir` fue eliminado.
- `Ordenes` tiene acciones rapidas de `Mensaje`, `Pago`, `Entrega` y
  `Eliminar`. Eliminar es una cancelacion segura: libera reserva, conserva
  auditoria y saca la orden de activas.
- `Ordenes` conserva historial de `Entregadas`. Los estados tienen color tenue
  por tarjeta: pendiente, mensaje, embalada, pagada y entregada.
- `Caja` reemplaza a `Ventas` como vista financiera operativa: stock
  valorizado, deuda a cobrar, compras estimadas a pagar, ventas cobradas y
  ultimas cartas vendidas.
- `Admin` concentra mantenimiento: PriceCharting CSV, precios TCGplayer,
  indice maestro, imagenes, importacion y herramientas avanzadas.
- `Precios TCGplayer` usa TCGCSV como fuente diaria sin credenciales oficiales.
  Guarda snapshot local por `tcgplayer_product_id` + `sub_type_name`, con
  scheduler a las `18:30` hora local y boton manual en Admin.
- Primera carga TCGplayer real del 2026-08-24: 45.185 filas de precio, 31.216
  productos, 18.619 productos cruzados y 30.169 cartas del indice con precio.
- `Calidad` quedo como bandeja de correccion diaria de datos: imagenes,
  PriceCharting, matches debiles y conflictos.
- El modal de producto diferencia RAW y graded; permite PSA/BGS/CGC/SGC,
  nota/certificado y vista previa util.
- El forzador de imagenes acepta URL manual directa o link de PriceCharting; se
  corrigieron casos donde URLs con apostrofes o links completos terminaban como
  rutas invalidas.

## Siguiente foco recomendado

El usuario quiere empezar la carga completa de stock. El proximo trabajo deberia
centrarse en hacer `Importar stock` todavia mas rapido y confiable:

1. Mejorar el preview visual de filas importadas con foto, precio, variante,
   accion y decision en una grilla mas densa.
2. Agregar acciones batch sobre filas revisables: crear todas sin stock previo,
   ignorar seleccionadas, elegir primer PriceCharting seguro, exportar solo
   dudas.
3. Agregar guardado/recuperacion de borrador de importacion para no perder una
   carga larga.
4. Registrar importaciones por lote con resumen historico y posibilidad de
   auditoria/reversion logica.
5. Mantener las ordenes intactas: nunca bajar `quantityOnHand` por debajo de
   `quantityReserved`.

## Prompt corto para iniciar la nueva conversacion

Copiar y pegar esto en la nueva cuenta:

```text
Estamos continuando UltimoTurno desde el workspace
D:\UltimoTurno\Stock.

Antes de modificar archivos, lee en este orden:
1. docs/new-platform/HANDOFF_NEXT_ACCOUNT.md
2. docs/OPERATING_MODEL.md
3. docs/new-platform/LOCAL_DEVELOPMENT.md
4. docs/new-platform/DATA_MODEL.md
5. docs/new-platform/MIGRATION_STRATEGY.md

Inspecciona tambien git status y el codigo actual. El documento de traspaso es
mas reciente que los otros documentos si hay contradicciones.

Estamos trabajando en la NUEVA VERSION. LEGACY debe seguir operativo y no debe
ser modificado salvo que yo lo pida expresamente. No agregues login: el usuario
aclaro que no lo quiere. No elimines Ventas, Compras, Ordenes, Movimientos ni la
revision visual de Importaciones. No conectes Google Sheets, PriceCharting,
Supabase remoto ni datos reales sin autorizacion.

Objetivo siguiente: preparar el primer ingreso controlado de stock real. Primero
separa una base piloto de la base con ejemplos, endurece el parser CSV, genera
una previsualizacion y conciliacion completa, y no apliques la importacion real
sin confirmacion explicita del usuario.

Trabaja de manera incremental: inspecciona, implementa, verifica con
npm run check:new y deja una forma clara de probarlo.
```

## Resumen ejecutivo

UltimoTurno tiene dos sistemas que deben convivir:

1. LEGACY, actualmente operativo.
   - Google Sheets + Apps Script.
   - App Expo/React Native en `mobile-app/`.
   - Generador de claims, ventas, ordenes, caches e importaciones existentes.
   - Debe seguir funcionando y no depende de la nueva plataforma.

2. NUEVA VERSION, en desarrollo activo.
   - Monorepo npm workspaces con TypeScript.
   - Web administrativa React + Vite.
   - API Node HTTP.
   - PostgreSQL embebido persistente mediante PGlite durante desarrollo local.
   - Migraciones SQL compatibles con el objetivo PostgreSQL/Supabase.
   - No usa Google Sheets ni Supabase remoto. PriceCharting queda disponible
     mediante descarga manual autenticada y cache local persistente.

La nueva version ya no debe tratarse como un prototipo descartable. Las
funciones nuevas deben ser incrementales, persistentes y reutilizables en el
producto final. Los datos de ejemplo actuales solo existen para visualizar y
probar; no son inventario real.

## Decisiones firmes del usuario

- La interfaz debe estar en espanol.
- La estetica principal es negra, blanca y roja, basada en la app y el logo de
  UltimoTurno.
- No agregar login ni pantalla de autenticacion. Existe infraestructura de
  sesiones en el schema, pero no es parte de la experiencia pedida actualmente.
- Inventario y venta deben estar unidos: desde el stock se agregan cartas al
  carrito.
- El carrito debe permitir editar cantidad y precio por carta.
- Al confirmar se elige entre venta cobrada y reserva.
- Una reserva debe aparecer en Ordenes y luego poder completarse o cancelarse.
- Deben conservarse Inicio, Inventario/Venta, Ordenes, Ventas, Compras,
  Movimientos, Importar y Claims.
- Movimientos y auditoria se muestran juntos para evitar dos secciones casi
  iguales.
- Importaciones debe mostrar errores, advertencias y multiples coincidencias
  para elegir la carta correcta.
- La carga real debe venir inicialmente desde un snapshot de LEGACY, sin
  escribir en Google Sheets.
- No decidir automaticamente cual hoja es fuente final cuando Stock, Ventas
  Detalle, Ordenes y Movimientos difieren. Primero hay que conciliar.
- La futura tienda online debe reservar stock antes de confirmar el pago.
- El modelo debe admitir varios negocios a futuro, sin complicar la operacion
  actual de un solo negocio.
- No guardar secretos ni credenciales en el repositorio.
- No desplegar, tocar Git remoto ni conectar servicios con costo sin permiso.

## Preferencias de trabajo aprendidas

- Construir versiones pequenas, visibles y funcionales; evitar planes enormes
  antes de mostrar resultados.
- No pedir aprobacion por colores, nombres internos o decisiones tecnicas
  reversibles.
- No quitar funcionalidades existentes al hacer una mejora visual o tecnica.
- No volver a introducir carteles de prototipo ni pantallas vacias.
- Los numeros operativos deben ser grandes y faciles de leer.
- Los formularios se abren por una accion explicita. No deben quedar flotando al
  final de paginas largas.
- No iniciar servidores desacoplados desde Codex ni dejar comandos esperando
  indefinidamente. Para el usuario existe un lanzador que abre dos PowerShell.
- Ejecutar lint, typecheck, tests, verificacion DB y build al cerrar cambios.

## Arquitectura actual de la nueva version

```text
package.json                         scripts del monorepo
apps/
  api/                               API Node HTTP, puerto 4000
  admin-web/                         React + Vite, puerto 5173
packages/
  db/                                PGlite, SQL, repositorios y operaciones
  domain/                            tipos y reglas compartidas
  importers/                         normalizacion y conciliacion
docs/new-platform/                   documentacion de la nueva plataforma
scripts/                             validaciones y lanzador local
apps/api/.data/ultimoturno-pglite/   base persistente local usual, ignorada por Git
Abrir UltimoTurno Nueva App.cmd      inicia API y web en dos ventanas
```

Flujo local:

```text
React/Vite -> HTTP API -> operaciones de packages/db -> PGlite persistente
```

La API crea el negocio y un actor `Sistema local` automaticamente. La web no
pide credenciales y no conserva cambios solamente en memoria del navegador.

## Funcionalidad existente

### Inicio

- Resumen de SKUs, unidades, reservadas, disponibles y valor ARS.
- Ventas de semana y mes.
- Cantidad de ordenes e importaciones pendientes.
- Inventario destacado, actividad y auditoria recientes.

### Inventario / Venta

- Datos persistentes servidos por la API.
- Busqueda inteligente por tokens y ranking: soporta casos operativos como
  `psyduck 44`, usando el primer numero como numero principal de carta y
  priorizando coincidencias nombre + numero.
- Orden por nombre, precio o cantidad.
- Filtros avanzados plegables.
- Imagen o placeholder, precio y disponibilidad legibles.
- Detalle de producto y ultimos movimientos en panel lateral.
- Alta y edicion en modal, abierto solo con `Nuevo producto` o `Editar`.
- Ajustes de cantidad con motivo y movimiento de inventario.
- Carrito lateral con cantidad y precio editable por linea.
- Confirmacion como venta cobrada o reserva.
- Los precios visibles muestran USD y ARS blue cuando hay precio USD o ARS.
  El frontend usa `/exchange-rate/blue`. Por defecto
  (`ULTIMOTURNO_BLUE_RATE_MODE=promedio`) el backend promedia la venta del
  dolar blue y cripto de DolarAPI (cache 10 minutos). `auto` usa solo blue y
  `manual` usa fijo `ULTIMOTURNO_BLUE_RATE_ARS` (1540 por defecto), que
  tambien es el respaldo si DolarAPI no responde.
- Notificaciones compactas que desaparecen automaticamente.
- Diseno responsive comprobado en escritorio, tablet y celular.

### Ordenes

- Lista reservas persistidas.
- Permite completar o cancelar una reserva.
- Completar descuenta stock; cancelar libera la cantidad reservada.

### Ventas

- Lista operaciones persistidas.
- Resumen semanal y mensual inicial.
- Conserva cliente, canal, lineas, cantidades y precios de venta.

### Compras

- Flujo persistente de compras sobre productos ya existentes o resultados del
  cache local de PriceCharting.
- Registra vendedor, nota, cantidades y costo por linea.
- Suma stock y crea movimientos.
- Incluye un buscador sobre el cache local real de PriceCharting.
- Desde un resultado PriceCharting se puede presionar `Comprar`, cargar
  cantidad/costo y registrar la compra. Si la carta ya existe por
  `priceChartingId`, suma stock al item existente; si no existe, crea producto,
  variante e item con SKU `PKM-PC-{priceChartingId}`, link canonico e imagen
  local/remota disponible.
- El ultimo costo de compra se deriva de `purchase_items` recibidos y se muestra
  en Inventario, en el buscador de Compras y en la exportacion CSV.
- La sincronizacion se ejecuta manualmente y no modifica inventario.
- Las imagenes tienen dos fases: primero se descubren URLs reales y despues se
  descargan archivos locales. La fase rapida replica legacy: abre la pagina
  canonica de PriceCharting y extrae
  `https://storage.googleapis.com/images.pricecharting.com/.../1600.jpg`,
  `og:image` o `twitter:image`, guardando esa URL para que la app ya pueda
  mostrar la carta sin esperar la descarga local.
- Existe endpoint `POST /pricecharting-images/discover` y herramienta
  `tools/pricecharting-image-worker.ts`. El acceso directo
  `Traer URLs Imagenes PriceCharting.cmd` ejecuta el worker rapido por indice
  externo:
  `npx tsx tools\pricecharting-image-worker.ts --save=url --source=external-index --batch=1000 --sleep-ms=0 --loop`.
  El worker habla con la API local para no abrir PGlite desde otro proceso.
- Existe endpoint `POST /pricecharting-images/external-index`. Construye/cachea
  `external-image-index.json` junto a la base local usando PokemonTCG API y
  TCGdex cuando responden, matchea por nombre + expansion + numero y guarda URL
  limpia en `public_url` mas fuente trazable en `source_image_url`. Las cartas
  sin match fuerte se posponen unos minutos, no se marcan como fallidas. Si
  PokemonTCG API no responde, cae al dataset raw de GitHub
  `PokemonTCG/pokemon-tcg-data`, que en pruebas locales respondio mejor que el
  endpoint API. El worker acepta `--rebuild-index` para reconstruir ese cache
  externo sin borrar archivos a mano.
- Existe endpoint `GET /pricecharting-images/external-index/status` para que el
  worker muestre si el indice externo ya existe, cuantas cartas tiene y que
  avisos hubo al construirlo. El acceso directo rapido avisa al usuario que no
  abra ventanas duplicadas y que las primeras tandas pueden depender de ese
  indice.
- PriceCharting HTML no debe ejecutarse con alta concurrencia: PriceCharting
  documenta limites estrictos de API y en pruebas reales pidio cooldown cuando
  el worker corria tandas concurrentes. El modo HTML queda forzado a
  concurrencia 1 y delay minimo de 1000 ms. Para mas velocidad, la mejora
  correcta es indexar fuentes abiertas por expansion completa, no pegarle 90k
  veces a paginas PriceCharting. Si quedan huecos despues del indice externo,
  usar `Traer URLs Imagenes PriceCharting Fallback Lento.cmd`.
- El estado intermedio `url_found` queda registrado en
  `pricecharting_image_cache`. El panel de Compras muestra `URLs imagen` aparte
  de `Imagenes locales`, asi hay feedback aun cuando todavia no se bajaron los
  archivos.
- Para descarga local, el procesador reutiliza `source_image_url` si ya existe;
  eso evita volver a leer HTML de PriceCharting. Tambien puede intentar
  PokemonTCG API y TCGdex, validando nombre + expansion + numero antes de
  asociar imagenes externas al `priceChartingId`. Las imagenes marcadas como
  fallidas vuelven a cola cuando se ejecuta stock/all, asi mejoras del
  descargador recuperan fallos viejos sin limpiar DB a mano.
- Existe modo manual `Solo Pokemon TCG` en Compras. Ese endpoint manda
  `mode: "pokemon-tcg"` a `/pricecharting-images/process`: no usa storage/HTML
  de PriceCharting ni TCGdex. Busca por nombre + numero, primero con expansion y
  despues sin expansion, pero solo descarga/asocia si el score fuerte pasa el
  umbral para evitar imagenes cruzadas.
- El panel de imagenes de Compras muestra progreso global, estado de cola,
  ultima tanda procesada, fuentes que aportaron URLs/imagenes y errores
  recientes por `priceChartingId`. Los botones visibles priorizan la primera
  pasada masiva: `Stock primero`, `URLs masivas`, `Descargar PokemonTCG`,
  `Descargar locales` y `Auto continuo`.

### Claims

- Existe como seccion principal propia en la navegacion.
- Permite crear un claim activo persistente.
- Permite buscar cartas en el cache local de PriceCharting y agregarlas al
  claim activo sin duplicarlas dentro del mismo claim. El buscador tambien
  entiende `nombre numero`, por ejemplo `psyduck 44`, y compara contra el
  primer numero de carta aunque PriceCharting tenga `044` o el usuario pegue
  `44/62`.
- La mesa de revision permite editar precio final ARS, precio final USD,
  nombre final, comprador, tags e ignorar/restaurar cartas.
- Calcula precio sugerido ARS desde el precio USD de PriceCharting con la
  regla inicial del generador viejo: USD x 1510, redondeado hacia arriba a
  500, minimo 800.
- Permite cargar frees basicos por comprador.
- Cerrar claim agrupa por comprador y crea ordenes pendientes en `Ordenes`.
  Las lineas de claim no requieren `inventory_item_id`; quedan como lineas
  externas con nombre/SKU snapshot y no descuentan stock automaticamente.
- Completar/cancelar esas ordenes cambia el estado de la orden, pero no mueve
  stock si la linea no esta vinculada a un item de inventario.

### Movimientos

- Historial de cambios de stock.
- Auditoria basica presentada en la misma seccion.

### Importar

- Recibe snapshot CSV pegado/cargado desde la web.
- Previsualiza antes de aplicar.
- Clasifica filas como crear, actualizar, revisar o invalidas.
- Muestra advertencias y hasta tres candidatos de coincidencia.
- Requiere resolver coincidencias ambiguas y confirmar para aplicar.
- La aplicacion usa las mismas operaciones persistentes y deja auditoria.
- Cruza cada fila contra el cache local de PriceCharting antes de crear stock:
  si hay una coincidencia fuerte la asocia automaticamente con
  `priceChartingId`, URL canonica e imagen local si existe; si hay multiples
  coincidencias plausibles obliga a elegir una; si no hay ninguna bloquea la
  fila para evitar cartas sin identidad externa.
- Para japones/chino usa traduccion local cuando la conoce, pero el matching
  fuerte se apoya principalmente en expansion y numero para cubrir nombres que
  llegan sin traducir desde MonPrice.

## Endpoints actuales

- `GET /health`
- `GET /auth/me` devuelve el actor local; no hay pantalla de login.
- `GET /exchange-rate/blue`
- `GET /stock`
- `POST /inventory`
- `PUT /inventory/:id`
- `POST /inventory-adjustments`
- `GET /movements`
- `GET /audit`
- `GET /sales`
- `POST /sales`
- `POST /sales/:id/complete`
- `POST /sales/:id/cancel`
- `GET /purchases`
- `POST /purchases`
- `GET /claims`
- `POST /claims`
- `POST /claims/cards/from-pricecharting`
- `PUT /claims/cards/:id`
- `POST /claims/frees`
- `POST /claims/close`
- `GET /pricecharting-cache`
- `GET /pricecharting-cache/status`
- `POST /pricecharting-cache/refresh`
- `GET /pricecharting-images/status`
- `POST /pricecharting-images/queue-stock`
- `POST /pricecharting-images/queue-all`
- `POST /pricecharting-images/external-index`
- `POST /pricecharting-images/discover`
- `POST /pricecharting-images/process`
- `POST /examples/inventory`
- `POST /imports/snapshot/preview`
- `POST /imports/snapshot/apply`

## Base de datos

Migraciones reproducibles:

- `0001_initial_stock_readonly.sql`: negocio, usuarios/roles, catalogo,
  variantes, inventario, precios, movimientos, fuentes externas,
  importaciones, reservas, auditoria e idempotencia.
- `0002_operational_inventory.sql`: indices y estructura de sesiones. Las
  sesiones estan dormidas y no deben forzar login en la web.
- `0003_operational_commerce.sql`: ventas, lineas de venta, compras y lineas de
  compra.
- `0004_pricecharting_cache.sql`: catalogo PriceCharting e historial de
  sincronizaciones.
- `0005_pricecharting_image_cache.sql`: cola/cache de imagenes de
  PriceCharting.
- `0006_claims.sql`: sesiones, cartas y frees de claims.
- `0007_pricecharting_image_url_found.sql`: agrega estado `url_found` para
  separar URL encontrada de archivo local descargado.

Desde el 2026-08-07, el perfil operativo local por defecto es `PILOTO REAL`.
Al iniciar mediante `npm run dev:api` o el lanzador de Windows, la base usada
por defecto es:

```text
apps/api/.data/ultimoturno-pilot-real
```

El perfil `PILOTO REAL` tiene `ULTIMOTURNO_ALLOW_EXAMPLES=false`; la ruta
`/examples/inventory` queda bloqueada. Tambien existen bases anteriores de
ejemplos/prueba en `apps/api/.data/ultimoturno-pglite` y
`.data/ultimoturno-pglite`. Quedan archivadas para inspeccion, no para uso
operativo. No mezclar ni borrar ninguna sin inspeccion y confirmacion.

En la ultima revision visual contenia ejemplos y operaciones de prueba. La
pantalla mostraba 8 SKUs, 12 unidades y registros de venta/reserva. No asumir
que nada dentro de esa base es real.

Los seeds de `packages/db/seeds/` se usan para pruebas/verificacion. La API
operativa no carga seeds automaticamente. Los ejemplos visibles se cargaron
mediante la accion `Cargar ejemplos`.

## Comandos

Desde `D:\UltimoTurno\Stock`:

```powershell
npm install
npm run dev:api
npm run dev:web
```

Direcciones:

```text
API: http://localhost:4000
Web: http://localhost:5173
```

Forma recomendada para el usuario:

```text
Doble clic en "Abrir UltimoTurno Piloto Real.cmd"
```

El acceso viejo `"Abrir UltimoTurno Nueva App.cmd"` tambien apunta al piloto
real, para evitar abrir por accidente el ambiente de ejemplos. El lanzador
cierra solamente procesos de este proyecto que ocupen 4000/5173 y abre API y web
en dos PowerShell visibles.

Verificacion completa y finita:

```powershell
npm run check:new
```

Esto ejecuta lint, typecheck, tests, verificacion de migraciones/seeds y build.
La ultima ejecucion completa, el 2026-08-07, aprobo todas las etapas y 29 tests.

## Archivos principales

- `apps/admin-web/src/main.tsx`: vistas, estado, llamadas API e interacciones.
- `apps/admin-web/src/styles.css`: sistema visual y responsive.
- `apps/api/src/server.ts`: rutas HTTP.
- `packages/db/src/index.ts`: operaciones persistentes y reglas transaccionales.
- `packages/db/migrations/*.sql`: schema reproducible.
- `packages/importers/src/index.ts`: reglas de importacion/conciliacion.
- `scripts/start-new-platform.ps1`: lanzador de servidores.
- `docs/new-platform/LOCAL_DEVELOPMENT.md`: ejecucion local.

## Estado de Git y precauciones

Al 2026-08-05, `git status` muestra modificaciones anteriores en LEGACY y gran
parte de la nueva plataforma como archivos sin seguimiento:

```text
M  StockAdministrationUnified_TO_COPY.gs
M  apps-script/StockAdministrationUnified.gs
M  apps-script/StockAdministrationUnified_TO_COPY.gs
M  mobile-app/App.js
M  mobile-app/src/api.js
?? apps/
?? packages/
?? docs/new-platform/
?? scripts/
?? package.json y otros archivos raiz de la nueva plataforma
```

No revertir esos cambios. No asumir que las modificaciones de LEGACY fueron
hechas por la tarea actual. Antes de commits hay que revisar y separar nueva
plataforma de cambios legacy. El remoto conocido es:

```text
https://github.com/ultimoturno20-cloud/ultimoturnoapp
```

No hacer push sin solicitud explicita. Como el usuario cambiara de cuenta en la
misma PC, todos los archivos locales seguiran disponibles aunque aun no esten en
Git.

## Deuda y riesgos conocidos

1. `ARCHITECTURE.md` y `DATA_MODEL.md` conservan frases de la etapa demo y no
   reflejan por completo ventas/compras persistentes. El codigo y este handoff
   son mas recientes.
2. El parser CSV actual divide lineas y celdas con `split`. No soporta de forma
   segura comillas, comas dentro de nombres, saltos de linea ni todos los casos
   de Excel/Google Sheets. Debe reemplazarse antes del stock real.
3. La traduccion japones/chino es un diccionario pequeno y hay cadenas con
   mojibake. No es una traduccion de produccion.
4. El matching de importacion ayuda a revisar, pero todavia no garantiza una
   identidad canonica por expansion/numero/idioma/acabado.
5. No existe backup/restauracion operativa de la base PGlite.
6. Las bases viejas mezclan ejemplos y pruebas manuales. Nunca importar stock
   real encima de ellas. Usar solamente `apps/api/.data/ultimoturno-pilot-real`.
7. Supabase remoto no esta configurado. PGlite es suficiente para preparar y
   validar el primer snapshot local.
8. No hay conexion real con Google Sheets. PriceCharting solo descarga su CSV
   oficial cuando el usuario configura el token y presiona Sincronizar.
9. No hay pruebas end-to-end automatizadas de navegador; hubo validacion manual
   responsive con el navegador integrado.

## Siguiente objetivo: carga controlada de stock real

El trabajo debe empezar asi:

Antes de este objetivo ya quedo implementado el cache PriceCharting:

- parser CSV robusto mediante `csv-parse`;
- tablas `pricecharting_cache_entries` y `pricecharting_cache_runs`;
- descarga desde el mismo link usado por LEGACY;
- token en variable privada de Windows, nunca en Git;
- buscador y estado visibles dentro de Compras;
- no crea inventario ni cambia precios automaticamente.

Para activarlo se ejecuta `Configurar PriceCharting.cmd`, se reinicia la nueva
app y se presiona `Sincronizar cache` en Compras.

### 1. Separar entornos

- Mantener `.data/ultimoturno-pglite` como base de ejemplos.
- Crear un perfil piloto, por ejemplo
  `.data/ultimoturno-pilot-real`, mediante `PGLITE_DATA_DIR`.
- Agregar una identificacion visual clara de `EJEMPLOS` o `PILOTO REAL`.
- No borrar la base actual sin confirmacion.

### 2. Fortalecer entrada de archivos

- Reemplazar el parser manual por un parser CSV probado.
- Soportar UTF-8, BOM, `,` y `;`, campos entre comillas y saltos de linea.
- Aceptar inicialmente CSV; XLSX puede agregarse despues si realmente se usa.
- No instalar ni conectar Google APIs para esta etapa.

### 3. Crear un asistente de importacion real

- Paso 1: seleccionar archivo.
- Paso 2: detectar encabezados y mapear columnas.
- Paso 3: validar todas las filas sin escribir.
- Paso 4: revisar duplicados y candidatos multiples.
- Paso 5: mostrar conciliacion y totales.
- Paso 6: confirmacion explicita.
- Paso 7: aplicar todo en una transaccion y registrar el lote.

Campos deseados:

- identificador/SKU de LEGACY;
- nombre;
- expansion;
- numero;
- idioma;
- condicion;
- acabado;
- cantidad observada;
- cantidad reservada;
- precio ARS;
- precio USD;
- ubicacion;
- imagen;
- identificadores externos;
- fila y hoja de origen.

### 4. Conciliacion obligatoria

El informe debe comparar por separado:

- cantidad de la hoja Stock;
- ventas pendientes de sincronizar;
- ordenes/reservas activas;
- suma de movimientos cuando exista;
- duplicados por identidad de carta;
- filas sin identidad suficiente;
- totales de SKUs, unidades, reservadas y valor.

No elegir silenciosamente una fuente ganadora. Cada conflicto debe quedar
visible y exportable.

### 5. Aplicacion segura

- Requerir confirmacion del usuario.
- Usar transaccion completa: todo se aplica o nada se aplica.
- Guardar hash del archivo e idempotencia para no repetir el mismo snapshot.
- Registrar antes/despues y usuario local en auditoria.
- Generar resumen final y lista de diferencias.

### 6. Validacion antes de oficializar

- Comparar conteos globales con LEGACY.
- Revisar manualmente una muestra fisica.
- Mantener LEGACY como fuente operativa.
- Usar la nueva app primero en modo consulta/conciliacion.
- Definir el corte del modulo Inventario solo cuando los numeros coincidan.

## Informacion que debe aportar el usuario para la carga real

No pedirla antes de implementar todo lo que pueda hacerse sin datos reales. Al
llegar al punto necesario, solicitar:

1. Un CSV local reciente exportado de la hoja de Stock.
2. Los nombres exactos de las columnas y la pestaña de origen.
3. Un CSV separado de Ordenes/reservas si esas cantidades no estan incluidas.
4. Confirmacion sobre si precios vacios deben quedar en cero o pendientes de
   revision.
5. Aprobacion antes de crear/aplicar el primer lote en la base piloto.

No pedir credenciales de Google ni Supabase para esta etapa.

## Criterio de terminado para el primer stock real

- El archivo se valida sin modificar datos.
- Todos los errores muestran fila, campo y causa.
- Los duplicados y multiples candidatos requieren decision humana.
- Existe un resumen exacto de altas, actualizaciones, ignoradas y conflictos.
- Repetir el mismo archivo no duplica inventario.
- Una aplicacion fallida no deja cambios parciales.
- El stock importado persiste al reiniciar API y web.
- Se puede consultar, editar, ajustar y auditar desde la interfaz actual.
- LEGACY permanece sin cambios y operativo.
