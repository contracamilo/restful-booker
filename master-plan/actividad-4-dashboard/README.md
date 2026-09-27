# Actividad 4 — Dashboard de rendimiento y recomendaciones

## Propósito

La Actividad 4 consolida en un dashboard los KPI (indicadores clave de desempeño) de rendimiento y las métricas de sistema obtenidas en la Actividad 3, y presenta un comentario analítico con dos KPI críticos y tres recomendaciones priorizadas para mejorar el sistema. No modifica las pruebas originales ni genera corridas nuevas.

## Relación con la Actividad 3

La A3 diseñó, ejecutó y documentó las pruebas de carga; sus recomendaciones se orientaron principalmente a fortalecer la prueba. La A4 parte de esa misma evidencia para analizar el sistema: la organiza en un dashboard, la relaciona con la arquitectura de la API y propone mejoras del servicio.

### Evidencia reutilizada

Se reutiliza de forma deliberada, para mantener la trazabilidad; no constituye contenido nuevo:

- La tabla de KPI por perfil (load, stress, spike, soak y breakpoint).
- Los valores de P50, P95, P99, throughput y tasa de error.
- Los SLO definidos en la A3.
- Los registros de `docker stats` de soak y breakpoint.

Todas las cifras son coherentes con el informe técnico entregado en la A3.

### Aportes nuevos de la Actividad 4

- **Dashboard consolidado e interactivo.** La A3 presentó gráficas individuales y un reporte HTML de k6 asociado a un solo perfil (spike); la A4 reúne los resultados de todos los perfiles en una sola vista, con selectores de perfil y de corrida.
- **Paneles nuevos:** comparación P50/P95/P99, P95 frente al SLO, throughput frente a la referencia, CPU y RAM, tráfico de red, Block I/O y series temporales de soak y breakpoint.
- **Configuración formal del dashboard:** unidades, umbrales, anotaciones, export JSON y flujo de datos CSV → script → dashboard.
- **Análisis de arquitectura ampliado:** proceso único de Node.js, base de datos LokiJS en memoria sin índices explícitos, `GET /booking` sin paginación y un único contenedor sin réplicas.
- **Recomendaciones de mejora del sistema,** distintas de las de la A3: índices en LokiJS, paginación de `GET /booking` y escalado horizontal con base de datos compartida.

## Estructura de archivos

| Ruta | Descripción |
|---|---|
| `dashboard/index.html` | Dashboard local HTML/JavaScript en un solo archivo, sin servidor ni dependencias externas. Incluye los datos generados desde los CSV y se abre directamente en el navegador. |
| `dashboard/dashboard_export.json` | Export JSON: paneles, fuentes, umbrales, anotaciones y limitaciones. |
| `data/kpis_rendimiento.csv` | P50, P95, P99, throughput, tasa de error y fuente del P99 por perfil. |
| `data/recursos_breakpoint.csv` | CPU, RAM y red del perfil breakpoint. |
| `data/recursos_soak.csv` | CPU, RAM, red y Block I/O del perfil soak. |
| `scripts/build_dashboard_data.py` | Inserta en `dashboard/index.html` los datos consolidados en los CSV. |
| `capturas/*.png` | Capturas del dashboard completo y de cada panel. |
| `comentario_analitico.md` | Comentario analítico (~540 palabras) con dos KPI y tres recomendaciones. |

## Flujo de datos

```
load-testing/results/ (A3)  →  data/*.csv  →  scripts/build_dashboard_data.py  →  dashboard/index.html
```

Para regenerar el dashboard después de cambiar un CSV:

```bash
cd master-plan/actividad-4-dashboard
python3 scripts/build_dashboard_data.py
```

Para visualizarlo, abrir `dashboard/index.html` en el navegador. No requiere servidor web ni otros archivos: los datos van incluidos en el mismo HTML.

Fuentes originales de la A3:

- `../load-testing/results/*_summary.json` (P50, P95, throughput, error)
- `../load-testing/results/*_console.log` (P99 de stress, spike, soak y breakpoint)
- Informe técnico entregado en la A3, Tabla 1 y Anexo C (P99 de load)
- `../load-testing/results/docker-stats/breakpoint_20260918_1139.log`
- `../load-testing/results/docker-stats/soak_20260918_1115.log`
- `../load-testing/config/environment.md` (SLO)

## SLO y umbrales

| Métrica | Umbral | Dónde se muestra |
|---|---|---|
| Latencia P95 | < 800 ms (SLO) | Panel 1 (columna Estado), panel 2 y tarjetas |
| Latencia P99 | < 1500 ms (SLO) | Panel 1 (columna Estado) y tarjetas |
| Tasa de error | < 1 % (SLO) | Tarjetas |
| Throughput | ≥ 150 req/s (referencia A3) | Panel 3 (línea vertical naranja de referencia) y tarjetas |
| CPU del contenedor | 80 % (umbral de saturación de referencia, no SLO) | Panel 4 |

## Paneles

El dashboard sigue un estilo de herramienta de observabilidad: filtros compactos en el encabezado (perfil y recursos), cuatro tarjetas KPI con indicador de estado (`SLO OK`, `Bajo referencia`) y seis paneles:

1. **Percentiles de latencia:** P50 / P95 / P99 por perfil, con estado frente al SLO.
2. **P95 vs SLO:** porcentaje consumido del SLO de 800 ms.
3. **Throughput:** req/s por perfil frente a la referencia de 150 req/s.
4. **CPU / RAM:** serie del contenedor (breakpoint o soak), con doble eje, umbral de CPU, anotaciones de inicio de carga, pico de CPU y fin de carga, y resumen de picos.
5. **Network I/O:** tráfico acumulado del contenedor (MB), con doble eje y anotación de fin de carga.
6. **Block I/O:** estado de lectura y escritura en disco durante el soak.

El fin de carga se identifica como la primera muestra con CPU en 0 % después del pico; `docker stats` no mide directamente los usuarios virtuales.

## Requisitos de la A4 → dónde se cumplen

| Requisito del enunciado | Evidencia |
|---|---|
| Conectar fuentes (Prometheus/APM/CSV) | CSV en `data/` → `scripts/build_dashboard_data.py` → `dashboard/index.html` |
| ≥ 2 paneles de latencia (percentiles) | Paneles 1 y 2 |
| ≥ 1 panel de recursos | Paneles 4, 5 y 6 (CPU, RAM, red, I/O) |
| Unidades | Ejes y subtítulos en ms, req/s, %, MiB y MB |
| Umbrales (SLA/SLO) | Tabla "SLO y umbrales" |
| Anotaciones | Panel 4 (inicio, pico y fin de carga) y panel 5 (fin de carga) |
| Dashboard (export JSON) + capturas PNG | `dashboard/dashboard_export.json` y `capturas/` |
| Dos KPI críticos justificados y contrastados con SLO | `comentario_analitico.md` (P95 y throughput) |
| Vínculo con arquitectura/infraestructura | `comentario_analitico.md`, sección "Vínculo con la arquitectura" |
| Tres recomendaciones con impacto/esfuerzo | `comentario_analitico.md`, tabla de recomendaciones |
| Coherencia con resultados de A3 | Cifras tomadas de `../load-testing/results/` y del informe técnico de la A3 |

## Trazabilidad del P99

- **load (11,50 ms):** proviene del informe técnico entregado en la A3 (Tabla 1 y Anexo C). La corrida `load_20260915` no tiene console log y su `summary.json` no incluye p(99).
- **stress, spike, soak y breakpoint:** provienen del console log de cada corrida.

La fuente de cada valor queda registrada en la columna `fuente_p99` de `data/kpis_rendimiento.csv` y en la nota del panel 1.

## CPU del soak: rango del informe y rango del log

El informe de la A3 presenta un rango resumido y representativo de la CPU del soak (aproximadamente 0,5 %–1,6 %). La A4 utiliza todas las muestras del archivo `docker stats`, que incluyen valores puntuales desde 0,42 % hasta 2,89 %; por esta razón el dashboard muestra picos de hasta 2,89 %. Ambos rangos describen la misma corrida con distinto nivel de detalle.

## Limitaciones

- Entorno local Docker, no productivo; la red es localhost.
- El log de breakpoint no incluye Block I/O; por eso el panel 6 utiliza la evidencia del soak.
- Las recomendaciones metodológicas de la A3 (precargar datos, prueba sin think time, mayor carga, recalibrar el SLO de throughput, ejecutar k6 en otra máquina y repetir corridas) siguen siendo antecedentes válidos para fortalecer la evidencia, pero no forman parte de las recomendaciones de esta actividad.
