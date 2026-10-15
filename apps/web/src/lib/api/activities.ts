import { type ActivityList, activityListSchema } from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchActivities = ({ cursor, signal }: PageOptions): Promise<ActivityList> =>
  api.get(`/activities${queryString({ cursor })}`, activityListSchema, { signal });
