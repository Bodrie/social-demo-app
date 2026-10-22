import { Injectable } from '@nestjs/common';
import webpush from 'web-push';

/** Where one browser receives push: its endpoint at the push service and its keys. */
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type PushOptions = {
  /** How long the push service keeps it for a device that is offline. */
  ttlSeconds: number;
  urgency: 'very-low' | 'low' | 'normal' | 'high';
  /** A newer push with the same topic replaces one still waiting at the push service. */
  topic?: string;
};

/** `gone`: the push service no longer knows the subscription (404, 410); drop it. */
export type PushResult = 'sent' | 'gone';

/** Delivers one encrypted push; any other failure throws. Swapped for a fake in tests. */
export interface PushSender {
  send(target: PushTarget, payload: string, options: PushOptions): Promise<PushResult>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');

export type VapidDetails = { subject: string; publicKey: string; privateKey: string };

/** The real thing: `web-push` encrypts the payload (RFC 8291) and signs with VAPID (RFC 8292). */
@Injectable()
export class WebPushSender implements PushSender {
  constructor(private readonly vapid: VapidDetails) {}

  async send(target: PushTarget, payload: string, options: PushOptions): Promise<PushResult> {
    try {
      await webpush.sendNotification(target, payload, {
        vapidDetails: this.vapid,
        TTL: options.ttlSeconds,
        urgency: options.urgency,
        ...(options.topic ? { topic: options.topic } : {}),
        timeout: 10_000,
      });
      return 'sent';
    } catch (error) {
      if (
        error instanceof webpush.WebPushError &&
        (error.statusCode === 404 || error.statusCode === 410)
      ) {
        return 'gone';
      }
      throw error;
    }
  }
}
