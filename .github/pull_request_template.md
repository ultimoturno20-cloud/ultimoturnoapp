## Tarea y Alcance

- Issue / OP ID:
- Autor (Codex / Claude / humano), rama y SHA base:
- Que cambia y que queda fuera:
- Archivos compartidos, contrato/migracion y coordinacion con otra tarea:

## Verificacion

- [ ] `npm run check:new` y `git diff --check` aprobados (adjuntar resumen).
- [ ] Regresiones de permisos/negocio/propietario, dinero, reservas y reintentos segun alcance.
- [ ] Totales/exportaciones/acciones masivas completos si hay paginacion.
- [ ] Si hay UI: QA desktop/movil, teclado y estados; capturas ficticias sin datos reales.
- [ ] Sin operaciones de QA productivas, secretos ni datos de compradores en el diff/logs.
- [ ] Rama actualizada contra main y CI `check` verde antes de integrar.

## Revision y Entrega

- Revision cruzada: revisor, hallazgos y resolucion (o pendiente):
- Riesgos, compatibilidad, pendientes y recuperacion de codigo:
- Documentos que debe consolidar el integrador y siguiente OP:
- [ ] Merge pendiente del usuario; el autor no mergea ni usa bypass.
- Despliegue: pendiente hasta merge humano y comparacion del SHA resultante
  de main con `/api/public-status`. No confundir PR publicado con online.
