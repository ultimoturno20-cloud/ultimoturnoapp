import { createOperationalDatabase, getHealth } from "@ultimoturno/db";

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const confirm = String(process.env.ULTIMOTURNO_SCHEMA_CONFIRM || "");
const runtimeEnv = String(process.env.ULTIMOTURNO_ENV || "staging").toLowerCase();
const sslValue = String(process.env.ULTIMOTURNO_DATABASE_SSL || "true").toLowerCase();

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL de PostgreSQL.");
}

if (confirm !== "INIT_POSTGRES_SCHEMA") {
  throw new Error("Operacion protegida. Defini ULTIMOTURNO_SCHEMA_CONFIRM=INIT_POSTGRES_SCHEMA para crear/actualizar el schema.");
}

if (runtimeEnv === "production" || runtimeEnv === "prod") {
  throw new Error("Este init esta pensado para staging. Produccion debe inicializarse con una ventana de deploy planificada.");
}

const db = await createOperationalDatabase({
  driver: "postgres",
  databaseUrl,
  ssl: ["1", "true", "yes", "require"].includes(sslValue),
  poolMax: Number(process.env.ULTIMOTURNO_DATABASE_POOL_MAX || 3),
  adminEmail: process.env.ULTIMOTURNO_ADMIN_EMAIL,
  adminPassword: process.env.ULTIMOTURNO_ADMIN_PASSWORD,
  adminName: process.env.ULTIMOTURNO_ADMIN_NAME
});

try {
  const migrationCount = await db.query<{ count: string }>("select count(*)::text as count from schema_migrations");
  console.log(JSON.stringify({
    ok: true,
    health: await getHealth(db),
    migrations: Number(migrationCount.rows[0]?.count || 0)
  }, null, 2));
} finally {
  await db.close();
}
