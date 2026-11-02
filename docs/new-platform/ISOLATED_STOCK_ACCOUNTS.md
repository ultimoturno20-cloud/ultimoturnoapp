# Cuentas con stock independiente

Actualizado: 2026-11-02. Codigo online; alta real aun no confirmada.

Issue #37; [PR #38](https://github.com/ultimoturno20-cloud/ultimoturnoapp/pull/38)
integrado con autorizacion expresa del usuario el 30/10. Head 477d8a9, base
266015b y merge a4c839ecf82db1afedbe181a13cd13156bf8b963. El 02/11 se
reconfirmaron ese SHA en produccion, DB configurada/accesible y CI success.
No equivale al Observador pendiente del PR #36 ni cambia el plan OP.

## Estado del Alta Real

La autorizacion del usuario para integrar y crear la cuenta fue recibida; el
release ya se completo. El intento operativo no quedo confirmado y el acceso
administrativo local devolvio 401. Evidencia:
[cierre operativo](https://github.com/ultimoturno20-cloud/ultimoturnoapp/pull/38#issuecomment-6532947327).

Ya existe una solicitud local privada con requestId y credencial aleatoria,
protegida por ACL y fuera de Git. No existe el archivo final de acceso ni un
login confirmado de la cuenta. No describirla como creada/lista, ni afirmar
que no se genero ninguna credencial local. No abrir o copiar la solicitud para
esta documentacion; no exponer nombre/email/password o identificadores privados.

La consulta de una fuente alternativa de credenciales fue bloqueada; sigue
pendiente la autorizacion expresa solicitada al usuario. El pedido documental
del 02/11 no la concede ni permite volver a ejecutar POST/login productivos, cambiar secretos
o buscar credenciales de Windows/navegador/otros entornos. Para continuar el alta
se requiere autenticacion vigente y autorizada. Usar la MISMA solicitud: no
generar otro requestId, otra identidad ni resetear passwords. Issue #37 cerrado
por merge representa el codigo entregado, no prueba que la cuenta este activa.

## Separacion

El perfil Stock propio habitual pertenece al negocio del administrador: este
puede ver y vender sus existencias. No usarlo dentro de UltimoTurno cuando se
solicita un espacio independiente.

El alta independiente crea otro registro de businesses, con inventario vacio,
un usuario y un unico rol stock_owner. Conserva la autenticacion y los flujos
de carga existentes. No copia stock, ventas, ordenes, claims, compradores,
usuarios, configuracion de tienda ni permisos de administrador. El catalogo
publico de cartas, sus imagenes y las referencias de proveedores son comunes;
las existencias, propietarios y precios cargados son del nuevo negocio.

Al ingresar se ofrece Cargar stock: puede buscar cartas, cargar cantidades y
consultar coincidencias propias. El perfil no administra usuarios ni opera
Caja, Ordenes, Claims, Compras o la tienda. La vista de asignaciones existente
no muestra revendedores de otro negocio. No es un panel administrativo completo
ni otra tienda publica. No se permite publicarlo en la tienda de UltimoTurno.

La separacion es logica por negocio en la misma base y plataforma, no una base
fisica ni infraestructura distinta. Operadores con credenciales de base o la
clave tecnica de contingencia siguen teniendo sus privilegios; no se entrega
ninguna de esas credenciales al usuario. No afirmar aislamiento frente al
operador de infraestructura.

## Alta Administrativa

POST /users/isolated-stock (en Vercel por /api/dispatch).
Solo administrador autenticado del negocio principal UltimoTurno, o el acceso
tecnico administrativo ya existente. No accesible por usuarios stock_owner,
revendedores, administradores de otro negocio ni visitantes anonimos.

Body privado: requestId UUID, businessName, displayName, email y password.
La cuenta siempre recibe stock_owner: no acepta elegir un rol administrador o
un business_id de destino. requestId identifica exclusivamente el alta nueva;
si ya corresponde a otro negocio o a datos diferentes, se rechaza con 409.

La transaccion crea negocio, rol, usuario y auditoria. No aplica migraciones,
seeds o compras de ejemplo. Se comprueba que el email no exista en otro negocio,
porque el login actual resuelve por email global. Usar un email nuevo y unico.
La fila del negocio principal se bloquea durante el alta para serializar estas
altas/reintentos. No es una restriccion SQL global de emails de todos los flujos
legacy de creacion de usuarios.

Primer resultado 201 con created=true; reintento compatible 200 con
created=false y los mismos IDs. El reintento no cambia password, rol, stock ni
agrega otra auditoria. No debe cambiarse el requestId despues de un timeout.
La respuesta no incluye password ni hash. Una cuenta inactiva o con permisos
alterados no se reactiva silenciosamente al reintentar.

## Operacion Segura

En cualquier alta nueva: aprobar el PR pertinente, verificar CI e integrar con
autorizacion humana. Para #38 esos pasos ya estan completos; no repetirlos ni
generar otra solicitud para el intento pendiente. Confirmar siempre el SHA
resultante en public-status y DB configurada/accesible antes de operar.
Para una solicitud realmente nueva, generar email/password aleatorios y guardar
el requestId y la solicitud en un archivo privado con ACL restringida ANTES
del POST. La password solo en ese archivo privado; nunca en Git, PR, chat o logs.
Si la respuesta es incierta, conservar la solicitud y reintentar exactamente
esa alta; nunca inventar otra cuenta ni resetear credenciales para resolverlo.

La cuenta pedida en chat sigue pendiente: este codigo no crea usuarios en el
arranque o en un deploy. No ejecutar compras, reservas, ventas ni altas de stock
ficticias en produccion para verificarla. Validar esos flujos solo en QA local.

## Verificacion

Pruebas DB y HTTP con negocios, cuentas y cartas ficticias en PGlite temporal:
inventario inicial vacio, login por negocio, carga de la misma carta sin mezclar
precio/cantidad, IDs y owner ajenos ignorados/rechazados, lecturas y rutas
privadas denegadas, dispatch, permisos, reintentos concurrentes, password
intacta, conflictos, nombre tecnico reservado y rollback total si falla auditoria.
Gate check:new aprobado: 298 tests, cero fallos, lint/tipos/DB verify/build OK.
Ocho regresiones focalizadas finales y Chrome local: login, carga manual y
consulta propia, recarga, cierre de sesion y 320/390/768/1440/1788 px sin
desbordamiento. Cantidad/precio central intactos; cero requests productivos.
Se conserva la UI de Stock propio, sin inventario administrativo completo.
La seleccion de un item manual local sin referencia PriceCharting puede mostrar
el aviso CoolStuff preexistente; no impide cargar y no se cambia en esta tarea.
