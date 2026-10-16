import type { ClientToServerEvents, ServerToClientEvents } from '@the-mesh/shared';
import { type Socket, io } from 'socket.io-client';
import { API_ORIGIN } from './env';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// `closeOnBeforeunload`: a reload or navigation away says goodbye, so the server does not
// count the dead socket against MAX_SOCKETS_PER_USER until its ping times out (~45 s).
const options = {
  path: '/socket.io',
  withCredentials: true,
  autoConnect: false,
  closeOnBeforeunload: true,
} as const;

let socket: ChatSocket | null = null;

/**
 * One socket per tab, created lazily and never connected on its own: the ChatProvider
 * connects it while a session exists and disconnects it on sign-out. Authentication is
 * the access cookie, which the browser sends with the handshake (same origin via the
 * dev proxy, `withCredentials` otherwise).
 */
export function getChatSocket(): ChatSocket {
  socket ??= API_ORIGIN ? io(API_ORIGIN, options) : io(options);
  return socket;
}
