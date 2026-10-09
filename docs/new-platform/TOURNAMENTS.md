# Torneos de UltimoTurno

Apartado `/torneos` del panel de administración. Reutiliza sesión y estilos de UltimoTurno; solo administradores del mismo negocio pueden consultar o modificar sus torneos.

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

La migración aditiva `0059_tournaments.sql` crea `tournaments`, indexado por negocio/actualización, con estado JSONB, creador y versión. No modifica stock, caja, claims, revendedores ni ventas. RLS habilitado sin políticas públicas: la tabla se consulta a través de la API autenticada del servidor.

La inicialización existente de la API aplica migraciones pendientes al arrancar, tanto en PGlite local como en PostgreSQL/Supabase. Al desplegar en Vercel se usa el mismo `DATABASE_URL` del sitio. No se requiere base nueva ni servicio externo.

Cada acción validada por el servidor guarda con compare-and-swap de versión. Dos PCs con la misma versión no pueden sobrescribir cambios mutuamente: la segunda recibe HTTP 409. La pantalla pausa edición ante conflictos/respuestas no confirmadas y exige recargar para verificar el estado antes de reenviar. No hay cola offline ni reenvíos automáticos. Recargar o abrir un torneo obtiene datos del servidor. No hay actualización en tiempo real; se usa `Recargar datos` para ver cambios hechos desde otra PC.

Las altas usan UUID de cliente reutilizado al reintentar; el mismo alta recupera un documento equivalente de versión 1 en vez de duplicarlo. Las copias descargadas no contienen sesión ni credenciales. El listado muestra los últimos 200 torneos.

## Rutas

- `GET /api/tournaments`: listado del negocio.
- `POST /api/tournaments`: alta o importación.
- `GET /api/tournaments/:id`: documento con versión.
- `PUT /api/tournaments/:id`: acción específica y versión esperada; nunca acepta sustitución arbitraria del estado.
- Vercel reescribe estas rutas a dispatch y `/torneos` al shell web.
- `?torneo=UUID` conserva el torneo abierto al recargar o compartir el enlace entre administradores.

## Verificación de esta entrega

- `npm run check:new`: lint, tipos, suite completa, verificación DB y builds.
- Pruebas nuevas del motor: Swiss, byes, top cut, puntos, resistencia, bajas e importación.
- Prueba DB temporal: persistencia entre sesiones, reintentos de alta, aislamiento por negocio/rol, versiones desactualizadas y rollback de acciones inválidas.
- Exportaciones: columnas, escape HTML y protección frente a fórmulas CSV.
- Navegador Chrome aislado con API simulada: alta, cinco jugadores, tres Swiss, top 4/final, campeón, segunda sesión y conflicto 409. Sin desborde de página en 1440/768/390/320 px; tabla y cuadro desplazan internamente.
- Ningún torneo ficticio ni resultado de prueba se crea en producción durante QA.

## Uso

Entrar con administrador, abrir **Torneos**, crear uno o importar una copia JSON del escritorio. Guardar configuración, inscribir jugadores, ir a **Rondas y resultados** y empezar Swiss. Cargar resultados por mesa y avanzar al completar la ronda. Al terminar, iniciar top cut si está configurado. Desde otra PC, iniciar sesión en el mismo negocio y abrir el torneo guardado; usar **Recargar datos** antes de editar si otra persona acaba de trabajar en él.
