/** Injection token; `AuthService.register` is the only caller. */
export const CAPTCHA = Symbol('CAPTCHA');

/**
 * Answers whether a registration came from a person. `verify` resolves false for a missing or
 * rejected token and throws `CaptchaUnavailableError` when the check itself cannot be done,
 * which refuses the registration rather than waving it through.
 */
export interface CaptchaVerifier {
  verify(token: string | undefined, ip: string | undefined): Promise<boolean>;
}

export class CaptchaUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CaptchaUnavailableError';
  }
}
