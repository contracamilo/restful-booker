# Informe técnico — Prueba de rendimiento Restful-Booker

**Equipo:** Camilo Rivera, Karen Torres, Richard Caicedo
**Curso:** Calidad en Software II — SOF28
**Fecha:** 18 de septiembre de 2026

## 1. Contexto y objetivo

Esta actividad continúa sobre el sistema de la Actividad 2: el fork del equipo de
[Restful-Booker](https://github.com/contracamilo/restful-booker), una API REST de reservas. Ahora el
objetivo no es validar funcionalidad sino **rendimiento**: se diseñó un script de carga en k6 y se
ejecutaron cuatro perfiles (carga, estrés, spike, soak) contra la API en Docker local, para
contrastar resultados frente a SLOs propios y detectar cuellos de botella antes de asumir que la API
soporta más tráfico.

## 2. Modelo de carga y supuestos

Detalle completo en [`config/environment.md`](../config/environment.md). Entorno: un solo contenedor
Docker sin balanceo, en una MacBook Apple M3 Max / 36 GB RAM — los números aquí comparan perfiles
entre sí, no representan un ambiente productivo. Perfiles: `load` (20 VUs, 5 min, carga normal),
`stress` (rampa por escalones hasta 100 VUs, 11 min, buscando el punto de quiebre), `spike` (salto a
150 VUs, 2 min) y `soak` (15 VUs, 15 min — acortado de los 45+ recomendados por tiempo del equipo,
limitación declarada). Sin datos reales de producción, el equipo asumió 20 usuarios concurrentes como
carga normal y hasta 150 como pico, siguiendo el modelado del Encuentro Virtual 4.

## 3. Diseño del plan de pruebas

El script (`scripts/load_test.js`, documentado en [`scripts/README.md`](../scripts/README.md))
implementa un *journey* completo, no llamadas aisladas: `GET /ping` → `GET /booking?firstname=..` →
`POST /auth` → `POST /booking` → `GET /booking/:id` → `PUT /booking/:id` → `DELETE /booking/:id`.

Puntos clave: **correlación** (el token de `/auth` se reinyecta como `Cookie` en `PUT`/`DELETE`, y el
`bookingid` creado se reutiliza en los pasos siguientes); **parametrización** (`BASE_URL`,
credenciales, perfil y think time por variable de entorno, sin valores fijos en código);
**think time** de 1–3s aleatorio entre pasos, para simular un usuario real y no tráfico puro; y
**assertions/umbrales** — `check()` por request más thresholds agregados globales y por paso
(`{step:auth}`, `{step:create_booking}`, `{step:search_bookings}`) para aislar dónde estaría el
cuello de botella si apareciera.

## 4. Resultados

| Perfil | VUs máx | Duración | P50 (ms) | P95 (ms) | P99 (ms) | Throughput (req/s) | Tasa de error |
|--------|---------|----------|----------|----------|----------|---------------------|----------------|
| load   | 20      | 5 min    | 2.34     | 7.45     | 11.50    | 9.30                | 0.00%          |
| stress | 100     | 11 min   | 2.32     | 7.69     | 12.84    | 32.79               | 0.00%          |
| spike  | 150     | 2 min    | 2.74     | 5.98     | 9.90     | 51.89               | 0.00%          |
| soak   | 15      | 15 min   | 3.60     | 10.11    | 13.98    | 8.69                | 0.00%          |

*(Corridas del 2026-09-15 y 2026-09-18 contra Docker local, 1 sola instancia, MacBook Apple M3 Max /
36 GB RAM (`config/environment.md`). Fuente: `results/{load,stress,spike,soak}_*_summary.json`.)*

**Uso de recursos (`docker stats`, muestreado cada 20s durante `soak`, 15 min):** CPU entre 0.5% y
1.6% en todo momento; RAM subió de 116.8 MiB a 119.8 MiB (+3 MiB en 15 min, prácticamente plano) —
sin señal de fuga de memoria en esta ventana de tiempo. Evidencia completa en
`results/docker-stats/soak_20260918_1115.log`.

## 5. Contraste con SLO

Nota de terminología (jerarquía SRE): lo que sigue son **SLOs** (metas internas del equipo), no un SLA
— esta API de práctica no tiene contrato externo. El **SLI** es el dato medido en la columna "Resultado".

| Métrica (SLI)                  | Objetivo (SLO) | Resultado medido (perfil) | ¿Cumple? |
|---------------------------------|----------------|----------------------------|----------|
| Latencia P95                    | < 800 ms       | 7.45 ms (load) / 7.69 ms (stress) / 5.98 ms (spike) | ✅ Sí |
| Latencia P99                    | < 1500 ms      | 11.50 ms (load) / 12.84 ms (stress) / 9.90 ms (spike) | ✅ Sí |
| Tasa de errores                 | < 1%           | 0.00% (load, stress y spike) | ✅ Sí |
| Throughput                      | ≥ 150 TPS      | 9.30 (load) / 32.79 (stress) / 51.89 (spike) / 8.69 req/s (soak) | ❌ No |
| Disponibilidad                  | ≥ 99.95%       | 100.00% (`checks_succeeded`, corrida de 15 min sin caídas) | ✅ Sí |

**Sobre el throughput:** no incumple por falla del sistema — error rate 0% y latencia estable indican
margen de sobra. El SLO de 150 TPS es una referencia genérica del curso; nuestro modelo de carga (think
time de 1–3s por paso, pensado para simular usuarios reales, no tráfico puro) pone un techo bajo al
throughput por VU sin importar cuántas VUs se agreguen. Decisión del equipo: en vez de forzar el
modelo a un número irreal para esta API de práctica, se documenta la brecha como hallazgo — no como
incumplimiento oculto — y se recalibra el SLO al contexto real modelado.

## 6. Cuellos de botella identificados

El hallazgo principal: **no se encontró el punto de quiebre de la API dentro del rango probado**
(hasta 100 VUs sostenidos, picos de 150, 15 min de soak) — 0% de error, latencia estable (p95 entre 6
y 10ms) y `docker stats` con CPU bajo 2% y memoria plana. Esto no significa "carga ilimitada": significa
que este rango, con este volumen de datos y en esta máquina, no alcanza a estresar la API. De ahí dos
cuellos de botella reales, distintos a los que se buscaban originalmente:

1. **El modelo de carga es el limitante, no la API** — el think time pone un techo bajo al throughput
   por VU; encontrar el límite real requeriría un perfil sin think time o con 500–1000+ VUs.
2. **El volumen de datos de prueba no representa un sistema con historial** — cada corrida arranca con
   la base casi vacía (sin `SEED`); `GET /booking` con miles de registros acumulados es un escenario
   no evaluado.

## 7. Propuestas de mejora priorizadas

1. **Repetir `stress`/`spike` con mayor concurrencia (500–1000 VUs) y sin think time**, para
   efectivamente encontrar el punto de quiebre en vez de reportar "no se encontró" como resultado final.
2. **Pre-cargar la base de datos con un volumen realista** (`SEED=true` o un script que inserte miles
   de reservas) antes de correr `load`/`stress`, para medir el efecto del volumen de datos sobre
   `GET /booking`, hoy no evaluado.
3. **Recalibrar el SLO de throughput** a un número derivado del modelo de carga real del negocio (si
   existiera), en vez de un valor genérico de referencia — o documentar explícitamente que el SLO de
   150 TPS aplica a un escenario de tráfico puro, no al journey con think time aquí modelado.
4. **Correr el generador de carga (k6) fuera de la misma máquina/contenedor que la API**, para eliminar
   contención de recursos entre cliente y servidor como variable de confusión en corridas futuras con
   mayor concurrencia.

## 8. Conclusiones

Dentro del rango modelado (hasta 100 VUs sostenidos, picos de 150, 15 min de resistencia), Restful-Booker
cumple todos los SLO salvo throughput —brecha explicada por el diseño del modelo de carga, no por el
sistema—: 0% de errores, p95 máximo de 10.11ms contra un umbral de 800ms, sin señales de degradación
sostenida. La API está lista para el nivel de tráfico aquí modelado. Antes de prometer más, se
recomienda cerrar los dos puntos de la sección 6 (límite real con más concurrencia, y volumen de datos
representativo) — temas para el debrief de EV-5.

---
*Extensión objetivo: ~800 palabras (sin contar tablas). Evidencia de respaldo en `../results/`.*
