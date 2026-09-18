# Documentación del script — `load_test.js`

Documentación técnica del script k6, complementaria a la guía de ejecución del
[README](../README.md) general y a los supuestos de [`config/environment.md`](../config/environment.md).
Esta página explica **cómo está construido y por qué**, para quien tenga que leerlo, mantenerlo o
calificarlo sin correrlo primero.

## 1. Journey (estructura de hilos/steps)

Un único script (`export default function`) modela un usuario que completa el flujo de mayor valor
de negocio de la API — no llamadas aisladas. Cada paso vive en su propio `group()` de k6 (aparecen
así en el resumen y en el dashboard HTML), con `think time` aleatorio entre pasos.

| # | Group                  | Método + endpoint         | Propósito                                   | Requiere token |
|---|-------------------------|----------------------------|----------------------------------------------|----------------|
| 1 | `01_health_check`       | `GET /ping`                 | Confirma que la API está arriba              | No             |
| 2 | `02_search_bookings`    | `GET /booking?firstname=..` | Simula búsqueda/listado (lectura)            | No             |
| 3 | `03_auth`                | `POST /auth`                | Obtiene el token de sesión                   | No             |
| 4 | `04_create_booking`     | `POST /booking`             | Crea una reserva con datos aleatorios        | No             |
| 5 | `05_get_booking_detail` | `GET /booking/:id`          | Consulta la reserva recién creada            | No             |
| 6 | `06_update_booking`     | `PUT /booking/:id`          | Modifica la reserva (requiere auth)          | Sí             |
| 7 | `07_delete_booking`     | `DELETE /booking/:id`       | Limpia la reserva creada (requiere auth)     | Sí             |

Los pasos 6 y 7 se saltan si el paso 3 (auth) falló — así una caída del endpoint `/auth` bajo carga
no genera además una cascada de falsos negativos en pasos que dependían de él.

## 2. Parametrización

Todo lo que puede variar entre entornos o corridas es una variable de entorno (`__ENV`), nunca un
valor fijo en el código — así el mismo script sirve para local, para otra máquina del equipo, o para
un ambiente distinto sin tocar una línea:

`BASE_URL`, `PROFILE`, `ADMIN_USER`, `ADMIN_PASS`, `THINK_MIN`, `THINK_MAX`, `SOAK_DURATION`
(tabla completa con defaults en el [README](../README.md#3-ejecutar-una-prueba)).

Los datos de cada reserva (nombre, precio, fechas, necesidades) también se generan de forma
aleatoria en cada iteración (`buildBookingPayload()`), en vez de repetir el mismo payload fijo —
evita que todas las iteraciones golpeen exactamente el mismo registro y da variedad realista.

## 3. Correlación

El token de sesión es el único dato que se **correlaciona** entre pasos (patrón típico de
JMeter/Gatling: extraer un valor de una respuesta y reinyectarlo en requests posteriores):

```
03_auth (POST /auth)
  └─> res.json('token')  →  variable `token` en el scope de la iteración
        └─> 06_update_booking:  header Cookie: token=<token>
        └─> 07_delete_booking:  header Cookie: token=<token>
```

De la misma forma, el `bookingid` que devuelve `04_create_booking` se reutiliza en los pasos 5, 6 y
7 (`GET/PUT/DELETE /booking/:id`) — sin esta correlación cada paso tendría que crear su propia
reserva, lo que no reflejaría el journey real de un usuario editando *su* reserva.

## 4. Assertions (checks) y umbrales (thresholds)

Son dos mecanismos de k6 con propósitos distintos:

- **`check()`** — assertion por request individual (ej. "el status fue 200"). Se acumulan en la
  métrica `checks` pero **no** hacen fallar la corrida por sí solas.
- **`thresholds`** (en `options`) — condición agregada sobre toda la corrida (ej. "el p95 de
  `http_req_duration` debe ser menor a 800ms"). Si se incumple, k6 termina con exit code ≠ 0 —
  esto es lo que realmente "reprueba" una corrida para efectos de CI/evidencia.

Cada request lleva un `tags: { step: '...' }` para poder aplicar thresholds *por paso* además del
global (ej. `http_req_duration{step:auth}`) — así se puede ver si el cuello de botella está en un
endpoint específico y no solo en el promedio general. Ver la tabla completa de checks/thresholds
actuales en [`config/environment.md`](../config/environment.md#3-sli--slo-asumidos-a-validar-en-ev-5--debrief).

## 5. Reproducibilidad

- El script está versionado en git junto con esta documentación — cualquier commit fija exactamente
  qué journey, thresholds y perfiles se usaron para generar cada resultado en `../results/`.
- Los perfiles de carga (`PROFILES`) están centralizados en un solo objeto en el script, no
  repetidos en varios archivos — cambiar un número de concurrencia se hace en un solo lugar.
- La aleatoriedad (nombres, fechas, precios) no afecta la reproducibilidad del *comportamiento*
  medido (todas las combinaciones ejercitan el mismo journey y son válidas para la API); lo que sí
  hay que fijar para comparar corridas entre sí es el `PROFILE` y, si se quiere, `THINK_MIN`/`THINK_MAX`.
- `setup()` falla rápido (antes de generar VUs) si la API no responde en `${BASE_URL}/ping` — evita
  confundir "la API está caída" con "la API se degradó bajo carga" en los resultados.

## 6. Organización del proyecto

```
master-plan/load-testing/
├── scripts/load_test.js   ← el script (una sola fuente de verdad para los 5 perfiles)
├── scripts/README.md      ← este documento
├── config/environment.md  ← entorno, modelo de carga, SLI/SLO, supuestos
├── results/                ← evidencia cruda por corrida (resúmenes versionados, trazas no)
└── report/informe_tecnico.md
```
