# Torneos de UltimoTurno

Espacio independiente en `/torneos`, con página de entrada, registro público y cuenta propia. No requiere permisos de administrador ni cuenta de Stock; no aparece como pestaña del panel. Comparte la identidad visual de UltimoTurno.

## Funciones

- Alta con nombre, 1–20 rondas Swiss y top cut opcional de 2, 4, 8 o 16.
- Una categoría/grupo (Flight 1), hasta 128 participantes, Player ID opcional y único.
- Inscripción cerrada al iniciar Swiss; bajas y reactivaciones entre rondas.
- Emparejamientos sin repetir rivales, por puntaje cercano, con búsqueda acotada a 200.000 pasos. La primera ronda es aleatoria. El bye prioriza menor cantidad de byes y menor puntaje compatible con un emparejamiento válido.
- Resultados A/B/empate y correcciones en la ronda actual. Rondas históricas de consulta.
- Posiciones con las ocho columnas del reporte TOM, récord V/D/E (puntos), baja y ambos porcentajes. Resistencia por victorias/matches, piso 25%, techo 75% para bajas anteriores al final y byes excluidos; el segundo desempate promedia resistencias de oponentes. Empates exactos usan inscripción, por lo que no se afirma equivalencia completa con TOM.
- Top cut sembrado, sin empates, con cuadro y campeón independiente de posiciones Swiss.
- Exportación JSON, CSV seguro para planillas y HTML imprimible con la marca.
- Importación validada del JSON de escritorio o de una copia web. Crea un torneo nuevo: no reemplaza un torneo guardado.

## Persistencia y acceso desde otra PC

La migración aditiva `0060_tournament_space.sql` crea `tournament_accounts`, `tournament_sessions`, `tournament_auth_attempts` y `account_tournaments`. Cada torneo pertenece a una cuenta de Torneos. Las tablas tienen RLS sin políticas públicas; solo la API autenticada del servidor consulta los datos. No modifica stock, caja, claims, revendedores ni ventas.

La API aplica migraciones pendientes al arrancar, tanto en PGlite local como en PostgreSQL/Supabase. Vercel usa el mismo `DATABASE_URL` del sitio. No requiere una nueva base o servicio externo.

El registro usa nombre, email y contraseña de 10–128 caracteres. Las contraseñas usan scrypt y sal aleatoria; las sesiones duran 30 días, con token aleatorio de 32 bytes y solo su hash SHA256 guardado. El token del navegador tiene una clave local propia, sin usar la sesión de Stock. Cerrar sesión revoca ese token. Límites de 15 minutos: 10 intentos por email, 30 logins por IP y 5 registros por IP. No hay verificación de email ni recuperación de contraseña en esta versión.

Los datos de la integración anterior `0059_tournaments.sql` y sus rutas administrativas permanecen protegidos. No se reasignan automáticamente a cuentas públicas. Se puede importar un JSON descargado previamente, creando una copia en la cuenta nueva.
Cada acción validada por el servidor guarda con compare-and-swap de versión. Dos PCs con la misma versión no pueden sobrescribir cambios mutuamente: la segunda recibe HTTP 409. La pantalla pausa edición ante conflictos/respuestas no confirmadas y exige recargar para verificar el estado antes de reenviar. No hay cola offline ni reenvíos automáticos. Recargar o abrir un torneo obtiene datos del servidor. No hay actualización en tiempo real; se usa `Recargar datos` para ver cambios hechos desde otra PC.

Las altas usan UUID de cliente reutilizado al reintentar; el mismo alta recupera un documento equivalente de versión 1 en vez de duplicarlo. Las copias descargadas no contienen sesión ni credenciales. El listado muestra los últimos 200 torneos.

## Rutas

- `POST /api/tournament-space/register`: crea cuenta y sesión sin acceso administrativo.
- `POST /api/tournament-space/login`: sesión propia de Torneos.
- `GET /api/tournament-space/me`: cuenta de esa sesión.
- `POST /api/tournament-space/logout`: revoca la sesión actual.
- `GET /api/tournament-space/tournaments`: lista privada de la cuenta.
- `POST /api/tournament-space/tournaments`: alta o importación.
- `GET /api/tournament-space/tournaments/:id`: documento con versión.
- `PUT /api/tournament-space/tournaments/:id`: acción específica y versión esperada.
- Vercel reescribe `/torneos` a `torneos.html`, una entrada Vite independiente. No carga el shell de Stock ni su service worker; el worker de Stock deja pasar esta ruta.
- `?torneo=UUID` conserva el evento al recargar o acceder desde otra PC con la misma cuenta. El enlace no da acceso a otras cuentas.

## Verificación de esta entrega

- `npm run check:new`: lint, tipos, suite completa, verificación DB y builds.
- Pruebas nuevas del motor: Swiss, byes, top cut, puntos, resistencia, bajas e importación.
- Prueba DB temporal: persistencia entre sesiones, reintentos de alta, aislamiento por negocio/rol, versiones desactualizadas y rollback de acciones inválidas.
- Exportaciones: columnas, escape HTML y protección frente a fórmulas CSV.
- Navegador Chrome aislado con API conectada a una base temporal: registro, login, restauración, logout, aislamiento de cuentas, alta, cinco jugadores, tres Swiss, top 4/final, campeón, segunda sesión y conflicto 409. Sin desborde de página en 1440/768/390/320 px; tabla y cuadro desplazan internamente.
- Ningún torneo ficticio ni resultado de prueba se crea en producción durante QA.

## Uso

Abrir `/torneos`, crear la cuenta propia o iniciar sesión y crear un evento o importar una copia JSON del escritorio. Guardar configuración, inscribir jugadores, ir a **Rondas y resultados** y empezar Swiss. Cargar resultados por mesa y avanzar al completar la ronda. Al terminar, iniciar top cut si está configurado. Desde otra PC, iniciar sesión en la misma cuenta de Torneos y abrir el torneo guardado; usar **Recargar datos** antes de editar si otra persona acaba de trabajar en él.
