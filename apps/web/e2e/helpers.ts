import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { type Browser, type BrowserContext, type Page, expect } from '@playwright/test';

/** The seeded accounts (see apps/api/prisma/seed.ts); every one has the same password. */
export const PASSWORD = 'Password123!';
export const USERS = {
  alice: {
    username: 'alice',
    email: 'alice@example.com',
    name: 'Alice Anderson',
    password: PASSWORD,
  },
  bob: { username: 'bob', email: 'bob@example.com', name: 'Bob Brown', password: PASSWORD },
  carol: { username: 'carol', email: 'carol@example.com', name: 'Carol Clark', password: PASSWORD },
} as const;
export type SeededUser = keyof typeof USERS;

export const ALICE = { ...USERS.alice, name: 'Alice' };

/** Written by auth.setup.ts; the `chromium` project starts every test as alice. */
export const stateFor = (user: SeededUser): string =>
  path.join(import.meta.dirname, '.auth', `${user}.json`);
export const STORAGE_STATE = stateFor('alice');

/** Where the API (started by playwright.config.ts with the outbox transport) writes every mail. */
export const OUTBOX_DIR = path.join(import.meta.dirname, '.outbox');

type OutboxEntry = { to: string; subject: string; text: string };

async function readOutbox(): Promise<OutboxEntry[]> {
  const files = (await readdir(OUTBOX_DIR).catch(() => [] as string[]))
    .filter((file) => file.endsWith('.json'))
    .toSorted();
  return Promise.all(
    files.map(async (file) => JSON.parse(await readFile(path.join(OUTBOX_DIR, file), 'utf8'))),
  );
}

/** The newest mail to `to` whose subject matches (waits for it, some sends are not awaited). */
export async function latestEmail(to: string, subject: RegExp): Promise<OutboxEntry> {
  await expect
    .poll(
      async () => (await readOutbox()).some((mail) => mail.to === to && subject.test(mail.subject)),
      { timeout: 10_000 },
    )
    .toBe(true);
  const mails = (await readOutbox()).filter((mail) => mail.to === to && subject.test(mail.subject));
  const mail = mails.at(-1);
  if (!mail) throw new Error(`No email to ${to}`);
  return mail;
}

/** The first link in the mail that leads to `pathname` (e.g. `/verify-email`). */
export function linkIn(mail: OutboxEntry, pathname: string): string {
  const match = new RegExp(
    `https?://\\S+${pathname.replace('/', '\\/')}\\?token=[A-Za-z0-9_%-]+`,
  ).exec(mail.text);
  if (!match) throw new Error(`No ${pathname} link in: ${mail.subject}`);
  return match[0];
}

/** For specs that must start signed out (the auth flows themselves). */
export const ANONYMOUS = { cookies: [], origins: [] };

/** Registers a throwaway member and follows the confirmation link; ends signed in on the feed. */
export async function registerAndConfirm(page: Page) {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const member = {
    username: `pw_${stamp}`,
    name: `Play Wright ${stamp}`,
    email: `pw_${stamp}@example.com`,
  };
  await page.goto('/register');
  await page.getByLabel('Username').fill(member.username);
  await page.getByLabel('Name', { exact: true }).fill(member.name);
  await page.getByLabel('Email').fill(member.email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Closed until the address is confirmed: the waiting room, not the feed.
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/verify-email$/);

  const mail = await latestEmail(member.email, /Confirm your email/);
  await page.goto(linkIn(mail, '/verify-email'));
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('New post')).toBeVisible();
  return member;
}

/** Opens the home feed with the stored session and waits for it. */
export async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByLabel('New post')).toBeVisible();
}

/** A second browser context signed in as another seeded member (no extra login needed). */
export async function contextAs(browser: Browser, user: SeededUser): Promise<BrowserContext> {
  return browser.newContext({ storageState: stateFor(user) });
}

/** Signs in through the UI; only for specs that test the sign-in flow itself. */
export async function signIn(
  page: Page,
  user: { email: string; password: string } = USERS.alice,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('New post')).toBeVisible();
}
