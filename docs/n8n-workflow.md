# Workflow de n8n → webhook de la app

Guía paso a paso para armar el workflow en n8n. Pensada para que se pueda
construir sin depender de IT — no usa BigQuery (no tenemos esas
credenciales), solo Google Sheets con tu propia cuenta.

## Qué hace y qué NO hace

Este workflow empuja filas de "Data BA" hacia
`/api/webhooks/n8n-sync`, que las guarda en Cloud SQL (`orders`,
`stores`, `users`). **Necesita `DATABASE_URL` configurado en el servicio**
para hacer algo útil — mientras Cloud SQL no exista, el webhook responde
400 con un mensaje claro, no rompe nada, pero tampoco guarda datos.

Esto es un camino **distinto y paralelo** al que ya está en producción
(Analytics leyendo Google Sheets en vivo, sin base de datos — ver
`src/lib/data/operational-live-source.ts`). Ese ya funciona hoy sin
esperar nada de esto. Este workflow es para cuando Cloud SQL exista y
queramos que los datos queden persistidos ahí también.

## 1. Credencial de Google Sheets en n8n

No hace falta una service account de GCP para esto — n8n puede usar tu
propia cuenta de Google:

1. En n8n → **Credentials → New → Google Sheets (OAuth2)**.
2. Sigue el flujo de login con tu cuenta `@zubale.com` (la misma con la
   que ya ves el Sheet).
3. Nómbrala algo como `Google Sheets - BA Ops`.

## 2. Trigger

- Nodo **Schedule Trigger** — cada 30-60 min es razonable para empezar.
- Añade también un **Manual Trigger** en paralelo (o simplemente ejecuta
  el workflow a mano con "Execute workflow") para probar sin esperar el
  cron mientras armas todo.

## 3. Leer el Sheet

Nodo **Google Sheets → Get Row(s)**:
- Credential: la del paso 1.
- Spreadsheet: `Automation Payments BA-MX Abril-Jun`
  (`1dOfBB8gcZsBR-GTPkYQcOdTbpbXH0MQk0FHuri6uRqY`).
- Sheet: **Data BA**.
- Range: deja vacío o `A:P` (todas las columnas).

Esto te devuelve un item por fila, con las columnas ya como campos:
`ORDER_ID, STATUS, STORE_NUMBER, STORE_NAME, STATE, DELIVERY_DATE, SLOT,
ON_TIME, DISTANCE_MAN_HAV, SHOPPER_FULL_NAME, SHOPPER_EMAIL,
NO_LINES_REQUESTED, STORE_ID, PEDIDOS_LATE, ZONA_CLASIFICACION,
FECHA_LIMPIA` — igual que en `docs/data-audit.md`.

⚠️ Si el nodo te devuelve la columna como `STORE ID` (con espacio) en vez
de `STORE_ID`, renómbrala con un nodo **Edit Fields (Set)** antes de
seguir — el webhook exige `STORE_ID` sin espacio.

## 4. Agrupar en lotes (batch)

El webhook acepta un array de filas por request; no mandes 50,000 filas
en un solo POST. Nodo **Code** (JavaScript), modo "Run Once for All
Items":

```js
const BATCH_SIZE = 2000;
const rows = items.map((item) => item.json);
const batches = [];
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  batches.push({ json: { rows: rows.slice(i, i + BATCH_SIZE) } });
}
return batches;
```

Esto convierte "una fila por item" en "un lote de 2000 filas por item" —
cada item de salida es un batch que se manda en un solo POST.

## 5. Mandar cada lote al webhook

Nodo **HTTP Request**, conectado después del nodo Code (n8n itera
automáticamente sobre cada item/batch):

- Method: `POST`
- URL: `https://finance-ops-poc-174716734672.us-central1.run.app/api/webhooks/n8n-sync`
- Authentication: **Header Auth** (o Generic Credential Type → Header Auth)
  - Name: `Authorization`
  - Value: `Bearer <el N8N_WEBHOOK_SECRET que publique IT>`
  - Mejor aún: guarda el secret como una **Credential** en n8n en vez de
    pegarlo en texto plano en el nodo, para que no quede visible al
    exportar/compartir el workflow.
- Body Content Type: `JSON`
- Body: `{{ $json }}` (ya trae `{ rows: [...] }` del nodo anterior) — o
  agrega `source`: `{"source": "n8n-sheets", "rows": {{ $json.rows }}}`
  si quieres que se distinga en `sync_logs`.

## 6. Verificar antes de conectar todo

Antes de correr el workflow completo, prueba el webhook a mano para
confirmar que el secret y el endpoint responden bien:

```bash
curl -X POST https://finance-ops-poc-174716734672.us-central1.run.app/api/webhooks/n8n-sync \
  -H "Authorization: Bearer <N8N_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"ORDER_ID":"test-1","STATUS":"DELIVERED","STORE_ID":"2983","STORE_NUMBER":"1579","STORE_NAME":"Calle De Los Pinos","STATE":"Estado de México","DELIVERY_DATE":"2026-08-30","SLOT":"10:00 - 11:00","ON_TIME":1,"DISTANCE_MAN_HAV":2.4,"SHOPPER_FULL_NAME":"Prueba Test","SHOPPER_EMAIL":"prueba@zubale.com","NO_LINES_REQUESTED":10,"PEDIDOS_LATE":0,"ZONA_CLASIFICACION":"OCCIDENTE","FECHA_LIMPIA":"2026-08-30"}]}'
```

- Si `DATABASE_URL` no está configurado todavía: esperas un 400 con
  `"No hay una base de datos conectada..."` — es correcto, confirma que
  el endpoint y el secret funcionan, solo falta Cloud SQL.
- Si el secret está mal: 401 `"No autorizado."`
- Una vez que Cloud SQL exista: deberías ver `ordersUpserted: 1` en la
  respuesta, y una fila nueva en `sync_logs`.

## Pendiente de IT

Solo una cosa: publicar `N8N_WEBHOOK_SECRET` como variable de entorno en
el servicio de Cloud Run (ya confirmado que lo hacen ellos vía Passbolt).
Todo lo demás de este documento se puede armar y probar sin esperarlos.
