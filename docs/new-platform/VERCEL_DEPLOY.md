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

`DATABASE_URL` debe guardarse como secreto. Para Supabase, preferir la URL de **Session Pooler** cuando la red de deploy no use IPv6 directo.

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
