# UltimoTurno - proximos pasos

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

