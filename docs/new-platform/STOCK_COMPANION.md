# Programa compañero de stock · mesa de escaneo

Pedido: facilitar el ingreso de cientos de cartas desde un programa separado
del panel. Responsable: Codex. Rama `codex/stock-companion`, base `a4c839e`.
Funcionalidad nueva; no reemplaza ni completa etapas OP pendientes.

## Abrir en Windows

La aplicación de escritorio se entrega como `UltimoTurno-Stock-0.2.0.exe`
(Windows x64, portable). Doble clic abre una ventana propia y arranca su servicio
interno; no requiere instalar Node.js, abrir una página ni mantener una consola.
Cerrar la ventana detiene la conexión y el servicio. Abrirla otra vez conserva
los lotes en `%LOCALAPPDATA%/UltimoTurno/StockCompanion/sessions.json`.
Una segunda apertura trae al frente la ventana existente. No necesita permisos
de administrador. El paquete de prueba todavía no está firmado digitalmente.
En esta PC el acceso directo **UltimoTurno Stock** usa la carpeta instalada
en `%LOCALAPPDATA%/Programs/UltimoTurno Stock/app`, para iniciar directamente
sin extraer el portable en cada apertura. No mover el ejecutable fuera de esa
carpeta: sus archivos acompañantes forman parte del programa.

Con el Pixel conectado y Monprice abierto, usar **Conectar Monprice**.
Si scrcpy está abierto la primera vez, se guarda automáticamente la ruta de ADB.
También se puede elegir **Android → Configurar conexión Android…** y seleccionar
`adb.exe` dentro de la carpeta de scrcpy; reiniciar para usar la ruta guardada.
Después scrcpy no necesita estar abierto. ADB y las DLL que lo acompañan deben
seguir instalados en esa carpeta. El teléfono requiere depuración USB autorizada.

Si sigue activa la versión anterior en navegador, cerrar su consola antes de
abrir la aplicación. No se inicia otra instancia sobre los mismos lotes ni se
matan procesos ajenos. Tras un cierre anormal solo se recupera el bloqueo si
su proceso ya no existe; un bloqueo inválido requiere revisión manual.

### Desarrollo y empaquetado

Desde `tools/stock-companion/desktop`, ejecutar `npm ci`, `npm test` y
`npm run build`. El portable queda en `.work/stock-desktop-release/` de la raíz.
Las dependencias tienen su propio lockfile y no cambian las de la plataforma.
El empaquetado usa una carpeta temporal aislada: incluye únicamente la interfaz,
el puente y `csv-parse`; no incluye `.env`, lotes, perfiles ni datos del repo.
La ventana usa sandbox, aislamiento de contexto y no expone Node al renderer.
Solo admite navegación a los documentos locales del compañero, sin ventanas
externas ni permisos de cámara/micrófono de la PC.

QA del ejecutable empaquetado: arranque sin Node externo, importación sintética,
cantidad editada, navegación a lotes, bloqueo de navegación externa, cierre,
liberación del bloqueo y recuperación de cantidad al reabrir. Sin llamadas a
producción. Dos pruebas adicionales cubren bloqueo vivo/muerto/inválido y
navegación permitida. El flujo de stock conserva las 33 pruebas del compañero.
Validación de la entrega inicial de escritorio: lint, typecheck, db:verify y build aprobados.
La suite general dio 297/298: una prueba de historial de precios abortó dentro
de WASM/PGlite (`Aborted()`), sin cambios de código en esa área. Esa misma prueba
pasó al repetirla aislada. No se declara una ejecución completa de check:new
en verde para esta entrega; el empaquetado y la prueba del escritorio sí pasaron.

### Alternativa de navegador para desarrollo

Con Node.js 22 y dependencias del repositorio instaladas (`npm ci`), ejecutar
`scripts/start-stock-companion.cmd` con doble clic. Abrir
http://127.0.0.1:4318 y mantener abierta la consola. Ctrl+C cierra el servidor.
Esta alternativa mantiene la interfaz en navegador. No requiere arrancar la API, la base local ni
los workers. No carga `.env` del repositorio.

## Pantalla Monprice + lista + envío

La mesa de escaneo y el editor de lotes usan la paleta de UltimoTurno:
negro `#050506`, paneles carbón `#111114` y acento rojo `#f52546`, con controles
y tipografía consistentes. La cabecera identifica UltimoTurno Stock.

Cada fila local ofrece **Eliminar**, que la excluye de este lote, sus totales y
el futuro envío. No borra stock existente ni modifica Monprice. **Ver eliminadas**
permite revisar las excluidas y **Restaurar** reincorporarlas. La elección queda
guardada al cerrar/reabrir y se conserva al comprobar la lista de Monprice.
Si se elimina una vista previa sin acabado y luego aparece en varias variantes,
todas quedan excluidas; se pueden restaurar individualmente. Esas variantes
requieren vinculación nueva, para no heredar el destino de otra variante.
Las filas enviadas, inciertas y los lotes aplicados no permiten eliminar/restaurar.
Se reutiliza `ignored` y la ruta existente de edición; no hay API nueva ni borrado
destructivo. El editor completo conserva su opción compatible **Omitir fila**.

QA del cambio visual y eliminación: 40 pruebas del compañero aprobadas,
navegador aislado en 320/390/768/1440/1788 px, teclado, totales, persistencia,
restauración, envío bloqueado y ambos temas comprobados. Ejecutable empaquetado
verificado con datos sintéticos y cierre/reapertura. No se borraron cartas reales
durante QA ni se realizaron operaciones productivas.

La raíz abre la mesa de escaneo: Pixel/Monprice a la izquierda, cartas y editor
de cantidades a la derecha. El flujo anterior de archivos sigue en `/batches`.
No incorpora otro reconocedor ni cambia el manejo de repetidas de Monprice.
Las correcciones de edición y acabado se hacen con los controles de Monprice:
el selector de cartas semejantes y el campo Tipo de cada carta. Se verificó
en pantalla PRE 004/131 frente a ASC 016/217, y las opciones Normal, Reverse Holo,
Reverse Holo Master Ball y Reverse Holo Poke Ball. No se añade un segundo
corrector para reemplazar esas funciones.

El puente traduce las etiquetas específicas Master Ball/Poké Ball a los
acabados `master ball`/`poke ball` del stock. No las reduce a Reverse Holo.
Los demás acabados, incluidos los que aún no se probaron físicamente, se
conservan sin inventar equivalencias. Una sustitución única de la misma carta
en Monprice, con idioma y cantidad de origen iguales, conserva la fila y la
cantidad editada en PC; actualiza edición/número/acabado y elimina el vínculo
automático anterior. Una elección de catálogo hecha explícitamente en PC se
conserva y vuelve a quedar pendiente de revisión. Si la sustitución es ambigua,
no se elimina una fila editada ni se modifica parcialmente el lote.

1. Conectar Android por USB con depuración autorizada, abrir scrcpy y Monprice.
2. Elegir nombre del lote, idioma y condición habitual en la PC; pulsar
   **Conectar Monprice**. La primera conexión incluye la sesión actual de la app.
3. Escanear en Monprice. El puente lee nombre, edición y número directamente
   del escáner, sin tocar controles, abrir la lista ni volver a la cámara por
   cada carta. La PC muestra una vista previa por identidad, con cantidad inicial
   1 y acabado pendiente. No usa el precio como contador ni suma por frame.
   Las cantidades reales, repetidas y acabados se copian de la lista completa
   únicamente al terminar o preparar el envío. Las cantidades editadas en la PC
   se conservan; una variante ambigua editada requiere revisión explícita.
4. Ajustar cantidades con teclado o +/−. Las correcciones de PC sobreviven a
   nuevas lecturas. La cantidad original de Monprice queda visible como referencia.
5. **Enviar al stock** comprueba toda la lista, vincula coincidencias exactas,
   solicita resolver las pendientes y muestra confirmación. Una vez confirmado,
   prepara las capturas y aplica solo sus IDs desde un único botón. El precio
   existente se conserva; las altas nuevas necesitan precio ARS explícito.

**Terminar captura** abre y comprueba una vez toda la lista antes de enviar,
incluidas cartas que no llegaron a observarse en la cámara, y deja Monprice en
su lista. No se permite enviar solamente la vista previa. Si una carta sigue
visible, sus frames repetidos o una reconexión no agregan unidades.
Después de un envío, otro lote exige comenzar con una sesión vacía de Monprice:
no vuelve a copiar automáticamente las cartas del lote anterior. Las operaciones
de stock siguen requiriendo admin. No se hicieron cargas productivas de prueba.

La vista del Pixel utiliza capturas ADB periódicas, no video de 60 fps; no afecta
al reconocimiento que corre en el teléfono. Se pueden tocar controles en la
imagen, usar el Pixel directamente o mantener scrcpy abierto. ADB se descubre
desde PATH, la instalación de scrcpy en ejecución o `COMPANION_ADB_PATH`.
No se instalan apps en Android. Los frames viven en memoria; no se versionan
capturas, seriales, catálogos operativos ni exportaciones reales.

Corrección de velocidad (2026-11-03): se elimina la navegación automática por
cada carta. La lectura de identidades y la descarga de capturas corren separadas,
con una sola imagen en vuelo: una captura lenta no demora la próxima identidad.
La espera entre lecturas baja a 250 ms y la PC consulta el estado cada 500 ms.
ADB/UIAutomator aún puede tardar varios segundos; no equivale a video en vivo.
Se midió una captura de aproximadamente 3,1 s en el Pixel. No se promete latencia
constante ni capturar cada carta en una pasada rápida: la lista final recupera
lo que no llegó a verse entre consultas, sin inventar cantidades por frames.

Validación de esta corrección: Pixel real lee Squirtle/Team Up/23/181 con cero
órdenes de input; usuario confirma que permanece en el escáner. 39 pruebas del
compañero y 2 del escritorio aprobadas, incluida captura lenta, desconexión sin
frames tardíos, variantes ambiguas, correcciones con cantidad editada y envío
idempotente. Ejecutable verificado con importación sintética, edición y reapertura.
Gate general check:new aprobado: lint, tipos, 298 pruebas, DB verify y build.

La lectura requiere Monprice al frente. Si aparece otra app, una pantalla de
permisos o un bloqueo, se pausa la captura y no se automatiza esa pantalla.
La lista se recorre por páginas y solo se acepta cuando sus cantidades suman
el total mostrado por Monprice; una lectura incompleta/conflictiva no reemplaza
el lote ni permite finalizar el envío. Los metadatos de graduación no reconocidos
quedan pendientes. `Foil` se conserva como tal, sin inventar `Reverse Holo`.
Las equivalencias `001/100` vs `1` requieren además nombre, edición y variante
exactos; dos denominadores diferentes no se vinculan automáticamente.

Esta versión depende de las etiquetas y estructura accesibles de Monprice
(ES/EN). La prueba física confirmó Pixel 9 + Monprice, Pidgey/Team Up/121/181 y
luego Farfetch'd/Team Up/127/181, una unidad normal de cada una. La segunda se
agregó automáticamente al lote local; la pantalla real se mostró junto al editor.
No se enviaron esas cartas al stock. No acredita rendimiento con cientos de
cartas reales: la copia de lista puede pausar el escáner unos segundos. Se debe
medir una tanda real; el CSV sigue disponible para listas muy largas o si la
interfaz de Monprice cambia.

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

Variables opcionales sin `.env`: `COMPANION_ADB_PATH`, `COMPANION_PORT`, `COMPANION_DATA_DIR` y
`COMPANION_API_BASE` (solo producción canónica o HTTP localhost para QA).
El lanzador indica el puerto estándar; si se cambia, usar la URL de la consola.

## Próximas etapas

Medir una tanda real de 50–100 cartas, incluida repetida después de otra carta,
edición manual de cantidades y vuelta a un lote guardado. También validar el
CSV/JSON del usuario como alternativa. La conexión lee/controla Monprice por
ADB; no implementa un reconocedor propio ni intenta contar pasos físicos.

Validación local realizada: 33 pruebas del compañero aprobadas; Chrome sin
conexión externa en 320/390/768/1440/1788 px, edición por teclado, filtros,
persistencia, duplicado de archivo, error de acceso y botones de envío
bloqueados sin conexión. Prueba de 123 filas en navegador: completar vacíos
desde un filtro, conservar ES/LP/reverse, navegar 25/100 filas, recargar y
marcar cantidades inválidas. No se verificó login ni sincronización productiva.
La mesa integrada también se probó en los cinco anchos: vista del teléfono,
lista de Monprice, cantidad editada conservada, finalización, vínculo y botón
único de envío contra API simulada. La integración con API real aislada se
mantiene en la suite. No se usan capturas reales como fixtures versionados.
`npm run check:new` aprobado: lint, tipos, suite general, verificación aislada
de DB y compilación. `git diff --check` sin errores. La creación de issue/PR
requiere autenticación de GitHub; sigue pendiente si no hay sesión disponible.

No modifica API, esquema, precios, panel ni documentación de continuidad
compartida. Se entrega por PR pendiente de revisión e integración humana;
no equivale a un despliegue de producción.
