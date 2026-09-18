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
Docker sin balanceo, en una MacBook Apple M3 Max / 36 GB RAM — números válidos para comparar entre
perfiles, no representativos de un ambiente productivo. Perfiles: `load` (20 VUs, 5 min), `stress`
(rampa hasta 100 VUs, 11 min), `spike` (150 VUs, 2 min), `soak` (15 VUs, 15 min — acortado de los 45+
recomendados por tiempo del equipo, limitación declarada) y `breakpoint` (escalones hasta 1000 VUs,
~7 min, agregado después de que los cuatro anteriores no lograran estresar la API). Sin datos reales
de producción, el equipo asumió 20 usuarios como carga normal y hasta 150 como pico (Encuentro Virtual
4); `breakpoint` sale deliberadamente de ese supuesto para buscar el límite real.

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
| breakpoint | 1000 | 6m44s    | 1.90     | 8.09     | 12.37    | 356.58              | 0.00%          |

*(Corridas del 2026-09-15 y 2026-09-18 contra Docker local, 1 sola instancia, MacBook Apple M3 Max /
36 GB RAM (`config/environment.md`). Fuente: `results/{load,stress,spike,soak,breakpoint}_*_summary.json`.)*

**Uso de recursos (`docker stats`, muestreado cada 20s):**
- Durante `soak` (15 VUs, 15 min): CPU entre 0.5% y 1.6% en todo momento; RAM subió de 116.8 MiB a
  119.8 MiB (+3 MiB, prácticamente plano) — sin señal de fuga de memoria en esta ventana.
- Durante `breakpoint` (hasta 1000 VUs): CPU subió de ~1% en reposo a **22–27%** en el pico de carga;
  RAM subió de 113 MiB a **206 MiB** (+83%) y volvió a 112 MiB al bajar a 0 VUs — confirma que es
  memoria de conexiones/trabajo activo, no una fuga. Es la primera señal medible de que el sistema
  sí responde al aumento de concurrencia, aunque sin llegar a incumplir SLOs. Evidencia completa en
  `results/docker-stats/`.

## 5. Contraste con SLO

Nota de terminología (jerarquía SRE): lo que sigue son **SLOs** (metas internas del equipo), no un SLA
— esta API de práctica no tiene contrato externo. El **SLI** es el dato medido en la columna "Resultado".

| Métrica (SLI)                  | Objetivo (SLO) | Resultado medido (perfil) | ¿Cumple? |
|---------------------------------|----------------|----------------------------|----------|
| Latencia P95                    | < 800 ms       | 7.45 ms (load) / 7.69 ms (stress) / 5.98 ms (spike) | ✅ Sí |
| Latencia P99                    | < 1500 ms      | 11.50 ms (load) / 12.84 ms (stress) / 9.90 ms (spike) | ✅ Sí |
| Tasa de errores                 | < 1%           | 0.00% (load, stress y spike) | ✅ Sí |
| Throughput                      | ≥ 150 TPS      | 9.30 (load) / 32.79 (stress) / 51.89 (spike) / 8.69 (soak) / 356.58 req/s (breakpoint, 1000 VUs) | ❌ No |
| Disponibilidad                  | ≥ 99.95%       | 100.00% (`checks_succeeded`, corrida de 15 min sin caídas) | ✅ Sí |

**Sobre el throughput:** no incumple por falla del sistema — error rate 0% y latencia estable indican
margen de sobra. El SLO de 150 TPS es una referencia genérica del curso; nuestro modelo de carga (think
time de 1–3s por paso, pensado para simular usuarios reales, no tráfico puro) pone un techo bajo al
throughput por VU sin importar cuántas VUs se agreguen. Decisión del equipo: en vez de forzar el
modelo a un número irreal para esta API de práctica, se documenta la brecha como hallazgo — no como
incumplimiento oculto — y se recalibra el SLO al contexto real modelado.

## 6. Cuellos de botella identificados

`load`, `stress` y `spike` (hasta 150 VUs) no lograron estresar la API: 0% error, latencia estable,
CPU bajo 2%. Por eso se agregó `breakpoint`, empujando hasta 1000 VUs — y ahí sí apareció señal real:
CPU subió ~20x (de ~1% a 22–27%) y RAM ~83% bajo carga. Aun así, **tampoco a 1000 VUs se incumplió
ningún SLO** (0% error, p95=8.09ms). Dos lecturas de esto:

1. **El verdadero límite sigue sin encontrarse, pero ya no es "no se buscó lo suficiente".** Con CPU
   en ~25% en una máquina de 14 núcleos, el contenedor (Node de un solo hilo) todavía tiene margen —
   el cuello de botella real probablemente aparece bien por encima de 1000 VUs, o exige quitar el
   think time para generar tráfico puro en vez de usuarios simulados.
2. **El volumen de datos de prueba no representa un sistema con historial** — cada corrida arranca con
   la base casi vacía (sin `SEED`); `GET /booking` con miles de registros acumulados es un escenario
   aparte, no evaluado, y podría ser el cuello de botella real antes que la concurrencia pura.

## 7. Propuestas de mejora priorizadas

1. **Seguir subiendo la concurrencia más allá de 1000 VUs y probar sin think time** (tráfico puro), ya
   que a 1000 VUs el CPU del contenedor apenas llega a ~25% — todavía hay margen antes del quiebre real.
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

Restful-Booker cumple todos los SLO salvo throughput (brecha explicada por el diseño del modelo de
carga, no por el sistema) hasta 1000 VUs concurrentes: 0% de errores, p95 máximo de 10.11ms contra un
umbral de 800ms, sin señales de degradación sostenida. Sí hay evidencia de que el sistema trabaja más
bajo carga (CPU y RAM escalan claramente entre 15 y 1000 VUs), pero el punto de quiebre real sigue sin
encontrarse dentro de lo probado. La API está lista para el nivel de tráfico aquí modelado, e incluso
para picos varias veces mayores a lo asumido inicialmente (20–150 VUs). Antes de prometer más, se
recomienda cerrar los dos puntos de la sección 6 (empujar la concurrencia sin think time, y probar con
volumen de datos representativo) — temas para el debrief de EV-5.

---
*Extensión objetivo: ~800 palabras (sin contar tablas). Evidencia de respaldo en `../results/`.*
