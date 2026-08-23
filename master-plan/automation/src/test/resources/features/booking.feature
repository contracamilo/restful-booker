Feature: Booking smoke suite
  Suite minima de automatizacion para el Master Test Plan (Actividad 2).
  Cubre RQ3 (crear reserva valida) y RQ4 (prevencion de solapamiento, Riesgo R2).

  Background:
    Given la API restful-booker esta disponible en "http://localhost:3001"

  Scenario: Crear una reserva valida
    When creo una reserva con nombre "Camilo" fechas "2026-09-01" a "2026-09-05" y precio 150
    Then la respuesta tiene codigo de estado 200
    And la respuesta contiene un bookingid numerico
    And los datos de la reserva devuelta coinciden con los enviados

  # Prueba de caracterizacion: confirma y deja evidencia reproducible del
  # comportamiento actual (no deseado) descrito en el Riesgo R2 / Defecto DEF-01.
  # El escenario PASA porque documenta la realidad observada; el gap contra el
  # comportamiento deseado (rechazo de solapamiento) se referencia en la seccion
  # 7 (Gestion de defectos) del MTP.
  Scenario: DEF-01 - la API acepta reservas solapadas sin control (comportamiento actual)
    Given ya existe una reserva con nombre "Guest1" fechas "2026-10-01" a "2026-10-05"
    When intento crear otra reserva con nombre "Guest2" fechas "2026-10-01" a "2026-10-05"
    Then ambas reservas se crean sin validacion de solapamiento, confirmando el defecto DEF-01
