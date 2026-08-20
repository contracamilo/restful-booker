# Guía para el equipo — Actividad 2 (Master Test Plan)

Hola Daniel y Richard. Este documento explica qué se hizo, por qué, y qué falta por hacer. La idea es que cualquiera de los dos pueda entrar, entender el trabajo y avanzar sin depender de Camilo.

---

## 1. ¿Qué es esta actividad y qué se pide?

Es la **Actividad 2** de Calidad en Software II: construir un **Mini Master Test Plan (MTP)** sobre un sistema de software ya existente (no se programa nada nuevo), demostrando un ciclo completo de calidad: alcance, riesgos, estrategia de pruebas, trazabilidad (RTM), gestión de defectos, automatización mínima y control de versiones en Git.

**Entrega:** domingo 23 de agosto, 11:59 PM. **Vale 5 puntos**, repartidos así:
- 2 pts: completitud y coherencia del MTP
- 1 pt: identificación y priorización de riesgos
- 1 pt: calidad de casos de prueba y trazabilidad (RTM)
- 1 pt: gestión de defectos, automatización y versionamiento en Git

**Formato final:** el documento debe entregarse en PDF usando la plantilla oficial "Anexo 1" (la bajamos de UnisalleVirtual, está en `Downloads/Anexo 1.docx` en la máquina de Camilo — si no la tienen, pídanla en la plataforma).

## 2. ¿Qué sistema elegimos y por qué?

Elegimos **[Restful-Booker](https://github.com/mwinteringham/restful-booker)**, una API REST de código abierto construida específicamente para practicar pruebas de API (autenticación + CRUD de reservas de habitaciones). La forkeamos a la cuenta de GitHub de Camilo: **https://github.com/contracamilo/restful-booker**.

¿Por qué esta y no otra? Porque:
- Su dominio (reservas con fechas de check-in/check-out) mapea casi 1:1 con el ejemplo "ReservaLab" que dieron en la clase de la actividad (riesgo de solapamiento, validación de fechas, capacidad).
- Es súper fácil de levantar (Docker en un comando) y tiene un contrato de API simple y bien definido.
- **Tiene defectos reales** (no simulados) que sirven perfecto para el ejercicio de riesgos/defectos — no tuvimos que inventar nada.

## 3. ¿Cómo levantar el proyecto en su máquina?

```bash
# 1. Clonar el fork (no el original, el de Camilo)
git clone https://github.com/contracamilo/restful-booker.git
cd restful-booker
git checkout feature/master-plan-setup   # o main si ya se mergeó el PR

# 2. Levantar la API con Docker
docker compose up -d --build
curl http://localhost:3001/ping          # debe responder 201

# 3. Correr la suite de automatización (Cucumber sobre JUnit)
cd master-plan/automation
mvn test
# Reportes en target/surefire-reports/ y target/cucumber-reports/
```

Necesitan tener instalado: Docker, Java 11+, Maven. Si no los tienen, avisen y vemos cómo instalarlos.

## 4. Estructura de carpetas — qué hay y para qué sirve

```
restful-booker/
├── master-plan/
│   ├── docs/
│   │   └── MASTER_PLAN.md      ← EL DOCUMENTO PRINCIPAL (lean esto primero)
│   ├── automation/              ← suite de pruebas automatizadas (Cucumber+JUnit+REST-assured)
│   ├── evidencias/               ← capturas, resultados de pruebas, CSV del RTM
│   │   ├── RTM.csv               ← trazabilidad en formato tabla/lista
│   │   ├── riesgos/               ← evidencia curl de cada caso de riesgo ejecutado
│   │   └── jira/                  ← evidencia del tablero Jira (historia/tareas/bugs)
│   └── extra/k6/                 ← scripts exploratorios (NO son la automatización oficial)
└── .github/workflows/mtp-smoke.yml  ← pipeline CI que corre la suite automáticamente
```

**Lo más importante para leer es [`master-plan/docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).** Sigue exactamente la estructura de la plantilla Anexo 1, así que leerlo es literalmente leer el contenido que va a ir en el PDF final.

## 5. Recorrido rápido por lo que ya está hecho

- **6 riesgos identificados y priorizados** (R1–R6), todos con **evidencia real** ejecutada contra la API (no inventada) — ej. la API acepta reservas con fecha de salida anterior a la de entrada, o acepta dos reservas para el mismo rango de fechas sin ningún control.
- **4 defectos reales confirmados** (DEF-01 a DEF-04) + 1 riesgo aceptado (DEF-05), todos reproducibles con un simple `curl` (están documentados con el comando exacto en la sección 7 del MTP).
- **RTM con 5 historias**, todas ejecutadas al 100% (algunas pasan, otras confirman defectos — ambas cosas cuentan como "ejecutado").
- **2 pruebas automatizadas** con Cucumber (BDD) corriendo sobre el runner de JUnit — cumple el requisito de la rúbrica que pide JUnit/Postman/Selenium IDE. Corren en verde tanto local como en un **pipeline de GitHub Actions** ([ver corrida](https://github.com/contracamilo/restful-booker/actions)).
- **Tablero Jira** (proyecto "Calidad en Software 2", key `KAN`): 1 historia + 10 tareas (casos de prueba) + 5 bugs vinculados.
- **Control de versiones:** rama `feature/master-plan-setup`, 5+ commits, [PR #1](https://github.com/contracamilo/restful-booker/pull/1).

## 6. Qué falta — reparto sugerido

Esto es una propuesta, ajústenla como les sirva mejor:

### Daniel
1. **Leer completo [`MASTER_PLAN.md`](docs/MASTER_PLAN.md)** y el [PR #1](https://github.com/contracamilo/restful-booker/pull/1) — dejar comentarios si algo no cuadra o no se entiende.
2. **Volcar el contenido al Anexo 1.docx** (la plantilla oficial) y exportarlo a PDF. El documento ya está redactado sección por sección con los mismos títulos que la plantilla — es más "copiar y dar formato" que redactar desde cero.
3. Confirmar que el PDF cumple el checklist final que está al pie del `MASTER_PLAN.md`.

### Richard
1. **Entrar al tablero Jira** (proyecto "Calidad en Software 2", https://unisalle-team-kku47wgx.atlassian.net) y tomar una **captura de pantalla** que muestre un bug vinculado a su tarea correspondiente (por ejemplo, abrir el issue `KAN-12` y mostrar el link "blocks" hacia `KAN-3`). Esto lo pide la rúbrica y hay que hacerlo con sesión propia logueada — Camilo no puede hacerlo sin las credenciales de alguien.
2. Revisar la sección de **Estrategia y cobertura** (sección 3 del MTP) y la de **Entornos y datos de prueba** (sección 5) — son las que menos "evidencia dura" tienen, así que si quieren reforzar el documento, ahí hay espacio para agregar algo (ej. correr manualmente 1-2 casos de los valores límite descritos en 3.2 y agregar la evidencia).
3. Ayudar a definir **fecha de entrega exacta** y los **nombres completos del equipo** para completar los metadatos al inicio del documento.

### Camilo (ya hecho)
Todo lo técnico: fork, estructura del repo, redacción del MTP, ejecución de los 11 casos de prueba, automatización, pipeline CI, tablero Jira, PR, tag `v1.0`.

## 7. Cómo contribuir (flujo de Git)

```bash
git checkout feature/master-plan-setup
git pull
# ... hacer sus cambios (ej. editar MASTER_PLAN.md, agregar evidencia) ...
git add <archivos que cambiaron>
git commit -m "mensaje descriptivo de lo que hicieron"
git push
```

Si prefieren, pueden crear su propia rama (`git checkout -b nombre-de-su-cambio`) y hacer un Pull Request contra `feature/master-plan-setup` o directamente contra `main` una vez esté mergeado — como les resulte más cómodo.

## 8. Enlaces útiles

- Repositorio: https://github.com/contracamilo/restful-booker
- Pull Request: https://github.com/contracamilo/restful-booker/pull/1
- Pipeline CI (GitHub Actions): https://github.com/contracamilo/restful-booker/actions
- Tablero Jira: https://unisalle-team-kku47wgx.atlassian.net/browse/KAN-1
- Documento principal: [`master-plan/docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md)

Cualquier duda, se resuelve mejor viendo el `MASTER_PLAN.md` directamente — cada sección explica el "qué" y el "por qué" de las decisiones tomadas.
