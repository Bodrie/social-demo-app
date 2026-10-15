import { HttpResponse, http } from 'msw/http';
import { API, unauthorized } from './auth';
import { mockDb, paginate } from './db';

export const activityHandlers = [
  http.get(`${API}/activities`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    return HttpResponse.json(paginate(mockDb.activities, new URL(request.url)));
  }),
];
