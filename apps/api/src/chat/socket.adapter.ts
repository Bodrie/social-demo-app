import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import { originAllowed } from '../common/origin-check.js';

/**
 * socket.io on the same HTTP server, with the CORS allow-list from the environment. The
 * handshake also refuses foreign origins outright: CORS alone does not stop a WebSocket
 * upgrade, and the cookie session must not be usable from someone else's page.
 */
export class AppSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    // socket.io types every option as required although all have defaults;
    // Nest passes `undefined` here, so the merged object must be asserted.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const merged = {
      ...options,
      cors: { origin: this.origins, credentials: true },
      allowRequest: (req, callback) => {
        const ok = originAllowed(req.headers.origin, this.origins, req.headers.host);
        callback(ok ? null : 'Origin not allowed', ok);
      },
    } as ServerOptions;
    return super.createIOServer(port, merged);
  }
}
