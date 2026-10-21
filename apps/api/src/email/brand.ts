import { LOGO_PNG } from './logo-png.js';
import type { EmailAttachment } from './mailer.js';

/** The accent of the mark; the mails' buttons and links use the same blue. */
export const BRAND_COLOR = '#006aaf';

/** What the layout's `<img>` refers to: `cid:` + this. */
export const MARK_CID = 'beso-mark';

/** The CSS size the layout shows the logo at. */
export const MARK_SIZE = { width: LOGO_PNG.width, height: LOGO_PNG.height };

/**
 * The logo (mark + wordmark) as an inline PNG (generated into `logo-png.ts` by `pnpm brand`).
 * Inline rather than hosted: a `cid:` image shows without a fetch, so clients that block
 * remote images still show it and nothing can be tracked through it.
 */
export function markAttachment(): EmailAttachment {
  return {
    filename: 'beso.png',
    contentType: 'image/png',
    content: Buffer.from(LOGO_PNG.base64, 'base64'),
    cid: MARK_CID,
  };
}
