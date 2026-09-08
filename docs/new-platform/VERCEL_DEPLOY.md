# Deploy en Vercel

La plataforma puede publicarse en Vercel usando:

- `apps/admin-web` como web Vite.
- `api/[...path].ts` como adaptador serverless de la API.
- Supabase PostgreSQL como base remota.

## Variables necesarias

Configurar estas variables en Vercel para Production y Preview:

```bash
ULTIMOTURNO_ENV=production
ULTIMOTURNO_DB_DRIVER=postgres
DATABASE_URL=postgresql://usuario:password@host:5432/postgres
ULTIMOTURNO_DATABASE_SSL=true
ULTIMOTURNO_DATABASE_POOL_MAX=3
ULTIMOTURNO_ACCESS_KEY=una-clave-privada
ULTIMOTURNO_ALLOW_EXAMPLES=false
PRICECHARTING_AUTO_REFRESH_ENABLED=false
TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED=false
```

`DATABASE_URL` debe guardarse como secreto. En Vercel, el valor debe ser solo la URL (`postgresql://...`), sin `DATABASE_URL=` adelante y sin comillas externas.

Para Supabase + Vercel, preferir la URL de **Supavisor / Transaction pooler** o **Session pooler**. La URL directa `db.<project-ref>.supabase.co:5432` suele depender de IPv6; Vercel no siempre puede llegar a ese host desde funciones serverless.

## Diagnostico publico seguro

El endpoint `GET /api/public-status` no expone datos de negocio ni secretos, pero sirve para revisar si Vercel tomo la configuracion correcta:

```json
{
  "environment": {
    "dbDriver": "postgres",
    "databaseUrlConfigured": true,
    "databaseUrlSource": "DATABASE_URL",
    "databaseEndpointKind": "supabase_pooler_transaction"
  },
  "data": {
    "rawPostgres": { "reachable": true },
    "databaseReachable": true
  }
}
```

Si `databaseEndpointKind` aparece como `invalid`, corregir el valor de `DATABASE_URL` en Vercel. Si `rawPostgres.reachable` aparece como `false` con una URL directa de Supabase, cambiar a una URL pooler IPv4.

## Comandos de Vercel

```bash
npx vercel link
npx vercel env add DATABASE_URL production
npx vercel env add ULTIMOTURNO_ACCESS_KEY production
npx vercel --prod
```

También se puede importar el repositorio de GitHub desde el dashboard de Vercel. En ese caso:

- Framework: Vite.
- Build command: `npm run build`.
- Output directory: `apps/admin-web/dist`.
- Install command: `npm install`.

Al quedar conectado con GitHub, cada push a `main` puede disparar un deploy nuevo.
