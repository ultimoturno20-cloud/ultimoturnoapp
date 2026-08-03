# Sales Stock Connector

Este script se instala en la planilla `Ventas`.

La idea nueva:

```text
Claims / Online / Local
        ↓
      Ventas
        ↓
   Stock Maestro
```

`Ventas` es la unica planilla que descuenta stock.

## Instalacion

1. Abrir la planilla `Ventas`.
2. Ir a `Extensiones > Apps Script`.
3. Pegar `SalesStockConnector.gs` en `Code.gs`.
4. Usar `appsscript.json`.
5. Guardar.
6. Ejecutar `setupVentasSheet`.
7. Ejecutar `promptConfigureStockMaster`.
8. Pegar ID o URL de `Stock Maestro`.
9. Recargar la planilla.
10. Opcional: `Ventas Sync > Activar trigger cada 5 min`.

## Encabezados de Ventas

La hoja debe llamarse `Ventas`.

Encabezados:

```text
Fecha | SKU | Nombre | Expansion | Cantidad | Precio unitario | Total | Comprador | Medio pago | Notas | PriceCharting URL | PriceCharting ID | Imagen URL | Sync Stock
```

## Uso

Cada venta, venga de claims, online o local, se agrega como fila en `Ventas`.

Luego:

- manual: `Ventas Sync > Sincronizar stock`
- automatico: trigger cada 5 minutos

Por cada venta no sincronizada:

1. Busca en `Stock Maestro` por SKU, PriceCharting ID o PriceCharting URL.
2. Si existe, baja `Cantidad`.
3. Si no existe, crea fila en `Stock` con `Cantidad = 0`.
4. Marca `Sync Stock`.

## Regla importante

No hay estado.

Si se vende, baja cantidad.
Si no existe en stock, se crea con cantidad cero para conservar historial y metadata.
