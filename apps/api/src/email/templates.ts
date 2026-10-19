export type EmailContent = { subject: string; text: string; html: string };

const BRAND = 'The Mesh';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** One plain layout for every message: no images, no tracking, readable in any client. */
function layout(title: string, paragraphs: string[], link?: { label: string; href: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${p}</p>`).join('');
  const button = link
    ? `<p style="margin:24px 0"><a href="${escapeHtml(link.href)}" style="display:inline-block;background:#1d6fb8;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escapeHtml(link.label)}</a></p>`
    : '';
  const fallback = link
    ? `<p style="margin:0 0 16px;color:#5b6472;font-size:13px">If the button does not work, copy this address into your browser:<br><a href="${escapeHtml(link.href)}" style="color:#1d6fb8;word-break:break-all">${escapeHtml(link.href)}</a></p>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f4f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2330;font-size:16px;line-height:1.5"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><p style="margin:0 0 24px;font-weight:700;font-size:18px;color:#1d6fb8">${BRAND}</p><div style="background:#ffffff;border-radius:14px;padding:28px 24px;border:1px solid #e3e7ee"><h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>${body}${button}${fallback}</div><p style="margin:24px 0 0;color:#8a93a1;font-size:12px">You received this email because an account on ${BRAND} uses this address. If that was not you, you can ignore it.</p></div></body></html>`;
}

export function verificationEmail(input: {
  name: string;
  link: string;
  hours: number;
}): EmailContent {
  const name = escapeHtml(input.name);
  return {
    subject: `Confirm your email address for ${BRAND}`,
    text: [
      `Hi ${input.name},`,
      '',
      `Welcome to ${BRAND}. Confirm your email address to start using your account:`,
      input.link,
      '',
      `The link works for ${input.hours} hours. If you did not create an account, ignore this email.`,
    ].join('\n'),
    html: layout(
      'Confirm your email address',
      [
        `Hi ${name},`,
        `Welcome to ${BRAND}. One click and your account is ready.`,
        `The link works for ${input.hours} hours. If you did not create an account, ignore this email.`,
      ],
      { label: 'Confirm email address', href: input.link },
    ),
  };
}

export function passwordResetEmail(input: {
  name: string;
  link: string;
  minutes: number;
}): EmailContent {
  const name = escapeHtml(input.name);
  return {
    subject: `Reset your ${BRAND} password`,
    text: [
      `Hi ${input.name},`,
      '',
      `Someone asked to reset the password of your ${BRAND} account. If that was you, choose a new one here:`,
      input.link,
      '',
      `The link works for ${input.minutes} minutes and only once. If you did not ask for this, ignore this email; your password stays as it is.`,
    ].join('\n'),
    html: layout(
      'Reset your password',
      [
        `Hi ${name},`,
        `Someone asked to reset the password of your ${BRAND} account. If that was you, choose a new one with the button below.`,
        `The link works for ${input.minutes} minutes and only once. If you did not ask for this, ignore this email; your password stays as it is.`,
      ],
      { label: 'Choose a new password', href: input.link },
    ),
  };
}

/** A notice, not a link to act on unless the change was not the owner's own. */
export function passwordChangedEmail(input: { name: string; link: string }): EmailContent {
  const name = escapeHtml(input.name);
  return {
    subject: `Your ${BRAND} password was changed`,
    text: [
      `Hi ${input.name},`,
      '',
      `The password of your ${BRAND} account was just changed. If that was you, there is nothing to do.`,
      '',
      `If it was not you, choose a new password right away; that also signs out every other device:`,
      input.link,
    ].join('\n'),
    html: layout(
      'Your password was changed',
      [
        `Hi ${name},`,
        `The password of your ${BRAND} account was just changed. If that was you, there is nothing to do.`,
        `If it was not you, choose a new password right away; that also signs out every other device.`,
      ],
      { label: 'Choose a new password', href: input.link },
    ),
  };
}

/** The last mail an account gets: confirmation that it, and everything it published, is gone. */
export function accountDeletedEmail(input: { name: string }): EmailContent {
  const name = escapeHtml(input.name);
  return {
    subject: `Your ${BRAND} account was deleted`,
    text: [
      `Hi ${input.name},`,
      '',
      `Your ${BRAND} account was deleted, as you asked. Your posts, comments, messages and pictures are gone with it; backups are kept for 14 days and then it is gone from them too.`,
      '',
      `If this was not you, reply to this email right away. Otherwise there is nothing to do, and thank you for having been part of ${BRAND}.`,
    ].join('\n'),
    html: layout('Your account was deleted', [
      `Hi ${name},`,
      `Your ${BRAND} account was deleted, as you asked. Your posts, comments, messages and pictures are gone with it; backups are kept for 14 days and then it is gone from them too.`,
      `If this was not you, reply to this email right away. Otherwise there is nothing to do, and thank you for having been part of ${BRAND}.`,
    ]),
  };
}
