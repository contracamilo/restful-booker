// Smoke test 2 — RQ4 / Riesgo R2: prevención de reservas solapadas
// Documenta si el sistema rechaza una segunda reserva con las mismas fechas.
// Las aserciones reflejan el comportamiento ESPERADO (control de solapamiento).
// Si fallan, es evidencia reproducible del defecto R2 documentado en MASTER_PLAN.md.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

function bookingPayload(firstname) {
  return JSON.stringify({
    firstname,
    lastname: 'Overlap',
    totalprice: 200,
    depositpaid: true,
    bookingdates: {
      checkin: '2026-10-01',
      checkout: '2026-10-05',
    },
    additionalneeds: 'None',
  });
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  const first = http.post(`${BASE_URL}/booking`, bookingPayload('Guest1'), { headers });
  check(first, {
    'first booking created (200)': (r) => r.status === 200,
  });

  const second = http.post(`${BASE_URL}/booking`, bookingPayload('Guest2'), { headers });

  // Comportamiento esperado (control de solapamiento): debería rechazarse.
  // Comportamiento real observado hoy: la API acepta ambas reservas (defecto R2).
  check(second, {
    'DEFECT R2 - overlapping booking should be rejected': (r) => r.status >= 400,
  });

  check({ first, second }, {
    'DEFECT R2 - both bookings should not have distinct ids for same dates': () =>
      !(first.json('bookingid') && second.json('bookingid') &&
        first.json('bookingid') !== second.json('bookingid')),
  });
}
