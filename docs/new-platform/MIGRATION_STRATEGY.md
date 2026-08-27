# Estrategia de migracion incremental

## Regla principal

Legacy sigue siendo operativo y fuente oficial hasta que se apruebe modulo por
modulo. La nueva plataforma empieza como lectura, simulacion y conciliacion.

## Etapas

1. Schema y seed ficticio.
2. Importacion read-only desde snapshots ficticios o anonimizados.
3. Conciliacion contra exportaciones aprobadas.
4. Modo espejo sin escritura en legacy.
5. Shadow-write en nueva DB, sin ser oficial.
6. Validacion de stock, movimientos y reservas.
7. Corte controlado por modulo.
8. Rollback documentado.

## Conciliacion

Todavia no se define fuente final ante conflictos entre `Stock`, `Ventas Detalle`,
`Ordenes` y `Movimientos`. Primero se documenta como se obtiene cada valor y se
prepara informe de diferencias.

Campos minimos a comparar:

- SKU
- cantidad observada en stock
- cantidad vendida/entregada
- cantidad por movimientos
- reservas futuras
- importaciones aplicadas
- filas pendientes de revision

## No hacer sin aprobacion

- Conectar Supabase remoto.
- Leer Google Sheets reales desde la nueva plataforma.
- Escribir en Google Sheets.
- Cambiar el flujo legacy.
- Elegir fuente final de conflicto.
