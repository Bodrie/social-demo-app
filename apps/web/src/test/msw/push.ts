import { pushEndpointSchema, pushSubscriptionSchema } from '@beso/shared';
import { HttpResponse, http } from 'msw/http';
import { API, apiError, unauthorized } from './auth';
import { mockDb } from './db';

export const pushHandlers = [
  http.get(`${API}/push/config`, () => {
    if (!mockDb.user) return unauthorized();
    return HttpResponse.json({ publicKey: mockDb.pushPublicKey });
  }),
  http.put(`${API}/push/subscriptions`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    if (!mockDb.pushPublicKey) return apiError(503, 'SERVICE_UNAVAILABLE', 'Push is off');
    const parsed = pushSubscriptionSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, 'VALIDATION_ERROR', 'Validation failed');
    if (!mockDb.pushEndpoints.includes(parsed.data.endpoint)) {
      mockDb.pushEndpoints.push(parsed.data.endpoint);
    }
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(`${API}/push/subscriptions`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const { endpoint } = pushEndpointSchema.parse(await request.json());
    mockDb.pushEndpoints = mockDb.pushEndpoints.filter((item) => item !== endpoint);
    return new HttpResponse(null, { status: 204 });
  }),
];
