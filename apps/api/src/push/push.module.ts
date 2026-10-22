import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PushController } from './push.controller.js';
import { PushListener } from './push.listener.js';
import { PUSH_SENDER, type PushSender, WebPushSender } from './push.sender.js';
import { PushService } from './push.service.js';

@Module({
  controllers: [PushController],
  providers: [
    PushService,
    PushListener,
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): PushSender | null => {
        const publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
        const privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true });
        const subject = config.get('VAPID_SUBJECT', { infer: true });
        if (publicKey && privateKey && subject) {
          return new WebPushSender({ publicKey, privateKey, subject });
        }
        new Logger('PushModule').log('No VAPID keys: push notifications are switched off');
        return null;
      },
    },
  ],
  exports: [PushService],
})
export class PushModule {}
