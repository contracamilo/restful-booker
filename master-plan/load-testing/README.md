# Actividad 3 — Prueba de rendimiento (carga/estrés/soak)

Continúa sobre el mismo fork de Restful-Booker usado en la Actividad 2 (Master Test Plan).
Script implementado en **k6** (JavaScript) — ver [`scripts/load_test.js`](scripts/load_test.js).

## 1. Requisitos

- Docker + Docker Compose (para levantar la API, igual que en la Actividad 2).
- [k6](https://k6.io/docs/get-started/installation/):
  ```bash
  brew install k6
  ```

## 2. Levantar la API

Desde la raíz del repo (`restful-booker/`):

```bash
docker compose up -d --build
curl -i http://localhost:3001/ping   # debe responder 201
```

## 3. Ejecutar una prueba

Desde `master-plan/load-testing/`. El perfil se elige con `PROFILE` (ver detalle de cada uno en
[`config/environment.md`](config/environment.md)):

```bash
# Smoke — validar que el script funciona (1 VU, 30s)
PROFILE=smoke k6 run scripts/load_test.js

# Carga esperada (perfil por defecto si no se pasa PROFILE)
PROFILE=load k6 run scripts/load_test.js

# Estrés — buscar el punto de quiebre
PROFILE=stress k6 run scripts/load_test.js

# Spike — pico súbito
PROFILE=spike k6 run scripts/load_test.js

# Soak/resistencia — por defecto 10 min, para evidencia final usar más tiempo
SOAK_DURATION=45m PROFILE=soak k6 run scripts/load_test.js

# Breakpoint — escalones hasta 1000 VUs para buscar el punto de quiebre real
# (los otros 4 perfiles no lo encontraron — ver informe técnico sección 6)
PROFILE=breakpoint k6 run scripts/load_test.js
```

Variables disponibles (todas opcionales, con default razonable):

| Variable       | Default                  | Qué hace                              |
|----------------|---------------------------|----------------------------------------|
| `BASE_URL`     | `http://localhost:3001`   | URL de la API bajo prueba              |
| `PROFILE`      | `load`                    | `smoke`\|`load`\|`stress`\|`spike`\|`soak`\|`breakpoint` |
| `ADMIN_USER`   | `admin`                   | Usuario para `/auth`                   |
| `ADMIN_PASS`   | `password123`             | Password para `/auth`                  |
| `THINK_MIN`    | `1`                       | Segundos mínimos de think time         |
| `THINK_MAX`    | `3`                       | Segundos máximos de think time         |
| `SOAK_DURATION`| `10m`                     | Duración del perfil `soak`             |

## 4. Guardar evidencia (resultados crudos + reporte)

Guarda siempre la corrida con nombre y fecha en `results/`, y observa recursos en paralelo con
`docker stats`:

```bash
# Terminal 1 — observabilidad de recursos durante la corrida
docker stats restful-booker

# Terminal 2 — ejecutar guardando JSON crudo + resumen
mkdir -p results
PROFILE=load k6 run scripts/load_test.js \
  --out json=results/load_$(date +%Y%m%d_%H%M).json \
  --summary-export=results/load_$(date +%Y%m%d_%H%M)_summary.json
```

### Reporte HTML

k6 (v0.47+) trae un dashboard web integrado que exporta HTML directamente, sin dependencias extra:

```bash
K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT=results/load_$(date +%Y%m%d_%H%M)_report.html \
PROFILE=load k6 run scripts/load_test.js
```

Abre el `.html` resultante — de ahí salen las capturas de dashboard que pide el entregable.
También puedes ver el dashboard en vivo mientras corre en `http://localhost:5665`.

### Reporte CSV (alternativa)

```bash
PROFILE=load k6 run scripts/load_test.js --out csv=results/load_$(date +%Y%m%d_%H%M).csv
```

## 5. Checklist de entrega (mapea directo a los criterios de evaluación)

- [x] `config/environment.md` completado (hardware real, perfiles, SLI/SLO/SLA aclarados)
- [x] Corridas de los 4 perfiles (`load`, `stress`, `spike`, `soak`) con resultados en `results/`
- [x] Reporte HTML del dashboard (`results/spike_*_report.html`) + `docker stats` durante `soak`
- [x] `report/informe_tecnico.md` completado (~974 palabras): percentiles P50/P95/P99, throughput,
      errores, contraste con SLO, cuellos de botella y propuestas priorizadas
- [ ] Todo commiteado en esta rama (`feature/actividad-3-load-testing`) y PR abierto

## 6. Estructura

```
master-plan/load-testing/
├── README.md                    ← esta guía
├── scripts/
│   └── load_test.js             ← script k6 parametrizado (smoke/load/stress/spike/soak)
├── config/
│   └── environment.md           ← entorno, perfil de carga y supuestos (SLA/SLO)
├── results/                     ← resultados crudos (JSON/CSV) y reportes HTML (no versionar corridas grandes)
└── report/
    └── informe_tecnico.md       ← informe técnico ~800 palabras (completar después de ejecutar)
```
