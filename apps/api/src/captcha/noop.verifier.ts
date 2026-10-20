import type { CaptchaVerifier } from './captcha.js';

/** No secret configured (development, tests): everyone is a person. */
export class NoopVerifier implements CaptchaVerifier {
  verify(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
