import { z } from 'zod';
import { type CaptchaVerifier, CaptchaUnavailableError } from './captcha.js';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TIMEOUT_MS = 2_000;

const outcomeSchema = z.object({ success: z.boolean() });

/**
 * Cloudflare Turnstile: the browser widget hands the form a token, this asks Cloudflare whether
 * that token was issued to a person, tied to the client's address. Each token works once.
 */
export class TurnstileVerifier implements CaptchaVerifier {
  constructor(
    private readonly secret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(token: string | undefined, ip: string | undefined): Promise<boolean> {
    if (!token) return false;
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (ip) body.set('remoteip', ip);
    let response: Response;
    try {
      response = await this.fetchImpl(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      });
    } catch (error) {
      throw new CaptchaUnavailableError('Turnstile did not answer', { cause: error });
    }
    if (!response.ok) {
      throw new CaptchaUnavailableError(`Turnstile answered ${response.status}`);
    }
    const parsed = outcomeSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success)
      throw new CaptchaUnavailableError('Turnstile answered something unexpected');
    return parsed.data.success;
  }
}
