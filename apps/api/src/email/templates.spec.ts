import { MARK_CID, markAttachment } from './brand.js';
import { accountDeletedEmail, escapeHtml, verificationEmail } from './templates.js';

describe('email templates', () => {
  it('shows the logo from the inline attachment, with the name as its alt text', () => {
    const mail = verificationEmail({ name: 'Alice', link: 'https://x.test/v?token=t', hours: 24 });
    expect(mail.html).toContain(`<img src="cid:${MARK_CID}"`);
    expect(mail.html).toContain('alt="BeSo"');
    expect(mail.html).toContain('href="https://x.test/v?token=t"');
    expect(mail.text).toContain('https://x.test/v?token=t');
  });

  it('escapes what the member typed, in every template', () => {
    const name = 'A <b>bold</b> "name"';
    expect(verificationEmail({ name, link: 'https://x.test', hours: 1 }).html).toContain(
      escapeHtml(name),
    );
    expect(accountDeletedEmail({ name }).html).not.toContain('<b>bold</b>');
    expect(accountDeletedEmail({ name }).text).toContain(name);
  });

  it('attaches the logo as a real PNG under the cid the layout refers to', () => {
    const attachment = markAttachment();
    expect(attachment).toMatchObject({ cid: MARK_CID, contentType: 'image/png' });
    expect(attachment.content.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(attachment.content.length).toBeLessThan(24 * 1024);
  });
});
