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
| Claude Code | D:\UltimoTurno\Stock\.work\agents\claude | claude/preparacion-local |

Ambas carpetas son worktrees del mismo repositorio GitHub, no aplicaciones ni
bases nuevas. La rama inicial de Claude parte de la preparacion compartida y
no tiene tarea funcional asignada. Esperar el merge humano del PR de preparacion
antes de crear la primera rama funcional desde origin/main actualizado.
La carpeta C:\Users\skype\Documents\Stock sigue prohibida.

La separacion evita pisar archivos locales; NO evita conflictos de merge.
Git y refs remotos son compartidos. Cada agente usa su propio cwd, node_modules,
puertos y fixtures. No copiar .env, .data, secretos, catalogos reales ni caches
operativas. No ejecutar npm ci en el checkout ajeno. No editar el .work de otro.
El worktree anidado queda ignorado por el checkout principal: jamas ejecutar
git clean -fdx, borrar .work recursivamente ni mover un worktree manualmente.

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
git worktree add .work/agents/<nombre> -b claude/<tarea> origin/main
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
La configuracion remota de protecciones es estado de GitHub, no se activa
solo por versionar esta guia. Verificarla por API o Settings > Branches.

Verificado por API el 16/10/2026 durante la preparacion: main protegida con
PR obligatorio, check de GitHub Actions (app 15368) requerido y strict=true,
enforce_admins=true, conversaciones resueltas, sin force-push ni borrado.
Aprobaciones GitHub requeridas: 0; la decision de merge sigue siendo humana.
Esta evidencia no garantiza que las reglas no cambien despues.

Previews de Vercel tambien son remotos: comprobar que NO heredan DB ni secretos
de produccion antes de usarlos. Este cambio no configura previews ni toca las
variables Vercel existentes. No agregar deploys productivos al CI de PRs.

## Prompt de arranque para Claude

```text
Trabaja en D:\UltimoTurno\Stock\.work\agents\claude, worktree del remoto
ultimoturno20-cloud/ultimoturnoapp. Lee CLAUDE.md, AGENTS.md y los documentos
obligatorios. Revisa status/log/remote/worktrees y public-status sin credenciales.
No uses C:\Users\skype\Documents\Stock ni edites el checkout de Codex.
Primero confirma que el PR de preparacion ya se integro y fetch origin.
Espera mi asignacion de issue, OP ID y alcance; no tomes automaticamente Ordenes.
Crea claude/<tarea> desde origin/main limpio. No toques hotspots ocupados.
Prueba en base temporal sin secretos; entrega commit, push y PR, sin merge.
Produccion tiene datos reales y no admite QA de compras, pagos ni cierres.
```
