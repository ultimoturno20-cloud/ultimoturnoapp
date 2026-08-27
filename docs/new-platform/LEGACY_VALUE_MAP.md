# Mapa inicial de valores legacy para conciliacion

Este documento describe como se observan hoy los valores principales. No define
todavia cual gana ante conflicto.

## Stock

Fuente legacy observada:

- Hoja `Stock` del HUB.
- Columnas clave declaradas en `SAU.STOCK_COL`:
  - `SKU`
  - `Nombre`
  - `Expansion`
  - `Numero`
  - `Idioma`
  - `Condicion`
  - `Ubicacion`
  - `Cantidad`
  - `PriceCharting URL`
  - `PriceCharting ID`
  - `Precio final ARS`
  - `Ultima compra USD`

## Ventas

Fuente legacy observada:

- Hoja `Ventas Detalle`.
- Columnas clave:
  - `Venta ID`
  - `Order ID`
  - `Origen`
  - `Comprador`
  - `Cantidad`
  - `Precio ARS`
  - `Precio USD`
  - `SKU`
  - `Pagado`
  - `Entregado`
  - `Sync Stock`
  - `Anulada`

## Ordenes

Fuente legacy observada:

- Hoja `Ordenes`.
- Pago y entrega viven a nivel orden/comprador, no carta individual.
- Columnas clave:
  - `Order ID`
  - `Claim`
  - `Comprador`
  - `Total ARS`
  - `Total USD`
  - `Pagado`
  - `Embalado`
  - `Entregado`
  - `Pagado ARS`
  - `Pagado USD`
  - `Saldo ARS`
  - `Saldo USD`

## Movimientos

Fuente legacy observada:

- Hoja `Movimientos Stock`.
- Se usa como historial para explicar cambios de stock.
- Debe compararse contra `Stock.Cantidad`, ventas sincronizadas y frees.

## Pendiente

- Definir reglas de conciliacion exactas.
- Exportar snapshot controlado cuando el usuario lo autorice.
- Comparar sin escribir en legacy.
