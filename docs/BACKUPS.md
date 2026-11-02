# Backups de la base

Actualizado: 2026-11-02. Estado revisado por lecturas; no se ejecuto un backup o restore.

El workflow `.github/workflows/db-backup.yml` esta programado a las 05:00 de
Argentina (08:00 UTC). Esta disenado para hacer pg_dump de Supabase, cifrarlo
con AES256 y conservar el artifact 14 dias. Esa programacion no demuestra que
exista un backup exitoso o recuperable. El repositorio es publico: nunca subir
dumps sin cifrar, passwords o cadenas de conexion.

## Estado Verificado

La ultima ejecucion consultada al 02/11 es del 01/11 y termino en failure:
[run 41316920382](https://github.com/ultimoturno20-cloud/ultimoturnoapp/actions/runs/41316920382).
Fallo Check secrets, antes de Dump/Encrypt/Upload. La condicion versionada exige
SUPABASE_DB_URL y BACKUP_PASSPHRASE no vacios; falta o esta vacio al menos uno,
pero no se consultaron valores ni se identifico cual. Esta corrida no acredita
un nuevo respaldo. No se evaluaron artifacts de otras corridas ni se comprobo
una restauracion en esta revision; no afirmar que no existe ningun backup previo.

Pendiente: confirmar configuracion con el responsable, corregir por una tarea
autorizada y validar dump/cifrado/restauracion en entorno aislado. La actualizacion
de registros no autoriza modificar secretos, lanzar el workflow, conectarse a
la base para pg_dump o restaurar produccion. Nunca pedir esos valores por chat.

## Secretos requeridos (GitHub → Settings → Secrets and variables → Actions)

- `SUPABASE_DB_URL`: la cadena de conexión directa de Supabase (Project Settings → Database → Connection string, puerto 5432).
- `BACKUP_PASSPHRASE`: la contraseña para cifrar. Guardala también fuera de GitHub: sin ella, los backups no se pueden abrir.

## Restaurar

1. Bajá el artifact desde la corrida de Actions que quieras.
2. Descifralo: `gpg --decrypt ultimoturno-AAAA-MM-DD.dump.gpg > ultimoturno.dump`.
3. Restauralo en una base nueva o vacía: `pg_restore --no-owner --no-privileges --dbname "$DATABASE_URL" ultimoturno.dump`.

Usar exclusivamente una base de prueba nueva/aislada para comprobar el procedimiento.
Una restauracion productiva requiere un plan y autorizacion especificos: nunca
reutilizar la conexion real ni ejecutar estos comandos como parte de documentar.
