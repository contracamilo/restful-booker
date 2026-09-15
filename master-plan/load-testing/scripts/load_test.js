// Actividad 3 — Script de prueba de rendimiento (carga/estrés/spike/soak)
// Objetivo: recorrer el flujo real de un usuario sobre Restful-Booker
// (ping -> buscar reservas -> autenticarse -> crear -> consultar -> actualizar -> eliminar)
// bajo distintos perfiles de carga, y contrastar contra los umbrales (SLA/SLO) definidos abajo.
//
// Perfiles disponibles (variable de entorno PROFILE): smoke | load | stress | spike | soak
// Ejecutar, por ejemplo:
//   BASE_URL=http://localhost:3001 PROFILE=load k6 run scripts/load_test.js
//
// Ver master-plan/load-testing/README.md para la guía completa de ejecución y reporte.

import http from 'k6/http';
import { check, group, sleep } from 'k6';

// ---------------------------------------------------------------------------
// Parametrización de entorno (config/environment.md documenta los supuestos)
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const ADMIN_USER = __ENV.ADMIN_USER || 'admin';
const ADMIN_PASS = __ENV.ADMIN_PASS || 'password123';
const THINK_MIN = Number(__ENV.THINK_MIN || 1);
const THINK_MAX = Number(__ENV.THINK_MAX || 3);

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

// ---------------------------------------------------------------------------
// Modelo de carga: un executor por perfil, seleccionado con PROFILE.
// Los números son un punto de partida razonable para una API de práctica de
// un solo contenedor; ajústenlos en config/environment.md según lo que midan
// en su máquina antes de tomarlos como definitivos para el informe.
// ---------------------------------------------------------------------------
const PROFILES = {
  // Validación rápida de que el script y la API funcionan (no es la prueba de carga en sí).
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  // Carga esperada en condiciones normales: rampa, sostenida, rampa de bajada.
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  // Estrés: empuja por encima de la carga esperada en escalones hasta encontrar el punto de quiebre.
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 30 },
      { duration: '2m', target: 30 },
      { duration: '1m', target: 60 },
      { duration: '2m', target: 60 },
      { duration: '1m', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  // Spike: pico súbito y corto para ver comportamiento ante ráfagas (ej. campaña, apertura de reservas).
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 5 },
      { duration: '10s', target: 150 },
      { duration: '1m', target: 150 },
      { duration: '10s', target: 5 },
      { duration: '30s', target: 5 },
    ],
    gracefulRampDown: '15s',
  },
  // Soak/resistencia: carga moderada sostenida por tiempo largo (fugas de memoria, degradación).
  // SOAK_DURATION por defecto es corto (10m) para poder probar el script rápido;
  // para la evidencia final del informe, correr con algo como SOAK_DURATION=45m o más.
  soak: {
    executor: 'constant-vus',
    vus: 15,
    duration: __ENV.SOAK_DURATION || '10m',
  },
};

const PROFILE = __ENV.PROFILE || 'load';
if (!PROFILES[PROFILE]) {
  throw new Error(`PROFILE desconocido: "${PROFILE}". Usa uno de: ${Object.keys(PROFILES).join(', ')}`);
}

// ---------------------------------------------------------------------------
// Umbrales (SLA/SLO). Estos son un supuesto de equipo documentado en
// config/environment.md — no hay un SLA publicado para esta API de práctica,
// así que el equipo lo define como meta razonable y lo valida en el debrief (EV-5).
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    [PROFILE]: PROFILES[PROFILE],
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.98'],
    'http_req_duration{step:auth}': ['p(95)<500'],
    'http_req_duration{step:create_booking}': ['p(95)<800'],
    'http_req_duration{step:search_bookings}': ['p(95)<600'],
  },
};

// ---------------------------------------------------------------------------
// Datos de prueba (parametrización simple, sin dependencias externas)
// ---------------------------------------------------------------------------
const FIRST_NAMES = ['Camilo', 'Daniel', 'Richard', 'Laura', 'Sofia', 'Andres', 'Valentina', 'Juan'];
const LAST_NAMES = ['Rivera', 'Charry', 'Caicedo', 'Gomez', 'Perez', 'Martinez', 'Lopez', 'Diaz'];
const NEEDS = ['Breakfast', 'Late checkout', 'None', 'Extra towels', 'Parking'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function think() {
  sleep(randomInt(THINK_MIN, THINK_MAX));
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildBookingPayload() {
  const checkinOffset = randomInt(1, 180);
  const stayLength = randomInt(1, 10);

  return JSON.stringify({
    firstname: randomItem(FIRST_NAMES),
    lastname: randomItem(LAST_NAMES),
    totalprice: randomInt(50, 500),
    depositpaid: Math.random() > 0.5,
    bookingdates: {
      checkin: isoDate(checkinOffset),
      checkout: isoDate(checkinOffset + stayLength),
    },
    additionalneeds: randomItem(NEEDS),
  });
}

// ---------------------------------------------------------------------------
// setup(): falla rápido si la API no responde, en vez de generar miles de
// errores de conexión que ensucien la evidencia.
// ---------------------------------------------------------------------------
export function setup() {
  const res = http.get(`${BASE_URL}/ping`);
  if (res.status !== 201) {
    throw new Error(
      `La API no respondió en ${BASE_URL}/ping (status ${res.status}). ` +
      `¿Está corriendo "docker compose up"? Revisa config/environment.md.`
    );
  }
}

// ---------------------------------------------------------------------------
// Journey principal: un usuario que busca, se autentica, crea, consulta,
// actualiza y elimina una reserva. Representa el flujo de mayor valor de
// negocio de la API, no una única llamada aislada.
// ---------------------------------------------------------------------------
export default function () {
  group('01_health_check', () => {
    const res = http.get(`${BASE_URL}/ping`, { tags: { step: 'health_check' } });
    check(res, { 'ping: status 201': (r) => r.status === 201 });
  });
  think();

  group('02_search_bookings', () => {
    const res = http.get(`${BASE_URL}/booking?firstname=${randomItem(FIRST_NAMES)}`, {
      tags: { step: 'search_bookings' },
    });
    check(res, { 'search: status 200': (r) => r.status === 200 });
  });
  think();

  let token = null;
  group('03_auth', () => {
    const res = http.post(
      `${BASE_URL}/auth`,
      JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
      { headers: JSON_HEADERS, tags: { step: 'auth' } }
    );
    const ok = check(res, {
      'auth: status 200': (r) => r.status === 200,
      'auth: token presente': (r) => {
        try {
          return typeof r.json('token') === 'string';
        } catch (e) {
          return false;
        }
      },
    });
    if (ok) token = res.json('token');
  });
  think();

  let bookingId = null;
  group('04_create_booking', () => {
    const res = http.post(`${BASE_URL}/booking`, buildBookingPayload(), {
      headers: JSON_HEADERS,
      tags: { step: 'create_booking' },
    });
    const ok = check(res, {
      'create: status 200': (r) => r.status === 200,
      'create: bookingid numérico': (r) => {
        try {
          return typeof r.json('bookingid') === 'number';
        } catch (e) {
          return false;
        }
      },
    });
    if (ok) bookingId = res.json('bookingid');
  });
  think();

  if (bookingId === null) {
    // Sin id no podemos continuar el flujo dependiente; ya quedó registrado como fallo arriba.
    return;
  }

  group('05_get_booking_detail', () => {
    // Importante: la API hace content negotiation estricto sobre el header Accept
    // (switch exacto en helpers/parser.js) y responde 418 si no reconoce el valor,
    // a diferencia de curl que manda "Accept: */*" por defecto. k6 no manda Accept
    // por defecto, así que hay que fijarlo explícitamente.
    const res = http.get(`${BASE_URL}/booking/${bookingId}`, {
      headers: { Accept: 'application/json' },
      tags: { step: 'get_booking' },
    });
    check(res, { 'get: status 200': (r) => r.status === 200 });
  });
  think();

  if (token) {
    group('06_update_booking', () => {
      const res = http.put(`${BASE_URL}/booking/${bookingId}`, buildBookingPayload(), {
        headers: { ...JSON_HEADERS, Cookie: `token=${token}` },
        tags: { step: 'update_booking' },
      });
      check(res, { 'update: status 200': (r) => r.status === 200 });
    });
    think();

    group('07_delete_booking', () => {
      const res = http.del(`${BASE_URL}/booking/${bookingId}`, null, {
        headers: { Cookie: `token=${token}` },
        tags: { step: 'delete_booking' },
      });
      check(res, { 'delete: status 201': (r) => r.status === 201 });
    });
  }
}
