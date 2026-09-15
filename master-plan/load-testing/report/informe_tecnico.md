<!--
Esqueleto del informe técnico (~800 palabras). Completar DESPUÉS de ejecutar las pruebas
(no antes) — cada sección abajo mapea a un criterio de evaluación de la Actividad 3.
Borrar los comentarios [ ] una vez se llene cada sección.
-->

# Informe técnico — Prueba de rendimiento Restful-Booker

**Equipo:** Camilo Rivera, Karen Torres, Richard Caicedo
**Curso:** Calidad en Software II — SOF28
**Fecha:** [completar]

## 1. Contexto y objetivo

[2–3 frases: qué sistema se probó (Restful-Booker, mismo fork de la Actividad 2), qué tipo de
prueba(s) se ejecutaron (carga/estrés/spike/soak) y para qué — detectar cuellos de botella y
contrastar contra SLA/SLO antes de considerar la API lista para más carga.]

## 2. Modelo de carga y supuestos

[Resumir la tabla de `config/environment.md`: concurrencia, duración, perfiles ejecutados.
Aclarar que el entorno es un solo contenedor Docker local, sin balanceo — limitación relevante
para interpretar resultados de stress/spike.]

## 3. Diseño del plan de pruebas

[Describir el journey del script: ping → búsqueda → auth → crear reserva → consultar →
actualizar → eliminar. Mencionar correlación (token de `/auth` reusado en PUT/DELETE),
think time (1–3s) y los thresholds definidos como SLA/SLO.]

## 4. Resultados

[Tabla con percentiles P50/P95/P99 de `http_req_duration`, throughput (requests/s o iteraciones/s)
y tasa de error, por perfil ejecutado. Completar con los números reales del `--summary-export`
o del dashboard HTML — no inventar valores.]

| Perfil | VUs máx | P50 (ms) | P95 (ms) | P99 (ms) | Throughput (req/s) | Tasa de error |
|--------|---------|----------|----------|----------|---------------------|----------------|
| load   | 20      | 2.34     | 7.45     | 11.50    | 9.30                | 0.00%          |
| stress | 100     | 2.32     | 7.69     | 12.84    | 32.79               | 0.00%          |

*(Corridas del 2026-09-15 contra Docker local, 1 sola instancia, en la máquina de Camilo —
ver hardware exacto pendiente de completar en `config/environment.md`. Fuente:
`results/load_20260915_1627_summary.json` y `results/stress_20260915_1632_summary.json`.)*

[Faltan `spike` y `soak` — correrlos y agregar filas. Agregar observaciones de `docker stats`
(CPU/RAM) durante alguna corrida, si se capturaron.]

## 5. Contraste con SLA/SLO

[Para cada umbral de `config/environment.md` — p95<800ms, p99<1500ms, error<1%, etc. — decir si
se cumplió o no, y en qué perfil empezó a fallar (típicamente el de `stress` o `spike`).]

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
