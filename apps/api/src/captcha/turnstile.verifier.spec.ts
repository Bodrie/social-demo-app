import { CaptchaUnavailableError } from './captcha.js';
import { TURNSTILE_VERIFY_URL, TurnstileVerifier } from './turnstile.verifier.js';

const answer = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('TurnstileVerifier', () => {
  it('posts the secret, the token and the address, and trusts a success answer', async () => {
    const fetchImpl = answer({ success: true });
    const verifier = new TurnstileVerifier('secret-1', fetchImpl);

    expect(await verifier.verify('tok', '203.0.113.9')).toBe(true);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    const sent = init?.body as URLSearchParams;
    expect(sent.get('secret')).toBe('secret-1');
    expect(sent.get('response')).toBe('tok');
    expect(sent.get('remoteip')).toBe('203.0.113.9');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('is false for a rejected token and for a missing one, without asking', async () => {
    const fetchImpl = answer({ success: false, 'error-codes': ['invalid-input-response'] });
    const verifier = new TurnstileVerifier('secret-1', fetchImpl);

    expect(await verifier.verify('bad', undefined)).toBe(false);
    expect(await verifier.verify(undefined, undefined)).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports the check as unavailable on network trouble, bad statuses and odd bodies', async () => {
    const down = new TurnstileVerifier(
      's',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')),
    );
    await expect(down.verify('tok', undefined)).rejects.toBeInstanceOf(CaptchaUnavailableError);

    const broken = new TurnstileVerifier('s', answer({ error: 'nope' }, 500));
    await expect(broken.verify('tok', undefined)).rejects.toBeInstanceOf(CaptchaUnavailableError);

    const odd = new TurnstileVerifier('s', answer({ nothing: true }));
    await expect(odd.verify('tok', undefined)).rejects.toBeInstanceOf(CaptchaUnavailableError);
  });
});
