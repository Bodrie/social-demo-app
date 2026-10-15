import { API_BASE_PATH } from '@the-mesh/shared';

/** Nest's global prefix form of the shared base path ("api/v1"). */
export const API_PREFIX = API_BASE_PATH.replace(/^\//, '');
