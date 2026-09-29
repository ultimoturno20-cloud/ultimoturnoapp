# Cobertura de precios TCGplayer y CoolStuff

## Piloto con inventario real: 28 de septiembre de 2026, 19:46 UTC

Se valido acceso de lectura y se obtuvo una copia del inventario mediante la
API autenticada. Habia 2.166 registros, de los cuales 1.348 tenian cantidad
fisica positiva (3.595 unidades). Este criterio incluye unidades reservadas.
De los registros con unidades, 963 tenian referencia TCGplayer y 33 CoolStuff.
Los precios disponibles no garantizan coincidencia correcta o cotizacion fresca.

Se descargaron las nueve paginas de Phantasmal Flames: 208 productos y 221
ofertas. El catalogo usa `ME Phantasmal Flames`, mientras el inventario usa
`Phantasmal Flames`. Se agrego esa equivalencia exacta, con una prueba que
rechaza otra edicion, numero, condicion o acabado.

El piloto selecciono solo cartas inglesas sin graduacion, con identificador
PriceCharting, nombre exacto normalizado y oferta disponible. Se guardaron 127
referencias mediante `/coolstuff-prices/observations`, en tandas de 20. Una
lectura posterior verifico los 127 precios. La cobertura CoolStuff con stock
paso de 33 a 146 registros: 113 nuevas referencias y 14 actualizaciones.
No se enviaron cambios de cantidades, reservas o precios de venta ni se
desplego codigo. Entre lecturas cambio el precio ARS de Iron Leaves Ex de
2.800 a 3.500; no se puede atribuir ese cambio a esta carga de referencias.

El cruce local encontro ademas 44 candidatos TCGplayer sin precio actual en
inventario. Son candidatos pendientes de revisar y vincular, no precios
incorporados. Tambien se observaron referencias TCGplayer en 20 registros
con unidades cuyo idioma no es ingles; revisar su equivalencia antes de
interpretarlos como valor de esa variante.

Evidencia local ignorada por Git en `outputs/price-source-audit`: instantaneas
`live-stock.json` y `live-stock-after.json`, `live-coverage-summary.json`,
`coolstuff-live-preview.json`, `coolstuff-live-receipts.json` y
`coolstuff-live-verification.json`. Las credenciales no se guardaron alli.
Validacion del ultimo cambio: 12 pruebas focalizadas, typecheck, lint y diff
check aprobados. La suite completa anterior tenia 67 pruebas aprobadas.

Las secciones siguientes documentan las mediciones previas al piloto.

## Medicion local del 28 de septiembre de 2026

| Fuente | Alcance descargado | Productos con precio | Filas u ofertas |
| --- | --- | --- | --- |
| TCGCSV | Los 220 grupos de Pokemon, categoria 3 | 31.476 | 45.461 filas; 44.638 con market |
| CoolStuff | Mega Evolution, 11 paginas | 265 | 287 ofertas |
| CoolStuff | Journey Together, 11 paginas | 273 | 296 ofertas |

TCGCSV incluye productos sellados y distintas impresiones. Una fila de precio
no equivale a una carta unica. CoolStuff distingue variantes y puede ofrecer
varias condiciones del mismo producto. El indice publico de CoolStuff devolvio
152 enlaces de expansiones; eso no garantiza cobertura de todas las ediciones.

Estas cifras describen las fuentes publicas descargadas localmente. No son
cartas nuevas incorporadas al inventario de produccion. No se uso acceso a
Supabase ni se modificaron precios de venta, stock, claims u ordenes.

## Recolectar mas precios sin credenciales

Desde la raiz del repo, con las dependencias instaladas:

```powershell
# Todos los grupos Pokemon publicados por TCGCSV.
node node_modules/tsx/dist/cli.mjs tools/price-source-audit.mts --source=tcg

# Enumerar expansiones CoolStuff y sus identificadores.
node node_modules/tsx/dist/cli.mjs tools/price-source-audit.mts --source=coolstuff

# Descargar todas las paginas de una expansion.
node node_modules/tsx/dist/cli.mjs tools/price-source-audit.mts --source=coolstuff --group=9126
node node_modules/tsx/dist/cli.mjs tools/price-source-audit.mts --source=coolstuff --group=8746
```

Los archivos quedan en `outputs/price-source-audit`, fuera de Git. Se puede
elegir otro directorio con `--output=RUTA`. Cada respuesta se conserva 24 horas;
repetir el comando reusa lo descargado y continua tras un error. Las consultas
son secuenciales, con 150 ms para TCGCSV y 10 segundos para CoolStuff. Ejecutar
una sola recoleccion por fuente a la vez. Una pagina vacia o repetida produce
un error y no se presenta una expansion incompleta como terminada.

El reporte `tcg-summary.json` muestra cobertura por grupo. Los JSON de precios
contienen los identificadores TCGplayer originales para cruzarlos con el indice
existente. `coolstuff-summary.json` lista las expansiones disponibles y los
archivos `coolstuff-ID-products.json` incluyen nombre, numero, acabado, URL,
condicion, cantidad y precio. Las ofertas sin precio no se cuentan.

## Automatizacion del inventario existente

TCGplayer ya tiene cron diario y descarga todos los grupos. Obtener mas precios
utiles para el inventario requiere completar los vinculos `tcgplayer_product_id`,
ademas de comprobar la ultima corrida. El endpoint existente
`POST /card-index/sync-tcgcsv` admite `inventoryOnly=true`, `seedMissing=false`,
`groupOffset` y `groupLimit`; avanzar con `nextGroupOffset` hasta que sea null.
No bajar los umbrales de coincidencia para inflar cobertura. TCGCSV no publica
precios por condicion; no deducir LP/MP/HP desde un precio agregado.

El comando `npm run prices:link-tcg` recorre esa API automaticamente, una
expansion por pedido, con `inventoryOnly=true` y `seedMissing=false`. Requiere
`ULTIMOTURNO_ACCESS_KEY` en el entorno; admite `ULTIMOTURNO_API_URL` para otro
servidor. Actualiza referencias del catalogo existente, sin crear cartas ni
cambiar cantidades o precios de venta. Ejecutar una sola instancia.

Ante un error se detiene y muestra el grupo para retomar:
`npm run prices:link-tcg -- --group-offset=NUMERO`. No reintenta escrituras
automaticamente. Si una peticion expira, esperar a que termine en el servidor
antes de retomar. Las coincidencias informadas pueden incluir vinculos que ya
existian; no representan necesariamente nuevas cartas con precio. El cron
existente sigue siendo responsable de actualizar las cotizaciones.

Este comando se valido con una API simulada; no se ejecuto contra produccion.

CoolStuff usa `npm run coolstuff:prices:daemon` y requiere
`ULTIMOTURNO_ACCESS_KEY` para la API productiva. La clave va en el entorno.
Para otro servidor se configura `ULTIMOTURNO_API_URL`.
El worker busca cartas inglesas con stock y un identificador PriceCharting.
No recoge automaticamente todo el catalogo ni cartas sin ese identificador.

Cambios implementados:

- Drena tandas pendientes sin esperar una hora entre cada 20 cartas.
- Reutiliza el indice y las expansiones entre tandas durante su vigencia.
- Conserva temporalmente errores de una expansion para evitar repetir la misma
  descarga fallida por cada carta.
- Reintenta fallos del ciclo en modo daemon y respeta 10 segundos entre consultas.
- Comprueba paginas repetidas/vacias y solo sigue paginacion de la misma expansion.
- Reconoce acabados antes del numero, como `Hariyama (Holo Rare) - 073/132`.
- Exige identidad compatible y condicion exacta; `Played` generico no sustituye
  LP, MP o HP, ni Near Mint sustituye una carta jugada.
- Conserva la fecha del ultimo precio valido cuando falla la actualizacion y
  respeta la espera del proximo intento.
- El lanzador Windows funciona desde la carpeta donde se clono el repo.

Para dejarlo desatendido, desplegar primero el cambio de API y ejecutar el worker
en un equipo siempre encendido, supervisado por el Programador de tareas de
Windows o el gestor de servicios del servidor. No se instalo ninguna tarea
persistente ni se desplegaron cambios durante esta revision.

## Validacion pendiente con stock real

Comparar una exportacion de inventario o consultar la API autenticada para medir:
cartas con vinculo, precio reciente, condicion/acabado correcto y faltantes por
fuente. Revisar una muestra antes de aplicar recomendaciones de venta. Para
coleccion, Seba usa TCGplayer/eBay; para jugables usa CoolStuff. Este cambio
recolecta referencias y no cambia esa politica ni incorpora eBay.

Fuentes: https://tcgcsv.com/docs y https://www.coolstuffinc.com/pokemon/.
