# Auditoría de fuentes de datos

Fuente auditada: Google Sheets **"Automation Payments BA-MX Abril-Jun"**
(`1dOfBB8gcZsBR-GTPkYQcOdTbpbXH0MQk0FHuri6uRqY`), leído directamente vía
Google Drive el 2026-08-31. Todo lo listado abajo son columnas y valores
reales encontrados en el archivo — nada fue inventado.

## Hojas encontradas

### Data BA (operación cruda)
```
ORDER_ID, STATUS, STORE_NUMBER, STORE_NAME, STATE, DELIVERY_DATE, SLOT,
ON_TIME, DISTANCE_MAN_HAV, SHOPPER_FULL_NAME, SHOPPER_EMAIL,
NO_LINES_REQUESTED, STORE ID, PEDIDOS_LATE, ZONA_CLASIFICACION, FECHA_LIMPIA
```
- `STATUS` observado: `DELIVERED`.
- `ON_TIME` es 0/1.
- `STORE ID` (con espacio) es la llave que comparte con Config_Tiendas y
  Master Pagos — **no** es lo mismo que `STORE_NUMBER`.

### Control Operativo - Live Ops
Pivote de `ON_TIME` por zona/tienda/fecha dentro de la misma hoja. No es
una tabla base — es un dashboard ya armado en el Sheet.

### Aclaración de Pagos ⭐
Todo indica que esta es la hoja destino del Google Form
(`1AvKRJQWpS8BPH2Xf2J77Q2r6X1VwQaPweHBpPvcSA3Q`):
```
Marca temporal, Fecha, Folio, Teléfono User, Evidencia (Ticket, Folio con
Estatus Completado), ESTATUS, FECHA BD, PROCEDE, STORE ID, TELEFONO BD,
DESCRIPCION, AMOUNT, ESTATUS ENVÍO, PAGADO EN MASTER, COMENTARIOS
```
Columnas agrupadas en el Sheet bajo: `LLENAR POR COORDINADOR`, `REVISION`,
`FINANZAS`, `AUTOMATICO`.

**Esta hoja ya modela el flujo Generado → Enviado → Pagado**: `ESTATUS
ENVÍO` y `PAGADO EN MASTER` son columnas separadas, confirmando en la
fuente real que "Master Pagos" nunca debe tratarse como "pagado".

### Reporte de Pagos BA-MX | Layout Pagos ("Master Pagos")
```
FECHA, STORE ID, USER, DESCRIPTION, AMOUNT, MODEL, STORE NAME, MASTER PAGOS
```
- `MASTER PAGOS` toma valores `Aprobado` / `NO` — es aprobación de envío,
  **no** confirmación de pago.
- `USER` es un número tipo teléfono (ej. `524521173001`), igual que
  `Teléfono User` / `TELEFONO BD` en Aclaración de Pagos.
- `DESCRIPTION` tiene forma `Task: <order_id> <dd/mm>`.

### Usuarios | Dato de Usuarios Bodega Aurrera
```
NOMBRE, CORREO ELECTRONICO, TELEFONO
```
`TELEFONO` es el identificador natural del usuario en todo el archivo.

### 1st Payment / 2nd Payment / Payment Validation
```
1st Payment:      USER, Ganancia AVG, Payment, StoreID, Concept, Store
2nd Payment:      USER, Real Payment Amount, Adjustment Payment, Store
Payment Validation: USER, Task, Payment per task, Store, 1st Payment,
                     2nd Payment, Total Payment, Match, Adjustment
```
Estas tres hojas son las que reflejan el pago **efectivamente disperso**
(PAGADO), con validación cruzada (`Match` TRUE/FALSE + `Adjustment`).

### Configuración de Tiendas | Asignación de Modelo de Pago
```
STORE_NUMBER, STORE_ID, STORE_NAME, MODELO, PAGO DE ESTACIONAMIENTO,
MONTO ESTACIONAMIENTO
```
`MODELO` (M99, M105, M109, M119, ...) referencia la hoja `Tarifa_Piano`.

### Tarifa_Piano
```
TARIFA, LINEAS_MIN, LINEAS_MAX, KM_MIN, KM_MAX, PAGO
```
Tabla de tarifas — no transacciones. Se usa para calcular el monto
"Generado" de una orden a partir de su modelo, líneas y distancia.

### Performance por día/general
Pivote de OnTime% por región/fecha. No es tabla base.

### Bonos-Supply
Confirmada por el usuario en `gid=2132023001` del mismo spreadsheet
(no estaba en el primer dump por tamaño — apareció en una segunda lectura
completa). Tabla plana de una sola fila de encabezado, sin las mini-tablas
combinadas que sí tienen Payment Validation:
```
DATE, WEEK SERVICE, BRAND, AREA, OWNER, TYPO, STORE ID, (vacía), Store,
USER, DESCRIPTION, AMOUNT, Payment check, OT, Validación, Comentario
```
seguida a la derecha por una mini-tabla de referencia sin relación directa
(`Store ID | Det | Tienda`, un lookup de apoyo).

- `BRAND` trae valores como `Bodega Aurrera` — en las filas muestreadas
  todas eran `Bodega Aurrera`, consistente con que este spreadsheet es
  BA-MX-only (a diferencia de otro archivo distinto, "Zubale MX - Walmart
  | Ops + Supply + Growth Bonus Master Report V2", que si acumula Walmart
  + Sams + Bodega Aurrera — **no es la fuente correcta**, se descartó).
- `TYPO` es el tipo/categoría de bono (ej. "Supervisor Payment - Expediter").
- `STORE ID` usa la misma llave que Data BA / Config Tiendas / Master Pagos.
- `USER` es el mismo identificador tipo-teléfono que en el resto del archivo.
- `Store` (columna 8) muestra `#N/A` en las filas muestreadas — es una
  fórmula rota en el Sheet, no usar; resolver el nombre de tienda vía
  `STORE ID` contra `stores` en su lugar.
- `Payment check` es TRUE/FALSE — es la señal más cercana a "confirmado",
  pero no hay evidencia de un estado explícito tipo "Aprobado/Pagado"
  como en Master Pagos, así que se modela como un booleano de
  verificación, no como pago confirmado (mismo principio que el resto:
  no asumir que "revisado" = "pagado").
- Nombre real del tab sin confirmar al 100% — se usa `"Bonos-Supply"`
  como mejor conjetura (así lo identificó el usuario). Ver
  `src/lib/sync/config.ts`.

## No encontrado en este archivo

`Master Data BA` (mencionada en la descripción original del proyecto)
**no aparece** en este spreadsheet. Pendiente de confirmar si vive en
otro archivo de Google Sheets o si el nombre cambió.

## Decisiones de modelado que se derivan de esta auditoría

1. **Llave de usuario**: `phone` (el campo tipo teléfono), no email ni
   nombre — es el único identificador consistente entre Data BA, Master
   Pagos, Aclaración de Pagos y Payment Validation.
2. **Llave de tienda**: `STORE ID` (external id), no `STORE_NUMBER`.
3. **Master Pagos ≠ Pagado**: `finance_submissions.master_pagos_approved`
   es un booleano de aprobación de envío. El estado `PAGADO` solo se
   asigna cuando existe una fila en `payments` (1st/2nd Payment).
4. Sin `Bonos-Supply` auditada, no se creó tabla de bonos — evitando
   inventar columnas.

Ver `prisma/schema.prisma` para el esquema actual (Cloud SQL for SQL
Server) derivado de esta auditoría — el diseño original en Postgres
(`supabase/migrations/`) queda como referencia histórica, ya retirado.
