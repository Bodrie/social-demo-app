import { JwtService } from '@nestjs/jwt';
import { AccessTokensService } from './access-tokens.service.js';
import { accessTokenJwtOptions } from './tokens.module.js';

const SECRET = 'unit-test-secret-unit-test-secret-unit-test';
const USER_ID = '01a13ed6-d3ec-71cb-b39f-fbc256a293b9';

describe('AccessTokensService', () => {
  const tokens = new AccessTokensService(new JwtService(accessTokenJwtOptions(SECRET, 60)));

  it('verifies what it signs', async () => {
    const token = await tokens.sign({ sub: USER_ID, ev: true, role: 'admin', sid: USER_ID });
    const payload = await tokens.verify(token);
    expect(payload).toMatchObject({ sub: USER_ID, ev: true, role: 'admin', sid: USER_ID });
    expect(payload?.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('refuses another issuer, another secret, another algorithm and expired tokens', async () => {
    const claims = { sub: USER_ID, ev: true, role: 'member' };
    const otherIssuer = new JwtService({ ...accessTokenJwtOptions(SECRET, 60), signOptions: {} });
    const otherSecret = new JwtService(accessTokenJwtOptions(`${SECRET}-other`, 60));
    const hs512 = new JwtService({
      secret: SECRET,
      signOptions: { algorithm: 'HS512', issuer: 'beso' },
    });
    const expired = new JwtService(accessTokenJwtOptions(SECRET, -10));

    const foreign = await Promise.all(
      [otherIssuer, otherSecret, hs512, expired].map((jwt) => jwt.signAsync(claims)),
    );
    const verified = await Promise.all(foreign.map((token) => tokens.verify(token)));
    expect(verified).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('refuses a correctly signed token whose claims have the wrong shape', async () => {
    const jwt = new JwtService(accessTokenJwtOptions(SECRET, 60));
    await expect(tokens.verify(await jwt.signAsync({ role: 'admin' }))).resolves.toBeUndefined();
    await expect(
      tokens.verify(await jwt.signAsync({ sub: 'not-a-uuid' })),
    ).resolves.toBeUndefined();
    await expect(tokens.verify('garbage')).resolves.toBeUndefined();
  });
});
