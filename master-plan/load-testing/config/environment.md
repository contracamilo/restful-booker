# Configuración — Actividad 3 (Prueba de rendimiento)

Documenta entorno, perfil de carga y supuestos, tal como lo pide el entregable
("Script parametrizado + documento de configuración: entorno, perfil y supuestos").

## 1. Entorno bajo prueba

- **Sistema:** [Restful-Booker](https://github.com/contracamilo/restful-booker) (fork del equipo),
  el mismo usado en la Actividad 2 (Master Test Plan).
- **Despliegue:** contenedor Docker local (`docker compose up -d --build`), API en `http://localhost:3001`.
- **Base de datos:** LokiJS embebido en el contenedor (sin persistencia externa) — cada `docker compose up`
  arranca con datos limpios salvo que se use `SEED=true`.
- **Hardware de referencia:** *(completar por quien ejecute: chip, RAM, SO — esto condiciona los resultados
  y debe declararse en el informe porque no es un ambiente productivo dedicado).*
- **Red:** localhost (sin latencia de red real) — los tiempos medidos reflejan procesamiento de la app,
  no condiciones de internet. Esto es una limitación a declarar en el informe.
- **Observabilidad disponible:** no hay APM/tracing centralizado para este proyecto de práctica.
  Como sustituto:
  - `docker stats restful-booker` (o el nombre del contenedor) en una terminal aparte, durante la corrida,
    para capturar CPU/RAM/I/O.
  - Métricas propias de k6 (`http_req_duration`, `http_req_failed`, `vus`, `iterations`) vía el resumen
    o el dashboard web (ver `README.md`).

## 2. Perfil de carga (modelo)

| Perfil  | Uso                                   | Concurrencia (VUs)      | Duración aprox. |
|---------|----------------------------------------|--------------------------|------------------|
| smoke   | Validar que el script y la API sirven  | 1                         | 30 s             |
| load    | Carga esperada en operación normal     | 0→20 (rampa), sostenida  | ~5 min           |
| stress  | Buscar el punto de quiebre             | 0→30→60→100 (escalones)  | ~11 min          |
| spike   | Ráfaga súbita (ej. apertura de reservas)| 5→150→5                  | ~2 min           |
| soak    | Resistencia / fugas de recursos        | 15 constantes            | 10 min (ajustar a 45 min+ para evidencia final) |

**Supuesto de concurrencia:** al no existir datos reales de producción para esta API de práctica, el equipo
asume 20 usuarios concurrentes como "carga normal" y hasta 100 como estrés, en línea con lo trabajado en el
Encuentro Virtual 4 (modelado de carga). *Ajustar aquí si el equipo decide otro número y justificar por qué.*

**Think time:** 1–3 s aleatorios entre pasos (`THINK_MIN`/`THINK_MAX`), simulando lectura/decisión de un
usuario real en vez de disparar requests espalda con espalda.

## 3. SLA/SLO asumidos (a validar en EV-5 — debrief)

No hay un SLA publicado para esta API de práctica, así que el equipo define las siguientes metas como
supuesto de trabajo (quedan como thresholds en `scripts/load_test.js`):

- `p95` de tiempo de respuesta global < **800 ms**
- `p99` de tiempo de respuesta global < **1500 ms**
- Tasa de error (`http_req_failed`) < **1%**
- `p95` del paso de autenticación (`/auth`) < **500 ms**
- `p95` de creación de reserva (`POST /booking`) < **800 ms**

*Si el equipo decide otros valores, actualizarlos aquí y en el bloque `thresholds` del script para que
coincidan — son la misma fuente de verdad.*

## 4. Supuestos y limitaciones declaradas

- La API corre en un único contenedor sin balanceo ni réplicas — los resultados de `stress`/`spike` van a
  mostrar el límite de esa única instancia, no de una arquitectura productiva.
- No hay seed de datos previos (`SEED=false` por defecto) — el journey crea y limpia sus propias reservas.
- El defecto **R2** (no hay control de solapamiento de fechas) documentado en la Actividad 2 sigue vigente:
  las reservas creadas durante la prueba de carga no chocan entre sí porque el endpoint las acepta sin
  validar solapamiento. No es un objetivo de esta actividad, pero es relevante si se compara throughput de
  creación contra un sistema con esa validación activa.
- Credenciales de auth (`admin` / `password123`) son las credenciales de demo fijas del propio proyecto
  Restful-Booker, no un secreto — están hardcodeadas en el código fuente del servidor.
- **Hallazgo de la implementación del script (validado contra el contenedor local):** `GET /booking/:id`
  hace content negotiation estricto sobre el header `Accept` (switch exacto en `helpers/parser.js`, sin
  default) y responde `418 I'm a Teapot` si el header no es exactamente `application/json`,
  `application/xml`, `application/x-www-form-urlencoded` o `*/*`. `curl` manda `Accept: */*` por defecto y
  por eso "funciona solo", pero k6 no manda `Accept` si no se fija explícitamente. El script ya lo maneja
  (`Accept: application/json` explícito en el paso `05_get_booking_detail`), pero vale la pena mencionarlo
  en el informe si aparece un patrón similar al medir throughput real.
