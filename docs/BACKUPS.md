# Backups de la base

Cada día a las 05:00 (hora Argentina), `.github/workflows/db-backup.yml` hace un `pg_dump` de Supabase, lo cifra con AES256 y lo guarda como artifact de GitHub Actions durante 14 días. El repo es público: sin la contraseña, el archivo no se puede leer.

## Secretos requeridos (GitHub → Settings → Secrets and variables → Actions)

- `SUPABASE_DB_URL`: la cadena de conexión directa de Supabase (Project Settings → Database → Connection string, puerto 5432).
- `BACKUP_PASSPHRASE`: la contraseña para cifrar. Guardala también fuera de GitHub: sin ella, los backups no se pueden abrir.

## Restaurar

1. Bajá el artifact desde la corrida de Actions que quieras.
2. Descifralo: `gpg --decrypt ultimoturno-AAAA-MM-DD.dump.gpg > ultimoturno.dump`.
3. Restauralo en una base nueva o vacía: `pg_restore --no-owner --no-privileges --dbname "$DATABASE_URL" ultimoturno.dump`.

Probalo primero en una base de prueba antes de tocar producción.
