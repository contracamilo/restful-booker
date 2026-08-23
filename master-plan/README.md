# Master Test Plan — Actividad 2 (Calidad en Software II)

Sistema bajo prueba: **Restful-Booker** (fork de práctica de QA/API testing), forkeado a este repositorio.

## Estructura

```
master-plan/
├── docs/
│   └── MASTER_PLAN.md          # documento principal, estructura 1:1 con Anexo 1
├── automation/                 # suite Cucumber-JVM + JUnit + REST-assured
│   ├── pom.xml
│   └── src/test/{java,resources}/...
├── evidencias/                 # RTM.csv, resultados de ejecución, health checks
└── extra/k6/                   # scripts k6 exploratorios (no son la automatización oficial)
```

## Cómo ejecutar

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

Ver [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) para el documento completo (contexto, riesgos, estrategia, RTM, defectos, KPIs).
