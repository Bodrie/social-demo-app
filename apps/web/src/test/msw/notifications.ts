import { HttpResponse, http } from 'msw/http';
import { API, unauthorized } from './auth';
import { mockDb, paginate } from './db';

export const notificationHandlers = [
  http.get(`${API}/notifications/unread-count`, () => {
    if (!mockDb.user) return unauthorized();
    const count = mockDb.notifications.filter((n) => n.readAt === null).length;
    return HttpResponse.json({ count });
  }),
  http.get(`${API}/notifications`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    return HttpResponse.json(paginate(mockDb.notifications, new URL(request.url)));
  }),
  http.post(`${API}/notifications/read`, () => {
    if (!mockDb.user) return unauthorized();
    mockDb.calls.notificationsRead += 1;
    const now = new Date().toISOString();
    for (const notification of mockDb.notifications) notification.readAt ??= now;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API}/notifications/:id/read`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const notification = mockDb.notifications.find((n) => n.id === params.id);
    if (!notification) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    notification.readAt ??= new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),
];
