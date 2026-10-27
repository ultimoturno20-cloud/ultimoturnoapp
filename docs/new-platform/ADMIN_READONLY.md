# Observador del panel

2026-10-27. Issue #35, rama codex/admin-readonly desde 266015b.
Pedido: una cuenta nueva para inspeccionar la plataforma de cara a v2.0 sin
modificar operaciones. Usuario acepta un email interno aleatorio. Publicacion
y acceso a datos reales pendientes de su confirmacion; no crear un admin completo.

## Permisos y limites

Rol exclusivo admin_readonly, sin asignar admin. canReadAdmin concede lectura
administrativa a ese rol; isReadOnlyAdmin prevalece si una cuenta tiene ambos.
El servidor resuelve la sesion despues de normalizar dispatch y rechaza toda
ruta/metodo fuera de una lista explicita de lecturas auditadas. POST solo para
login/logout; se mantienen la autenticacion, expiracion de sesiones y revocacion.
Cron, reparaciones, importaciones, pagos, cierres, usuarios, stock, tienda y
demas escrituras se rechazan con 403 ANTES del handler, incluso con clave compartida.
Nuevas rutas quedan denegadas hasta ser revisadas; no basta que sean GET.

Lecturas del panel conservan negocio/usuario de la sesion. Consultas de stock
del observador leen datos actuales sin publicar/actualizar snapshots compartidos.
No vencen pedidos web ni sincronizan reglas/tableros al consultarlos; imagenes
ausentes no disparan reparaciones/descargas. Los administradores normales
conservan esos comportamientos. La tienda anonima sigue siendo publica y sus
reglas no cambian: este rol limita el panel autenticado, no a visitantes anonimos.
No es un usuario SQL read-only ni una cuenta de desarrollo con acceso a la DB.
No protege frente a entregar por separado secretos administrativos o de la base.

No hay migracion ni cambio de esquema. El rol se inserta por negocio dentro
de la transaccion de alta de la primera cuenta de observador, solo mediante
un administrador existente. No se alteran roles/cuentas anteriores.

## Interfaz y alta

Login habitual en /admin, identificacion Solo lectura en cabecera y tipo
Observador en el listado de usuarios. Administradores pueden elegir
Observador (solo lectura) al crear una cuenta desde Admin. No se muestran
acciones de publicacion en inventario; otras acciones existentes pueden seguir
visibles para inspeccionar pantallas, pero sus solicitudes de escritura fallan.
No se clona la plataforma ni se crea otra base con datos productivos.

Para el alta solicitada: generar email interno unico y password aleatoria,
entregar la credencial por un canal privado. No publicarla en Git, PR o chat.
La operacion real debe verificar primero SHA desplegado y salud DB, consultar
si el email existe, no recrear/reiniciar usuarios ante respuesta incierta y
comprobar que el resultado tenga UNICAMENTE admin_readonly. No probar cobros
ni reparaciones en produccion. Retirar/desactivar la cuenta cuando deje de ser necesaria.

## Verificacion

Pruebas HTTP/PGlite temporal con usuarios ficticios y negocios separados:
lector sin admin, invariancia de todas las tablas publicas antes/despues de
lecturas y rechazos; pedido web vencido que NO expira al consultarlo. Guardas
de POST/PUT/DELETE, jobs GET, rutas nuevas, dispatcher, clave compartida,
aislamiento de negocio, sesion expirada/desactivada y admin existente conservado.
Permisos, rutas, tipos y suite general se verifican en check:new; no secretos de CI.

Chrome local, 30 cartas ficticias: login y 13 vistas sin fallos de lectura,
badge, filtros/paginacion con teclado, rechazo de cobro con stock intacto y
logout. 320/390/768/1440/1788 px, reduced motion, capturas revisadas y cero
requests productivos. Artefactos bajo .work/observer-* ignorado; demo local
http://127.0.0.1:5302/admin. No equivalen a auditoria del contenido real.

## Continuidad

PR #34 integrado por autorizacion explicita del usuario el 23/10, online
266015b con DB configurada/accesible. Corregidos cobro que abandona inventario
y pagina que se reinicia. PR #32 del slider sigue separado y pendiente.
Este cambio de acceso no desarrolla v2.0 ni completa OP-1.4c.2b.
