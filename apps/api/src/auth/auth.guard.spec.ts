import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard, extractAccessToken } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

const jwt = new JwtService({
  secret: 'unit-test-secret-unit-test-secret-unit-test',
  signOptions: { expiresIn: 60 },
});

function contextFor(request: Partial<AuthenticatedRequest>, isPublic = false): ExecutionContext {
  const handler = () => undefined;
  const reflector = new Reflector();
  if (isPublic) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => AuthGuard,
    switchToHttp: () => ({ getRequest: () => request }),
    reflector,
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard(jwt, new Reflector());

  it('ignores non-HTTP contexts (sockets are authenticated at handshake)', async () => {
    const context = { getType: () => 'ws' } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets @Public() routes through without a token', async () => {
    await expect(guard.canActivate(contextFor({ headers: {}, cookies: {} }, true))).resolves.toBe(
      true,
    );
  });

  it('attaches the user id from a valid cookie token', async () => {
    const token = await jwt.signAsync({ sub: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9' });
    const request: Partial<AuthenticatedRequest> = {
      headers: {},
      cookies: { access_token: token },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9' });
  });

  it('rejects a correctly signed token without a usable subject', async () => {
    const token = await jwt.signAsync({ role: 'admin' });
    await expect(
      guard.canActivate(contextFor({ headers: {}, cookies: { access_token: token } })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects missing and tampered tokens', async () => {
    await expect(guard.canActivate(contextFor({ headers: {}, cookies: {} }))).rejects.toMatchObject(
      { status: 401 },
    );
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer nope' }, cookies: {} })),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('extractAccessToken', () => {
  it('prefers the cookie, then the bearer header', () => {
    expect(
      extractAccessToken({
        cookies: { access_token: 'c' },
        headers: { authorization: 'Bearer h' },
      } as never),
    ).toBe('c');
    expect(
      extractAccessToken({ cookies: {}, headers: { authorization: 'Bearer h' } } as never),
    ).toBe('h');
    expect(
      extractAccessToken({ cookies: {}, headers: { authorization: 'Basic x' } } as never),
    ).toBeUndefined();
    expect(extractAccessToken({ cookies: undefined, headers: {} } as never)).toBeUndefined();
  });
});
