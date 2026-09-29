# Copia local del inventario

Abrir `Abrir copia local.cmd` desde la raiz del proyecto. La app usa
http://127.0.0.1:5174/inventario y la API escucha solamente en 127.0.0.1:4010.
Las credenciales locales generadas al importar estan en
`.work/stock-offline/access.json`; no son las de produccion.

La base PGlite queda en `.data/stock-offline`, separada de cualquier otra base.
El lanzador activa la actualizacion TCGplayer diaria a las 06:30, hora de esta
PC, y mantiene desactivada la de PriceCharting. No utiliza Supabase ni Vercel.
No cierra procesos que ocupen sus puertos. Los registros de ejecucion
y el resultado de la importacion estan en `.work/stock-offline`.

La copia procede del JSON descargado antes de que Vercel bloqueara la API.
No se mantiene sincronizada. Incluye SKUs, nombres, ediciones, idiomas,
condiciones, acabados, cantidades fisicas y reservadas, propietarios y precios
de venta. Los identificadores de cartas y stock se conservan en la base aislada.

No es un backup completo: no contiene pedidos, ventas, cuentas originales,
certificados de autenticacion ni historial de movimientos. Las reservas son
cantidades copiadas, sin sus pedidos asociados. Los movimientos de la base
local documentan la importacion. Las imagenes conservan sus URLs y pueden
necesitar internet. Las referencias completas permanecen en el JSON original.
Se restauro el catalogo ingles del snapshot y sus vinculos TCGplayer. Los
precios PriceCharting restaurados son historicos, no una consulta nueva.
CoolStuff sigue disponible en el snapshot, sin reconstruir aun su cache local.

## Precios TCGplayer

TCGCSV publica el catalogo y precios agregados de TCGplayer. La API local
descarga todos los grupos Pokemon y guarda los precios en PGlite. No requiere
clave TCGplayer. No son cotizaciones por condicion NM/LP/MP; el acabado se
resuelve aparte mediante las variantes disponibles.

La actualizacion diaria funciona mientras la API y esta PC esten encendidas.
Al abrir despues de la hora programada, el proceso existente intenta recuperar
la corrida del dia pendiente. No se instalo inicio automatico con Windows.
Si TCGCSV no publico una nueva version, evita descargar de nuevo todo el catalogo.
Un fallo conserva la ultima cache; una respuesta vacia no puede borrarla.
Solicitudes simultaneas comparten una misma corrida dentro de esta API.

Para actualizar ahora, con la app encendida, abrir `Actualizar TCG local.cmd`.
El comando comprueba que la API sea la copia local, actualiza referencias y
verifica que cantidades y precios de venta no hayan cambiado. El reporte queda
en `.work/stock-offline/tcg-refresh-report.json`. No cambia precios de venta.

Se revisaron y vincularon los 44 candidatos del inventario por nombre, edicion,
numero e idioma. Tambien se restauraron 1.620 vinculos previos del snapshot;
estos ultimos no equivalen a una nueva revision de identidad. Las cartas nuevas
sin vinculo necesitan conciliacion adicional: la actualizacion diaria de precios
no inventa asociaciones.

Validacion del 29 de septiembre de 2026: descarga en vivo de 220 grupos y
45.463 filas, version de fuente `2026-09-28T20:05:54+0000`. El inventario local
muestra 1.660 registros con referencia TCGplayer, 1.015 con cantidad fisica
positiva. Los 44 candidatos tienen precio visible. Cantidades, reservas y
precios de venta coinciden con el snapshot original. Evidencia detallada en
`.work/stock-offline/tcg-coverage.json`.

La prueba con dos solicitudes simultaneas devolvio el mismo identificador de
corrida. La prueba de base de datos confirma que una carga vacia conserva los
precios y la corrida anterior. Build, typecheck y lint aprobados.

Durante la verificacion se reparo la importacion del catalogo `external_sources`:
su ausencia impedia adjuntar los identificadores a las cartas. El importador
ahora crea esas fuentes y verifica los IDs PriceCharting por SKU; los 2.166
registros de la copia actual pasaron esa comprobacion.

Para preparar una nueva copia en un checkout limpio:

```powershell
node node_modules/tsx/dist/cli.mjs tools/import-local-stock.mts outputs/price-source-audit/tcg-stock-before.json
pwsh -NoProfile -File scripts/start-local-stock.ps1
```

El importador solo permite una base PGlite local nueva en `.data/stock-offline`.
Rechaza SKUs duplicados y cantidades invalidas; importa en una transaccion y
verifica cantidades y precios por SKU. Nunca reemplaza una base existente.
