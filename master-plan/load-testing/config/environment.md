# Configuración — Actividad 3 (Prueba de rendimiento)

Documenta entorno, perfil de carga y supuestos, tal como lo pide el entregable
("Script parametrizado + documento de configuración: entorno, perfil y supuestos").

## 1. Entorno bajo prueba

- **Sistema:** [Restful-Booker](https://github.com/contracamilo/restful-booker) (fork del equipo),
  el mismo usado en la Actividad 2 (Master Test Plan).
- **Despliegue:** contenedor Docker local (`docker compose up -d --build`), API en `http://localhost:3001`.
- **Base de datos:** LokiJS embebido en el contenedor (sin persistencia externa) — cada `docker compose up`
  arranca con datos limpios salvo que se use `SEED=true`.
- **Hardware de referencia:** MacBook con chip Apple M3 Max (14 núcleos), 36 GB RAM, macOS 26.6.2 (arm64).
  Condiciona los resultados — es una laptop de desarrollo, no un ambiente productivo dedicado, así que los
  números de throughput/latencia no son comparables a los de un servidor real.
- **Red:** localhost (sin latencia de red real) — los tiempos medidos reflejan procesamiento de la app,
  no condiciones de internet. Esto es una limitación a declarar en el informe.
- **Observabilidad disponible:** no hay APM/tracing centralizado para este proyecto de práctica.
  Como sustituto:
  - `docker stats restful-booker` (o el nombre del contenedor) en una terminal aparte, durante la corrida,
    para capturar CPU/RAM/I/O.
  - Métricas propias de k6 (`http_req_duration`, `http_req_failed`, `vus`, `iterations`) vía el resumen
    o el dashboard web (ver `README.md`).

## 2. Perfil de carga (modelo)

| Perfil     | Uso                                   | Concurrencia (VUs)      | Duración aprox. |
|------------|----------------------------------------|--------------------------|------------------|
| smoke      | Validar que el script y la API sirven  | 1                         | 30 s             |
| load       | Carga esperada en operación normal     | 0→20 (rampa), sostenida  | ~5 min           |
| stress     | Empujar por encima de lo esperado      | 0→30→60→100 (escalones)  | ~11 min          |
| spike      | Ráfaga súbita (ej. apertura de reservas)| 5→150→5                  | ~2 min           |
| soak       | Resistencia / fugas de recursos        | 15 constantes            | 15 min (ajustar a 45 min+ para evidencia más robusta) |
| breakpoint | Buscar el punto de quiebre real        | 0→100→...→1000 (escalones)| ~7 min          |

**Resultado de `breakpoint` (2026-09-18):** ni siquiera a 1000 VUs se incumplió un SLO (0% error,
p95=8.09ms) — pero `docker stats` sí mostró presión real: CPU de ~1% a 22–27%, RAM de 113 a 206 MiB.
El punto de quiebre real está más allá de 1000 VUs o requiere quitar el think time. `stress` dejó de
ser, en la práctica, el perfil que busca el quiebre — ese rol lo cumple ahora `breakpoint`; `stress`
queda como el escalón intermedio "por encima de lo normal pero aún realista".

**Supuesto de concurrencia:** al no existir datos reales de producción para esta API de práctica, el equipo
asume 20 usuarios concurrentes como "carga normal" y hasta 100 como estrés, en línea con lo trabajado en el
Encuentro Virtual 4 (modelado de carga). *Ajustar aquí si el equipo decide otro número y justificar por qué.*

**Think time:** 1–3 s aleatorios entre pasos (`THINK_MIN`/`THINK_MAX`), simulando lectura/decisión de un
usuario real en vez de disparar requests espalda con espalda.

## 3. SLI / SLO asumidos (a validar en EV-5 — debrief)

Terminología (según el material del curso — jerarquía SLI/SLO/SLA de Google SRE):
- **SLI** (Service Level Indicator): lo que se **mide** — el dato real y objetivo (ej. "el P95 fue 7.45ms").
- **SLO** (Service Level Objective): la meta **interna** del equipo — contra esto se validan las pruebas.
- **SLA** (Service Level Agreement): la promesa **externa**/contractual, con penalización si se incumple —
  suele ser más holgada que el SLO. **No aplica aquí**: esta es una API de práctica sin cliente externo ni
  contrato, así que el equipo solo define y valida **SLOs**, no un SLA. (Antes esta sección decía
  "SLA/SLO" indistintamente — corregido: lo que sigue son SLOs.)

No hay un SLO publicado por un tercero para esta API de práctica, así que el equipo define las siguientes
metas como supuesto de trabajo (quedan como thresholds en `scripts/load_test.js`):

- `p95` de tiempo de respuesta global < **800 ms**
- `p99` de tiempo de respuesta global < **1500 ms**
- Tasa de error (`http_req_failed`) < **1%**
- Throughput (`http_reqs` rate) ≥ **150 TPS** *(referencia del material del curso; nuestras corridas
  locales van muy por debajo — 9–33 req/s — porque el volumen de VUs modelado es bajo, no porque el
  sistema no dé más: ver nota en `report/informe_tecnico.md` sección 4)*
- `p95` del paso de autenticación (`/auth`) < **500 ms**
- `p95` de creación de reserva (`POST /booking`) < **800 ms**

*Si el equipo decide otros valores, actualizarlos aquí y en el bloque `thresholds` del script para que
coincidan — son la misma fuente de verdad. El SLI (resultado medido) siempre sale de `results/*_summary.json`,
nunca se inventa.*

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
