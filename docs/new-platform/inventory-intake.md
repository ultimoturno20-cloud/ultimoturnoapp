# Ingreso de inventario

Inventario es la unica seccion operativa para buscar cartas y agregar existencias.

- Agregar stock busca en la base existente. Agregar existencias, dentro de una carta, reutiliza sus datos y variante.
- La cantidad se suma al stock existente de la misma identidad, idioma, condicion, acabado y graduacion; cambiar la variante crea otro item.
- Costo registrado por unidad es opcional (null = sin registrar, 0 = costo cero) y editable, con moneda ARS o USD. Es un dato del item, no una compra contable ni un costo promedio por lote.
- La carga muestra confirmacion y permite seguir con otra carta. Buscador, orden y filtros quedan fijos durante el desplazamiento.
- CSV: cada lote se aplica en una transaccion. Mismo contenido, opciones y resoluciones devuelve la confirmacion previa. Otro lote fisico debe usar otro nombre. Los CSV comunes mantienen la semantica previa de snapshot (actualizan cantidades absolutas).
- Pre-base movil: cantidades y marca de carga se confirman juntas. Una captura aplicada no puede volver a sumar stock, tampoco pasando por la vista previa CSV, que conserva su identificador.
- La proteccion cubre las cargas realizadas con esta version. No intenta eliminar duplicados historicos.

## Verificacion

- npm test (incluye packages/db/src/intake-safety.test.ts)
- npm run typecheck
- npm run lint
- npm run build
- npx tsx scripts/verify-intake-api.mts (puerto 4097, base temporal independiente; no usa PILOTO REAL)

La migracion 0025 se aplica al iniciar la API. Para activar cambios del servidor ya compilados, detener la API anterior con Ctrl+C y volver a iniciarla con el mismo perfil y directorio de datos. No abrir dos procesos sobre la base PILOTO REAL.
