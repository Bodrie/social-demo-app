import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { authenticateSocket, handshakeToken, parseCookies } from './handshake.js';

const jwt = new JwtService({
  secret: 'unit-test-secret-unit-test-secret-unit-test',
  signOptions: { expiresIn: 60 },
});

function socketWith(headers: Record<string, string>, auth: Record<string, unknown> = {}): Socket {
  return { handshake: { headers, auth } } as unknown as Socket;
}

describe('parseCookies', () => {
  it('parses and decodes a cookie header', () => {
    expect(parseCookies('a=1; access_token=x%2Ey; empty=')).toEqual({
      a: '1',
      access_token: 'x.y',
      empty: '',
    });
    expect(parseCookies(undefined)).toEqual({});
  });
});

describe('handshakeToken', () => {
  it('prefers the cookie and falls back to auth.token', () => {
    expect(handshakeToken(socketWith({ cookie: 'access_token=c' }, { token: 'h' }))).toBe('c');
    expect(handshakeToken(socketWith({}, { token: 'h' }))).toBe('h');
    expect(handshakeToken(socketWith({}, { token: 42 }))).toBeUndefined();
  });
});

describe('authenticateSocket', () => {
  it('resolves the user id for a valid token and refuses anything else', async () => {
    const token = await jwt.signAsync({ sub: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9' });
    const session = await authenticateSocket(socketWith({}, { token }), jwt);
    expect(session?.userId).toBe('01a13ed6-d3ec-71cb-b39f-fbc256a293b9');
    expect(session?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    const noSub = await jwt.signAsync({ role: 'admin' });
    await expect(
      authenticateSocket(socketWith({}, { token: noSub }), jwt),
    ).resolves.toBeUndefined();
    await expect(
      authenticateSocket(socketWith({}, { token: 'nope' }), jwt),
    ).resolves.toBeUndefined();
    await expect(authenticateSocket(socketWith({}), jwt)).resolves.toBeUndefined();
  });
});
