import { type PushConfig, type PushSubscriptionInput, pushConfigSchema } from '@beso/shared';
import { api } from './client';

export const fetchPushConfig = (signal?: AbortSignal): Promise<PushConfig> =>
  api.get('/push/config', pushConfigSchema, { signal });

export const savePushSubscription = (subscription: PushSubscriptionInput): Promise<void> =>
  api.put('/push/subscriptions', subscription);

export const removePushSubscription = (endpoint: string): Promise<void> =>
  api.delete('/push/subscriptions', { body: { endpoint } });
