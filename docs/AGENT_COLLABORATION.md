# Codex + Claude: trabajo en paralelo

Vigente desde 2026-10-16. Reglas comunes en AGENTS.md; CLAUDE.md remite alli.
No reemplaza NEXT_STEPS ni OPTIMIZATION_PLAN, y no agrega un backlog paralelo.

## Fuente de verdad y responsabilidades

GitHub conserva codigo integrado en main, propuestas en PRs y asignaciones en
issues. La produccion real se confirma por public-status, no por un push.
La memoria de un chat no equivale a cambios integrados ni autoriza al otro agente.

El usuario decide prioridades, asigna tareas, autoriza merge y despliegue.
El autor implementa y prueba; el otro agente revisa el diff con foco en errores,
permisos, stock, dinero e idempotencia. Revision cruzada no reemplaza CI ni la
decision humana. Ningun agente mergea ni hace bypass por su cuenta.

Usar la plantilla de issue "Tarea para agente" y la plantilla de PR. Antes de
programar deben quedar claros propietario, OP ID, areas permitidas/excluidas,
archivos compartidos, contrato y criterio de aceptacion. Una tarea sin asignar
no se considera tomada por haberla mencionado en un chat. No hay locks locales.
Si dos tareas necesitan el mismo hotspot, detener ese solapamiento y pedir una
division al usuario; se puede avanzar en pruebas o areas realmente independientes.

## Carpetas de esta PC

| Agente | Checkout | Rama inicial |
|---|---|---|
| Codex | D:\UltimoTurno\Stock | codex/colaboracion-claude |
| Claude Code | D:\UltimoTurno\Stock-claude | claude/preparacion-local |

Ambas carpetas son worktrees del mismo repositorio GitHub, no aplicaciones ni
bases nuevas. La rama inicial de Claude parte de la preparacion compartida y
no tiene tarea funcional asignada. PR de preparacion #28 integrado por el usuario
en 4215399; crear las ramas funcionales desde origin/main actualizado.
No reutilizar claude/preparacion-local para desarrollo ni asumir que sera
ancestro de main: squash/rebase cambian la historia. Crear una rama NUEVA
desde origin/main despues del merge, sin resetear ni forzar la de preparacion.
La carpeta C:\Users\skype\Documents\Stock sigue prohibida.

La separacion evita pisar archivos locales; NO evita conflictos de merge.
Git y refs remotos son compartidos. Cada agente usa su propio cwd, node_modules,
puertos y fixtures. No copiar .env, .data, secretos, catalogos reales ni caches
operativas. No ejecutar npm ci en el checkout ajeno. No editar el .work de otro.
Los worktrees son hermanos, nunca anidados: Node podria resolver en silencio
paquetes del checkout padre. El 16/10 se movio Claude con git worktree move
tras confirmar el usuario que habia cerrado la sesion. Se regeneran junctions
de npm despues de mover. No mover con Explorer ni borrar worktrees a mano.

Despues de npm ci y typecheck verificar resolucion desde el worktree asignado:

```powershell
node -p "require.resolve('@ultimoturno/db')"
node -p "require.resolve('@ultimoturno/domain')"
node -p "require.resolve('@ultimoturno/importers')"
```

Todos deben apuntar DENTRO de ese worktree (packages/.../dist), nunca al de
otro agente ni a un node_modules ancestro. Si falla, detener QA y reparar la
instalacion propia; no usar NODE_PATH, --preserve-symlinks o paquetes globales
como solucion. Un test que resuelve codigo ajeno no valida la rama actual.

## Inicio de una tarea

Ejecutar solo en TU worktree limpio. No escribir literalmente <tarea>.

```powershell
git status --short --branch
git remote -v
git worktree list
git fetch origin
git log -1 origin/main
git switch -c codex/<tarea> origin/main
```

Claude usa claude/<tarea>. Si la rama ya existe, inspeccionar su estado y su
issue antes de continuar: no recrearla, resetearla ni forzarla. Releer AGENTS y
contexto despues de actualizar. Verificar public-status; no exigir que el HEAD
de una rama nueva ya este en produccion.

Para otro worktree futuro, desde el checkout canonico y con nombre/rama nuevos:

```powershell
git fetch origin
git worktree add ../Stock-<nombre> -b claude/<tarea> origin/main
```

No ejecutar sobre la carpeta preparada de Claude. No es un clone ni necesita
otra base real. Si se usa otra maquina en el futuro, clonar el mismo remoto,
seguir ramas/PRs y no trasladar rutas absolutas de esta PC como configuracion.

## Division recomendada del trabajo

No asignar permanentemente "todo backend" a uno y "todo frontend" al otro:
muchas funciones actuales cruzan ambos y comparten archivos grandes.

| Zona compartida | Acuerdo necesario |
|---|---|
| main.tsx, styles.css | Un editor por ventana de trabajo; otros trabajan en modulos/tests independientes |
| server.ts, packages/db/src/index.ts | Un integrador para rutas/exports; acordar contrato antes de implementar consumidores |
| Domain, DTO y auth | PR de contrato primero; dependientes esperan merge |
| Migraciones y package-lock.json | Un propietario; no instalar dependencias ni numerar migraciones en paralelo sin coordinar |
| AGENTS y documentos de continuidad | Un integrador consolida; otros dejan evidencia en su PR |
| Workers, cron y Vercel | Sincronizar permisos/configuracion; ningun ensayo contra produccion |

La proxima prioridad funcional sigue siendo OP-1.4c.2b, empezando por el picker
de Ordenes. Sugerencia inicial (NO asignacion): un agente implementa ese alcance
y el otro revisa/registra casos de prueba sin editar sus hotspots. Para dos
implementaciones simultaneas, el usuario debe elegir una segunda tarea con
zonas y contratos independientes. No adelantar todas las etapas por paralelismo.

## QA y CI

Node 22, npm ci, npm run check:new. CI en PR y push a main usa token de lectura,
sin secretos de Supabase/proveedores, sin deploy ni pull_request_target.
El job requerido conserva el nombre check. db:verify valida esquema/seeds en
PGlite nuevo en memoria. Los otros tests deben usar fixtures temporales.
typecheck ejecuta tsc -b y emite dist de los paquetes composite ANTES de los
tests; build al final tambien empaqueta Vite. No reordenar por confundir
typecheck con una comprobacion noEmit.
Concurrencia: solo un PR cancela su run anterior. Cada push de main usa SHA
propio en el grupo; no se cancelan runs activos NI pendientes de otros commits.
Esto no hace que Vercel espere el CI de main: el gate previo es el check del PR.

La API local puede elegir la base operativa por defecto; npm run dev:api sin
preparacion NO es una prueba aislada. Antes de cualquier demo definir un
PGLITE_DATA_DIR nuevo dentro del worktree, ULTIMOTURNO_DB_DRIVER=pglite,
puertos libres y entorno sin credenciales productivas/proveedores. Desactivar
workers/integraciones; no iniciar scripts de mantenimiento ni compartir DB.
Revisar el diff de migraciones y los efectos de inicializacion antes de arrancar.

Para ahorrar C: se puede asignar TEMP/TMP a un directorio temporal propio en D:.
No borrar temporales de otro proceso. Las pruebas visuales solo son necesarias
cuando el cambio afecta UI; el gate automatico no demuestra calidad visual.
Lint actual detecta whitespace y patrones legacy conocidos, no todos los secretos.
Revisar el diff staged y ejemplos de entorno antes de publicar.

## Entrega, revision e integracion

1. Autor: pruebas locales, git diff --check, stage explicito, commit y push de
   su rama. Actualizar issue/PR con evidencia, riesgos y OP ID. No usar datos
   reales en capturas/logs. No cerrar el OP como online aun.
2. Revisor: leer issue + diff + contexto, enumerar hallazgos por severidad con
   archivo/linea y faltantes de prueba. No cambiar el checkout del autor; si se
   necesita ejecutar el codigo, usar otro worktree de revision. El autor corrige.
3. Integrador: actualizar contra origin/main cuando otro PR se integro, resolver
   conflictos en la propia rama y repetir checks. Preferir merge de origin/main
   para no reescribir una rama publicada; no force-push.
4. Usuario: revisar CI/check verde y revision cruzada, decidir y ejecutar merge
   desde GitHub. Actualizar rama si main avanzo: CI requerido sobre base actual.
5. Tras merge autorizado: verificar el SHA resultante de main en public-status
   y revisar estaticos/401 sin operaciones reales. Si Vercel aun muestra otro
   SHA, registrar pendiente; no asumir ni forzar redeploy para cerrar el item.
6. Integrador: consolidar documentos y marcar entrega/online con evidencia en
   la siguiente actualizacion documental. Ambos releen antes de elegir otro OP.

No hacer rollback de datos ni reset/force-push de main. Si hay regresion,
preparar PR de correccion o revert de codigo revisado; la recuperacion de datos
requiere plan y autorizacion especificos.

## Proteccion y limites reales

Configurar main con PR obligatorio, CI check requerido y rama actualizada,
reglas aplicadas a administradores, sin force-push ni borrado. No exigir una
aprobacion de otra cuenta humana si solo existe el propietario: no puede
aprobar su propio PR. En ese caso el merge humano es una regla de operacion,
no una aprobacion GitHub simulada por una IA.

Ambos agentes locales usan la misma identidad de GitHub. La proteccion no
distingue a Claude del humano ni impide a un admin cambiar las reglas. Para
aislamiento de permisos real se necesitan identidades/tokens separados con
privilegios minimos. No generar ni compartir nuevos tokens en el chat.
Para una barrera tecnica de merge: separar cuentas y almacenes de credenciales
(no dejar accesible la cuenta humana en la sesion del agente), quitar admin a
los agentes y exigir review del humano designado mediante CODEOWNERS/reglas.
Configurar esa aprobacion cuando exista dicha separacion, no con ambas IAs
usando la identidad del unico propietario: bloquearia tambien su autoaprobacion.
Esto sigue pendiente; instrucciones y draft NO son aislamiento de permisos.
La configuracion remota de protecciones es estado de GitHub, no se activa
solo por versionar esta guia. Verificarla por API o Settings > Branches.

Verificado por API el 16/10/2026 durante la preparacion: main protegida con
PR obligatorio, check de GitHub Actions (app 15368) requerido y strict=true,
enforce_admins=true, conversaciones resueltas, sin force-push ni borrado.
Aprobaciones GitHub requeridas: 0; la decision de merge sigue siendo humana.
Esta evidencia no garantiza que las reglas no cambien despues.

## Previews: bloqueo operativo

La revision detecto que la API importa server.js al primer request;
createOperationalDatabase aplica
runOperationalMigrations y ensureOperationalBootstrap antes de servir rutas.
Si Preview comparte credenciales operativas, incluso una peticion de lectura
puede inicializar la base real. No publicar valores ni detalles de configuracion
remota sensible en este repositorio publico. La revision no demuestra que haya
habido cambios de datos o filtracion.

Medida versionada: vercel.json permite auto-deploy Git solo en main y bloquea
las demas ramas con **. Las reglas Vercel permiten un match true sobre false:
main sigue habilitada. No bloquea CLI/manual ni modifica variables remotas.
Comprobar el resultado del proximo push; no inferir que un preview viejo se retiro.

Pendiente del usuario/integrador en Vercel, ANTES de habilitar previews o
avanzar a PRs funcionales con migraciones:

1. Editar DATABASE_URL y PRICECHARTING_TOKEN para quitar SOLO Preview,
   conservando Production y sus valores. Revisar tambien variables compartidas
   del equipo, integraciones, overrides por rama y otros proyectos del mismo repo.
2. Revisar/retirar previews anteriores que heredaron esas variables sin tocar
   despliegues Production. Cambiar scopes NO cambia despliegues ya creados.
   No abrirlos para probar: su primer request puede ejecutar inicializacion.
3. Registrar evidencia de nombres/entornos y estado de previews, nunca secretos.
   Si se habilita QA remoto futuro, usar credenciales/recursos aislados y sin
   permisos sobre produccion, con workers desactivados. No requiere otra base
   real de UltimoTurno: mientras tanto toda QA sigue en PGlite local temporal.

El usuario confirmo correccion de entornos y retiro del Preview identificado;
PR #28 integrado en 4215399 y Postgres productivo accesible, verificado el 19/10.
Esto no equivale a auditoria autenticada de toda la cuenta ni otros previews.
No repetir ese merge. Cualquier preview nuevo requiere aislamiento explicito.
Para verificar salud comprobar databaseUrlConfigured y databaseReachable;
HTTP 200 y ok=true pueden coexistir con una base desconectada.
No agregar deploys productivos al CI de PRs ni forzar un redeploy de Production.

Referencias: [Git por rama](https://vercel.com/docs/project-configuration/git-configuration)
y [alcance de variables y despliegues existentes](https://vercel.com/docs/environment-variables).

## Prompt de arranque para Claude

```text
Trabaja en D:\UltimoTurno\Stock-claude, worktree del remoto
ultimoturno20-cloud/ultimoturnoapp. Lee CLAUDE.md, AGENTS.md y los documentos
obligatorios. Revisa status/log/remote/worktrees y public-status sin credenciales.
No uses C:\Users\skype\Documents\Stock ni edites el checkout de Codex.
Primero confirma que el PR de preparacion ya se integro y fetch origin.
Espera mi asignacion de issue, OP ID y alcance; no tomes automaticamente Ordenes.
Crea claude/<tarea> desde origin/main limpio. No toques hotspots ocupados.
Prueba en base temporal sin secretos; entrega commit, push y PR, sin merge.
Produccion tiene datos reales y no admite QA de compras, pagos ni cierres.
```
