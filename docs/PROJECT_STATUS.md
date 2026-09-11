# UltimoTurno - estado actual

Actualizado: 2026-09-11

Este archivo es la memoria corta del proyecto para poder abrir otro chat y
seguir trabajando sin perder contexto.

## Workspace

```text
D:\UltimoTurno\Stock
```

La carpeta que importa para codigo nuevo es esta. Si Codex aparece parado en
`C:\Users\skype\Documents\Stock`, cambiar el working directory a
`D:\UltimoTurno\Stock` antes de tocar archivos.

## Online

App online:

```text
https://ultimoturnoapp-api.vercel.app/
```

API online:

```text
https://ultimoturnoapp-api.vercel.app/api
```

Proveedor:

```text
Vercel + Supabase Postgres
```

Estado funcional conocido:

- La pagina carga online.
- El inventario puede estar en cero y eso es normal si no se cargo stock.
- El catalogo PriceCharting completo fue importado: aproximadamente 120.710
  entradas.
- La busqueda de agregar stock debe buscar contra el catalogo completo, no solo
  contra cartas que alguna vez tuvieron inventario.
- Se agrego el endpoint `/catalog-cards` como fuente unificada del selector.
- Puede quedar un problema de deploy/cache en Vercel si online sirve una version
  vieja del backend. Verificar el commit desplegado antes de asumir que el codigo
  local esta roto.

## Local

Comandos habituales:

```powershell
npm run dev:api
npm run dev:web
```

Tambien existen accesos `.cmd` en la raiz para abrir la plataforma con perfil
piloto real.

Perfil esperado:

```text
ULTIMOTURNO_DATA_PROFILE=PILOTO REAL
ULTIMOTURNO_ALLOW_EXAMPLES=false
```

Base local esperada para piloto:

```text
D:\UltimoTurno\Stock\apps\api\.data\ultimoturno-pilot-real
```

Imagenes locales esperadas:

```text
D:\UltimoTurno\pricecharting-images
```

## Base de datos

Local puede usar PGlite. Produccion usa Postgres/Supabase.

Variables importantes, sin pegar secretos en git:

```ini
ULTIMOTURNO_DB_DRIVER=postgres
ULTIMOTURNO_DATABASE_URL=...
ULTIMOTURNO_DATABASE_SSL=true
ULTIMOTURNO_DATABASE_POOL_MAX=1
ULTIMOTURNO_ACCESS_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=ultimoturno-images
PRICECHARTING_TOKEN=...
```

Notas de DB:

- En Vercel se ajusto el pool para evitar `EMAXCONNSESSION max clients reached`.
- En produccion conviene usar transaction pooler y `ULTIMOTURNO_DATABASE_POOL_MAX=1`.
- Las migraciones viven en `packages/db/migrations`.
- La migracion mas reciente importante es `0030_unified_catalog_cards.sql`.

## Catalogo

Fuente principal:

```text
PriceCharting CSV / API
```

Estado conocido:

- Total aproximado: 120.710 entradas.
- Con precio PriceCharting: aproximadamente 81.339 entradas.
- TCG price cache online estaba vacio en la ultima revision conocida.
- El catalogo NO es stock. Sirve para elegir cartas y crear stock.
- Stock en cero no significa catalogo vacio.

Separacion por idioma:

- `english`
- `japanese`
- `chinese`

Regla de negocio:

- Korean, Indonesia y promos/variantes de otros paises asiaticos caen en
  `japanese`.
- La UI muestra filtros tipo `Todos`, `US Ingles`, `JP Japones`, `CN Chino`.

Endpoint unificado:

```text
GET /api/catalog-cards?q=...&languageGroup=...
```

Este endpoint debe ser la fuente del modal `Agregar stock`.

## Imagenes

Estado conocido:

- Hay imagenes locales descargadas/cacheadas.
- Se hizo una subida parcial/grande a Supabase Storage:
  - aproximadamente 37.014 subidas;
  - 595 ya existentes;
  - 16 fallidas.
- El bucket esperado es `ultimoturno-images`.
- El script de subida es:

```powershell
npm run images:supabase:upload
```

Script real:

```text
scripts/upload-pricecharting-images-to-supabase.mts
```

Notas:

- Las imagenes de PriceCharting no siempre vienen en el CSV.
- El sistema puede usar fallback desde `card_index_entries` / TCGCSV cuando
  matchea idioma + expansion + numero.
- Si el catalogo muestra placeholder `PC`, revisar primero si `image_url` viene
  vacio desde `/catalog-cards`.

## UI de agregar stock

Cambios recientes:

- Busca en catalogo completo.
- Muestra contador de catalogo completo.
- Agrega filtro de idioma.
- Distingue acabados como `Reverse`.
- Muestra precios separados:
  - `PC`: precio de PriceCharting.
  - `TCG`: precio de TCG en caso de tenerlo.
- Se saco el texto `blue` del listado del catalogo.
- Hay toggle superior para ver precios en `USD` o `ARS`.
- Al seleccionar carta, los campos `Precio de venta ARS` y `Precio de venta USD`
  se convierten entre si.
- Precio minimo de venta: `800 ARS`.
- Hay valor recomendado redondeado para acelerar carga de stock.

Regla de precio:

- Si se carga ARS, calcula USD.
- Si se carga USD, calcula ARS.
- Si falta precio fuente, recomendar minimo `800 ARS`.
- El backend tambien normaliza el precio ARS antes de guardar.

## Verificacion

Ultima verificacion local conocida despues de los cambios estructurales:

```powershell
npm run typecheck
npm run build
npm run db:verify
npm test
```

Resultado conocido:

```text
typecheck OK
build OK
db:verify OK
tests OK: 36 pass, 0 fail
```

## Commits recientes importantes

```text
609a61b Add unified catalog cards view
556c9eb Optimize unified catalog search
de5a4f1 Filter reference rows in unified catalog
22c6f97 Trigger unified catalog deploy
```

Si online no refleja el comportamiento esperado, revisar en Vercel si el commit
activo es el ultimo de `main`.

