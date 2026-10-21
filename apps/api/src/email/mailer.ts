/** Injection token for the transport; `EmailService` is the only place that composes messages. */
export const MAILER = Symbol('MAILER');

/** An inline image: the HTML refers to it as `cid:<cid>`, so nothing is fetched from the web. */
export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
  cid: string;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
};

export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}
