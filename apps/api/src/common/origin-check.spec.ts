import { originAllowed, originCheck } from './origin-check.js';

const ALLOWED = ['http://localhost:5173', 'https://app.example.com'];

describe('originAllowed', () => {
  it('accepts the configured origins, ignoring case and trailing slashes', () => {
    expect(originAllowed('http://localhost:5173', ALLOWED, 'api.example.com')).toBe(true);
    expect(originAllowed('HTTPS://App.Example.com/', ALLOWED, 'api.example.com')).toBe(true);
  });

  it('accepts the API host itself on either scheme (Swagger UI, single origin behind Caddy)', () => {
    expect(originAllowed('http://localhost:3000', ALLOWED, 'localhost:3000')).toBe(true);
    expect(originAllowed('https://mesh.example.com', ALLOWED, 'mesh.example.com')).toBe(true);
    expect(originAllowed('https://mesh.example.com', ALLOWED, 'other.example.com')).toBe(false);
  });

  it('lets requests without an Origin through and refuses foreign or null origins', () => {
    expect(originAllowed(undefined, ALLOWED, 'api.example.com')).toBe(true);
    expect(originAllowed('https://evil.example', ALLOWED, 'api.example.com')).toBe(false);
    expect(originAllowed('null', ALLOWED, 'api.example.com')).toBe(false);
    expect(originAllowed('https://app.example.com.evil.example', ALLOWED, 'x')).toBe(false);
  });
});

describe('originCheck middleware', () => {
  type Req = { method: string; headers: Record<string, string> };
  const run = (req: Req) => {
    const result: { status?: number; body?: unknown; next: boolean } = { next: false };
    const res = {
      status(code: number) {
        result.status = code;
        return this;
      },
      json(body: unknown) {
        result.body = body;
      },
    };
    originCheck(ALLOWED)(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the middleware only reads `method` and headers
      { ...req, get: (name: string) => req.headers[name.toLowerCase()] } as never,
      res as never,
      () => {
        result.next = true;
      },
    );
    return result;
  };

  it('ignores safe methods whatever the origin', () => {
    expect(run({ method: 'GET', headers: { origin: 'https://evil.example' } }).next).toBe(true);
    expect(run({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }).next).toBe(true);
  });

  it('refuses a state-changing request from an unknown origin with the error envelope', () => {
    const result = run({
      method: 'POST',
      headers: { origin: 'https://evil.example', host: 'api.example.com' },
    });
    expect(result.next).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Cross-origin request refused',
    });
  });

  it('passes state-changing requests from the web app or from non-browser clients', () => {
    expect(
      run({ method: 'POST', headers: { origin: 'http://localhost:5173', host: 'localhost:3000' } })
        .next,
    ).toBe(true);
    expect(run({ method: 'DELETE', headers: { host: 'localhost:3000' } }).next).toBe(true);
  });
});
