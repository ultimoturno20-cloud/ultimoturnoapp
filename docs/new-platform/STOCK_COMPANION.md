# Programa compañero de stock · primera versión

Pedido: facilitar el ingreso de cientos de cartas desde un programa separado
del panel. Responsable: Codex. Rama `codex/stock-companion`, base `a4c839e`.
Funcionalidad nueva; no reemplaza ni completa etapas OP pendientes.

## Abrir en Windows

Con Node.js 22 y dependencias del repositorio instaladas (`npm ci`), ejecutar
`scripts/start-stock-companion.cmd` con doble clic. Abrir
http://127.0.0.1:4318 y mantener abierta la consola. Ctrl+C cierra el servidor.
Es una herramienta local con interfaz en navegador, todavía no un instalador
ni un ejecutable independiente. No requiere arrancar la API, la base local ni
los workers. No carga `.env` del repositorio.

## Flujo

1. Escanear un lote nuevo en Monprice y exportar CSV/JSON al equipo.
2. Nombrar el lote y cargar el archivo. El programa guarda todas las filas,
   incluidas repetidas; no adivina cantidades ni variantes faltantes.
3. Revisar nombre, edición, número, unidades nuevas, idioma, condición, acabado
   y certificadora/grado si corresponde.
   Se puede omitir una fila. Los filtros no cambian el alcance del lote.
   **Completar vacíos** aplica idioma, condición y/o acabado elegidos a las
   filas locales de TODO el lote, incluso fuera del filtro/página. No reemplaza
   valores existentes, precios ni cantidades; no cambia filas enviadas,
   inciertas u omitidas. Las filas modificadas pierden su vínculo/revisión
   previa para volver a confirmar su identidad.
4. Conectar una cuenta administradora. **Vincular coincidencias exactas** busca
   cartas ya existentes por identidad completa, incluida graduación, sin tomar
   resultados ambiguos ni listas truncadas. El resto se vincula manualmente a
   una coincidencia
   del catálogo. Elegir stock existente adopta su identidad y conserva precio;
   elegir catálogo conserva idioma/acabado ingresados, que se deben verificar.
   Una carta nueva necesita precio de venta ARS explícito. El precio de Monprice
   no se convierte automáticamente en precio de venta.
5. Marcar cada fila como revisada o usar **Confirmar revisión de vinculadas**
   después de revisar todas las coincidencias del lote, incluso fuera del filtro.
   Confirmar **Enviar capturas**. Esto crea
   entradas en Carga móvil; todavía no suma stock.
6. Confirmar **Sumar al stock**. Solo envía los IDs de este lote al ingreso
   móvil existente, que aplica cantidades aditivas y recibos transaccionales.
   Ejemplo: 8 unidades previas + 3 escaneadas = 11. No usa el importador de
   snapshot que reemplaza cantidades absolutas.

El ingreso móvil actualmente exige admin. Una cuenta stock_owner puede preparar
lotes locales pero la herramienta no amplía permisos ni conecta sus capturas.
Soportarla requiere un contrato API separado con aislamiento de propietario e
idempotencia antes de incorporar esa conexión. No crear cuentas ni buscar claves
locales para resolverlo. No se sincroniza automáticamente al abrir un archivo.

## Formatos y límites

CSV con coma, punto y coma o tabulador, BOM, comillas y campos multilínea.
Columnas típicas: `Name,Set,Number,Count,Language,Condition,Finish`.
JSON: lista de objetos o un objeto con `cards`, `items` o `scans` como lista.
Se admiten equivalentes básicos en español. No se asume conocer todos los
esquemas de Monprice: falta validar con una exportación real del usuario.
Máximo 10 MB desde la interfaz, 10.000 filas; cantidades enteras de 1 a 100.000.
Un idioma/acabado vacío se mantiene pendiente. Sin agrupación automática.
La revisión muestra 25/50/100 filas por página, con filtros adicionales de
sin vínculo, omitidas y transferencia incierta. Totales y acciones siguen
abarcando todo el lote. Cantidades inválidas quedan señaladas y no se suman
al contador de unidades. La UI y el servidor comparten las mismas validaciones.
Se conservan códigos de chino CHS/CHT. Cartas con certificadora y grado usan
la condición canónica GRADED al enviarse; sin esos dos datos quedan pendientes.

La huella reconoce archivos con las mismas filas normalizadas aunque cambie el
separador. **Nuevo lote físico** permite importar otro conjunto real idéntico;
esa opción NO debe usarse para reintentar una transferencia. No detecta todos
los cambios de formato, orden o exportaciones acumulativas: usar una colección
nueva/vacía por lote y exportar solo los ejemplares nuevos. Una exportación de
toda la colección no representa necesariamente nuevas existencias.

## Persistencia, seguridad y recuperación

Sesiones y comprobantes: `%LOCALAPPDATA%\UltimoTurno\StockCompanion\sessions.json`.
No es otra base de stock. Conservar y respaldar este archivo antes de mover el
programa; el respaldo descargado de cada lote es un comprobante JSON, no una
exportación Monprice ni un archivo para reimportar. Cambiar de PC o borrar las
sesiones pierde las huellas de importación: no reimportar lotes ya enviados.
Las sesiones contienen datos operativos privados y no deben entrar en Git.

La contraseña y el token de acceso solo viven en memoria; cerrar el proceso
requiere volver a conectar. El servidor solo escucha en 127.0.0.1 y valida Host,
Origin y un token aleatorio de arranque. No acepta destinos remotos arbitrarios
ni redirecciones. La cuenta/negocio quedan ligados al lote al elegir catálogo.

La creación móvil NO tiene clave idempotente. Antes de cada POST se guarda
`uncertain` y nunca se reenvía una fila incierta. **Comprobar transferencia**
busca su marcador exacto en todas las páginas, incluso capturas ya revisadas.
Si encuentra una sola, recupera el ID. Si no aparece o hay varias, bloquea el
reenvío y requiere revisar Carga móvil; no ofrece un botón para duplicarla.
Después de enviar, las filas quedan bloqueadas. La aplicación final sí permite
reintentar los mismos IDs. Capturas rechazadas/revisadas fuera del programa
pueden ser omitidas por la API: el comprobante muestra unidades efectivamente
sumadas y capturas omitidas; no equivale a un censo posterior del inventario.

Un archivo `running.lock` impide dos procesos sobre las mismas sesiones. Tras
un cierre anormal, comprobar en el Administrador de tareas que el PID escrito
en ese archivo ya no corresponde a este programa. Solo entonces eliminar ese
archivo puntual y volver a abrir. Nunca borrar `sessions.json` para desbloquear.
Si falla lectura/escritura del archivo, el programa se detiene o bloquea la
operación; no reconstruye silenciosamente un outbox vacío.

## Validación aislada

`npm run typecheck` y `node --test tools/stock-companion/*.test.mjs`

Incluye CSV/JSON, cantidades, variantes, precio conservado, corte antes/después
de crear, recuperación paginada, aislamiento por actor/negocio, rechazo de origen,
sesiones sin credenciales, instancia única y persistencia al reiniciar. La
prueba HTTP usa API simulada con cartas sintéticas (8 + 3 = 11; repetir = 11).
La prueba de integración adicional utiliza la API real compilada y una PGlite
temporal sin credenciales productivas: 124 filas, cuatro variantes distintas,
precios conservados y respuesta de aplicación perdida después del commit.
Reintentar los IDs no vuelve a sumar existencias. Esta prueba no usa la API
desplegada; desactiva integraciones antes de importar el módulo de servidor.
No realiza autenticaciones ni operaciones de QA en producción.

Variables opcionales sin `.env`: `COMPANION_PORT`, `COMPANION_DATA_DIR` y
`COMPANION_API_BASE` (solo producción canónica o HTTP localhost para QA).
El lanzador indica el puerto estándar; si se cambia, usar la URL de la consola.

## Próximas etapas

Validar un CSV/JSON real y medir una tanda de 50–100 cartas. Automatizar después
la llegada del archivo desde el teléfono. La captura en vivo con scrcpy o un
reconocedor propio requiere comprobar eventos de escaneo y dos ejemplares
iguales consecutivos. Esta entrega no lee la cámara ni controla Monprice.

Validación local realizada: 21 pruebas del compañero aprobadas; Chrome sin
conexión externa en 320/390/768/1440/1788 px, edición por teclado, filtros,
persistencia, duplicado de archivo, error de acceso y botones de envío
bloqueados sin conexión. Prueba de 123 filas en navegador: completar vacíos
desde un filtro, conservar ES/LP/reverse, navegar 25/100 filas, recargar y
marcar cantidades inválidas. No se verificó login ni sincronización productiva.
`npm run check:new` aprobado: lint, tipos, suite general, verificación aislada
de DB y compilación. `git diff --check` sin errores. La creación de issue/PR
requiere autenticación de GitHub; sigue pendiente si no hay sesión disponible.

No modifica API, esquema, precios, panel ni documentación de continuidad
compartida. Se entrega por PR pendiente de revisión e integración humana;
no equivale a un despliegue de producción.
