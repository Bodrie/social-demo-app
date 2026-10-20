import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { OutboxEntry } from '../../src/email/outbox.mailer.js';

/** Every mail the app wrote in this test file, oldest first (the outbox dir is per file). */
export async function readOutbox(): Promise<OutboxEntry[]> {
  const dir = process.env.EMAIL_OUTBOX_DIR;
  if (!dir) throw new Error('EMAIL_OUTBOX_DIR is not set');
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.json'));
  const entries = await Promise.all(
    files.toSorted().map(async (file) => {
      const text = await readFile(path.join(dir, file), 'utf8');
      return JSON.parse(text) as OutboxEntry;
    }),
  );
  return entries;
}

/** Waits for a mail to `to` whose subject matches, since some sends are not awaited by the API. */
export async function waitForEmail(
  to: string,
  subject: RegExp,
  timeoutMs = 5000,
): Promise<OutboxEntry> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- polling on purpose
    const match = (await readOutbox()).findLast((e) => e.to === to && subject.test(e.subject));
    if (match) return match;
    if (Date.now() > deadline) throw new Error(`No email to ${to} matching ${subject}`);
    // oxlint-disable-next-line no-await-in-loop -- polling on purpose
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Waits until `count` mails to `to` match and returns all of them, oldest first. */
export async function waitForEmails(
  to: string,
  subject: RegExp,
  count: number,
  timeoutMs = 5000,
): Promise<OutboxEntry[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- polling on purpose
    const matches = (await readOutbox()).filter((e) => e.to === to && subject.test(e.subject));
    if (matches.length >= count) return matches;
    if (Date.now() > deadline) {
      throw new Error(`Only ${matches.length} of ${count} emails to ${to} matching ${subject}`);
    }
    // oxlint-disable-next-line no-await-in-loop -- polling on purpose
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** The `token=` query value of the first link in the mail. */
export function tokenIn(email: OutboxEntry): string {
  const match = /[?&]token=([A-Za-z0-9_%-]+)/.exec(email.text);
  if (!match?.[1]) throw new Error(`No token link in: ${email.subject}`);
  return decodeURIComponent(match[1]);
}
