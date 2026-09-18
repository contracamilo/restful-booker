<!--
Esqueleto del informe técnico (~800 palabras). Completar DESPUÉS de ejecutar las pruebas
(no antes) — cada sección abajo mapea a un criterio de evaluación de la Actividad 3.
Borrar los comentarios [ ] una vez se llene cada sección.
-->

# Informe técnico — Prueba de rendimiento Restful-Booker

**Equipo:** Camilo Rivera, Karen Torres, Richard Caicedo
**Curso:** Calidad en Software II — SOF28
**Fecha:** 18 de septiembre de 2026

## 1. Contexto y objetivo

Esta actividad continúa sobre el mismo sistema bajo prueba de la Actividad 2 (Master Test Plan):
el fork del equipo de [Restful-Booker](https://github.com/contracamilo/restful-booker), una API
REST de reservas (autenticación + CRUD de bookings) usada como laboratorio de pruebas. El objetivo
aquí es distinto al de la Actividad 2: en vez de validar *funcionalidad* (¿la API hace lo que debe?),
se valida *rendimiento* (¿lo hace dentro de un tiempo y volumen aceptable, y en qué punto deja de
hacerlo?). Se diseñó e implementó un script de carga en k6 (JavaScript) y se ejecutaron cuatro
perfiles — carga, estrés, spike y soak/resistencia — contra la API corriendo en un contenedor Docker
local, para contrastar los resultados frente a los SLO que el equipo definió como meta interna y
para identificar, con evidencia, si existe algún cuello de botella antes de considerar la API lista
para un volumen de tráfico mayor.

## 2. Modelo de carga y supuestos

El detalle completo vive en [`config/environment.md`](../config/environment.md); resumen:

- **Entorno:** un solo contenedor Docker (`docker compose up`), sin balanceo ni réplicas, corriendo
  en una MacBook con chip Apple M3 Max (14 núcleos), 36 GB RAM. Esto es una limitación deliberada a
  declarar: los números de throughput/latencia son válidos para comparar entre perfiles de esta misma
  máquina, pero no son representativos de un ambiente productivo con más recursos o balanceado.
- **Perfiles ejecutados:** `load` (20 VUs, rampa de 5 min, carga esperada en operación normal),
  `stress` (rampa por escalones hasta 100 VUs, ~11 min, para buscar el punto de quiebre), `spike`
  (salto súbito a 150 VUs sostenido 1 min, para ver comportamiento ante ráfagas) y `soak` (15 VUs
  constantes durante 15 min, para detectar degradación o fugas de recursos por tiempo sostenido —
  se acortó de los 45+ min recomendados por restricción de tiempo del equipo, declarado como
  limitación).
- **Supuesto de concurrencia:** sin datos reales de producción para esta API de práctica, el equipo
  asumió 20 usuarios concurrentes como "carga normal" y hasta 100–150 como estrés/pico, siguiendo lo
  trabajado en el Encuentro Virtual 4 de modelado de carga.

## 3. Diseño del plan de pruebas

El script (`scripts/load_test.js`, documentado en detalle en [`scripts/README.md`](../scripts/README.md))
implementa un único *journey* de usuario en vez de llamadas aisladas a endpoints sueltos, para medir
el flujo de mayor valor de negocio de la API de punta a punta:

`GET /ping` (salud) → `GET /booking?firstname=..` (búsqueda) → `POST /auth` (login) →
`POST /booking` (crear reserva) → `GET /booking/:id` (consultar) → `PUT /booking/:id` (actualizar) →
`DELETE /booking/:id` (eliminar).

Puntos clave del diseño:
- **Correlación:** el token que devuelve `/auth` se reinyecta como header `Cookie` en los pasos de
  `PUT`/`DELETE`, y el `bookingid` que devuelve la creación se reutiliza en los pasos siguientes — sin
  esto cada paso operaría sobre datos inconexos, no sobre "la reserva de este usuario".
- **Parametrización:** entorno (`BASE_URL`), credenciales, perfil de carga y think time son variables
  de entorno, no valores fijos — el mismo script corre en cualquier máquina del equipo sin editar código.
- **Think time:** 1–3 segundos aleatorios entre pasos, para no disparar requests espalda con espalda
  (que no simularía un usuario real leyendo/decidiendo).
- **Assertions y umbrales:** cada request lleva `check()` de status/contenido, y se definieron
  thresholds agregados (ver sección 5) tanto globales como por paso (`{step:auth}`,
  `{step:create_booking}`, `{step:search_bookings}`) para poder aislar si el cuello de botella está en
  un endpoint específico.

## 4. Resultados

[Tabla con percentiles P50/P95/P99 de `http_req_duration`, throughput (requests/s o iteraciones/s)
y tasa de error, por perfil ejecutado. Completar con los números reales del `--summary-export`
o del dashboard HTML — no inventar valores.]

| Perfil | VUs máx | P50 (ms) | P95 (ms) | P99 (ms) | Throughput (req/s) | Tasa de error |
|--------|---------|----------|----------|----------|---------------------|----------------|
| load   | 20      | 2.34     | 7.45     | 11.50    | 9.30                | 0.00%          |
| stress | 100     | 2.32     | 7.69     | 12.84    | 32.79               | 0.00%          |
| spike  | 150     | 2.74     | 5.98     | 9.90     | 51.89               | 0.00%          |
| soak   | 15      | [pendiente — corrida en curso] | | | | |

*(Corridas del 2026-09-15 y 2026-09-18 contra Docker local, 1 sola instancia, MacBook Apple M3 Max /
36GB RAM (`config/environment.md`). Fuente: `results/{load,stress,spike,soak}_*_summary.json`.)*

[Falta completar la fila de `soak` cuando termine la corrida. Agregar observaciones de `docker stats`
(CPU/RAM) — capturadas en `results/docker-stats/` durante el soak.]

## 5. Contraste con SLO

Nota de terminología (jerarquía SRE): lo que sigue son **SLOs** (metas internas del equipo), no un SLA
— esta API de práctica no tiene contrato externo. El **SLI** es el dato medido en la columna "Resultado".

| Métrica (SLI)                  | Objetivo (SLO) | Resultado medido (perfil) | ¿Cumple? |
|---------------------------------|----------------|----------------------------|----------|
| Latencia P95                    | < 800 ms       | 7.45 ms (load) / 7.69 ms (stress) / 5.98 ms (spike) | ✅ Sí |
| Latencia P99                    | < 1500 ms      | 11.50 ms (load) / 12.84 ms (stress) / 9.90 ms (spike) | ✅ Sí |
| Tasa de errores                 | < 1%           | 0.00% (load, stress y spike) | ✅ Sí |
| Throughput                      | ≥ 150 TPS      | 9.30 (load) / 32.79 (stress) / 51.89 req/s (spike) | ❌ No |
| Disponibilidad                  | ≥ 99.95%       | [completar con resultado de `soak` — checks_succeeded de la corrida de 15 min] | ⏳ Pendiente |

[Completar: el throughput no cumple, pero ojo — NO es porque el sistema se sature (el error rate es 0%
y la latencia no sube), sino porque el modelo de carga (20–100 VUs con think time de 1–3s) no genera
150 TPS por diseño. Antes de reportar esto como "incumplimiento", el equipo debe decidir: ¿el SLO de
150 TPS es realista para el volumen de usuarios que se está modelando, o hay que ajustar el SLO al
modelo de carga real en vez de forzar el modelo para llegar a un número de una slide genérica? Esa
decisión y su justificación van aquí.]

## 6. Cuellos de botella identificados

[Priorizar 1–3 cuellos de botella reales observados: ¿qué paso del journey degrada primero al
subir concurrencia? ¿CPU, memoria, o el propio Node single-thread del contenedor? ¿Algún endpoint
específico (ej. `/auth` o `POST /booking`) que se vuelve el limitante?

Dato relevante para esta sección: en la corrida de `stress` (hasta 100 VUs) la API NO se rompió —
0% de error y p95 se mantuvo en 7.69ms, prácticamente igual que en `load` (20 VUs). Eso no
significa que no haya cuello de botella, significa que con este volumen de datos (reservas
efímeras, sin dataset grande) y en esta máquina, 100 VUs no alcanza a estresar el contenedor.
Antes de concluir "no hay cuello de botella", el equipo debería: (a) revisar `docker stats`
durante una corrida para ver si CPU/RAM ya iban en aumento aunque la latencia no lo reflejara
todavía, y (b) considerar correr `stress` con más VUs o `spike` para encontrar el punto real de
quiebre — de lo contrario el hallazgo honesto es "no se encontró el límite dentro del rango
probado", no "el sistema soporta carga ilimitada".]

## 7. Propuestas de mejora priorizadas

[2–4 acciones concretas y viables, en orden de prioridad — ej. escalar horizontalmente el
contenedor, agregar cache de solo-lectura para `GET /booking`, revisar el manejo de tokens en
memoria (`globalLogins`) como posible cuello de botella bajo alta concurrencia, etc.]

## 8. Conclusiones

[Cierre breve: ¿la API está lista para el nivel de carga modelado? ¿Qué se recomienda antes de
aumentar tráfico real? Vincular con el debrief de EV-5.]

---
*Extensión objetivo: ~800 palabras (sin contar tablas). Evidencia de respaldo en `../results/`.*
