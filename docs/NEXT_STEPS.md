# UltimoTurno - proximos pasos

Actualizado: 2026-09-23

> Las prioridades vigentes estan en esta primera seccion. El plan del
> 2026-09-11 se conserva debajo como referencia historica.

## Prioridades vigentes

### 0. Activar y pilotear el planificador de claims

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

### 1. Observar la sincronizacion sectorial en produccion

- Confirmar con dos sesiones reales que inventario, claims, ordenes, caja y el
  portal reflejen cambios dentro de los 15 segundos esperados.
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

- Verificar el tablero en desktop y movil con volumen real.
- Si todavia falta espacio vertical, ocultar o colapsar la marca superior solo
  dentro de Ordenes.
- No cambiar estados, reservas ni queries de persistencia por una mejora visual.

Senal de exito: mas tarjetas visibles y acciones legibles sin modificar una sola
orden de produccion.

### 6. Robustecer tareas automaticas

- Confirmar diariamente el cron PriceCharting de las `09:00 UTC`.
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
https://ultimoturnoapp-api.vercel.app/ con Vercel, Supabase/Postgres y Supabase
Storage.

Hay un claim activo y ordenes reales en produccion: no los elimines, canceles ni
recrees durante pruebas. No pongas secretos en Git.

Commit de produccion confirmado antes de la mejora de sincronizacion:
`271933f`. Revisar `git log -1` y `/api/public-status` para obtener el commit
final publicado por el chat siguiente.

Trabajo reciente: carga de stock en pagina completa, busqueda de catalogo mas
rapida, imagenes con fallback/proxy seguro, tarjetas de inventario normalizadas,
mejoras de claim y sistema de revendedores en consignacion. El revendedor tiene
usuario propio, stock asignado sin exclusividad, ventas, rendiciones, pedidos,
stock global de solo lectura y estados independientes de preparacion y cobro.
UltimoTurno siempre conserva prioridad sobre el stock y la venta del revendedor
revalida disponibilidad antes de descontar.

La navegacion principal y el portal usan URLs reales por sector. La pantalla
visible se actualiza cada 15 segundos y al recuperar el foco, sin F5 ni perdida
de formularios, carrito, filtros o scroll. El boton superior actualiza solo el
sector actual. Antes de cambiar esto, revisar la implementacion de History API,
los mapas de rutas y `vercel.json`.

Objetivo inmediato: validar la sincronizacion con dos sesiones en produccion y
luego pilotear revendedores con pocas cartas reales para comprobar
prioridad central, venta, anulacion, devolucion, rendicion, pedidos y estados.
Luego continuar cobertura de imagenes y validacion de CSV reales.
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
La app online es https://ultimoturnoapp-api.vercel.app/
```
