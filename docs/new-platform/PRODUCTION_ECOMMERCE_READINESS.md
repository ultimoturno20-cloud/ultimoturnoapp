# Preparacion para produccion y ecommerce

La plataforma actual funciona como piloto operativo local. Para usarla desde cualquier lugar y luego convertirla en ecommerce con pagos integrados, hay que separar tres etapas: privado online, operacion estable y checkout publico.

## Etapa 1: privado online

Objetivo: poder usar UltimoTurno fuera de la computadora local sin abrir todavia una tienda publica.

- Subir a GitHub una rama estable con los cambios actuales revisados.
- Configurar ambientes separados: `local`, `staging` y `production`.
- Definir `ULTIMOTURNO_ALLOWED_ORIGINS` con los dominios reales autorizados.
- Definir `ULTIMOTURNO_ACCESS_KEY` por ambiente mientras no exista login completo.
- Mantener `ULTIMOTURNO_ALLOW_EXAMPLES=false` en toda base real.
- Publicar frontend y API detras de HTTPS.
- Crear backup automatico de base y archivos antes de uso diario.

Esta etapa todavia puede usar una clave privada, pero no debe quedar con CORS abierto ni datos de ejemplo habilitados.

## Etapa 2: datos preparados para internet

Objetivo: que la base deje de depender del disco local de Windows.

- Migrar de PGlite local a PostgreSQL administrado.
- Mantener PGlite solo para desarrollo local y pruebas.
- Crear migraciones repetibles para construir la base desde cero.
- Separar imagenes/cache a storage persistente, por ejemplo storage S3 compatible, R2 o storage del proveedor elegido.
- Agregar backups probados y restauracion documentada.
- Agregar logs de errores y auditoria operativa por usuario.

Sin esta etapa, un ecommerce seria fragil: el stock, las ordenes y los pagos dependen de consistencia real.

## Etapa 3: base ecommerce

Objetivo: que el inventario operativo pueda alimentar una tienda.

Datos nuevos que conviene modelar antes de integrar pagos:

- Producto publicable: titulo publico, descripcion, imagen principal, precio publicado, moneda, estado visible/oculto.
- Stock reservado para checkout: cuando alguien inicia compra, las unidades quedan bloqueadas por un tiempo.
- Carrito publico: items, cantidades, moneda, subtotal, descuentos y vencimiento.
- Orden ecommerce: comprador, estado, pago esperado, pago confirmado, entrega/envio, notas internas.
- Pago: proveedor, payment id externo, estado, moneda, monto, comisiones y payload de webhook.
- Envio/retiro: metodo, costo, direccion si aplica, estado de preparacion.

La plataforma administrativa no deberia perder su logica actual. El ecommerce debe consumir el mismo inventario, pero con reglas mas estrictas para reservas y pagos.

## Pagos

La integracion de pagos debe entrar despues de tener dominio HTTPS, base remota y ambientes separados.

Flujo recomendado:

1. La tienda crea una orden pendiente y reserva stock por un tiempo limitado.
2. El backend crea una preferencia/sesion de pago con el proveedor elegido.
3. El comprador paga fuera de la app o en checkout embebido, segun proveedor.
4. El proveedor llama al webhook del backend.
5. El backend valida firma/secreto del webhook.
6. Si el pago esta aprobado, marca la orden como pagada y la mueve al flujo operativo.
7. Si vence o falla, libera stock reservado.

Nunca conviene marcar una orden como pagada solo por el retorno del navegador. La confirmacion real debe venir por webhook validado.

## Primeros cambios ya iniciados

- La API ahora soporta `ULTIMOTURNO_ALLOWED_ORIGINS` para no exponer CORS abierto en produccion.
- `.env.example` declara variables de ambiente, dominio, clave temporal y placeholders de pagos.
- El modo local sigue aceptando origenes `localhost` para no trabar desarrollo.
- La base ahora soporta dos drivers: `pglite` para local y `postgres` para staging/produccion.
- `/health` informa el driver activo sin exponer credenciales.

## Activar PostgreSQL remoto

Variables minimas para staging/produccion:

```env
ULTIMOTURNO_ENV=production
ULTIMOTURNO_DB_DRIVER=postgres
DATABASE_URL=postgres://usuario:password@host:5432/base
ULTIMOTURNO_DATABASE_SSL=true
ULTIMOTURNO_DATABASE_POOL_MAX=10
ULTIMOTURNO_ALLOWED_ORIGINS=https://app.ultimoturno.com
ULTIMOTURNO_ACCESS_KEY=clave-larga-unica-del-ambiente
ULTIMOTURNO_ALLOW_EXAMPLES=false
```

Con `ULTIMOTURNO_DB_DRIVER=pglite`, la API ignora `DATABASE_URL` y sigue usando `PGLITE_DATA_DIR`. Esto evita que el piloto local cambie de base por accidente.

Antes de crear tablas, validar la conexion sin escribir:

```powershell
$env:DATABASE_URL="postgres://usuario:password@host:5432/base"
$env:ULTIMOTURNO_DATABASE_SSL="true"
npm run db:postgres:check
```

En Supabase, si la URL directa tiene forma `postgresql://postgres:...@db.<project-ref>.supabase.co:5432/postgres` y la conexion falla desde una red sin IPv6, usar la connection string de **Supavisor / Session pooler** desde el boton **Connect** del dashboard. Esa URL suele tener esta forma:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:password@aws-0-region.pooler.supabase.com:5432/postgres
```

La URL directa sirve si el entorno tiene IPv6 o si el proyecto tiene el add-on IPv4. Para staging y para un backend persistente en una red IPv4, usar **Session pooler**, no Transaction pooler.

Para inicializar una base staging vacia:

```powershell
$env:ULTIMOTURNO_ENV="staging"
$env:DATABASE_URL="postgres://usuario:password@host:5432/base"
$env:ULTIMOTURNO_DATABASE_SSL="true"
$env:ULTIMOTURNO_SCHEMA_CONFIRM="INIT_POSTGRES_SCHEMA"
npm run db:postgres:init
```

## Copiar datos de PGlite a PostgreSQL

Cuando exista una base staging vacia, se puede copiar el piloto real con:

```powershell
$env:ULTIMOTURNO_ENV="staging"
$env:SOURCE_PGLITE_DATA_DIR="D:\UltimoTurno\Stock\apps\api\.data\ultimoturno-pilot-real"
$env:DATABASE_URL="postgres://usuario:password@host:5432/base"
$env:ULTIMOTURNO_DATABASE_SSL="true"
$env:ULTIMOTURNO_MIGRATION_CONFIRM="COPY_PGLITE_TO_POSTGRES"
npm run db:migrate:pglite-to-postgres
```

Si un cache externo trae valores raros, se puede copiar primero solo la informacion operativa:

```powershell
$env:ULTIMOTURNO_MIGRATION_SKIP_CACHES="true"
npm run db:migrate:pglite-to-postgres
```

El script ejecuta migraciones en destino, vacia las tablas operativas y copia los datos en orden compatible con las claves foraneas. Se niega a correr con `ULTIMOTURNO_ENV=production`; usarlo primero contra staging, nunca directo sobre una base productiva con ventas activas.

## Siguiente paso tecnico

El proximo bloque recomendado es crear una base staging real, correr la migracion y levantar la API con `ULTIMOTURNO_DB_DRIVER=postgres` para probar inventario, ordenes y claims sobre PostgreSQL remoto antes de abrir ecommerce.
