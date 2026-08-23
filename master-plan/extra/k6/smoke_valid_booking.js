// Smoke test 1 — RQ3: creación de una reserva válida
// Ejecutar contra la API local: docker-compose up (localhost:3001)
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

export default function () {
  const payload = JSON.stringify({
    firstname: 'Camilo',
    lastname: 'Rivera',
    totalprice: 150,
    depositpaid: true,
    bookingdates: {
      checkin: '2026-09-01',
      checkout: '2026-09-05',
    },
    additionalneeds: 'Breakfast',
  });

  const res = http.post(`${BASE_URL}/booking`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has bookingid': (r) => typeof r.json('bookingid') === 'number',
    'booking.firstname matches request': (r) => r.json('booking.firstname') === 'Camilo',
    'booking.lastname matches request': (r) => r.json('booking.lastname') === 'Rivera',
    'booking.totalprice matches request': (r) => r.json('booking.totalprice') === 150,
    'booking.bookingdates.checkin matches request': (r) =>
      r.json('booking.bookingdates.checkin') === '2026-09-01',
    'booking.bookingdates.checkout matches request': (r) =>
      r.json('booking.bookingdates.checkout') === '2026-09-05',
  });
}
