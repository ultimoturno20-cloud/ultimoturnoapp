import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as {
  Pool: new (config: Record<string, unknown>) => {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  };
};

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const sslValue = String(process.env.ULTIMOTURNO_DATABASE_SSL || "true").toLowerCase();

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Este check no escribe nada, pero necesita la URL de PostgreSQL.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: ["1", "true", "yes", "require"].includes(sslValue) ? { rejectUnauthorized: false } : undefined
});

try {
  const version = await pool.query<{ version: string }>("select version()");
  const current = await pool.query<{ database: string; user: string; schema: string }>(
    "select current_database() as database, current_user as user, current_schema() as schema"
  );
  const migrationsTable = await pool.query<{ exists: boolean }>(
    "select to_regclass('public.schema_migrations') is not null as exists"
  );
  let migrations = 0;
  let businessRows = 0;
  if (migrationsTable.rows[0]?.exists) {
    const migrationCount = await pool.query<{ count: string }>("select count(*)::text as count from schema_migrations");
    migrations = Number(migrationCount.rows[0]?.count || 0);
    const businessCount = await pool.query<{ count: string }>("select count(*)::text as count from businesses");
    businessRows = Number(businessCount.rows[0]?.count || 0);
  }
  console.log(JSON.stringify({
    ok: true,
    database: current.rows[0]?.database,
    user: current.rows[0]?.user,
    schema: current.rows[0]?.schema,
    postgres: version.rows[0]?.version,
    schemaMigrationsTable: Boolean(migrationsTable.rows[0]?.exists),
    migrations,
    businessRows
  }, null, 2));
} finally {
  await pool.end();
}
