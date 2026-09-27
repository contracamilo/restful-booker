# Master Test Plan y evidencia de calidad — Restful-Booker (Calidad en Software II)

Sistema bajo prueba: **Restful-Booker** (fork de práctica de QA/API testing), forkeado a este repositorio.

## Estructura

```
master-plan/
├── docs/
│   └── MASTER_PLAN.md            # Actividad 2: documento principal, estructura 1:1 con Anexo 1
├── automation/                   # Actividad 2: suite Cucumber-JVM + JUnit + REST-assured
│   ├── pom.xml
│   └── src/test/{java,resources}/...
├── evidencias/                   # Actividad 2: RTM.csv, resultados de ejecución, health checks
├── load-testing/                 # Actividad 3: prueba de rendimiento (k6) — ver load-testing/README.md
│   ├── scripts/load_test.js
│   ├── config/environment.md
│   ├── results/
│   └── report/informe_tecnico.md
├── actividad-4-dashboard/        # Actividad 4: dashboard de KPIs y comentario analítico — ver actividad-4-dashboard/README.md
│   ├── dashboard/index.html
│   ├── data/*.csv
│   └── comentario_analitico.md
└── extra/k6/                     # scripts k6 exploratorios (no son la automatización oficial)
```

## Cómo ejecutar

### Actividad 2 — Automatización

```bash
# 1. Levantar la API
docker compose up -d --build
curl http://localhost:3001/ping   # debe responder 201

# 2. Correr la suite de automatización (Cucumber sobre JUnit)
cd master-plan/automation
mvn test
# Reportes en target/surefire-reports/ y target/cucumber-reports/
```

El pipeline de GitHub Actions ([`.github/workflows/mtp-smoke.yml`](../.github/workflows/mtp-smoke.yml)) ejecuta los mismos pasos en cada push/PR.

### Actividad 3 — Prueba de carga (k6)

Ver [`load-testing/README.md`](load-testing/README.md) para requisitos, perfiles disponibles y cómo guardar evidencia.

### Actividad 4 — Dashboard de rendimiento

El dashboard es un archivo HTML único (sin servidor ni dependencias externas); los datos ya
vienen incluidos, generados a partir de la evidencia de la Actividad 3.

```bash
cd master-plan/actividad-4-dashboard
python3 scripts/build_dashboard_data.py   # opcional: regenera los datos si cambiaste algún CSV en data/
open dashboard/index.html                 # o ábrelo manualmente desde el navegador
```

Ver [`actividad-4-dashboard/README.md`](actividad-4-dashboard/README.md) para el detalle de
paneles, umbrales (SLO) y trazabilidad de cada cifra hacia su fuente en `load-testing/results/`.

## Documentos por actividad

- **Actividad 2:** [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) — contexto, riesgos, estrategia, RTM, defectos, KPIs.
- **Actividad 3:** [`load-testing/report/informe_tecnico.md`](load-testing/report/informe_tecnico.md).
- **Actividad 4:** [`actividad-4-dashboard/comentario_analitico.md`](actividad-4-dashboard/comentario_analitico.md) — dos KPIs críticos y tres recomendaciones priorizadas.
