# MASTER TEST PLAN (MTP) — Restful-Booker
**Actividad 2 · Calidad en Software II**

> Este documento sigue exactamente la estructura del Anexo 1 (plantilla oficial) para poder trasladarse directo al formato de entrega en PDF.

## Metadatos mínimos

- **Proyecto / Producto:** Restful-Booker (fork de práctica de QA/API testing)
- **Sistema bajo prueba (SUT):** API REST de reservas — [contracamilo/restful-booker](https://github.com/contracamilo/restful-booker) (fork de [mwinteringham/restful-booker](https://github.com/mwinteringham/restful-booker))
- **Integrantes (máx. 3):** _[completar]_
- **Versión del documento:** v0.1 (borrador — se etiqueta `v1.0` en el repo al cierre)
- **Fecha:** _[completar fecha de entrega]_
- **Repositorio (URL):** https://github.com/contracamilo/restful-booker
- **Tablero Jira (opcional):** proyecto "Calidad en Software 2" (`KAN`) — historia [KAN-1](https://unisalle-team-kku47wgx.atlassian.net/browse/KAN-1) con 10 tareas (casos de prueba) y 5 bugs vinculados (`Blocks`), ver [`master-plan/evidencias/jira/`](../evidencias/jira)

---

## 1. Contexto y alcance

**1.1 ¿Qué problema/objetivo de negocio atiende el SUT?**
Restful-Booker simula el backend de un sistema de reservas de habitaciones: permite crear, consultar, actualizar y eliminar reservas, protegiendo las operaciones de escritura sensibles detrás de un token de autenticación. En este ejercicio actúa como sistema de referencia realista para practicar un ciclo completo de calidad (riesgos, estrategia, trazabilidad, defectos, automatización) sobre una API con reglas de negocio mínimas y deliberadamente incompletas — análogo a evaluar un sistema real de reservas antes de su primer release.

**1.2 Alcance (In/Out): ¿qué se incluye y qué NO?**
*Incluido:* autenticación (`POST /auth`), ciclo de vida completo de reservas (`POST/GET/PUT/PATCH/DELETE /booking`), autorización sobre operaciones de escritura (token o Basic Auth), health check (`GET /ping`), validación de payloads JSON.
*Excluido:* interfaz web (`public/`) del proyecto, soporte XML/urlencoded, roles múltiples (solo existe un usuario `admin` fijo), persistencia real o múltiples entornos, notificaciones/pagos/integraciones externas.

**1.3 Supuestos y dependencias.**
Credenciales fijas del proyecto (`admin`/`password123`); un único entorno de desarrollo local vía Docker (`docker-compose up`, puerto `3001`); almacenamiento en memoria (LokiJS) que se reinicia con el contenedor, por lo que los datos son siempre sintéticos y no persisten entre corridas.

**1.4 Referencias.**
Contrato de API documentado en `routes/index.js` del propio repositorio (fuente de verdad, no hay OpenAPI/Swagger publicado en el fork); reglas de validación en `helpers/validationrules.js`.

---

## 2. Riesgos y priorización

Formato: Impacto (1–5) × Probabilidad (1–5) = Nivel (IxP). Alto: 15–25, Medio: 8–14, Bajo: 1–7.

**R1.** Descripción: `POST /booking` no valida que `checkout` sea posterior a `checkin` → se crean reservas con fechas invertidas o idénticas. | Impacto: 5 Prob.: 4 Nivel (IxP): 20 (Alto) | Mitigación/Prueba: caso T01 — crear reserva con `checkout` anterior a `checkin`. **Ejecutado:** respuesta `200 OK`, la reserva se crea con fechas invertidas (`bookingid: 11`) → defecto confirmado, ver evidencia [T01](../evidencias/riesgos/T01_checkout_antes_checkin.txt).

**R2.** Descripción: no existe verificación de solapamiento entre reservas → dos reservas para el mismo rango de fechas se aceptan sin conflicto (doble reserva). | Impacto: 5 Prob.: 4 Nivel (IxP): 20 (Alto) | Mitigación/Prueba: caso T02, automatizado como DEF-01 en la suite Cucumber. **Ejecutado (automatizado):** ambas reservas se crean con `bookingid` distintos → defecto confirmado (ver sección 9).

**R3.** Descripción: `PUT/PATCH/DELETE /booking/:id` aceptan el header Basic hardcodeado (`YWRtaW46cGFzc3dvcmQxMjM=`) documentado públicamente → cualquiera con acceso al repo puede modificar/eliminar reservas ajenas sin pasar por `/auth`. | Impacto: 4 Prob.: 4 Nivel (IxP): 16 (Alto) | Mitigación/Prueba: caso T03 — usar el header sin haber llamado `/auth`. **Ejecutado:** `PUT /booking/1` con solo el header hardcodeado devuelve `200 OK` y modifica la reserva → defecto confirmado (DEF-04), ver evidencia [T03](../evidencias/riesgos/T03_auth_hardcoded.txt).

**R4.** Descripción: `totalprice` solo valida presencia (`presence: true`), no tipo ni rango → se aceptan precios negativos, cero o no numéricos. | Impacto: 4 Prob.: 3 Nivel (IxP): 12 (Medio) | Mitigación/Prueba: caso T04 — partición de equivalencia sobre `totalprice`. **Ejecutado:** `totalprice: -50` se acepta tal cual (`200 OK`, [evidencia](../evidencias/riesgos/T04_totalprice_negative.txt)); `totalprice: "abc"` es **coaccionado silenciosamente a `null`** en vez de rechazarse (`200 OK`, [evidencia](../evidencias/riesgos/T04_totalprice_string.txt)) — hallazgo más severo de lo previsto: no solo falta validación, se corrompe el dato silenciosamente (DEF-03).

**R5.** Descripción: `DELETE /booking/:id` sobre un id inexistente responde `405` en lugar de `404` → clientes/automatización interpretan mal el resultado. | Impacto: 2 Prob.: 4 Nivel (IxP): 8 (Medio) | Mitigación/Prueba: caso T05 — `DELETE` sobre id inexistente. **Ejecutado:** respuesta `405 Method Not Allowed` confirmada, ver evidencia [T05](../evidencias/riesgos/T05_delete_nonexistent.txt) → defecto confirmado (DEF-02).

**R6.** Descripción: el token emitido por `POST /auth` no expira ni se invalida (vive en memoria del proceso) → una fuga de token queda vigente indefinidamente hasta reiniciar el contenedor. | Impacto: 4 Prob.: 2 Nivel (IxP): 8 (Medio) | Mitigación/Prueba: caso T06 — documentado como no verificable en un entorno de un solo ambiente (ver sección 5); riesgo aceptado y registrado.

**Orden de ejecución sugerido (mayor a menor IxP):** R1 y R2 primero (empatados en 20, ambos del dominio de fechas/solapamiento — el mayor impacto de negocio, doble reserva y datos inconsistentes) → R3 (compromete integridad vía autorización débil) → R4 → R5 y R6 (impacto contenido, no bloquean flujo crítico).

---

## 3. Estrategia y cobertura

**3.1 Niveles / Tipos de prueba:**
- [x] Smoke (sanidad rápida de build) — `GET /ping` + creación de reserva válida
- [x] Funcional de sistema (flujos críticos) — ciclo CRUD completo de `/booking`
- [x] Regresión mínima — se re-ejecuta el smoke suite en cada PR vía CI (ver sección 9)
- [ ] Aceptación (fuera de alcance para este ejercicio, ver sección 1.2)
- [x] Seguridad básica (authN/authZ) — autorización de `PUT/PATCH/DELETE` (R3)

**3.2 Técnicas de diseño (2–3 elegidas):**
- [x] **Partición de equivalencias** — `totalprice`: clase válida (positivos, ej. `111`), clases inválidas (negativos `-50`, cero `0`, no numérico `"abc"`, ausente).
- [x] **Valores límite** — `bookingdates`: `checkin` = `checkout` (mismo día); `checkin` un día después de `checkout` (justo fuera del límite válido); fechas muy alejadas (año 2099) para verificar ausencia de validación de rango.
- [x] **Tablas de decisión** — autenticación × operación → respuesta esperada (ver tabla abajo).

| Autenticado | Operación | Esperado | Observado |
|---|---|---|---|
| Sí | `PUT /booking/:id` | 200 | 200 |
| No | `PUT /booking/:id` | 401/403 | 403 |
| Sí | `DELETE /booking/:id` (id existe) | 201 | 201 |
| Sí | `DELETE /booking/:id` (id no existe) | 404 | 405 (defecto R5) |
| — | `POST /booking` (sin auth) | 200 | 200 (correcto: crear no requiere auth) |

**3.3 Criterios de cobertura mínima:**
- [x] 100% de criterios de aceptación cubiertos para historias críticas (RQ1–RQ5, sección 4)
- [x] Smoke obligatorio en cada build (pipeline CI, sección 9)
- [x] Regresión mínima sobre módulos impactados (re-ejecución del smoke suite en cada PR)

---

## 4. Trazabilidad mínima (RTM)

- **Req/Historia 1:** Autenticación de usuario admin (RQ1)
  - Caso(s): T-AUTH-01, T-AUTH-02 • Criterio(s): token válido solo con credenciales correctas • Severidad: Crítico • Estado: **Ejecutado — PASA**: credenciales correctas devuelven `{"token":"..."}` ([evidencia](../evidencias/riesgos/RQ1_auth_valid.txt)); incorrectas devuelven `{"reason":"Bad credentials"}` sin token ([evidencia](../evidencias/riesgos/RQ1_auth_invalid.txt)). *Observación menor (no defecto):* ambas respuestas usan HTTP 200 en vez de 401 para el caso fallido — el control funciona (no emite token), pero el código de estado no es semánticamente correcto.

- **Req/Historia 2:** Consultar disponibilidad/listado de reservas (RQ2)
  - Caso(s): T-GET-01, T-GET-02 • Criterio(s): `GET /booking` filtra por firstname/lastname/checkin/checkout • Severidad: Alto • Estado: **Ejecutado — PASA**: listado completo ([evidencia](../evidencias/riesgos/RQ2_get_all.txt)) y filtro por `firstname` devuelve exactamente la reserva esperada ([evidencia](../evidencias/riesgos/RQ2_get_filtered.txt))

- **Req/Historia 3:** Crear una reserva válida (RQ3)
  - Caso(s): Escenario Cucumber "Crear una reserva válida" • Criterio(s): respuesta 200 con bookingid numérico y datos reflejados • Severidad: Crítico • Estado: **Automatizado — PASA** (ver sección 9)

- **Req/Historia 4:** Prevenir/reportar solapamiento de reservas (RQ4)
  - Caso(s): Escenario Cucumber "DEF-01" • Criterio(s): debería rechazar solapamiento (comportamiento deseado) • Severidad: Crítico • Estado: **Defecto confirmado (DEF-01)** — automatizado como prueba de caracterización que documenta el gap (ver sección 7)

- **Req/Historia 5:** Actualizar/eliminar reserva solo con autorización (RQ5)
  - Caso(s): T03 (R3), T-DELETE-01 • Criterio(s): operaciones de escritura devuelven 403 sin token válido • Severidad: Crítico • Estado: **Falló — defecto confirmado (DEF-04)**, aplica a `PUT` ([evidencia T03](../evidencias/riesgos/T03_auth_hardcoded.txt)) y a `DELETE` ([evidencia T-DELETE-01](../evidencias/riesgos/T-DELETE-01_auth_hardcoded.txt)) — ambos aceptan el header hardcodeado sin haber llamado `/auth`

RTM también se publica como lista independiente en [`master-plan/evidencias/RTM.csv`](../evidencias/RTM.csv) para el entregable separado que exige la actividad.

---

## 5. Entornos y datos de prueba

**Entornos:**
- **DEV:** `http://localhost:3001` — build: fork `contracamilo/restful-booker`, rama `feature/master-plan-setup` — levantado vía `docker-compose up` — logs: `docker compose logs`
- **QA/Staging:** No aplica — actividad académica de un solo entorno (justificado en sección 1.3)
- **UAT:** No aplica

**Datos de prueba:**
- Dataset válido: `{firstname: "Camilo", lastname: "Rivera", totalprice: 150, checkin: "2026-09-01", checkout: "2026-09-05"}`
- Dataset límite: `{totalprice: -50}`, `{totalprice: 0}`, `{totalprice: "abc"}`, `{checkin: checkout}`
- Dataset de solapamiento: dos reservas idénticas en fechas (`2026-10-01` a `2026-10-05`) con distinto `firstname`

---

## 6. Criterios de entrada/salida por ciclo

**Smoke** — Entrada (ready): contenedor Docker activo, `GET /ping` responde 201 | Salida (done): los 2 escenarios Cucumber/JUnit pasan en verde (BUILD SUCCESS) | Bloqueadores: Docker no disponible, puerto 3001 ocupado.

**Funcional priorizado (alto riesgo)** — Entrada (ready): smoke en verde, casos T01–T06 diseñados y datos de prueba preparados | Salida (done): R1–R3 (riesgos Alto) ejecutados y documentados con evidencia, aunque no se corrijan (proyecto de terceros) | Bloqueadores: cambios en el contrato de API del upstream que invaliden los casos diseñados.

**Regresión mínima** — Entrada (ready): un cambio (PR) impacta `routes/index.js`, `helpers/validator.js` o `models/booking.js` | Salida (done): pipeline CI (sección 9) vuelve a pasar en verde tras el cambio | Bloqueadores: pipeline caído por causas de infraestructura (no relacionadas al cambio).

---

## 7. Gestión de defectos

**Flujo:** New → In Progress → Resolved → Closed

- **Severidades:** Crítico, Alto, Medio, Bajo
- **Prioridades:** P0 (hotfix), P1, P2

**Defectos documentados (mínimo 2 requeridos por la actividad):**

| ID | Descripción | Severidad | Prioridad | Estado | Reproducibilidad |
|---|---|---|---|---|---|
| DEF-01 | La API acepta reservas solapadas para el mismo rango de fechas sin ningún control (Riesgo R2) | Crítico | P1 | New — automatizado como prueba de caracterización (ver sección 9); no se corrige por ser fork de terceros usado como sandbox | Reproducible: ver escenario Cucumber "DEF-01" — cualquier integrante obtiene el mismo resultado ejecutando `mvn test`. Evidencia: [cucumber_smoke_result.xml](../evidencias/cucumber_smoke_result.xml) |
| DEF-02 | `DELETE /booking/:id` sobre un id inexistente responde `405 Method Not Allowed` en vez de `404 Not Found` (Riesgo R5) | Medio | P2 | New — confirmado por ejecución manual | Reproducible: `curl -X DELETE http://localhost:3001/booking/999999 -H "Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM="`. Evidencia: [T05](../evidencias/riesgos/T05_delete_nonexistent.txt) |
| DEF-03 | `totalprice` acepta valores negativos sin rechazo, y valores no numéricos (ej. `"abc"`) son **coaccionados silenciosamente a `null`** en vez de rechazarse (Riesgo R4) | Medio | P2 | New — confirmado por ejecución manual | Reproducible: `POST /booking` con `totalprice: -50` ([evidencia](../evidencias/riesgos/T04_totalprice_negative.txt)) y con `totalprice: "abc"` ([evidencia](../evidencias/riesgos/T04_totalprice_string.txt)) |
| DEF-04 | `PUT` y `DELETE /booking/:id` aceptan el header `Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=` (documentado públicamente en el propio README del proyecto) sin que el cliente haya llamado `/auth` — permite modificar/eliminar reservas de terceros sin flujo de autenticación real (Riesgo R3) | Crítico | P1 | New — confirmado por ejecución manual en ambos verbos | Reproducible: `curl -X PUT http://localhost:3001/booking/1 -H "Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=" ...` ([evidencia T03](../evidencias/riesgos/T03_auth_hardcoded.txt)) y `curl -X DELETE http://localhost:3001/booking/{id} -H "Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM="` ([evidencia T-DELETE-01](../evidencias/riesgos/T-DELETE-01_auth_hardcoded.txt)) |

**Reglas de triage y escalación:** el equipo revisa hallazgos nuevos al cierre de cada ciclo (sección 6); severidad Crítico/Alto se documenta con evidencia inmediata, severidad Medio/Bajo se registra para el backlog de hallazgos sin bloquear el smoke suite.

**SLA:** no aplica (ejercicio académico de alcance fijo, no hay ventana de corrección comprometida con stakeholders reales).

---

## 8. Métricas (mínimas)

- [x] **% avance de ejecución de casos** (hechos/plan) — **11 de 11 casos ejecutados y documentados (100%)** al cierre de este ciclo (T01–T06, RQ1–RQ5). Frecuencia: por ciclo (sección 6).
- [x] **# defectos abiertos por severidad** — **Crítico: 2** (DEF-01, DEF-04) · **Medio: 2** (DEF-02, DEF-03) · Alto/Bajo: 0. Frecuencia: al cierre de cada ciclo. *Decisión que informa:* con 2 defectos críticos abiertos ligados a integridad de datos y autorización, se prioriza su corrección/documentación formal antes de ampliar cobertura funcional.
- [x] **Tasa de éxito del smoke** (últimos N builds) — pipeline CI: **1/1 ejecuciones en verde** ([run #32411628327](https://github.com/contracamilo/restful-booker/actions/runs/32411628327)). *Nota aparte:* de los 10 casos de riesgo con veredicto concluyente (T01–T05, RQ1–RQ5), 3 confirman comportamiento correcto (RQ1, RQ2, RQ3 = 30%) y 5 confirman defectos (T01, T03, T04, T05, y el DEF-01 automatizado) — esto no es una falla del smoke suite (que sigue en verde por diseño, sección 9), sino una señal de negocio: la API bajo prueba tiene varias reglas de negocio críticas sin implementar (fechas, autorización), justificando la prioridad Alta asignada a R1–R3. Frecuencia: por cada push/PR.

---

## 9. Automatización mínima viable (CI)

- [x] **Suite smoke ejecutable desde línea de comando:** Cucumber-JVM ejecutado a través del **runner de JUnit** (`RunCucumberTest`, anotado `@RunWith(Cucumber.class)`) — la ejecución produce reportes JUnit XML estándar (`target/surefire-reports/`), cumpliendo el requisito de la rúbrica ("JUnit, Postman o Selenium IDE"). Ubicación: [`master-plan/automation/`](../automation).
- [x] **Pipeline CI que dispara la suite smoke:** GitHub Actions — [`.github/workflows/mtp-smoke.yml`](../../.github/workflows/mtp-smoke.yml) — levanta `restful-booker` vía `docker compose`, espera el health check (`GET /ping`), y corre `mvn test`.
- [x] **Reporte de resultados:** JUnit XML + reporte HTML de Cucumber, publicados como artefacto del workflow (`actions/upload-artifact`); copia local en [`master-plan/evidencias/`](../evidencias).
- [x] **Evidencia:** ejecución local confirmada — `BUILD SUCCESS`, `Tests run: 2, Failures: 0, Errors: 0` (ver [`junit_smoke_result.txt`](../evidencias/junit_smoke_result.txt) y [`cucumber_smoke_result.xml`](../evidencias/cucumber_smoke_result.xml)) — **y pipeline de GitHub Actions en verde**: [run #32411628327](https://github.com/contracamilo/restful-booker/actions/runs/32411628327) (`conclusion: success`). Tag `v1.0` ya creado (sección 10).

**Los 2 escenarios automatizados:**
1. *Crear una reserva válida* (cubre RQ3) — aserciones duras sobre código de estado, presencia de `bookingid`, y que los campos devueltos coincidan con el payload enviado.
2. *DEF-01 — comportamiento de solapamiento* (cubre RQ4) — prueba de caracterización: confirma y deja evidencia reproducible de que la API acepta reservas solapadas hoy (el gap contra el comportamiento deseado se documenta como defecto en la sección 7, no como fallo de test, para mantener el pipeline en verde).

**Cómo ejecutar local/CI:**
```bash
docker compose up -d --build          # levanta la API en localhost:3001
cd master-plan/automation
mvn test                              # corre la suite Cucumber/JUnit
```

---

## 10. Control de versiones (resumen)

- [x] Rama principal (`main`) protegida — se trabaja en `feature/master-plan-setup`
- [x] Ramas de feature + Pull Request obligatorio antes de integrar a `main` ([PR #1](https://github.com/contracamilo/restful-booker/pull/1))
- [x] Etiquetado de entregables: **`v1.0`** creado sobre `feature/master-plan-setup` (6 commits) — se mantiene válido tras el merge a `main`

---

## Entregables a publicar
- [ ] MTP (este documento, volcado al Anexo 1 en PDF)
- [x] RTM (lista, ver [`master-plan/evidencias/RTM.csv`](../evidencias/RTM.csv))
- [x] Repo con suite smoke + pipeline CI (`master-plan/automation/` + `.github/workflows/mtp-smoke.yml`)
- [x] Evidencia ejecución pipeline (`master-plan/evidencias/`)

## Checklist de verificación del MTP
- [x] Alcance y objetivos claros (sección 1, ≤1 página)
- [x] Riesgos priorizados (6) y orden de ejecución (sección 2)
- [x] Estrategia mínima definida y técnicas elegidas (sección 3)
- [x] RTM mínima (req ↔ casos ↔ estado) (sección 4)
- [x] Entornos y datos descritos (sección 5)
- [x] Entrada/Salida por ciclo (sección 6)
- [x] Flujo de defectos y severidades (sección 7)
- [x] 3 KPIs mínimos definidos (sección 8)
- [x] CI mínima funcionando con evidencia (sección 9 — local `BUILD SUCCESS` + [pipeline en verde en GitHub Actions](https://github.com/contracamilo/restful-booker/actions/runs/32411628327))
- [x] Reglas de versionado claras — tag `v1.0` creado (sección 10)
