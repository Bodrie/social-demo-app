import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w.-]{1,128}$/;

/**
 * pino-http `genReqId`: reuse a well-formed incoming X-Request-Id (so a proxy
 * or the web app can correlate), otherwise mint one. Always echoed back.
 */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = candidate !== undefined && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}
